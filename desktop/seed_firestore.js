const { initializeApp } = require("firebase/app");
const { getFirestore, collection, doc, setDoc, writeBatch } = require("firebase/firestore");
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
    const songsPath = path.join(__dirname, 'src', 'database', 'songs.json');
    const songs = JSON.parse(fs.readFileSync(songsPath, 'utf8'));

    console.log(`Found ${songs.length} songs. Starting upload...`);

    const batchSize = 400; // Firestore batch limit is 500
    const chunks = [];
    for (let i = 0; i < songs.length; i += batchSize) {
        chunks.push(songs.slice(i, i + batchSize));
    }

    let totalUploaded = 0;

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(song => {
            // Use song.id as document ID for easy reference
            const ref = doc(db, "songs", song.id);
            batch.set(ref, song);
        });
        await batch.commit();
        totalUploaded += chunk.length;
        console.log(`Uploaded ${totalUploaded} / ${songs.length}`);
    }

    console.log("Seeding complete!");
    process.exit(0);
}

seed().catch(console.error);
