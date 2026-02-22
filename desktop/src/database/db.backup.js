const fs = require('fs');
const path = require('path');

let songs = [];
let dbInitialized = false;

function initDb() {
    try {
        const dataPath = path.join(__dirname, 'songs.json');
        console.log('Loading songs from:', dataPath);
        if (fs.existsSync(dataPath)) {
            const raw = fs.readFileSync(dataPath, 'utf-8');
            songs = JSON.parse(raw);
            console.log(`Loaded ${songs.length} songs.`);
            dbInitialized = true;
        } else {
            console.warn('songs.json not found!');
            songs = [];
        }
    } catch (e) {
        console.error('Failed to load songs:', e);
        songs = [];
    }
}

function searchSongs(query, category) {
    if (!dbInitialized) initDb();

    let results = songs;

    // Filter by category if provided and not 'All'
    if (category && category !== 'All') {
        // Map UI category names to DB category names
        // UI: 'Hymn', 'Chorus', 'Telugu', 'Hindi'
        // DB: 'English Hymns', 'English Choruses', 'Telugu Songs', 'Hindi Songs'
        const filterStr = category.toLowerCase();
        results = results.filter(s => {
            const cat = s.category.toLowerCase();
            if (filterStr === 'hymn') return cat.includes('hymn');
            if (filterStr === 'chorus') return cat.includes('chorus');
            if (filterStr === 'telugu') return cat.includes('telugu');
            if (filterStr === 'hindi') return cat.includes('hindi');
            return true;
        });
    }

    if (!query) return results.slice(0, 50);

    const q = query.toLowerCase().trim();
    return results.filter(s => {
        if (s.id.toLowerCase().includes(q)) return true;
        if (s.preview && s.preview.toLowerCase().includes(q)) return true;
        return false;
    }).slice(0, 50);
}

function getSong(id) {
    if (!dbInitialized) initDb();
    return songs.find(s => s.id === id);
}

function getNextId(category) {
    if (!dbInitialized) initDb();
    // Determine prefix based on category
    let prefix = 'S';
    const cat = category.toLowerCase();
    if (cat.includes('hymn')) prefix = 'H';
    else if (cat.includes('chorus')) prefix = 'C';
    else if (cat.includes('telugu')) prefix = 'T';
    else if (cat.includes('hindi')) prefix = 'HN';

    // Find highest number with this prefix
    let maxNum = 0;
    songs.forEach(s => {
        if (s.id.startsWith(prefix)) {
            const numPart = parseInt(s.id.substring(prefix.length));
            if (!isNaN(numPart) && numPart > maxNum) {
                maxNum = numPart;
            }
        }
    });

    return prefix + (maxNum + 1);
}

function addSong(songData) {
    if (!dbInitialized) initDb();

    // Check for duplicate ID
    if (songs.find(s => s.id === songData.id)) {
        throw new Error(`Song ID ${songData.id} already exists`);
    }

    const newSong = {
        id: songData.id,
        category: songData.category,
        preview: songData.title || songData.preview, // Ensure preview is set
        slides: songData.slides
    };

    songs.push(newSong);

    // Persist to disk
    try {
        const dataPath = path.join(__dirname, 'songs.json');
        fs.writeFileSync(dataPath, JSON.stringify(songs, null, 2), 'utf-8');
        return newSong;
    } catch (e) {
        console.error("Failed to save song:", e);
        throw new Error("Failed to save song to database");
    }
}

function updateSong(songId, songData) {
    if (!dbInitialized) initDb();

    const index = songs.findIndex(s => s.id === songId);
    if (index === -1) {
        throw new Error(`Song ID ${songId} not found`);
    }

    // Update fields
    const updatedSong = {
        ...songs[index],
        category: songData.category || songs[index].category,
        preview: songData.title || songData.preview || songs[index].preview,
        slides: songData.slides || songs[index].slides
    };

    songs[index] = updatedSong;

    // Persist to disk
    try {
        const dataPath = path.join(__dirname, 'songs.json');
        fs.writeFileSync(dataPath, JSON.stringify(songs, null, 2), 'utf-8');
        return updatedSong;
    } catch (e) {
        console.error("Failed to update song:", e);
        throw new Error("Failed to update song in database");
    }
}

