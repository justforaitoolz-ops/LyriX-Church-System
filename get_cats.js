const fs = require('fs');
const path = require('path');
const dbPath = path.join('desktop', 'src', 'database', 'songs.json');

try {
    const data = fs.readFileSync(dbPath, 'utf8');
    const songs = JSON.parse(data);
    const categories = [...new Set(songs.map(s => s.category))];
    console.log("INTERNAL_CATS:", JSON.stringify(categories));
} catch (e) {
    console.error(e);
}
