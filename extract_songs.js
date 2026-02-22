const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'Faith_Companion_Extracted', 'assets', 'public', 'assets', 'index-CNKXvrNy.js');
const targetContent = fs.readFileSync(targetFile, 'utf8');

// The objects seem to be in format {title:"...",romanizedTitle:"...",lyrics:`...`,romanizedLyrics:`...`,category:"...",number:"..."}
// We will use a regex to match object literals or just extract everything that looks like a title and lyrics
const songRegex = /\{[^}]*?title:"([^"]+)"[^}]+lyrics:`([^`]+)`[^}]*\}/g;

const songs = [];
let match;
while ((match = songRegex.exec(targetContent)) !== null) {
    songs.push({
        title: match[1],
        lyricsPreview: match[2].substring(0, 50).replace(/\n/g, ' '),
        rawObject: match[0]
    });
}

// Since JS objects in minified code might not have quotes around keys, standard JSON.parse won't work easily on the raw string.
// Let's identify the total count and check for english titles.
const englishSongs = songs.filter(s => /^[a-zA-Z\s0-9.,!?'-]+$/.test(s.title));
const teluguSongs = songs.filter(s => !/^[a-zA-Z\s0-9.,!?'-]+$/.test(s.title));

console.log(`Extracted ${songs.length} total songs.`);
console.log(`Found ${englishSongs.length} english songs.`);
console.log(`Found ${teluguSongs.length} non-english (likely Telugu) songs.`);

fs.writeFileSync('songs_summary.json', JSON.stringify({
    total: songs.length,
    englishCount: englishSongs.length,
    teluguCount: teluguSongs.length,
    sampleEnglish: englishSongs.slice(0, 10).map(s => s.title),
    sampleTelugu: teluguSongs.slice(0, 5).map(s => s.title)
}, null, 2));

console.log('Summary saved to songs_summary.json');
