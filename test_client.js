const { io } = require('socket.io-client');

const URL = 'http://localhost:3001';
console.log(`Connecting to ${URL}...`);
const socket = io(URL);

socket.on('connect', () => {
    console.log('✅ Connected');

    // Test 1: Search for a known song in the JSON (e.g., C1)
    console.log('Testing: Search Song "C1"');
    socket.emit('command', { action: 'search-song', query: 'C1' });

    // Test 2: Search for text
    setTimeout(() => {
        console.log('Testing: Search Text "worship"');
        socket.emit('command', { action: 'search-song', query: 'worship' });
    }, 1000);

    setTimeout(() => {
        console.log('Test Complete. Disconnecting.');
        socket.disconnect();
        process.exit(0);
    }, 2000);
});
