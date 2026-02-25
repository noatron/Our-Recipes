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

        const structureRules = `
מבנה הפלט (חובה):
- name: שם המתכון בלבד (מחרוזת).
- ingredients: מערך מחרוזות – כל מרכיב בפריט נפרד. שורה אחת במתכון = פריט אחד במערך. אסור לשלב שני מרכיבים באותו פריט.
- instructions: מערך מחרוזות – כל שלב הכנה בפריט נפרד. שלב 1, שלב 2 וכו' – כל אחד פריט נפרד. אסור לשלב שני שלבים באותו פריט.
- suggestedTags: מערך תגיות מהרשימה בלבד.

דוגמה למבנה:
{"name": "עוגת שוקולד", "ingredients": ["2 ביצים", "1 כוס סוכר", "1 כוס קמח", "3 כפות קקאו"], "instructions": ["לחמם תנור ל-180 מעלות.", "לערבב ביצים וסוכר.", "להוסיף קמח וקקאו ולערבב.", "לאפות 25 דקות."], "suggestedTags": ["קינוח"]}

תגיות מותרות: מהיר, בינוני, ארוך, מנה עיקרית, תוספת, מרק, סלט, קינוח, לחם ומאפה, עוגות ועוגיות, רוטב וממרח, שתייה, בוקר, צהריים, ערב, חטיף, צמחוני, טבעוני, ללא גלוטן, ילדים, שבת וחגים, אירוח, כל השבוע.`;

        const multiImagePrompt = `אלו ${images.length} תמונות של מתכון אחד (לפי הסדר). קרא את כל הטקסט מכל תמונה (כותרות, מרכיבים, הוראות הכנה) – כולל טקסט צפוף או קטן – ואיחד למתכון אחד.

כללים:
1. שם המתכון – מחרוזת אחת בשדה name.
2. מרכיבים – כל מרכיב בשורה נפרדת = כל מרכיב כפריט נפרד במערך ingredients. אם במתכון כתוב "חלב, ביצים, קמח" – החזר 3 פריטים. אם כתוב רשימה עם שורות – כל שורה = פריט.
3. הוראות הכנה – כל שלב בשורה נפרדת = כל שלב כפריט נפרד במערך instructions. אם כתוב "1. לחמם תנור 2. לערבב" – החזר 2 פריטים. אם יש פסקה ארוכה – פרק לפי משפטים/שלבים לוגיים.
4. התעלם מאשטגים ואמוג'ים. העדף להעתיק את כל מה שכתוב ולא להשאיר רשימות ריקות.
${structureRules}

החזר רק JSON תקין, בלי הסברים ובלי markdown.`;

        const singleImagePrompt = `בתמונה מופיע מתכון. קרא את כל הטקסט (כותרות, מרכיבים, הוראות הכנה) – כולל טקסט צפוף – וחלץ לפי המבנה הקבוע.

כללים:
1. name – שם המתכון (מחרוזת אחת).
2. ingredients – מערך: כל מרכיב בפריט נפרד. שורה אחת = פריט אחד. אסור לשלב מרכיבים באותו פריט.
3. instructions – מערך: כל שלב הכנה בפריט נפרד. שלב אחד = פריט אחד. אסור לשלב שלבים באותו פריט.
4. התעלם מאשטגים ואמוג'ים.
${structureRules}

החזר רק JSON תקין, בלי הסברים ובלי markdown.`;

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

        function toIngredientsArray(val) {
            if (Array.isArray(val)) return val;
            if (val == null) return [];
            const s = String(val).trim();
            if (!s) return [];
            const byNewline = s.split(/\n+/).map(x => x.trim()).filter(Boolean);
            if (byNewline.length > 1) return byNewline;
            const byComma = s.split(/\s*[,،]\s*/).map(x => x.trim()).filter(Boolean);
            if (byComma.length > 1) return byComma;
            return [s];
        }
        function toInstructionsArray(val) {
            if (Array.isArray(val)) return val.map(stripStepNumber);
            if (val == null) return [];
            const s = String(val).trim();
            if (!s) return [];
            const byNumbered = s.split(/\s*\n\s*(?=\d+[.)]\s*)/).map(stripStepNumber).filter(Boolean);
            if (byNumbered.length > 1) return byNumbered;
            const byNewline = s.split(/\n+/).map(stripStepNumber).filter(Boolean);
            if (byNewline.length > 1) return byNewline;
            const bySentence = s.split(/(?<=[.!?])\s+/).map(stripStepNumber).filter(Boolean);
            if (bySentence.length > 1) return bySentence;
            return [s.replace(/^\d+[.)]\s*/, '').trim()];
        }
        function stripStepNumber(str) {
            return String(str).replace(/^\d+[.)]\s*/, '').trim();
        }

        recipe.ingredients = toIngredientsArray(recipe.ingredients || recipe.ingredient);
        recipe.ingredients = recipe.ingredients.map(i => String(i).trim()).filter(Boolean);
        recipe.instructions = toInstructionsArray(recipe.instructions || recipe.instruction);
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
