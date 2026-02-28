const { getFirestore, writeBatch, doc, getDocs, collection, query, where, deleteDoc } = require('firebase/firestore');
const { getAuth, signInAnonymously } = require('firebase/auth');
const axios = require('axios');
const { initializeApp } = require('firebase/app');

// Hardcode firebase params for migration 
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

const BASE_URL = "https://raw.githubusercontent.com/WeCareLtd/SingUntoLord_DB/main";
const CATEGORIES = {
    "EnglishHymns.json": "Hymns",
    "EnglishChoruses.json": "Choruses",
    "TeluguSongs.json": "Aradhana Geethalu" // Faith Companion uses TeluguSongs for the Aradhana Geethalu
};

async function migrate() {
    console.log("Starting Migration. Authenticating...");
    await signInAnonymously(auth);
    console.log("Authenticated. Beginning process...");

    for (const [filename, categoryName] of Object.entries(CATEGORIES)) {
        console.log(`\n============================`);
        console.log(`Processing ${categoryName} (${filename})...`);

        // 1. Fetch JSON from GitHub
        console.log(`Downloading ${BASE_URL}/${filename}...`);
        const response = await axios.get(`${BASE_URL}/${filename}`);
        const data = response.data;

        let songsCount = data.Count;
        let songs = data.Items || data.items || data;

        // If the structure is weird handle it (Faith companion API puts them direct in an array sometimes or under a key depending on file)

        if (Array.isArray(data)) {
            songs = data;
        } else if (data.Items && Array.isArray(data.Items)) {
            songs = data.Items;
        } else {
            console.error(`Could not parse songs array from ${filename}. Format unknown.`);
            continue;
        }

        console.log(`Found ${songs.length} songs attached to JSON.`);

        // 2. Clear existing songs in this category
        console.log(`Clearing existing ${categoryName} from Firestore...`);
        const q = query(collection(db, "songs"), where("category", "==", categoryName));
        const querySnapshot = await getDocs(q);

        let deleteCount = 0;
        let deleteBatch = writeBatch(db);

        for (const actDoc of querySnapshot.docs) {
            deleteBatch.delete(actDoc.ref);
            deleteCount++;

            if (deleteCount % 400 === 0) {
                await deleteBatch.commit();
                console.log(`Committed delete batch (400)...`);
                deleteBatch = writeBatch(db);
            }
        }
        if (deleteCount % 400 !== 0 && deleteCount > 0) {
            await deleteBatch.commit();
        }
        console.log(`Cleared ${deleteCount} existing songs from ${categoryName}.`);

        // 3. Define the Prefix mappings usually used by LyriX Stage desktop app
        let prefixMap = {
            "Hymns": "H",
            "Choruses": "C",
            "Aradhana Geethalu": "AG",
            "Telugu Songs": "T"
        };
        const prefix = prefixMap[categoryName] || "S";

        // 4. Transform and write Batch
        let addedCount = 0;
        let writeModeBatch = writeBatch(db);

        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];

            // Re-format song Number if necessary, but keep the explicit titles
            // They come as "EnglishHymns", "title": "A charge to keep I have", "lyrics": "...", "songNumber": 294
            const generatedId = `${prefix}${song.songNumber || (i + 1)}`;

            const newDoc = doc(db, "songs", generatedId);
            const transformedData = {
                title: (song.title || "Untitled").trim(), // FORCE title into DB field
                preview: (song.title || "Untitled").trim(), // Force preview to also be the title to override legacy code
                category: categoryName,
                slides: (song.lyrics || "").split("\n\n"),
                updatedAt: new Date().toISOString()
            };

            writeModeBatch.set(newDoc, transformedData);
            addedCount++;

            if (addedCount % 400 === 0) {
                await writeModeBatch.commit();
                console.log(`Committed write batch (400)...`);
                writeModeBatch = writeBatch(db);
            }
        }

        if (addedCount % 400 !== 0 && addedCount > 0) {
            await writeModeBatch.commit();
        }

        console.log(`Successfully migrated ${addedCount} songs into ${categoryName}!`);
    }

    console.log("\nMigration completed successfully.");
    process.exit(0);
}

migrate().catch(console.error);
