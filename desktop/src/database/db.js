const { db, auth } = require('../firebaseConfig.js');
const { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, getDoc, query, orderBy, limit, where, writeBatch } = require('firebase/firestore');
const { signInAnonymously } = require('firebase/auth');
const fs = require('fs');
const path = require('path');

const SONGS_BACKUP_PATH = path.join(__dirname, 'songs.json');
const SCHEDULE_BACKUP_PATH = path.join(__dirname, 'schedule.json');

// Since we are running in Node.js for Electron Main Process, 
// we use the standard Firestore SDK as configured in firebaseConfig.js

let songsCache = [];
let scheduleCache = [];

async function initDb() {
    console.log("Initializing local DB cache...");

    // OFFLINE FIRST: Load local backup immediately before any network/async calls
    try {
        if (fs.existsSync(SONGS_BACKUP_PATH)) {
            const localSongs = JSON.parse(fs.readFileSync(SONGS_BACKUP_PATH, 'utf-8'));
            if (Array.isArray(localSongs) && localSongs.length > 0) {
                songsCache = localSongs;
                console.log(`Loaded ${songsCache.length} songs from local backup (Instant Initial Load)`);
                if (global.broadcastSongsUpdate) global.broadcastSongsUpdate(songsCache);
            }
        }
        if (fs.existsSync(SCHEDULE_BACKUP_PATH)) {
            const localSchedule = JSON.parse(fs.readFileSync(SCHEDULE_BACKUP_PATH, 'utf-8'));
            if (Array.isArray(localSchedule)) {
                scheduleCache = localSchedule;
                console.log(`Loaded schedule from local backup`);
                if (global.broadcastScheduleUpdate) global.broadcastScheduleUpdate(scheduleCache);
            }
        }
    } catch (err) {
        console.error("Failed to load local backup:", err);
    }

    console.log("Connecting to Firestore & Auth...");
    // Authenticate app
    try {
        await signInAnonymously(auth);
        console.log("Authenticated anonymously with Firebase");
    } catch (err) {
        console.error("Firebase Authentication failed:", err);
    }

    // Subscribe to Songs
    const songsQuery = query(collection(db, "songs"), orderBy("id"));
    onSnapshot(songsQuery, (snapshot) => {
        const songs = snapshot.docs.map(d => d.data());
        // Robust Natural Sort (C1, C2, C10 instead of C1, C10, C100)
        songs.sort((a, b) => {
            return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
        });
        songsCache = songs;
        console.log(`Updated Songs Cache: ${songsCache.length} songs`);

        // Save to local backup for offline use
        try {
            fs.writeFileSync(SONGS_BACKUP_PATH, JSON.stringify(songsCache, null, 2));
        } catch (err) {
            console.error("Failed to save local songs backup:", err);
        }

        if (global.broadcastSongsUpdate) {
            global.broadcastSongsUpdate(songsCache);
        }

    }, (error) => {
        console.error("Error watching songs:", error);
    });

    // Subscribe to Schedule (Global 'sunday-service' doc)
    const scheduleRef = doc(db, "schedules", "sunday-service");
    onSnapshot(scheduleRef, (docSnap) => {
        if (docSnap.exists()) {
            scheduleCache = docSnap.data().items || [];
            console.log("Updated Schedule Cache via Firestore");

            // Save to backup
            try {
                fs.writeFileSync(SCHEDULE_BACKUP_PATH, JSON.stringify(scheduleCache, null, 2));
            } catch (err) {
                console.error("Failed to save local schedule backup:", err);
            }

            if (global.broadcastScheduleUpdate) {
                global.broadcastScheduleUpdate(scheduleCache);
            }
        } else {
            // Create if missing
            setDoc(scheduleRef, { items: [] });
            scheduleCache = [];
        }
    });

    return true; // Async init simulation
}

// Search is now local filtering of cache for speed, 
// OR we could do a Firestore query if dataset is huge. 
// For <2000 songs, local filter is faster and instant.
function searchSongs(queryStr, filter = 'All') {
    const q = queryStr.toLowerCase();

    return songsCache.filter(song => {
        if (filter !== 'All' && song.category !== filter) return false;
        if (!q) return true;

        return (song.title && song.title.toLowerCase().includes(q)) ||
            (song.id && song.id.toString().toLowerCase().includes(q)) ||
            (song.lyrics && song.lyrics.toLowerCase().includes(q)) || // If lyrics field exists
            (song.slides && song.slides.some(s => s.toLowerCase().includes(q)));
    }).slice(0, 2000);
}

function getSong(id) {
    return songsCache.find(s => s.id === id);
}

function getSchedule() {
    return scheduleCache;
}

async function addSong(songData) {
    // Firestore set
    await setDoc(doc(db, "songs", songData.id), songData);
    // Cache updates automatically via listener
    return songData;
}

async function updateSong(songData) {
    await setDoc(doc(db, "songs", songData.id), songData, { merge: true });
}

