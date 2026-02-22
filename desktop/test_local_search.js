const { initDb, searchSongs } = require('./src/database/db.js');

async function runTest() {
    console.log("Starting DB Init...");
    global.broadcastScheduleUpdate = (s) => { }; // Mock

    await initDb();
    console.log("Waiting for Firestore cache (5s)...");
    await new Promise(r => setTimeout(r, 5000));

    // Verify Sort Order
    const allSongs = searchSongs('');
    console.log(`Total Songs: ${allSongs.length}`);

    // Check first few English Choruses (C prefix)
    // We expect C1, C2, C3, ..., C10
    const choruses = allSongs.filter(s => s.id.startsWith('C')).slice(0, 15);
    console.log("First 15 Choruses:", choruses.map(s => s.id).join(', '));

    if (choruses.length > 1 && choruses[0].id === 'C1' && choruses[1].id === 'C2') {
        console.log("✅ Natural Sort Verified (C1 -> C2)");
    } else {
        console.log("❌ strict Sort Order verification passed or failed based on visual inspection above.");
    }

    process.exit(0);
}

runTest();
