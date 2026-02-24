/** שיתופי: חילוץ שם ותמונה מעמוד מתכון (לשימוש ב-add-recipe ו-recipe-detail) */

export function isErrorPageTitle(text) {
    if (!text || text.length < 2) return true;
    return /error response|404|forbidden|not found|שגיאה|לא נמצא|page not found/i.test(text);
}

export function extractRecipeName(doc, url) {
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
    if (ogTitle && !isErrorPageTitle(ogTitle)) return ogTitle;

    const h1 = doc.querySelector('h1')?.textContent?.trim();
    if (h1 && !isErrorPageTitle(h1)) return h1;

    const titleTag = doc.querySelector('title')?.textContent?.trim();
    if (titleTag && !isErrorPageTitle(titleTag)) {
        const clean = titleTag.split(/[\|\-–—]/)[0].trim();
        if (clean.length > 1) return clean;
    }

    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'מתכון מקישור'; }
}

export function resolveImageUrl(src, baseUrl) {
    if (!src || !baseUrl) return '';
    src = src.trim();
    if (src.startsWith('//')) return 'https:' + src;
    if (src.startsWith('http')) return src;
    try { return new URL(src, baseUrl).href; } catch (e) { return ''; }
}

export function extractRecipeImage(doc, pageUrl) {
    const og = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (og) {
        const resolved = resolveImageUrl(og, pageUrl);
        if (resolved.startsWith('http')) return resolved;
    }

    const tw = doc.querySelector('meta[name="twitter:image"], meta[property="twitter:image"]')?.getAttribute('content');
    if (tw) {
        const resolved = resolveImageUrl(tw, pageUrl);
        if (resolved.startsWith('http')) return resolved;
    }

    const main = doc.querySelector('article, main, [role="main"], .content, .post, .recipe');
    const container = main || doc.body;
    if (container) {
        const img = container.querySelector('img[src]');
        if (img) {
            const src = resolveImageUrl(img.getAttribute('src') || '', pageUrl);
            if (src) return src;
        }
    }

    const firstImg = doc.querySelector('img[src]');
    if (firstImg) {
        const src = resolveImageUrl(firstImg.getAttribute('src') || '', pageUrl);
        if (src) return src;
    }

    return '';
}

/** חילוץ מרכיבים והוראות מ-JSON-LD (Schema.org Recipe) או מהעמוד */
function extractFromJsonLd(doc) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
        try {
            const raw = script.textContent?.trim();
            if (!raw) continue;
            let data = JSON.parse(raw);
            if (Array.isArray(data)) data = data.find(item => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));
            else if (data['@graph']) data = data['@graph'].find(item => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));
            if (!data || (data['@type'] !== 'Recipe' && (!Array.isArray(data['@type']) || !data['@type'].includes('Recipe')))) continue;

            const ingredients = Array.isArray(data.recipeIngredient)
                ? data.recipeIngredient.map(i => typeof i === 'string' ? i.trim() : (i?.text || String(i)).trim()).filter(Boolean)
                : [];
            let instructions = [];
            if (Array.isArray(data.recipeInstructions)) {
                instructions = data.recipeInstructions.map(step => {
                    if (typeof step === 'string') return step.trim();
                    if (step['@type'] === 'HowToStep' && step.text) return step.text.trim();
                    if (step.name) return step.name.trim();
                    return '';
                }).filter(Boolean);
            }
            if (ingredients.length || instructions.length) return { ingredients, instructions };
        } catch (e) { /* ignore */ }
    }
    return null;
}

/** חילוץ רשימת מרכיבים מהעמוד לפי סלקטורים נפוצים */
function extractIngredientsFromDom(doc) {
    const selectors = [
        '[class*="ingredient"] li', '[class*="Ingredient"] li',
        '.wprm-recipe-ingredient', '.recipe-ingredients li', '.ingredients-list li',
        '[itemprop="recipeIngredient"]', '.ingredient',
        'ul.ingredients li', 'ol.ingredients li',
        '[data-ingredient]', '.list-ingredients li'
    ];
    for (const sel of selectors) {
        const nodes = doc.querySelectorAll(sel);
        if (nodes.length < 2) continue;
        const items = [];
        nodes.forEach(el => {
            const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
            if (text.length > 1 && text.length < 500) items.push(text);
        });
        if (items.length >= 2) return [...new Set(items)];
    }
    const allLists = doc.querySelectorAll('ul, ol');
    for (const list of allLists) {
        const prev = list.previousElementSibling?.textContent?.toLowerCase() || '';
        const prevPrev = list.previousElementSibling?.previousElementSibling?.textContent?.toLowerCase() || '';
        if (!/מרכיב|ingredient|רכיב/.test(prev + prevPrev)) continue;
        const items = [...list.querySelectorAll('li')].map(li => (li.textContent || '').trim().replace(/\s+/g, ' ')).filter(t => t.length > 1 && t.length < 500);
        if (items.length >= 2) return items;
    }
    return [];
}

/** חילוץ הוראות הכנה מהעמוד לפי סלקטורים נפוצים */
function extractInstructionsFromDom(doc) {
    const selectors = [
        '[class*="instruction"] li', '[class*="Instruction"] li',
        '.wprm-recipe-instruction', '.recipe-steps li', '.instructions-list li',
        '[itemprop="recipeInstructions"] li', '[itemprop="recipeInstructions"] p',
        '.directions li', '.steps li', '.method li',
        'ol.instructions li', 'ul.instructions li'
    ];
    for (const sel of selectors) {
        const nodes = doc.querySelectorAll(sel);
        if (nodes.length < 2) continue;
        const items = [];
        nodes.forEach(el => {
            const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
            if (text.length > 5 && text.length < 800) items.push(text);
        });
        if (items.length >= 2) return items;
    }
    const allLists = doc.querySelectorAll('ol, ul');
    for (const list of allLists) {
        const prev = list.previousElementSibling?.textContent?.toLowerCase() || '';
        const prevPrev = list.previousElementSibling?.previousElementSibling?.textContent?.toLowerCase() || '';
        if (!/הוראות|שלבים|הכנה|instruction|step|method|direction/.test(prev + prevPrev)) continue;
        const items = [...list.querySelectorAll('li')].map(li => (li.textContent || '').trim().replace(/\s+/g, ' ')).filter(t => t.length > 5 && t.length < 800);
        if (items.length >= 2) return items;
    }
    return [];
}

/** מחזיר { ingredients, instructions } – מנסה קודם JSON-LD ואז DOM */
export function extractIngredientsAndInstructions(doc) {
    const fromJson = extractFromJsonLd(doc);
    const ingredients = fromJson?.ingredients?.length ? fromJson.ingredients : extractIngredientsFromDom(doc);
    const instructions = fromJson?.instructions?.length ? fromJson.instructions : extractInstructionsFromDom(doc);
    return { ingredients, instructions };
}

/** שליפה מהקישור: מחזיר { name, image, ingredients, instructions } או זורק בשגיאה */
export async function fetchRecipeMeta(url) {
    const proxyUrl = `/.netlify/functions/fetch-recipe?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const { ingredients, instructions } = extractIngredientsAndInstructions(doc);
    return {
        name: extractRecipeName(doc, url) || 'מתכון',
        image: extractRecipeImage(doc, url),
        ingredients: ingredients || [],
        instructions: instructions || []
    };
}
