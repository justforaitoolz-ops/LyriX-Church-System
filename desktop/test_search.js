const axios = require('axios');
const cheerio = require('cheerio');

async function testSearch(query) {
    console.log(`[Search] Searching (Hymnary): ${query}`);
    try {
        const searchUrl = `https://hymnary.org/search?qu=${encodeURIComponent(query)}`;
        console.log(`[Search] URL: ${searchUrl}`);

        const { data } = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        const $ = cheerio.load(data);
        const results = [];

        // Inspect Hymnary structure (usually .result-row or .search-result)
        // I'll grab all links inside the main container if I can guess it, or just dump links again.
        // Let's look for search results.

        // Common structure for Hymnary:
        // .result-row .title a

        $('.result-row').each((i, el) => {
            const titleEl = $(el).find('.title a');
            const title = titleEl.text().trim();
            const url = titleEl.attr('href');

            // Fix relative URLs
            const fullUrl = url && url.startsWith('/') ? `https://hymnary.org${url}` : url;

            if (title && fullUrl) {
                results.push({ title, url: fullUrl, source: 'Hymnary' });
            }
        });

        console.log(`[Search] Found ${results.length} results.`);
        console.log(results.slice(0, 5));

    } catch (e) {
        console.error("[Search] Error:", e.message);
    }
}

testSearch("Amazing Grace");
