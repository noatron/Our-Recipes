/**
 * רשימת קניות – state משותף (זיכרון + localStorage לרשימה הנוכחית ורשימות שמורות).
 * אגרגציה: מרכיבים זהים מכמה מתכונים מתאחדים עם ספירה (למשל 2 עגבניות).
 */
(function () {
    const CURRENT_KEY = 'app_shopping_list';
    const SAVED_LISTS_KEY = 'app_saved_shopping_lists';

    /** מפתח לאגרגציה: נורמליזציה קלה (תפוח/תפוחים/תפוחי → תפוח) */
    function normalizeKey(text) {
        if (!text || typeof text !== 'string') return '';
        let s = text.trim().toLowerCase();
        s = s.replace(/\s+/g, ' ');
        s = s.replace(/ים\s/g, ' ').replace(/ים$/g, '');
        s = s.replace(/י\s/g, ' ').replace(/י$/g, '');
        return s;
    }

    /** תבלינים יבשים, שמנים ומים – לא נכנסים לרשימת הקניות (בזיליקום טרי וכו' כן) */
    var PANTRY_NORMALIZED = [
        'מלח', 'פלפל', 'פפריקה', 'אורגנו', 'כורכום', 'כמון', 'זעתר',
        'פלפל שחור', 'פלפל לבן', 'פפריקה מתוקה', 'מלח גס', 'תבלין', 'קורט',
        'שמן', 'שמן זית', 'שמן רגיל', 'שמן קנולה', 'שמן צמחי',
        'מים'
    ].map(function (t) { return normalizeKey(t); });

    /** תבלינים/שמנים באנגלית – לזיהוי והשמטה */
    var PANTRY_EN = [
        'black pepper', 'salt', 'kosher salt', 'cooking salt', 'dried thyme',
        'olive oil', 'extra virgin olive oil', 'evoo', 'vegetable oil'
    ].map(function (t) { return t.trim().toLowerCase(); });

    function isPantryItem(text) {
        var key = normalizeKey(text);
        if (!key) return true;
        if (PANTRY_NORMALIZED.indexOf(key) !== -1) return true;
        for (var i = 0; i < PANTRY_NORMALIZED.length; i++) {
            var p = PANTRY_NORMALIZED[i];
            if (key === p || key.indexOf(p + ' ') === 0) return true;
        }
        var low = (text || '').trim().toLowerCase();
        if (/^קורט\s/.test(low)) return true;
        for (var j = 0; j < PANTRY_EN.length; j++) {
            if (low === PANTRY_EN[j] || low.indexOf(PANTRY_EN[j] + ' ') === 0 || low.indexOf(' ' + PANTRY_EN[j]) >= 0) return true;
        }
        return false;
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
        s = s.replace(/\s+/g, ' ').trim();
        return s || text.trim();
    }

    /** יחידות נפוצות – לנורמליזציה ורבים (כף→כפות); כולל אנגלית → מפתח עברי */
    var UNIT_PAIRS = [
        { singular: 'כף', plural: 'כפות', key: 'כף' },
        { singular: 'כפית', plural: 'כפיות', key: 'כפית' },
        { singular: 'כוס', plural: 'כוסות', key: 'כוס' },
        { singular: 'חבילה', plural: 'חבילות', key: 'חבילה' },
        { singular: 'יחידה', plural: 'יחידות', key: 'יחידה' },
        { singular: 'גרם', plural: 'גרם', key: 'גרם' },
        { singular: 'ק"ג', plural: 'ק"ג', key: 'ק\"ג' },
        { singular: 'מלא', plural: 'מלא', key: 'מלא' }
    ];
    var UNIT_EN = [
        { re: /^tbsp\.?\s+|^tbs\.?\s+|^tablespoons?\s+/i, key: 'כף' },
        { re: /^tsp\.?\s+|^teaspoons?\s+/i, key: 'כפית' },
        { re: /^cups?\s+/i, key: 'כוס' },
        { re: /^g\s+|^gram(?:s)?\s+/i, key: 'גרם' },
        { re: /^kg\s+|^kilo(?:gram)?s?\s+/i, key: 'ק\"ג' }
    ];

    /** מפרק מרכיב למספר + יחידה + שם (תומך בעברית, אנגלית, שברים 1/2) */
    function parseIngredient(text) {
        if (!text || typeof text !== 'string') return null;
        var s = text.trim().replace(/\s+/g, ' ');
        var qty = 1;
        var unitKey = '';
        var name = s;

        var numMatch = s.match(/^(\d+(?:\.\d+)?)\s+/);
        var gMatch = s.match(/^(\d+(?:\.\d+)?)\s*g\s+/i);
        var fracMatch = s.match(/^(\d+)\/(\d+)\s+/);
        if (gMatch) {
            qty = parseFloat(gMatch[1], 10);
            s = s.slice(gMatch[0].length).trim();
            unitKey = 'גרם';
            name = s;
            return { qty: qty, unitKey: unitKey, name: name };
        }
        if (numMatch) {
            qty = parseFloat(numMatch[1], 10);
            s = s.slice(numMatch[0].length).trim();
        } else if (fracMatch) {
            qty = parseInt(fracMatch[1], 10) / parseInt(fracMatch[2], 10);
            s = s.slice(fracMatch[0].length).trim();
        } else if (/^חצי\s/i.test(s)) {
            qty = 0.5;
            s = s.replace(/^חצי\s+/, '').trim();
        } else if (/^רבע\s/i.test(s)) {
            qty = 0.25;
            s = s.replace(/^רבע\s+/, '').trim();
        }

        for (var i = 0; i < UNIT_EN.length; i++) {
            var ue = UNIT_EN[i];
            if (ue.re.test(s)) {
                unitKey = ue.key;
                name = s.replace(ue.re, '').trim();
                break;
            }
        }
        if (!unitKey) {
            for (var j = 0; j < UNIT_PAIRS.length; j++) {
                var u = UNIT_PAIRS[j];
                var re = new RegExp('^(' + u.singular + '|' + u.plural + ')\\s+', 'i');
                if (re.test(s)) {
                    unitKey = u.key;
                    name = s.replace(re, '').trim();
                    break;
                }
            }
        }
        if (!name) name = text.trim();
        return { qty: qty, unitKey: unitKey, name: name };
    }

    /** מחזיר טקסט לתצוגה: כמות + יחידה ברבים + שם (2 כפות סוכר) */
    function formatMerged(qty, unitKey, name) {
        if (!unitKey) return name;
        var unitDisplay = unitKey;
        for (var i = 0; i < UNIT_PAIRS.length; i++) {
            if (UNIT_PAIRS[i].key === unitKey) {
                unitDisplay = (qty > 1 || qty !== Math.floor(qty)) ? UNIT_PAIRS[i].plural : UNIT_PAIRS[i].singular;
                break;
            }
        }
        if (qty === Math.floor(qty) && qty >= 1) {
            return qty + ' ' + unitDisplay + ' ' + name;
        }
        if (qty === 0.5) return 'חצי ' + unitDisplay + ' ' + name;
        if (qty === 0.25) return 'רבע ' + unitDisplay + ' ' + name;
        return qty + ' ' + unitDisplay + ' ' + name;
    }

    /** סדר קטגוריות ברשימת הקניות */
    var CATEGORY_ORDER = [
        'מוצרי חלב',
        'ביצים',
        'בשר ועוף',
        'דגים',
        'ירקות',
        'פירות',
        'חומרים יבשים',
        'אחר'
    ];

    /** מחזיר קטגוריה לפי מילות מפתח בשם המרכיב */
    function getCategory(displayText) {
        var t = (displayText || '').toLowerCase().trim();
        var n = normalizeKey(t);
        var dairy = /חלב|שמנת|גבינה|יוגורט|חמאה|ריקוטה|משקה חלב|milk|cream|cheese|butter|yogurt|mascarpone/i;
        var eggs = /ביצה|ביצים|egg/i;
        var meat = /עוף|בקר|כבש|הודו|חזה|שוק|צלי|בשר|meat|chicken|beef|turkey|lamb/i;
        var fish = /דג|סלמון|טונה|לברק|בורי|דגים|fish|salmon|tuna/i;
        var veg = /עגבני[הות]|מלפפון|גזר|בצל|שום|פלפל|חסה|ברוקולי|כרוב|גמבה|קישוא|חציל|סלרי|בטטה|תפוח\s*אדמה|עגבניה|מלפפון|tomato|potato|onion|carrot|vegetable|lettuce|pepper/i;
        var fruit = /תפוח|בננה|לימון|תפוז|אבטיח|מלון|ענבים|רימון|אגס|משמש|פרי|apple|banana|lemon|orange|fruit/i;
        var dry = /קמח|סוכר|אורז|פסטה|שקדים|אגוזים|צימוקים|קורנפלור|סודה לשתייה|אבקת אפייה|שוקולד|קקאו|גרעינים|שומשום|קוקוס|מיונז|פירורי לחם|flour|sugar|rice|pasta|almond|nut|chocolate|coconut|stock|broth/i;
        if (dairy.test(t) || dairy.test(n)) return 'מוצרי חלב';
        if (eggs.test(t) || eggs.test(n)) return 'ביצים';
        if (meat.test(t) || meat.test(n)) return 'בשר ועוף';
        if (fish.test(t) || fish.test(n)) return 'דגים';
        if (veg.test(t) || veg.test(n)) return 'ירקות';
        if (fruit.test(t) || fruit.test(n)) return 'פירות';
        if (dry.test(t) || dry.test(n)) return 'חומרים יבשים';
        return 'אחר';
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
            return s && !isPantryItem(s);
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
     * מחזיר רשימה מאוגדת: [{ key, displayText, count }]
     * מרכיבים עם יחידה (כף סוכר) מתאחדים לסכום (2 כפות סוכר); בלי יחידה – איחוד לפי שם + count.
     */
    function getAggregated() {
        var list = getRaw();
        var byKey = {};
        list.forEach(function (item) {
            var text = item.text;
            if (isPantryItem(text)) return;
            var parsed = parseIngredient(text);
            var key;
            var displayText;
            if (parsed && parsed.unitKey && parsed.name) {
                key = 'u:' + parsed.unitKey + ':' + normalizeKey(parsed.name);
                if (!byKey[key]) {
                    byKey[key] = { key: key, qty: 0, unitKey: parsed.unitKey, name: parsed.name, displayText: '' };
                }
                byKey[key].qty += parsed.qty;
            } else {
                key = normalizeKey(text) || text.trim().toLowerCase() || '_';
                if (!byKey[key]) {
                    byKey[key] = { key: key, qty: 0, unitKey: '', name: '', displayText: text, countOnly: true };
                }
                byKey[key].countOnly = true;
                byKey[key].count = (byKey[key].count || 0) + 1;
                byKey[key].displayText = byKey[key].displayText || text;
            }
        });
        var result = [];
        Object.keys(byKey).forEach(function (k) {
            var o = byKey[k];
            var displayText = o.countOnly ? o.displayText : formatMerged(o.qty, o.unitKey, o.name);
            var count = o.countOnly ? (o.count || 1) : o.qty;
            result.push({
                key: o.key,
                displayText: displayText,
                count: count,
                category: getCategory(displayText)
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

    /** מוחק פריט לפי מפתח (מפתח רגיל או מאוחד u:unit:name) */
    function removeByKey(normalizedKey) {
        if (normalizedKey.indexOf('u:') === 0) {
            var parts = normalizedKey.split(':');
            var unitKey = parts[1];
            var nameKey = parts.slice(2).join(':');
            setRaw(getRaw().filter(function (item) {
                var p = parseIngredient(item.text);
                if (!p || p.unitKey !== unitKey) return true;
                return normalizeKey(p.name) !== nameKey;
            }));
        } else {
            setRaw(getRaw().filter(function (item) { return normalizeKey(item.text) !== normalizedKey; }));
        }
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
        const raw = getRaw();
        saved.items.forEach(({ displayText, count }) => {
            for (let i = 0; i < count; i++) {
                raw.push({ text: displayText, recipeId: null, recipeName: null });
            }
        });
        setRaw(raw);
    }

    /** טקסט לרשימה (לשיתוף בווטסאפ) – שורות מאוחדות (2 כפות סוכר) כבר כוללות כמות */
    function getShareText() {
        var grouped = getAggregatedGroupedByCategory();
        var lines = [];
        CATEGORY_ORDER.forEach(function (cat) {
            var items = grouped[cat];
            if (!items || items.length === 0) return;
            lines.push('*' + cat + '*');
            items.forEach(function (item) {
                var alreadyMerged = /^\d|^חצי\s|^רבע\s/.test(item.displayText || '');
                if (alreadyMerged) lines.push(item.displayText);
                else lines.push(item.count > 1 ? item.displayText + ' x' + item.count : item.displayText);
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
        getShareText,
        shareToWhatsApp,
        normalizeKey,
        isPantryItem
    };
})();
