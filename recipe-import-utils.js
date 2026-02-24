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

/** שליפה מהקישור: מחזיר { name, image } או זורק בשגיאה */
export async function fetchRecipeMeta(url) {
    const proxyUrl = `/.netlify/functions/fetch-recipe?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return {
        name: extractRecipeName(doc, url) || 'מתכון',
        image: extractRecipeImage(doc, url)
    };
}
