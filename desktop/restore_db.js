const { getFirestore, writeBatch, doc, getDocs, collection, deleteDoc } = require('firebase/firestore');
const { getAuth, signInAnonymously } = require('firebase/auth');
const { initializeApp } = require('firebase/app');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
    apiKey: "AIzaSyAGcC_oF9aLuK_ofHuE7I3wEafBs5ckfbo",
    authDomain: "church-lyrics-viewer.firebaseapp.com",
    projectId: "church-lyrics-viewer",
    storageBucket: "church-lyrics-viewer.firebasestorage.app",
    messagingSenderId: "134711184790",
    appId: "1:134711184790:web:7889e6330bc459f00a21b7"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function restore() {
    console.log("Authenticating...");
    await signInAnonymously(auth);

    const backupFile = path.resolve(__dirname, 'src/database/songs.json');
    const songs = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    console.log(`Loaded ${songs.length} songs from backup.`);

    console.log("Clearing existing songs...");
    const querySnapshot = await getDocs(collection(db, "songs"));
    let deleteCount = 0;
    let deleteBatch = writeBatch(db);
    for (const docSnap of querySnapshot.docs) {
        deleteBatch.delete(docSnap.ref);
        deleteCount++;
        if (deleteCount % 400 === 0) {
            await deleteBatch.commit();
            deleteBatch = writeBatch(db);
        }
    }
    if (deleteCount % 400 !== 0 && deleteCount > 0) {
        await deleteBatch.commit();
    }
    console.log(`Cleared ${deleteCount} songs.`);

    let addedCount = 0;
    let writeBatchRef = writeBatch(db);
    for (const song of songs) {
        const docRef = doc(db, "songs", song.id);
        const dataToSave = { ...song };
        if (!dataToSave.updatedAt) {
            dataToSave.updatedAt = new Date().toISOString();
        }
        writeBatchRef.set(docRef, dataToSave);
        addedCount++;
        if (addedCount % 400 === 0) {
            await writeBatchRef.commit();
            writeBatchRef = writeBatch(db);
        }
    }
    if (addedCount % 400 !== 0 && addedCount > 0) {
        await writeBatchRef.commit();
    }
    console.log(`Successfully restored ${addedCount} songs from local backup.`);
    process.exit(0);
}

restore().catch(console.error);
