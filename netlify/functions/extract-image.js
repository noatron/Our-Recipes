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

        const imageBlocks = images.map((img) => ({
            type: 'image',
            source: {
                type: 'base64',
                media_type: img.mediaType || 'image/jpeg',
                data: img.data
            }
        }));

        const multiImagePrompt = `אלו ${images.length} תמונות של מתכון אחד (לפי הסדר). ייתכן שמדובר במסמך סרוק, צילומי מסך או תמונות עם טקסט צפוף/קטן – קרא את כל הטקסט בכל תמונה, שורה אחר שורה.

משימה:
1. קרא את כל הטקסט מכל תמונה (כולל טקסט קטן או צפוף: כותרות, רשימות מרכיבים, הוראות הכנה).
2. איחד למתכון אחד: name, רשימת מרכיבים מלאה (ingredients), הוראות הכנה מלאות לפי סדר (instructions).
3. כל מרכיב – פריט נפרד ב-ingredients. כל שלב – פריט נפרד ב-instructions. גם אם הטקסט נראה כפסקה אחת, פרק לפריטים (לפי שורות או משפטים).
4. אם לא ברור – העדף להעתיק את מה שכתוב ולא להשאיר רשימות ריקות.

פלט: רק JSON תקין, בלי הסברים ובלי markdown:
{"name": "שם המתכון", "ingredients": ["מרכיב 1", "מרכיב 2", "..."], "instructions": ["שלב 1", "שלב 2", "..."], "suggestedTags": ["תגית1"]}
תגיות – רק מהרשימה: מהיר, בינוני, ארוך, מנה עיקרית, תוספת, מרק, סלט, קינוח, לחם ומאפה, עוגות ועוגיות, רוטב וממרח, שתייה, בוקר, צהריים, ערב, חטיף, צמחוני, טבעוני, ללא גלוטן, ילדים, שבת וחגים, אירוח, כל השבוע`;

        const singleImagePrompt = `בתמונה מופיע מתכון (מסמך, צילום מסך, פוסט). קרא את כל הטקסט בתמונה – כולל טקסט קטן או צפוף – וחלץ מתכון מלא.

חובה: להחזיר בהכרח מערך ingredients (כל מרכיב בשורה/פריט נפרד) ומערך instructions (כל שלב הכנה בפריט נפרד). גם במסמך סרוק או טקסט צפוף – קרא שורה אחר שורה והעתק את המרכיבים ואת הוראות ההכנה. אם זה פסקה – פרק לפריטים. התעלם מאשטגים ואמוג'ים.

פלט: רק JSON, בלי הסברים:
{"name": "שם המתכון", "ingredients": ["מרכיב 1", "מרכיב 2"], "instructions": ["שלב 1", "שלב 2"], "suggestedTags": ["תגית1"]}
תגיות – רק מהרשימה: מהיר, בינוני, ארוך, מנה עיקרית, תוספת, מרק, סלט, קינוח, לחם ומאפה, עוגות ועוגיות, רוטב וממרח, שתייה, בוקר, צהריים, ערב, חטיף, צמחוני, טבעוני, ללא גלוטן, ילדים, שבת וחגים, אירוח, כל השבוע`;

        const textBlock = {
            type: 'text',
            text: images.length > 1 ? multiImagePrompt : singleImagePrompt
        };

        const message = await client.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 4096,
            messages: [{ role: 'user', content: [...imageBlocks, textBlock] }]
        });

        const text = message.content[0].text.trim();
        let jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { statusCode: 200, headers, body: JSON.stringify({ error: 'לא הצלחתי לחלץ מתכון מהתמונות' }) };
        }

        const recipe = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(recipe.ingredients)) {
            if (Array.isArray(recipe.ingredient)) recipe.ingredients = recipe.ingredient;
            else if (recipe.ingredients != null) recipe.ingredients = String(recipe.ingredients).split(/\n+/).map(s => s.trim()).filter(Boolean);
            else recipe.ingredients = [];
        }
        recipe.ingredients = recipe.ingredients.map(i => String(i).trim()).filter(Boolean);
        if (!Array.isArray(recipe.instructions)) {
            if (Array.isArray(recipe.instruction)) recipe.instructions = recipe.instruction;
            else if (recipe.instructions != null) recipe.instructions = String(recipe.instructions).split(/\n+|(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
            else recipe.instructions = [];
        }
        recipe.instructions = recipe.instructions.map(s => String(s).trim()).filter(Boolean);
        if (!Array.isArray(recipe.suggestedTags)) recipe.suggestedTags = [];
        recipe.name = (recipe.name && String(recipe.name).trim()) || 'מתכון';
        if (recipe.ingredients.length === 0 && recipe.instructions.length === 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ error: 'לא זוהו מרכיבים או הוראות בתמונה. נסי תמונה ברורה יותר (או צילום מקרוב של הטקסט) או הזיני את המתכון ידנית.' }) };
        }
        return { statusCode: 200, headers, body: JSON.stringify(recipe) };

    } catch (err) {
        console.error('extract-image error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'שגיאה בחילוץ המתכון. נסי שוב.' }) };
    }
};
