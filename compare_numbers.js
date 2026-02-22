const fs = require('fs');
const path = require('path');

const localSongsPath = path.join(__dirname, 'desktop', 'local_english_songs.json');
const apkSongsPath = path.join(__dirname, 'apk_database.json');

const localSongs = JSON.parse(fs.readFileSync(localSongsPath, 'utf8'));
const apkSongs = JSON.parse(fs.readFileSync(apkSongsPath, 'utf8'));

// Filter APK songs to just english
const isEnglish = (str) => /^[a-zA-Z\s0-9.,!?'-:;()"’]+$/.test(str.trim());
const apkEnglish = apkSongs.filter(s => isEnglish(s.title || ""));

console.log(`Loaded ${localSongs.length} local English songs, ${apkEnglish.length} APK English songs.`);

// We want to match by title
const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

const apkMap = new Map();
apkEnglish.forEach(s => {
    apkMap.set(normalize(s.title), s);
});

const updates = [];
let notFoundCount = 0;
let updatedCount = 0;

localSongs.forEach(ls => {
    const normName = normalize(ls.title);
    const match = apkMap.get(normName);
    if (!match) {
        // Try loose match
        const looseMatch = apkEnglish.find(as => normalize(as.title).includes(normName) || normName.includes(normalize(as.title)));
        if (!looseMatch) {
            notFoundCount++;
            return;
        }
    }
    const targetMatch = match || apkEnglish.find(as => normalize(as.title).includes(normName) || normName.includes(normalize(as.title)));

    if (targetMatch.number && String(ls.song_number) !== String(targetMatch.number)) {
        updates.push({
            id: ls.id,
            title: ls.title,
            oldNumber: ls.song_number,
            newNumber: targetMatch.number,
            category: targetMatch.category
        });
        updatedCount++;
    }
});

console.log(`Found ${updatedCount} songs that have DIFFERENT numbers in the APK vs Local DB.`);
console.log(`Could not find ${notFoundCount} local songs in the APK.`);

if (updates.length > 0) {
    console.log(`\nSample differences:`);
    updates.slice(0, 5).forEach(u => console.log(`"${u.title}": Local Number ${u.oldNumber} -> APK Number ${u.newNumber}`));

    // Generate SQL to update the local DB
    let sql = ``;
    updates.forEach(u => {
        sql += `UPDATE songs SET song_number = '${u.newNumber}' WHERE song_id = '${u.id}';\n`;
    });
    fs.writeFileSync('update_numbers.sql', sql);
    console.log(`\nWrote ${updates.length} update queries to update_numbers.sql`);
} else {
    console.log('\nAll matching songs have the identical sequence/numbering already!');
}
