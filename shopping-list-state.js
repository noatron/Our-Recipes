/**
 * רשימת קניות – state משותף (זיכרון + localStorage לרשימה הנוכחית ורשימות שמורות).
 * נורמליזציה: מוציאים מכל מרכיב כמות ויחידה ומשאירים רק שם המוצר (למשל "1 כף סוכר" → "סוכר").
 * איחוד: מרכיבים עם אותו שם מוצר מופיעים בשורה אחת, בלי כמויות – הרשימה היא צ'קליסט של מה לקנות.
 */
(function () {
    const CURRENT_KEY = 'app_shopping_list';
    const SAVED_LISTS_KEY = 'app_saved_shopping_lists';

    /** מפתח לאגרגציה: נורמליזציה קלה (תפוח/תפוחים/תפוחי → תפוח) */
    function normalizeKey(text) {
        if (!text || typeof text !== 'string') return '';
        let s = text.trim().toLowerCase();
        s = s.replace(/\s+/g, ' ');
        s = s.replace(/\s*ללא\s+מלח\s*/g, ' ').replace(/\s*עם\s+מלח\s*/g, ' ');
        s = s.replace(/\s*מלוח[ה]?\s*/g, ' ').replace(/\s*לא\s+מלוח[ה]?\s*/g, ' ');
        s = s.replace(/ים\s/g, ' ').replace(/ים$/g, '');
        s = s.replace(/י\s/g, ' ').replace(/י$/g, '');
        s = s.replace(/\s*רגיל\s*$/g, '').trim();
        s = s.replace(/\s*לבן\s*$/g, '').trim();
        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    /** תבלינים יבשים, שמנים ומים – לא נכנסים לרשימת הקניות (בזיליקום טרי וכו' כן). שמנים – רק אם הכמות פחות מכוס (Rule 4). */
    var PANTRY_NORMALIZED = [
        'מלח', 'פלפל', 'פפריקה', 'אורגנו', 'כורכום', 'כמון', 'זעתר',
        'פלפל שחור', 'פלפל לבן', 'פפריקה מתוקה', 'מלח גס', 'תבלין', 'קורט',
        'שמן', 'שמן זית', 'שמן רגיל', 'שמן קנולה', 'שמן צמחי',
        'מים'
    ].map(function (t) { return normalizeKey(t); });

    /** תבלינים/שמנים באנגלית – לזיהוי והשמטה (שמנים – Rule 4 לפי כמות) */
    var PANTRY_EN = [
        'black pepper', 'salt', 'kosher salt', 'cooking salt', 'dried thyme',
        'olive oil', 'extra virgin olive oil', 'evoo', 'vegetable oil'
    ].map(function (t) { return t.trim().toLowerCase(); });

    /** מוצרים שהם שמן – עבורם מחילים כלל כמות (כוס ומעלה נכנס לרשימה) */
    var OIL_NORMALIZED = ['שמן', 'שמן זית', 'שמן רגיל', 'שמן קנולה', 'שמן צמחי'].map(function (t) { return normalizeKey(t); });
    var OIL_EN = ['olive oil', 'extra virgin olive oil', 'evoo', 'vegetable oil'];

    function isPantryItem(text) {
        var low = (text || '').trim().toLowerCase();
        if (/\bתבלין\b/.test(low) || /\bspice\b/.test(low) || /\bherb\b/.test(low)) return true;
        if (/^קורט\s/.test(low)) return true;
        var key = normalizeKey(text);
        if (!key) return true;
        if (PANTRY_NORMALIZED.indexOf(key) !== -1) return true;
        for (var i = 0; i < PANTRY_NORMALIZED.length; i++) {
            var p = PANTRY_NORMALIZED[i];
            if (key === p || key.indexOf(p + ' ') === 0) return true;
        }
        for (var j = 0; j < PANTRY_EN.length; j++) {
            if (low === PANTRY_EN[j] || low.indexOf(PANTRY_EN[j] + ' ') === 0 || low.indexOf(' ' + PANTRY_EN[j]) >= 0) return true;
        }
        return false;
    }

    /** האם המוצר הוא שמן (כל סוג) – Rule 4: שמן נכנס רק אם כמות >= כוס או גרסה ספציפית */
    function isOilProduct(text) {
        var low = (text || '').trim().toLowerCase();
        var key = normalizeKey(text);
        if (key === 'שמן' || key.indexOf('שמן ') === 0) return true;
        for (var i = 0; i < OIL_NORMALIZED.length; i++) {
            if (key === OIL_NORMALIZED[i] || key.indexOf(OIL_NORMALIZED[i] + ' ') === 0) return true;
        }
        for (var j = 0; j < OIL_EN.length; j++) {
            if (low.indexOf(OIL_EN[j]) >= 0) return true;
        }
        return false;
    }

    /** גרסה ספציפית של שמן/חומץ (כתית מעולה, בלסמי וכו') – נשמרת ברשימה; רק הגרסה הגנרית מושמטת. */
    function isSpecificOilOrVinegar(productName) {
        if (!productName || typeof productName !== 'string') return false;
        var n = (productName || '').trim();
        if (!n) return false;
        return (/כתית|מעולה|בלסמי|אדום\s*יין|לבן\s*יין|סינטי|אורגני|קולד\s*פרס|פריס/i.test(n) || n.length > 12);
    }

    /** מפשט מרכיב לפירוט מינימלי – רק שם וכמות, בלי הכנה/מידות אמריקאיות/סוגריים */
    function simplifyIngredient(text) {
        if (!text || typeof text !== 'string') return '';
        var s = text.trim().replace(/\s+/g, ' ');
        s = s.replace(/\s*\([^)]*\)/g, ' ').replace(/\s*,\s*[^,]*(\([^)]*\))?/g, ' ');
        s = s.replace(/\s*\/\s*\d+\s*(oz|ounce|lb|pound)\s*/gi, ' ');
        s = s.replace(/\s*\/\s*\d+\s*["']?\s*/g, ' ');
        s = s.replace(/\bחלבון\s*(מ)?ביצה\b/gi, 'ביצה');
        if (/\bextra\s+virgin\s+olive\s+oil\b/i.test(s)) s = s.replace(/\bextra\s+virgin\s+olive\s+oil\b/gi, 'שמן זית');
        if (/\bolive\s+oil\b/i.test(s)) s = s.replace(/\bolive\s+oil\b/gi, 'שמן זית');
        s = s.replace(/\b(unsalted|salted|low\s+sodium)\s+/gi, ' ');
        s = s.replace(/\s*ללא\s+מלח\s*/g, ' ').replace(/\s*עם\s+מלח\s*/g, ' ');
        s = s.replace(/\s*מלוח[ה]?\s*/g, ' ').replace(/\s*לא\s+מלוח[ה]?\s*/g, ' ');
        s = s.replace(/\s*רגיל\s*/g, ' ').replace(/\s*לבן\s*$/g, ' ');
        var cupTbsp = s.match(/^(\d+)\s*כוס(?:ות)?\s+ו-?\s*(\d+)\s*(?:כף|כפות)\s+/);
        if (cupTbsp) {
            var cups = parseInt(cupTbsp[1], 10);
            var tbsps = parseInt(cupTbsp[2], 10);
            s = (cups * 16 + tbsps) + ' כפות ' + s.slice(cupTbsp[0].length);
        } else {
            var halfCup = s.match(/^חצי\s+כוס\s+ו-?\s*(\d+)\s*(?:כף|כפות)\s+/);
            if (halfCup) {
                var t = parseInt(halfCup[1], 10);
                s = (8 + t) + ' כפות ' + s.slice(halfCup[0].length);
            }
        }
        var remove = [
            /\s*מושר[ייה]?\s*(חצי\s*יום|לילה|יומיים?|\d+\s*שעות?)?/gi,
            /\s*חצי\s*יום\s*מושר[ייה]?/gi,
            /\s*חתוך\s*(לקוביות|טבעות|פרוסות|דק|גס)?/gi,
            /\s*קצוץ\s*(דק|גס)?/gi,
            /\s*מבושל\s*(מראש)?/gi,
            /\s*קפוא\s*/gi,
            /\s*טרי\s*/gi,
            /\s*טחון\s*/gi,
            /\s*מקולף\s*/gi,
            /\s*מגורר[ים]?\s*/gi,
            /\s*גרוס[ה]?\s*/gi,
            /\s*מולבן[ים]?\s*/gi,
            /\s*פרוס[ים]?\s*/gi,
            /\s*בפומפיה\s*(גסה|דקה)?/gi,
            /\s*גסה\s*$/gi,
            /\s*דקה\s*$/gi,
            /\s*לריבועים?\s*/gi,
            /\s*לפרוסות\s*/gi,
            /\s*לקוביות\s*/gi,
            /\s*למחית\s*/gi,
            /\s*בגודל\s*[A-Z]+\s*/gi,
            /\s*בינוני\s*/gi,
            /\s*קטן\s*/gi,
            /\s*גדול\s*/gi,
            /\s*מחולק\s*ל-\d+\s*/gi,
            /\s*חצי\s*יום\s*/g,
            /\s*לילה\s*/g
        ];
        for (var i = 0; i < remove.length; i++) s = s.replace(remove[i], ' ');
        s = s.replace(/גר[''\u2019\u2018]/g, 'גרם');
        s = s.replace(/\s+/g, ' ').trim();
        return s || text.trim();
    }

    /** יחידות עבריות לזיהוי – ממוינות לפי אורך (ארוך קודם) כדי להתאים "כפות" לפני "כף". */
    var UNITS = [
        'שלושה רבעים', 'שלושה רבעי', 'כפות', 'כף', 'כפיות', 'כפית', 'כוסות', 'כוס',
        'קילו', 'ק\"ג', 'גרם', 'מ"ל', 'ליטר', 'יחידות', 'יחידה', 'חבילות', 'חבילה',
        'פרוסות', 'פרוסה', 'ענפים', 'ענף', 'שיני', 'שן', 'קורט'
    ];
    /** מילות מספר עבריות → מספר */
    var NUMBER_WORDS = {
        'חצי': 0.5,
        'רבע': 0.25,
        'שליש': 0.33,
        'שלושה רבעים': 0.75,
        'שלושה רבעי': 0.75,
        'אחד': 1,
        'אחת': 1,
        'שתי': 2,
        'שתיים': 2,
        'שנים': 2,
        'שתי': 2,
        'שלוש': 3,
        'שלושה': 3,
        'ארבע': 4,
        'ארבעה': 4,
        'חמש': 5,
        'חמישה': 5,
        'שש': 6,
        'שישה': 6,
        'שבע': 7,
        'שמונה': 8,
        'תשע': 9,
        'עשר': 10
    };
    /** יחידות לנורמליזציה (מפתח יחיד) – לתאימות קוד קיים */
    var UNIT_PAIRS = [
        { singular: 'כף', plural: 'כפות', key: 'כף' },
        { singular: 'כפית', plural: 'כפיות', key: 'כפית' },
        { singular: 'כוס', plural: 'כוסות', key: 'כוס' },
        { singular: 'חבילה', plural: 'חבילות', key: 'חבילה' },
        { singular: 'יחידה', plural: 'יחידות', key: 'יחידה' },
        { singular: 'גרם', plural: 'גרם', key: 'גרם' },
        { singular: 'ק"ג', plural: 'ק"ג', key: 'ק\"ג' },
        { singular: 'מ"ל', plural: 'מ"ל', key: 'מ\"ל' },
        { singular: 'ליטר', plural: 'ליטר', key: 'ליטר' },
        { singular: 'מלא', plural: 'מלא', key: 'מלא' },
        { singular: 'פרוסה', plural: 'פרוסות', key: 'פרוסה' },
        { singular: 'ענף', plural: 'ענפים', key: 'ענף' },
        { singular: 'שן', plural: 'שיני', key: 'שן' },
        { singular: 'קורט', plural: 'קורט', key: 'קורט' }
    ];
    var UNIT_EN = [
        { re: /^tbsp\.?\s+|^tbs\.?\s+|^tablespoons?\s+/i, key: 'כף' },
        { re: /^tsp\.?\s+|^teaspoons?\s+/i, key: 'כפית' },
        { re: /^cups?\s+/i, key: 'כוס' },
        { re: /^g\s+|^gram(?:s)?\s+/i, key: 'גרם' },
        { re: /^kg\s+|^kilo(?:gram)?s?\s+/i, key: 'ק\"ג' },
        { re: /^ml\s+|^milliliter(?:s)?\s+/i, key: 'מ\"ל' },
        { re: /^l\s+|^liter(?:s)?\s+/i, key: 'ליטר' }
    ];

    /**
     * מפרק מרכיב מחרוזת ל-3 חלקים: amount, unit, product.
     * @returns {{ amount: number|null, unit: string|null, product: string }} או null
     */
    function parseIngredient(text) {
        if (!text || typeof text !== 'string') return null;
        var s = text.trim().replace(/\s+/g, ' ');
        var amount = null;
        var unit = null;
        var product = s;

        var phrases = Object.keys(NUMBER_WORDS).sort(function (a, b) { return b.length - a.length; });
        for (var pi = 0; pi < phrases.length; pi++) {
            var phrase = phrases[pi];
            if (s.indexOf(phrase) === 0) {
                amount = NUMBER_WORDS[phrase];
                s = s.slice(phrase.length).trim();
                break;
            }
        }
        if (amount === null) {
            var fracMatch = s.match(/^(\d+)\/(\d+)\s+/);
            var numMatch = s.match(/^(\d+(?:\.\d+)?)\s+/);
            if (fracMatch) {
                amount = parseInt(fracMatch[1], 10) / parseInt(fracMatch[2], 10);
                s = s.slice(fracMatch[0].length).trim();
            } else if (numMatch) {
                amount = parseFloat(numMatch[1], 10);
                s = s.slice(numMatch[0].length).trim();
            }
        }

        for (var i = 0; i < UNITS.length; i++) {
            var u = UNITS[i];
            var escaped = u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var re = new RegExp('^' + escaped + '\\s+', 'i');
            if (re.test(s)) {
                unit = u;
                product = s.replace(re, '').trim();
                break;
            }
        }
        if (!unit && amount !== null) {
            var gMatch = s.match(/^(\d+(?:\.\d+)?)\s*g\s+/i);
            if (gMatch) {
                amount = parseFloat(gMatch[1], 10);
                unit = 'גרם';
                product = s.slice(gMatch[0].length).trim();
            }
        }
        for (var j = 0; j < UNIT_EN.length; j++) {
            if (unit) break;
            var ue = UNIT_EN[j];
            if (ue.re.test(s)) {
                unit = ue.key;
                product = s.replace(ue.re, '').trim();
                break;
            }
        }
        if (!product && s) product = s;
        product = (product || '').replace(/^קורט\s+/, '').trim() || (product || text.trim()).trim();
        var result = { amount: amount, unit: unit, product: product };
        result.qty = amount != null ? amount : 1;
        result.unitKey = unit || '';
        result.name = product;
        return result;
    }

    /** Rule 4 – ממיר כמות ליחידות כוס: כוס=1, כף=1/16, כפית=1/48. יחידות אחרות (גרם וכו') → null. */
    function quantityInCups(parsed) {
        if (!parsed || typeof parsed.qty !== 'number') return null;
        var u = parsed.unitKey || '';
        if (u === 'כוס') return parsed.qty;
        if (u === 'כף') return parsed.qty / 16;
        if (u === 'כפית') return parsed.qty / 48;
        return null;
    }

    /** Rule 4 – שמן: נכנס לרשימה רק אם כמות >= כוס אחת. אין כמות/יחידה לא כוס → לא נכנס. */
    function oilQuantityAtLeastOneCup(text) {
        var simplified = simplifyIngredient(text) || text;
        var parsed = parseIngredient(simplified);
        var cups = quantityInCups(parsed);
        return cups !== null && cups >= 1;
    }

    /**
     * Rule 4 – האם להחרים את הפריט מרשימת הקניות: תבלינים/מלח/מים תמיד; שמן גנרי רק אם כמות < כוס.
     * גרסה ספציפית (שמן זית כתית מעולה, חומץ בלסמי) נשמרת תמיד.
     */
    function shouldExcludeFromShoppingList(text) {
        if (!text || !String(text).trim()) return true;
        if (!isPantryItem(text)) return false;
        if (!isOilProduct(text)) return true;
        var simplified = simplifyIngredient(text) || text;
        var parsed = parseIngredient(simplified);
        var productName = (parsed && parsed.name) ? parsed.name.trim() : '';
        if (isSpecificOilOrVinegar(productName)) return false;
        return !oilQuantityAtLeastOneCup(text);
    }

    /**
     * Rule 1 / Rule 5 – product name only: strip quantity and unit before comparing.
     * Remove: numbers, כף, כפית, כוס, גרם, ק"ג, מ"ל, ליטר, יחידות, קורט. Trim; compare via normalizeKey (lowercase/normalized Hebrew).
     * "1 כף סוכר" → "סוכר", "2 כפות שמן זית כתית מעולה" → "שמן זית כתית מעולה" (specific version kept).
     */
    function toProductName(text) {
        if (!text || typeof text !== 'string') return '';
        var simplified = simplifyIngredient(text) || text.trim();
        var parsed = parseIngredient(simplified);
        if (parsed && parsed.name && (parsed.name = parsed.name.trim())) return parsed.name;
        var s = simplified.replace(/\s+/g, ' ');
        s = s.replace(/^\d+(\.\d+)?\s*/, '').replace(/^\d+\/\d+\s*/, '').replace(/^חצי\s+/, '').replace(/^רבע\s+/, '').replace(/^קורט\s+/, '');
        for (var j = 0; j < UNIT_PAIRS.length; j++) {
            var u = UNIT_PAIRS[j];
            var re = new RegExp('^(' + u.singular + '|' + u.plural + ')\\s+', 'i');
            s = s.replace(re, '');
        }
        for (var i = 0; i < UNIT_EN.length; i++) s = s.replace(UNIT_EN[i].re, '');
        s = s.replace(/^\d+(\.\d+)?\s*g\s+/i, '').replace(/^גר.\s+/, '').replace(/^\d+(\.\d+)?\s*מ"ל\s+/i, '').replace(/^\d+(\.\d+)?\s*ליטר\s+/i, '');
        return s.replace(/\s+/g, ' ').trim() || text.trim();
    }

    /** יחידה ברבים לתצוגה */
    function pluralizeUnit(unit, amount) {
        if (!unit) return '';
        var usePlural = (amount > 1 || (amount !== Math.floor(amount) && amount > 0));
        for (var i = 0; i < UNIT_PAIRS.length; i++) {
            var u = UNIT_PAIRS[i];
            if (u.key === unit || u.singular === unit || u.plural === unit) {
                return usePlural ? u.plural : u.singular;
            }
        }
        return unit;
    }

    /** פורמט שורה אחת: עם כמות+יחידה "3 כוסות קמח", עם כמות בלבד "4 ביצים", בלי כמות "שמן זית כתית". */
    function formatDisplayLine(amount, unit, product) {
        if (!product) return '';
        if (amount == null) return product;
        var unitDisplay = unit ? pluralizeUnit(unit, amount) : '';
        if (amount === 0.5 && unitDisplay) return 'חצי ' + unitDisplay + ' ' + product;
        if (amount === 0.25 && unitDisplay) return 'רבע ' + unitDisplay + ' ' + product;
        if (unitDisplay) return amount + ' ' + unitDisplay + ' ' + product;
        return amount + ' ' + product;
    }

    /** קטגוריות לפי מדור בסופרמרקט – קל להרחבה */
    var CATEGORIES = {
        'ירקות ופירות': ['עגבנייה', 'עגבניות', 'מלפפון', 'מלפפונים', 'בצל', 'בצלים', 'שום', 'לימון', 'לימונים', 'תפוח', 'תפוחים', 'בננה', 'בננות', 'גזר', 'חסה', 'ברוקולי', 'כרוב', 'קישוא', 'חציל', 'סלרי', 'בטטה', 'תפוח אדמה', 'פלפל', 'גמבה', 'אבטיח', 'מלון', 'ענבים', 'רימון', 'אגס', 'משמש', 'פרי', 'ירק'],
        'בשר ודגים': ['עוף', 'בקר', 'בשר', 'טונה', 'סלמון', 'דג', 'דגים', 'הודו', 'כבש', 'חזה', 'שוק', 'צלי'],
        'מוצרי חלב וביצים': ['ביצה', 'ביצים', 'חמאה', 'שמנת', 'גבינה', 'יוגורט', 'חלב', 'ריקוטה', 'משקה חלב'],
        'מאפייה': ['קמח', 'לחם', 'שמרים', 'פירורי לחם', 'לחמנייה', 'פיתה', 'חלה'],
        'קטניות ודגנים': ['אורז', 'פסטה', 'עדשים', 'חומוס', 'קינואה', 'בורגול', 'שעועית', 'אפונה', 'מאש'],
        'תבלינים ורטבים': ['פפריקה', 'כמון', 'אורגנו', 'כורכום', 'זעתר', 'רוטב סויה', 'חומץ', 'רוטב', 'תבלין'],
        'שימורים': ['עגבניות מרוסקות', 'שימורי טונה', 'מרק משומר', 'רסק עגבניות', 'תירס משומר'],
        'אחר': []
    };

    /** סדר קטגוריות ברשימת הקניות */
    var CATEGORY_ORDER = [
        'מוצרי חלב וביצים',
        'בשר ודגים',
        'ירקות ופירות',
        'מאפייה',
        'קטניות ודגנים',
        'תבלינים ורטבים',
        'שימורים',
        'אחר'
    ];

    /** מחזיר קטגוריה לפי שם מוצר – קל להרחבה */
    function categorizeProduct(productName) {
        if (!productName || typeof productName !== 'string') return 'אחר';
        var t = (productName || '').toLowerCase().trim();
        var n = normalizeKey(productName);
        var keys = Object.keys(CATEGORIES);
        for (var i = 0; i < keys.length; i++) {
            var cat = keys[i];
            if (cat === 'אחר') continue;
            var terms = CATEGORIES[cat];
            for (var j = 0; j < terms.length; j++) {
                var term = (terms[j] || '').toLowerCase();
                if (!term) continue;
                if (t.indexOf(term) >= 0 || n.indexOf(normalizeKey(term)) >= 0) return cat;
            }
        }
        return 'אחר';
    }

    function getCategory(displayText) {
        return categorizeProduct(displayText);
    }

    /** בדיקת parseIngredient על 6 דוגמאות – הרצה מהקונסול: ShoppingList.runParseTest() */
    function runParseTest() {
        var examples = [
            '2 כפות שמן זית',
            'חצי כוס קמח',
            '3 שיני שום',
            '1 קורט מלח',
            '250 גרם בשר טחון',
            '4 ביצים'
        ];
        console.log('parseIngredient test:');
        examples.forEach(function (str) {
            var simplified = simplifyIngredient(str);
            var parsed = parseIngredient(simplified);
            console.log(JSON.stringify(str), '→', parsed ? { amount: parsed.amount, unit: parsed.unit, product: parsed.product } : null);
        });
    }

    function getRaw() {
        try {
            const raw = localStorage.getItem(CURRENT_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (_) {
            return [];
        }
    }

    function setRaw(list) {
        try {
            localStorage.setItem(CURRENT_KEY, JSON.stringify(list));
        } catch (_) {}
    }

    /**
     * מוסיף מרכיבים לרשימה. כל פריט: { text, recipeId?, recipeName? }
     * אגרגציה נעשית בתצוגה (getAggregated).
     */
    function addItems(recipeId, recipeName, items) {
        const list = getRaw();
        const toAdd = (items || []).filter(function (t) {
            var s = t && String(t).trim();
            return s && !shouldExcludeFromShoppingList(s);
        });
        toAdd.forEach(function (text) {
            var raw = String(text).trim();
            var simplified = simplifyIngredient(raw);
            list.push({
                text: simplified || raw,
                recipeId: recipeId || null,
                recipeName: recipeName || null
            });
        });
        setRaw(list);
    }

    /**
     * אגרגציה: קבוצה לפי product+unit; אותו מוצר+אותה יחידה – מסכמים כמות; יחידות שונות – שורות נפרדות; בלי כמות – דדופליקציה.
     */
    function getAggregated() {
        var list = getRaw();
        var byKey = {};
        list.forEach(function (item) {
            var text = item.text;
            var simplified = simplifyIngredient(text) || text;
            var parsed = parseIngredient(simplified);
            if (!parsed || !parsed.product) return;
            var product = parsed.product.trim();
            var productKey = normalizeKey(product) || '_';
            var unit = parsed.unit || '';
            var key = productKey + '|' + unit;
            var amount = parsed.amount;
            if (!byKey[key]) {
                byKey[key] = { key: key, product: product, unit: unit, amount: amount };
            } else {
                var existing = byKey[key];
                if (existing.amount != null && amount != null) {
                    existing.amount = existing.amount + amount;
                } else if (amount != null) {
                    existing.amount = amount;
                }
            }
        });
        var result = [];
        Object.keys(byKey).forEach(function (k) {
            var o = byKey[k];
            var displayText = formatDisplayLine(o.amount, o.unit, o.product);
            result.push({
                key: o.key,
                displayText: displayText,
                category: categorizeProduct(o.product)
            });
        });
        result.sort(function (a, b) { return (a.displayText || '').localeCompare(b.displayText || '', 'he'); });
        return result;
    }

    /** מחזיר את הרשימה המאוגדת מקובצת לפי קטגוריות (לפי סדר CATEGORY_ORDER) */
    function getAggregatedGroupedByCategory() {
        var agg = getAggregated();
        var grouped = {};
        CATEGORY_ORDER.forEach(function (cat) { grouped[cat] = []; });
        agg.forEach(function (item) {
            var cat = item.category || 'אחר';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        });
        return grouped;
    }

    /** מוחק פריט לפי מפתח (productKey|unit) – מוחק את כל השורות שמתאגדות למפתח הזה */
    function removeByKey(aggregateKey) {
        setRaw(getRaw().filter(function (item) {
            var simplified = simplifyIngredient(item.text) || item.text;
            var parsed = parseIngredient(simplified);
            if (!parsed || !parsed.product) return true;
            var key = (normalizeKey(parsed.product.trim()) || '_') + '|' + (parsed.unit || '');
            return key !== aggregateKey;
        }));
    }

    function clear() {
        setRaw([]);
    }

    /** שומר את הרשימה הנוכחית (המאוגדת) under שם – רשימות שמורות נפרדות */
    function saveNamedList(name) {
        const aggregated = getAggregated();
        if (aggregated.length === 0) return null;
        const saved = getSavedLists();
        const id = 'sl_' + Date.now();
        saved.push({
            id,
            name: (name || 'רשימת קניות').trim() || 'רשימת קניות',
            items: aggregated,
            createdAt: Date.now()
        });
        try {
            localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(saved));
            return id;
        } catch (_) {
            return null;
        }
    }

    function getSavedLists() {
        try {
            const raw = localStorage.getItem(SAVED_LISTS_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (_) {
            return [];
        }
    }

    function loadSavedList(id) {
        const saved = getSavedLists().find(l => l.id === id);
        if (!saved || !Array.isArray(saved.items)) return;
        loadSavedListFromData(saved);
    }

    /** טוען רשימה שמורה מאובייקט (למשל מפיירבייס) – items: [{ displayText, count }] */
    function loadSavedListFromData(list) {
        if (!list || !Array.isArray(list.items)) return;
        const raw = getRaw();
        list.items.forEach(({ displayText, count }) => {
            var n = typeof count === 'number' ? count : 1;
            for (var i = 0; i < n; i++) {
                raw.push({ text: displayText, recipeId: null, recipeName: null });
            }
        });
        setRaw(raw);
    }

    /** טקסט לרשימה (לשיתוף בווטסאפ) – שם מוצר בלבד, בלי כמויות */
    function getShareText() {
        var grouped = getAggregatedGroupedByCategory();
        var lines = [];
        CATEGORY_ORDER.forEach(function (cat) {
            var items = grouped[cat];
            if (!items || items.length === 0) return;
            lines.push('*' + cat + '*');
            items.forEach(function (item) {
                lines.push(item.displayText || '');
            });
            lines.push('');
        });
        return lines.join('\n').trim();
    }

    /** פותח ווטסאפ עם הרשימה */
    function shareToWhatsApp() {
        const text = getShareText();
        if (!text) return '';
        const encoded = encodeURIComponent(text);
        return 'https://wa.me/?text=' + encoded;
    }

    window.ShoppingList = {
        getRaw,
        addItems,
        getAggregated,
        getAggregatedGroupedByCategory,
        CATEGORY_ORDER,
        removeByKey,
        clear,
        saveNamedList,
        getSavedLists,
        loadSavedList,
        loadSavedListFromData,
        getShareText,
        shareToWhatsApp,
        normalizeKey,
        isPantryItem,
        runParseTest
    };
})();
