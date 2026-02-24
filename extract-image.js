const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const body = JSON.parse(event.body);

        // תמיכה בתמונה אחת (ישן) או מערך תמונות (חדש)
        let images = [];
        if (body.images && Array.isArray(body.images)) {
            images = body.images;
        } else if (body.image) {
            images = [{ data: body.image, mediaType: body.mediaType || 'image/jpeg' }];
        }

        if (!images.length) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'לא התקבלו תמונות' }) };
        }

        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        // בניית הודעה עם כל התמונות לפי הסדר
        const imageBlocks = images.map((img, i) => ({
            type: 'image',
            source: {
                type: 'base64',
                media_type: img.mediaType || 'image/jpeg',
                data: img.data
            }
        }));

        const textBlock = {
            type: 'text',
            text: images.length > 1
                ? `אלו ${images.length} תמונות של אותו מתכון, לפי הסדר. חלץ מהן מתכון שלם ומאוחד. החזר JSON בלבד (ללא הסברים) עם המבנה הבא:
{"name": "שם המתכון", "ingredients": ["מרכיב 1", "מרכיב 2"], "instructions": ["שלב 1", "שלב 2"], "suggestedTags": ["תגית1"]}
השתמש רק בתגיות מהרשימה: מהיר, בינוני, ארוך, מנה עיקרית, תוספת, מרק, סלט, קינוח, לחם ומאפה, עוגות ועוגיות, רוטב וממרח, שתייה, בוקר, צהריים, ערב, חטיף, צמחוני, טבעוני, ללא גלוטן, ילדים, שבת וחגים, אירוח, כל השבוע`
                : `זו תמונה של מתכון. חלץ ממנה את המתכון המלא. החזר JSON בלבד (ללא הסברים) עם המבנה הבא:
{"name": "שם המתכון", "ingredients": ["מרכיב 1", "מרכיב 2"], "instructions": ["שלב 1", "שלב 2"], "suggestedTags": ["תגית1"]}
השתמש רק בתגיות מהרשימה: מהיר, בינוני, ארוך, מנה עיקרית, תוספת, מרק, סלט, קינוח, לחם ומאפה, עוגות ועוגיות, רוטב וממרח, שתייה, בוקר, צהריים, ערב, חטיף, צמחוני, טבעוני, ללא גלוטן, ילדים, שבת וחגים, אירוח, כל השבוע`
        };

        const message = await client.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 2048,
            messages: [{ role: 'user', content: [...imageBlocks, textBlock] }]
        });

        const text = message.content[0].text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { statusCode: 200, headers, body: JSON.stringify({ error: 'לא הצלחתי לחלץ מתכון מהתמונות' }) };
        }

        const recipe = JSON.parse(jsonMatch[0]);
        return { statusCode: 200, headers, body: JSON.stringify(recipe) };

    } catch (err) {
        console.error('extract-image error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'שגיאה בחילוץ המתכון. נסי שוב.' }) };
    }
};
