const https = require('https');
const http = require('http');
const { URL } = require('url');
const zlib = require('zlib');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Upgrade-Insecure-Requests': '1'
};

function fetchUrl(url, redirectCount = 0) {
    const maxRedirects = 5;
    if (redirectCount > maxRedirects) {
        return Promise.resolve({ statusCode: 302, body: '' });
    }

    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { ...BROWSER_HEADERS, Host: parsed.hostname }
    };

    return new Promise((resolve, reject) => {
        const req = client.request(options, (res) => {
            if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
                let nextUrl = res.headers.location;
                if (nextUrl.startsWith('/')) nextUrl = parsed.origin + nextUrl;
                return fetchUrl(nextUrl, redirectCount + 1).then(resolve).catch(reject);
            }

            let stream = res;
            const enc = (res.headers['content-encoding'] || '').toLowerCase();
            if (enc === 'gzip') stream = stream.pipe(zlib.createGunzip());
            else if (enc === 'deflate') stream = stream.pipe(zlib.createInflate());
            else if (enc === 'br') stream = stream.pipe(zlib.createBrotliDecompress());

            let data = '';
            stream.on('data', chunk => data += chunk);
            stream.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    body: data
                });
            });
            stream.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const url = req.query?.url;

    if (!url) {
        res.status(400).send('Missing url parameter');
        return;
    }

    try {
        const result = await fetchUrl(url);
        res.status(result.statusCode).send(result.body);
    } catch (err) {
        res.status(500).send(err.message || 'Fetch failed');
    }
};
