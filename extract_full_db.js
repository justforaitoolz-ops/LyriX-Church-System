const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'Faith_Companion_Extracted', 'assets', 'public', 'assets', 'index-CNKXvrNy.js');
const targetContent = fs.readFileSync(targetFile, 'utf8');

// The song object structure looks like:
// { title: "Title", romanizedTitle: "...", lyrics: `...`, romanizedLyrics: `...`, category: "...", number: "1" }
// Or something similar. Let's write a parser to extract everything that looks like a song object.

// Using a regex to find all objects containing title and lyrics.
const songRegex = /{(?:[^{}]*?)title:"([^"]+)"(?:[^{}]*?)lyrics:`([^`]+)`(?:[^{}]*?)}/g;

const songs = [];
let match;
while ((match = songRegex.exec(targetContent)) !== null) {
    const rawObjStr = match[0];
    const song = {
        title: match[1],
        lyrics: match[2],
    };

    // Extract category if exists
    const catMatch = rawObjStr.match(/category:"([^"]+)"/);
    if (catMatch) song.category = catMatch[1];

    // Extract number if exists
    // It might be unquoted like `number:1` or `number:"1"` or `songNumber:1`
    const numMatch = rawObjStr.match(/(?:number|songNumber|id):"?(\d+)"?/);
    if (numMatch) song.number = parseInt(numMatch[1], 10);

    songs.push(song);
}

fs.writeFileSync('apk_database.json', JSON.stringify(songs, null, 2));
console.log(`Extracted ${songs.length} songs full structure.`);
