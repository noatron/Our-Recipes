const https = require('https');

exports.handler = async function(event) {
  // רק POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: 'Missing API key' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { image, mediaType } = body;
  if (!image) {
    return { statusCode: 400, body: 'Missing image' };
  }

  const requestBody = JSON.stringify({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType || 'image/jpeg',
              data: image
            }
          },
          {
            type: 'text',
            text: `זהי תמונה של מתכון מרשתות חברתיות. חלצי את המידע הבא בעברית והחזירי JSON בלבד ללא הסברים:
{
  "name": "שם המתכון",
  "ingredients": ["מרכיב 1", "מרכיב 2"],
  "instructions": ["שלב 1", "שלב 2"],
  "suggestedTags": ["תגית1", "תגית2"]
}

עבור suggestedTags, בחרי רק מהרשימה הזו: מהיר, בינוני, ארוך, מנה עיקרית, תוספת, מרק, סלט, קינוח, לחם ומאפה, עוגות ועוגיות, רוטב וממרח, שתייה, בוקר, צהריים, ערב, חטיף, צמחוני, טבעוני, ללא גלוטן, ילדים, שבת וחגים, אירוח, כל השבוע.

אם לא מדובר במתכון, החזירי: {"error": "לא זוהה מתכון בתמונה"}`
          }
        ]
      }
    ]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content?.[0]?.text || '';
          // נקה markdown אם יש
          const clean = text.replace(/```json|```/g, '').trim();
          const result = JSON.parse(clean);
          resolve({
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
          });
        } catch (e) {
          resolve({
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'שגיאה בניתוח התגובה' })
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: err.message })
      });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      resolve({
        statusCode: 504,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'timeout' })
      });
    });

    req.write(requestBody);
    req.end();
  });
};