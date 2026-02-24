import { db } from './firebase.js';
import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { extractRecipeName, extractRecipeImage } from './recipe-import-utils.js';

/** מפרק CSV או טקסט לשורות ומחלץ URLs (שורה = קישור, או CSV עם עמודה שמכילה קישור) */
function parseUrlsFromCsv(text) {
    if (!text || !text.trim()) return [];
    const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const urlLike = /^https?:\/\//i;
    const urls = [];
    for (const line of lines) {
        const parts = line.split(/[\t,;]/).map(p => p.trim());
        let found = false;
        for (const p of parts) {
            if (urlLike.test(p)) {
                urls.push(p);
                found = true;
                break;
            }
        }
        if (!found && urlLike.test(line)) urls.push(line);
    }
    return [...new Set(urls)];
}

/** מייבא מתכון בודד מקישור (אותה לוגיקה כמו כפתור הייבוא) */
async function importOneRecipe(url) {
    const proxyUrl = `/.netlify/functions/fetch-recipe?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const name = extractRecipeName(doc, url) || 'מתכון חדש';
    const image = extractRecipeImage(doc, url);

    const newRecipe = {
        name,
        category: 'עיקריות',
        source: new URL(url).hostname,
        image,
        url,
        ingredients: [],
        instructions: []
    };
    await addDoc(collection(db, 'recipes'), newRecipe);
    return { name, url };
}

document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const importMode = document.getElementById('import-mode');
    const manualMode = document.getElementById('manual-mode');
    const csvMode = document.getElementById('csv-mode');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.getAttribute('data-mode');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            importMode.classList.remove('active');
            manualMode.classList.remove('active');
            if (csvMode) csvMode.classList.remove('active');
            if (mode === 'import') {
                importMode.classList.add('active');
            } else if (mode === 'csv') {
                if (csvMode) csvMode.classList.add('active');
            } else {
                manualMode.classList.add('active');
            }
        });
    });

    const importBtn = document.getElementById('importBtn');
    const importStatus = document.getElementById('import-status');

    importBtn.addEventListener('click', async () => {
        const url = document.getElementById('recipeUrl').value.trim();
        if (!url) {
            importStatus.className = 'import-status error';
            importStatus.textContent = '⚠️ נא להזין קישור למתכון';
            return;
        }

        importStatus.className = 'import-status loading';
        importStatus.textContent = '⏳ מייבא מתכון...';

        try {
            const proxyUrl = `/.netlify/functions/fetch-recipe?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const name = extractRecipeName(doc, url) || 'מתכון חדש';
            const image = extractRecipeImage(doc, url);

            const newRecipe = {
                name: name,
                category: 'עיקריות',
                source: new URL(url).hostname,
                image: image,
                url: url,
                ingredients: [],
                instructions: []
            };

            await addDoc(collection(db, 'recipes'), newRecipe);
            importStatus.className = 'import-status success';
            importStatus.textContent = '✅ המתכון נשמר ב-Firebase! מעבירה...';
            setTimeout(() => { window.location.href = 'index.html'; }, 800);

        } catch (err) {
            console.error(err);
            importStatus.className = 'import-status error';
            importStatus.textContent = '⚠️ לא הצלחנו לייבא או לשמור. נסי שוב או השתמשי בהזנה ידנית';
        }
    });

    const recipeForm = document.getElementById('recipeForm');
    if (recipeForm) {
        recipeForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('recipeName').value;
            const category = document.getElementById('recipeCategory').value;
            const source = document.getElementById('recipeSource').value || 'מתכון ביתי';
            const image = document.getElementById('recipeImage').value || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';

            const ingredientsText = document.getElementById('recipeIngredients').value;
            const ingredients = ingredientsText.split('\n').filter(line => line.trim() !== '');

            const instructionsText = document.getElementById('recipeInstructions').value;
            const instructions = instructionsText.split('\n').filter(line => line.trim() !== '');

            const submitBtn = recipeForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'שומר...';

            try {
                const newRecipe = { name, category, source, image, ingredients, instructions };
                await addDoc(collection(db, 'recipes'), newRecipe);
                window.location.href = 'index.html';
            } catch (err) {
                console.error(err);
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                alert('שגיאה בשמירת המתכון. נסי שוב.');
            }
        });
    }

    // ייבוא מקובץ CSV
    const csvFile = document.getElementById('csvFile');
    const csvPaste = document.getElementById('csvPaste');
    const csvImportBtn = document.getElementById('csvImportBtn');
    const csvStatus = document.getElementById('csv-status');

    async function runCsvImport() {
        let text = (csvPaste?.value || '').trim();
        if (csvFile?.files?.length) {
            text = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result || '');
                r.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
                r.readAsText(csvFile.files[0], 'UTF-8');
            });
        }
        const urls = parseUrlsFromCsv(text);
        if (urls.length === 0) {
            csvStatus.className = 'import-status error csv-bulk-status';
            csvStatus.textContent = '⚠️ לא נמצאו קישורים. הדביקי קישורים (שורה לכל קישור) או בחרי קובץ CSV.';
            return;
        }

        csvImportBtn.disabled = true;
        let done = 0;
        let failed = 0;
        const total = urls.length;
        const delayMs = 1200;

        const setStatus = (msg, isError = false) => {
            csvStatus.className = 'import-status csv-bulk-status' + (isError ? ' error' : ' loading');
            csvStatus.textContent = msg;
        };

        setStatus(`⏳ מייבא 0 מתוך ${total}...`);

        for (let i = 0; i < urls.length; i++) {
            try {
                await importOneRecipe(urls[i]);
                done++;
                setStatus(`⏳ מייבא ${done} מתוך ${total}...`);
            } catch (err) {
                console.warn('ייבוא נכשל:', urls[i], err);
                failed++;
                setStatus(`⏳ מייבא ${done} מתוך ${total} (${failed} נכשלו)...`);
            }
            if (i < urls.length - 1) await new Promise(r => setTimeout(r, delayMs));
        }

        csvImportBtn.disabled = false;
        csvStatus.className = 'import-status success csv-bulk-status';
        csvStatus.textContent = `✅ סיום: ${done} מתכונים יובאו ל-Firebase${failed ? `, ${failed} נכשלו.` : '.'}`;
        csvFile.value = '';
        csvPaste.value = '';
    }

    if (csvImportBtn) {
        csvImportBtn.addEventListener('click', runCsvImport);
    }

    console.log('✅ add-recipe.js loaded (Firebase)');
});