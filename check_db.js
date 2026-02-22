const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'desktop', 'church_songs.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
        return;
    }
});

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) throw err;
        console.log("Tables:");
        console.log(tables);

        if (tables.some(t => t.name === 'songs')) {
            db.all("PRAGMA table_info(songs)", [], (err, cols) => {
                console.log("Columns in songs:");
                console.log(cols);
            });
            db.all("SELECT id, title, category FROM songs LIMIT 5", [], (err, rows) => {
                console.log("Sample songs:");
                console.log(rows);
            });
        }
    });
});

db.close();
