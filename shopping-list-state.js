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
        'פלפל שחור', 'פלפל לבן', 'פפריקה מתוקה', 'מלח גס', 'תבלין',
        'שמן', 'שמן זית', 'שמן רגיל', 'שמן קנולה', 'שמן צמחי',
        'מים'
    ].map(function (t) { return normalizeKey(t); });

    function isPantryItem(text) {
        var key = normalizeKey(text);
        if (!key) return true;
        if (PANTRY_NORMALIZED.indexOf(key) !== -1) return true;
        for (var i = 0; i < PANTRY_NORMALIZED.length; i++) {
            var p = PANTRY_NORMALIZED[i];
            if (key === p || key.indexOf(p + ' ') === 0) return true;
        }
        return false;
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
            list.push({
                text: String(text).trim(),
                recipeId: recipeId || null,
                recipeName: recipeName || null
            });
        });
        setRaw(list);
    }

    /**
     * מחזיר רשימה מאוגדת: [{ key, displayText, count }]
     * מרכיבים עם אותו מפתח (לאחר נורמליזציה) מתאחדים; count = כמה פעמים הופיע.
     */
    function getAggregated() {
        const list = getRaw();
        const byKey = {};
        list.forEach(function (item) {
            var text = item.text;
            if (isPantryItem(text)) return;
            var key = normalizeKey(text) || text.trim().toLowerCase() || '_';
            if (!byKey[key]) {
                byKey[key] = { key: key, displayText: text, count: 0 };
            }
            byKey[key].count += 1;
        });
        return Object.values(byKey).sort(function (a, b) { return (a.displayText || '').localeCompare(b.displayText || '', 'he'); });
    }

    /** מוחק פריט לפי מפתח (מוחק את כל המופעים של המפתח המנורמלי) */
    function removeByKey(normalizedKey) {
        const list = getRaw().filter(item => normalizeKey(item.text) !== normalizedKey);
        setRaw(list);
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

    /** טקסט לרשימה (לשיתוף בווטסאפ) */
    function getShareText() {
        const agg = getAggregated();
        const lines = agg.map(({ displayText, count }) =>
            count > 1 ? displayText + ' x' + count : displayText
        );
        return lines.join('\n');
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