// Map the JSON format to what the UI expects
// JSON has: id, category, preview, slides[]
// UI expects: id, title, category, number, lyrics (string)
// We need to adapt it on the fly or pre-process.
// Actually, let's keep the internal filtering simple, but genericize the output if needed.
// But wait, the previous SQLite had 'title', 'lyrics' as string.
// This new JSON has 'preview' which acts like title maybe? and 'slides' as array.

// Let's patch filter to return objects that are compatible or update UI to handle this schema.
// Easier to update UI to handle 'slides' array directly (it's better anyway).
// And 'preview' can be the title. 'id' is 'C1' etc, which serves as 'number' too.

// Schedule Management
let schedule = [];

function loadSchedule() {
    try {
        const dataPath = path.join(__dirname, 'schedule.json');
        if (fs.existsSync(dataPath)) {
            const raw = fs.readFileSync(dataPath, 'utf-8');
            schedule = JSON.parse(raw);
            console.log(`Loaded ${schedule.length} items in schedule.`);
        } else {
            schedule = [];
            saveSchedule();
        }
    } catch (e) {
        console.error('Failed to load schedule:', e);
        schedule = [];
    }
}

function saveSchedule() {
    try {
        const dataPath = path.join(__dirname, 'schedule.json');
        fs.writeFileSync(dataPath, JSON.stringify(schedule, null, 2), 'utf-8');
    } catch (e) {
        console.error("Failed to save schedule:", e);
    }
}

function getSchedule() {
    if (!dbInitialized) { // Ensure explicit init
        initDb();
        loadSchedule();
    }
    return schedule;
}

function addToSchedule(songId) {
    if (!dbInitialized) initDb();
    const song = getSong(songId);
    if (!song) throw new Error("Song not found");

    // Add unique entry (allow duplicates? usually yes for services, but let's stick to unique ID for keys if possible. 
    // Actually, a service might sing a reprise. So we should create a schedule item with a unique instance ID.)
    const scheduleItem = {
        instanceId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        songId: song.id,
        title: song.preview,
        category: song.category,
        slides: song.slides
    };

    schedule.push(scheduleItem);
    saveSchedule();
    return schedule;
}

function removeFromSchedule(instanceId) {
    schedule = schedule.filter(item => item.instanceId !== instanceId);
    saveSchedule();
    return schedule;
}

function reorderSchedule(newOrder) {
    // newOrder should be array of instanceIds
    // Verify all exist? Or just trust the client?
    // Let's assume the client sends the full new array of items or IDs.
    // Safer to just replace the schedule with the incoming list if valid

    // Simple validation: check length
    if (newOrder.length !== schedule.length) {
        console.warn("Schedule reorder length mismatch");
    }

    schedule = newOrder;
    saveSchedule();
    return schedule;
}

function clearSchedule() {
    schedule = [];
    saveSchedule();
    return [];
}

// Modify initDb to also load schedule
const originalInitDb = initDb;
initDb = function () {
    // Call original logic (copy-paste of logic since function hoisting might be tricky with direct const assignment)
    try {
        const dataPath = path.join(__dirname, 'songs.json');
        console.log('Loading songs from:', dataPath);
        if (fs.existsSync(dataPath)) {
            const raw = fs.readFileSync(dataPath, 'utf-8');
            songs = JSON.parse(raw);
            console.log(`Loaded ${songs.length} songs.`);
            dbInitialized = true;
        } else {
            console.warn('songs.json not found!');
            songs = [];
        }
    } catch (e) {
        console.error('Failed to load songs:', e);
        songs = [];
    }
    loadSchedule();
};

module.exports = { initDb, searchSongs, getSong, addSong, updateSong, getNextId, getSchedule, addToSchedule, removeFromSchedule, reorderSchedule, clearSchedule };
