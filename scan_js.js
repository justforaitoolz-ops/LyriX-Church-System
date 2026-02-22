const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'Faith_Companion_Extracted', 'assets', 'public', 'assets', 'index-CNKXvrNy.js');
const targetContent = fs.readFileSync(targetFile, 'utf8');

// Also load other large JS files just in case
const files = fs.readdirSync(path.join(__dirname, 'Faith_Companion_Extracted', 'assets', 'public', 'assets')).filter(f => f.endsWith('.js'));
let out = '';

for (const f of files) {
    const p = path.join(__dirname, 'Faith_Companion_Extracted', 'assets', 'public', 'assets', f);
    const content = fs.readFileSync(p, 'utf8');

    // Look for typical json array signatures or hymn clues
    const snippetMatch = content.match(/.{0,50}(hymns?|Chorus|lyrics).{0,50}/gi);
    if (snippetMatch) {
        out += `--- File: ${f} ---\n`;
        out += snippetMatch.slice(0, 10).join('\n') + '\n\n';
    }

    // Try to find a large array of objects
    const arrayMatch = content.match(/\[\{[^{]*"title"[^{]*:[^\]]{1000,}\]/);
    if (arrayMatch) {
        out += `--- FOUND LARGE ARRAY in ${f} ---\n`;
        out += arrayMatch[0].substring(0, 1000) + '\n... (truncated)\n\n';
    }
}

fs.writeFileSync('scan_results.txt', out);
console.log('Results written to scan_results.txt');
