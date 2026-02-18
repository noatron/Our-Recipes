const https = require('https');
const http = require('http');

exports.handler = async function(event) {
  const url = event.queryStringParameters?.url;
  
  if (!url) {
    return { statusCode: 400, body: 'Missing url parameter' };
  }

  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: data
        });
      });
    }).on('error', (err) => {
      resolve({ statusCode: 500, body: err.message });
    });
  });
};