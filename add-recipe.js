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

const EDIT_CATEGORIES = ['עיקריות', 'תוספות', 'סלטים', 'מרקים', 'קינוחים', 'עוגות', 'עוגיות', 'מאפים', 'לחמים', 'כללי', 'ממרחים'];
const ALL_TAGS = ['מהיר', 'בינוני', 'ארוך', 'מנה עיקרית', 'תוספת', 'מרק', 'סלט', 'קינוח', 'לחם ומאפה', 'עוגות ועוגיות', 'רוטב וממרח', 'שתייה', 'בוקר', 'צהריים', 'ערב', 'חטיף', 'צמחוני', 'טבעוני', 'ללא גלוטן', 'ילדים', 'שבת וחגים', 'אירוח', 'כל השבוע'];

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const importMode = document.getElementById('import-mode');
    const manualMode = document.getElementById('manual-mode');
    const csvMode = document.getElementById('csv-mode');
    const imagesMode = document.getElementById('images-mode');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.getAttribute('data-mode');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            importMode.classList.remove('active');
            manualMode.classList.remove('active');
            if (csvMode) csvMode.classList.remove('active');
            if (imagesMode) imagesMode.classList.remove('active');
            if (mode === 'import') {
                importMode.classList.add('active');
            } else if (mode === 'csv') {
                if (csvMode) csvMode.classList.add('active');
            } else if (mode === 'images') {
                if (imagesMode) imagesMode.classList.add('active');
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

    // --- ייבוא מכמה תמונות ---
    const recipeImageFiles = document.getElementById('recipeImageFiles');
    const imagesPreview = document.getElementById('images-preview');
    const extractFromImagesBtn = document.getElementById('extractFromImagesBtn');
    const imagesStatus = document.getElementById('images-status');

    if (recipeImageFiles) {
        recipeImageFiles.addEventListener('change', () => {
            const files = Array.from(recipeImageFiles.files || []);
            extractFromImagesBtn.disabled = files.length === 0;
            if (files.length === 0) {
                imagesPreview.style.display = 'none';
                imagesPreview.innerHTML = '';
                return;
            }
            imagesPreview.style.display = 'flex';
            imagesPreview.innerHTML = files.map((f, i) => {
                const url = URL.createObjectURL(f);
                return `<div class="image-preview-item"><img src="${url}" alt="תמונה ${i + 1}"><span>תמונה ${i + 1}</span></div>`;
            }).join('');
        });
    }

    function showImageResultModal(recipe) {
        const modal = document.createElement('div');
        modal.className = 'image-result-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;padding:16px;';
        const tags = recipe.suggestedTags || [];
        modal.innerHTML = `
            <div style="background:#F8F7FF;border-radius:16px;padding:28px;width:100%;max-width:500px;font-family:'Varela Round',sans-serif;direction:rtl;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
                <h3 style="margin:0 0 20px;color:#407076;text-align:center;">בדיקה לפני שמירה</h3>
                <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">שם המתכון</label>
                <input id="irm-name" value="${escapeHtml(recipe.name || '')}" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:1rem;box-sizing:border-box;margin-bottom:14px;background:white;">
                <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">קטגוריה</label>
                <select id="irm-category" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:1rem;box-sizing:border-box;margin-bottom:14px;background:white;">
                    ${EDIT_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>
                <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">מרכיבים</label>
                <textarea id="irm-ingredients" rows="5" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:0.9rem;box-sizing:border-box;margin-bottom:14px;resize:vertical;">${escapeHtml((recipe.ingredients || []).join('\n'))}</textarea>
                <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">הוראות הכנה</label>
                <textarea id="irm-instructions" rows="6" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:0.9rem;box-sizing:border-box;margin-bottom:14px;resize:vertical;">${escapeHtml((recipe.instructions || []).join('\n'))}</textarea>
                <label style="display:block;margin-bottom:6px;color:#407076;font-size:0.9rem;">תגיות</label>
                <div id="irm-tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px;">
                    ${ALL_TAGS.map(tag => `<button type="button" class="irm-tag ${tags.includes(tag) ? 'active' : ''}" data-tag="${escapeHtml(tag)}" style="background:${tags.includes(tag) ? '#407076' : 'white'};color:${tags.includes(tag) ? 'white' : '#698996'};border:1.5px solid ${tags.includes(tag) ? '#407076' : '#c5d9dc'};border-radius:20px;padding:4px 12px;font-family:Varela Round,sans-serif;font-size:0.8rem;cursor:pointer;">${escapeHtml(tag)}</button>`).join('')}
                </div>
                <div style="display:flex;gap:10px;">
                    <button id="irm-save" style="flex:1;padding:12px;background:#407076;color:white;border:none;border-radius:8px;font-family:inherit;font-size:1rem;cursor:pointer;">שמור מתכון</button>
                    <button id="irm-cancel" style="flex:1;padding:12px;background:transparent;color:#407076;border:2px solid #407076;border-radius:8px;font-family:inherit;font-size:1rem;cursor:pointer;">ביטול</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.irm-tag').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const on = btn.classList.contains('active');
                btn.style.background = on ? '#407076' : 'white';
                btn.style.color = on ? 'white' : '#698996';
                btn.style.borderColor = on ? '#407076' : '#c5d9dc';
            });
        });
        modal.querySelector('#irm-cancel').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', ev => { if (ev.target === modal) modal.remove(); });

        modal.querySelector('#irm-save').addEventListener('click', async () => {
            const saveBtn = modal.querySelector('#irm-save');
            saveBtn.textContent = 'שומר...';
            saveBtn.disabled = true;
            try {
                const name = document.getElementById('irm-name').value.trim() || recipe.name || 'מתכון';
                const category = document.getElementById('irm-category').value;
                const ingredients = document.getElementById('irm-ingredients').value.split('\n').filter(l => l.trim());
                const instructions = document.getElementById('irm-instructions').value.split('\n').filter(l => l.trim());
                const tags = [...modal.querySelectorAll('.irm-tag.active')].map(b => b.dataset.tag);

                await addDoc(collection(db, 'recipes'), {
                    name,
                    category,
                    source: 'מתמונה',
                    image: '',
                    url: '',
                    ingredients,
                    instructions,
                    tags
                });
                modal.remove();
                window.location.href = 'index.html';
            } catch (err) {
                console.error(err);
                saveBtn.textContent = 'שמור מתכון';
                saveBtn.disabled = false;
                alert('שגיאה בשמירה. נסי שוב.');
            }
        });
    }

    if (extractFromImagesBtn) {
        extractFromImagesBtn.addEventListener('click', async () => {
            const files = Array.from(recipeImageFiles?.files || []);
            if (files.length === 0) {
                imagesStatus.className = 'import-status error';
                imagesStatus.textContent = '⚠️ נא לבחור לפחות תמונה אחת';
                return;
            }
            extractFromImagesBtn.disabled = true;
            imagesStatus.className = 'import-status loading';
            imagesStatus.textContent = '⏳ שולח תמונות ל-AI...';

            try {
                const images = await Promise.all(files.map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = e => resolve({ data: e.target.result.split(',')[1], mediaType: file.type || 'image/jpeg' });
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }));

                const response = await fetch('/.netlify/functions/extract-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ images })
                });
                const result = await response.json();
                if (result.error) {
                    imagesStatus.className = 'import-status error';
                    imagesStatus.textContent = result.error;
                    extractFromImagesBtn.disabled = false;
                    return;
                }
                imagesStatus.className = 'import-status success';
                imagesStatus.textContent = '✅ המתכון חולץ! בדקי ועדכני לפני השמירה.';
                showImageResultModal(result);
            } catch (err) {
                console.error(err);
                imagesStatus.className = 'import-status error';
                imagesStatus.textContent = 'שגיאה בחיבור ל-AI. נסי שוב.';
                extractFromImagesBtn.disabled = false;
                return;
            }
            extractFromImagesBtn.disabled = false;
        });
    }

    console.log('✅ add-recipe.js loaded (Firebase)');
});