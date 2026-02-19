export function extractRecipeName(doc, url) {
    // ניסיון 1: JSON-LD (הכי אמין)
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
        try {
            const data = JSON.parse(script.textContent);
            const recipe = Array.isArray(data) ? data.find(d => d['@type'] === 'Recipe') : data;
            if (recipe?.name) return recipe.name;
        } catch (e) {}
    }

    // ניסיון 2: meta og:title
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle?.content) return ogTitle.content;

    // ניסיון 3: title של הדף
    const title = doc.querySelector('title');
    if (title?.textContent) return title.textContent.split('|')[0].split('-')[0].trim();

    return null;
}

export function extractRecipeImage(doc, url) {
    // ניסיון 1: JSON-LD
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
        try {
            const data = JSON.parse(script.textContent);
            const recipe = Array.isArray(data) ? data.find(d => d['@type'] === 'Recipe') : data;
            if (recipe?.image) {
                const img = recipe.image;
                if (typeof img === 'string') return img;
                if (img.url) return img.url;
                if (Array.isArray(img) && img[0]) return typeof img[0] === 'string' ? img[0] : img[0].url;
            }
        } catch (e) {}
    }

    // ניסיון 2: meta og:image
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage?.content) return ogImage.content;

    return 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=300&fit=crop';
}
export async function fetchRecipeMeta(url) {
    const proxyUrl = `/.netlify/functions/fetch-recipe?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
        throw new Error(`שגיאת שרת: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('HTML התקבל, אורך:', html.length);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const name = extractRecipeName(doc, url) || 'מתכון';
    const image = extractRecipeImage(doc, url);
    
    console.log('שם שחולץ:', name);
    console.log('תמונה שחולצה:', image);
    
    return { name, image };

}