async function getNextId(category) {
    // Determine prefix
    let prefix = '';
    if (category === 'English Choruses') prefix = 'C';
    else if (category === 'English Hymns') prefix = 'H';
    else if (category === 'Telugu Songs') prefix = 'T';
    else if (category === 'Hindi Songs') prefix = 'HI';
    else prefix = 'S';

    // Filter cache for this prefix
    const existingIds = songsCache
        .map(s => s.id)
        .filter(id => id.startsWith(prefix))
        .map(id => parseInt(id.replace(prefix, '')))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);

    let nextNum = 1;
    if (existingIds.length > 0) {
        nextNum = existingIds[existingIds.length - 1] + 1;
    }

    return `${prefix}${nextNum}`;
}

async function addToSchedule(songId) {
    const song = getSong(songId);
    if (!song) throw new Error('Song not found');

    const newItem = {
        instanceId: Date.now().toString(),
        songId: song.id,
        title: song.title || song.preview,
        category: song.category
    };

    const newSchedule = [...scheduleCache, newItem];

    // Update Firestore
    await setDoc(doc(db, "schedules", "sunday-service"), { items: newSchedule });

    return newSchedule;
}

async function removeFromSchedule(instanceId) {
    const newSchedule = scheduleCache.filter(i => i.instanceId !== instanceId);
    await setDoc(doc(db, "schedules", "sunday-service"), { items: newSchedule });
    return newSchedule;
}

async function reorderSchedule(newSchedule) {
    await setDoc(doc(db, "schedules", "sunday-service"), { items: newSchedule });
    return newSchedule;
}

async function deleteSong(id) {
    // 1. Optimistic UI update: instantly remove deleted song from memory
    songsCache = songsCache.filter(s => s.id !== id);

    const match = id.match(/^([a-zA-Z]+)(\d+)$/);
    if (!match) {
        // Fallback for non-standard IDs, delete and return instantly
        deleteDoc(doc(db, "songs", id)).catch(e => console.error(e));
        return true;
    }

    const prefix = match[1];
    const deletedNum = parseInt(match[2]);

    // 2. Identify songs to shift from the local cache snapshot
    const songsToShift = songsCache
        .filter(s => {
            const m = s.id.match(/^([a-zA-Z]+)(\d+)$/);
            return m && m[1] === prefix && parseInt(m[2]) > deletedNum;
        })
        .sort((a, b) => {
            const numA = parseInt(a.id.match(/\d+/)[0]);
            const numB = parseInt(b.id.match(/\d+/)[0]);
            return numA - numB;
        });

    let currentSchedule = [...scheduleCache];
    let scheduleChanged = false;

    // 3. Setup Firestore WriteBatches (Max 500 ops per batch)
    let batches = [writeBatch(db)];
    let currentBatch = batches[0];
    let opsCount = 1;
    currentBatch.delete(doc(db, "songs", id));

    // 4. Shift them sequentially down
    for (const song of songsToShift) {
        // Firestore limit is 500 writes per batch. 490 is a safe threshold.
        if (opsCount >= 490) {
            currentBatch = writeBatch(db);
            batches.push(currentBatch);
            opsCount = 0;
        }

        const oldId = song.id;
        const currentNum = parseInt(oldId.match(/\d+/)[0]);
        const newId = `${prefix}${currentNum - 1}`;

        // Write the song data to the new decremented ID slot
        const newSongData = { ...song, id: newId };

        // Optimistic UI update: instantly swap slots in memory
        songsCache = songsCache.filter(s => s.id !== oldId);
        songsCache.push(newSongData);

        currentBatch.set(doc(db, "songs", newId), newSongData);
        // Delete the old ID slot
        currentBatch.delete(doc(db, "songs", oldId));
        opsCount += 2;

        // Update any schedule references pointing to this shifted song
        currentSchedule = currentSchedule.map(item => {
            if (item.songId === oldId) {
                scheduleChanged = true;
                return { ...item, songId: newId };
            }
            return item;
        });
    }

    // Sort cache again for UI
    songsCache.sort((a, b) => {
        return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
    });

    // 5. Save the updated schedule if any references were fixed
    if (scheduleChanged) {
        scheduleCache = currentSchedule; // Optimistic
        if (opsCount >= 499) {
            currentBatch = writeBatch(db);
            batches.push(currentBatch);
        }
        currentBatch.set(doc(db, "schedules", "sunday-service"), { items: currentSchedule });
        if (global.broadcastScheduleUpdate) {
            global.broadcastScheduleUpdate(scheduleCache);
        }
    }

    // 6. Fire and Forget the network payload so the UI isn't blocked!
    Promise.all(batches.map(b => b.commit()))
        .then(() => console.log(`Successfully shifted ${songsToShift.length} songs in the background.`))
        .catch(e => console.error("Batch delete/shift error:", e));

    return true;
}

module.exports = {
    initDb,
    searchSongs,
    getSong,
    addSong,
    updateSong,
    deleteSong,
    getNextId,
    getSchedule,
    addToSchedule,
    removeFromSchedule,
    reorderSchedule
};
