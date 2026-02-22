const { initDb, deleteSong, getSong, searchSongs } = require('./src/database/db.js');

async function testDelete() {
    await initDb();

    // Give it a second to load the cache
    await new Promise(r => setTimeout(r, 2000));

    console.log("Initial songs:");
    const allS = searchSongs('').filter(s => s.id.startsWith('S')).sort((a, b) => parseInt(a.id.match(/\d+/)[0]) - parseInt(b.id.match(/\d+/)[0]));

    console.log(allS.slice(0, 5).map(s => s.id));

    if (allS.length === 0) {
        console.log("No S songs found");
        process.exit(1);
    }

    const target = allS[0].id; // Test the first S prefix song
    const s1 = getSong(target);
    if (!s1) {
        console.log(`${target} not found!`);
        process.exit(1);
    }

    console.log(`Deleting ${target}...`);
    await deleteSong(target);

    // Wait for cache update
    await new Promise(r => setTimeout(r, 3000));

    console.log("Final songs after shift:");
    const newAllS = searchSongs('').filter(s => s.id.startsWith('S')).sort((a, b) => parseInt(a.id.match(/\d+/)[0]) - parseInt(b.id.match(/\d+/)[0]));
    console.log(newAllS.slice(0, 5).map(s => s.id));

    process.exit(0);
}

testDelete();
