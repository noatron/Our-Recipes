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
                ? `אלו ${images.length} צילומי מסך (למשל מאינסטגרם או טיקטוק) של אותו מתכון, לפי הסדר. ייתכן שכל תמונה היא "שקף" עם טקסט או כיתוב.
עבור על כל התמונות, קרא את כל הטקסט המופיע עליהן (כותרות, כיתוב, קפשן) וחלץ מתכון מלא ומאוחד.
חשוב: חלץ בהכרח את רשימת המרכיבים (ingredients) ואת הוראות ההכנה (instructions) – כל מרכיב בשורה נפרדת, כל שלב בשורה נפרדת. אם המרכיבים או ההוראות כתובים בטקסט על התמונה – העתק אותם למבנה המבוקש. התעלם מהאשטגים ואמוג'ים לצורך התוכן.
החזר JSON בלבד (בלי הסברים) במבנה הזה:
{"name": "שם המתכון", "ingredients": ["מרכיב 1", "מרכיב 2"], "instructions": ["שלב 1", "שלב 2"], "suggestedTags": ["תגית1"]}
תגיות – רק מהרשימה: מהיר, בינוני, ארוך, מנה עיקרית, תוספת, מרק, סלט, קינוח, לחם ומאפה, עוגות ועוגיות, רוטב וממרח, שתייה, בוקר, צהריים, ערב, חטיף, צמחוני, טבעוני, ללא גלוטן, ילדים, שבת וחגים, אירוח, כל השבוע`
                : `זו צילום מסך של מתכון (למשל מאינסטגרם או טיקטוק). ייתכן שיש על התמונה כיתוב, קפשן או טקסט עם המרכיבים והוראות.
קרא את כל הטקסט המופיע בתמונה (כולל טקסט על הרקע, כותרות, רשימות) וחלץ מתכון מלא.
חשוב: חלץ בהכרח רשימת מרכיבים (ingredients) והוראות הכנה (instructions) – כל מרכיב בפריט נפרד, כל שלב בפריט נפרד. אם המרכיבים או ההוראות כתובים כפסקה אחת – פרק אותם לפריטים. התעלם מאשטגים ואמוג'ים לצורך התוכן.
החזר JSON בלבד (בלי הסברים) במבנה:
{"name": "שם המתכון", "ingredients": ["מרכיב 1", "מרכיב 2"], "instructions": ["שלב 1", "שלב 2"], "suggestedTags": ["תגית1"]}
תגיות – רק מהרשימה: מהיר, בינוני, ארוך, מנה עיקרית, תוספת, מרק, סלט, קינוח, לחם ומאפה, עוגות ועוגיות, רוטב וממרח, שתייה, בוקר, צהריים, ערב, חטיף, צמחוני, טבעוני, ללא גלוטן, ילדים, שבת וחגים, אירוח, כל השבוע`
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
        if (!Array.isArray(recipe.ingredients)) recipe.ingredients = Array.isArray(recipe.ingredient) ? recipe.ingredient : (recipe.ingredients ? [String(recipe.ingredients)] : []);
        if (!Array.isArray(recipe.instructions)) recipe.instructions = Array.isArray(recipe.instruction) ? recipe.instruction : (recipe.instructions ? [String(recipe.instructions)] : []);
        if (!Array.isArray(recipe.suggestedTags)) recipe.suggestedTags = [];
        return { statusCode: 200, headers, body: JSON.stringify(recipe) };

    } catch (err) {
        console.error('extract-image error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'שגיאה בחילוץ המתכון. נסי שוב.' }) };
    }
};
