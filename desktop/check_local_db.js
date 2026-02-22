const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'church_songs.db');
const db = new Database(dbPath, { readonly: true });

// Check tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables:", tables.map(t => t.name).join(', '));

if (tables.some(t => t.name === 'songs')) {
    const count = db.prepare("SELECT COUNT(*) as c FROM songs").get().c;
    console.log(`Local DB has ${count} songs.`);

    // Let's get English hymns and choruses to see what numbers exist
    const sampleLocal = db.prepare("SELECT id, title, category FROM songs WHERE category IN ('hymn', 'hymns', 'choruse', 'choruses', 'English Hymns', 'English Choruses') LIMIT 10").all();
    console.log("Sample local English songs:", sampleLocal);

    const localEnglishSongs = db.prepare("SELECT * FROM songs WHERE title NOT REGEXP '[అ-హ]'").all(); // Using simple heuristic if regexp available, but sqlite3 doesn't have regexp by default.
    // Instead, fetch all and filter in JS.
    const allLocalSongs = db.prepare("SELECT * FROM songs").all();

    const apkPath = path.join(__dirname, '..', 'apk_database.json');
    if (fs.existsSync(apkPath)) {
        const apkSongs = JSON.parse(fs.readFileSync(apkPath, 'utf8'));
        // Filter out Telugu from APK by checking characters
        const isEnglish = (str) => /^[a-zA-Z\s0-9.,!?'-:;()"’]+$/.test(str.trim());

        const apkEnglish = apkSongs.filter(s => isEnglish(s.title || ""));
        const localEnglish = allLocalSongs.filter(s => isEnglish(s.title || ""));

        console.log(`\nComparison:`);
        console.log(`Local English: ${localEnglish.length} | APK English: ${apkEnglish.length}`);

        // Look for discrepancies in first 5 English hymns
        console.log(`\nFirst 5 APK English:`);
        apkEnglish.slice(0, 5).forEach(s => console.log(`[${s.number}] ${s.title} (Cat: ${s.category})`));

        console.log(`\nFirst 5 Local English:`);
        localEnglish.slice(0, 5).forEach(s => console.log(`[${s.id}] ${s.title} (Cat: ${s.category})`));
    }
}

db.close();
