import { db, auth, onUserChange } from './firebase.js';
import { collection, addDoc, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { extractRecipeName, extractRecipeImage, extractIngredientsAndInstructions } from './recipe-import-utils.js';

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

/** מחזיר שדות "הוסיף ע"י" מהמשתמש המחובר */
function getAddedByFields() {
    const user = auth.currentUser;
    return {
        addedByUid: user ? user.uid : null,
        addedByName: user ? (user.displayName || user.email || 'משתמשת') : 'נועה'
    };
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
    const { ingredients, instructions } = extractIngredientsAndInstructions(doc);

    const addedBy = getAddedByFields();
    const newRecipe = {
        name,
        source: new URL(url).hostname,
        image,
        url,
        ingredients: ingredients || [],
        instructions: instructions || [],
        addedByUid: addedBy.addedByUid,
        addedByName: addedBy.addedByName
    };
    await addDoc(collection(db, 'recipes'), newRecipe);
    return { name, url };
}

let ALL_TAGS = ['בשר', 'דגים', 'פסטות', 'טרטים ופשטידות', 'צמחוני', 'סלטים', 'תוספות', 'לחם ומאפים', 'רוטבים וממרחים', 'מרקים', 'עוגות', 'עוגיות', 'קינוחים', 'שוקולד', 'ארוחות בוקר', 'חטיפים', 'שתייה'];
async function loadTagConfig() {
    try {
        const snap = await getDoc(doc(db, 'config', 'tags'));
        if (snap.exists() && snap.data().allTags?.length) ALL_TAGS = snap.data().allTags;
    } catch (_) {}
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    const loginRequiredBlock = document.getElementById('login-required-block');
    const addRecipeContent = document.getElementById('add-recipe-content');

    function setBlocksVisibility(user) {
        if (loginRequiredBlock) loginRequiredBlock.style.display = user ? 'none' : 'block';
        if (addRecipeContent) addRecipeContent.style.display = user ? '' : 'none';
        return !!user;
    }

    let formInitialized = false;
    function initFormWhenReady(user) {
        if (!user || formInitialized) return;
        formInitialized = true;
        loadTagConfig();
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
                if (typeof window.__renderManualTags === 'function') window.__renderManualTags();
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
            const { ingredients, instructions } = extractIngredientsAndInstructions(doc);

            const addedBy = getAddedByFields();
            const newRecipe = {
                name: name,
                source: new URL(url).hostname,
                image: image,
                url: url,
                ingredients: ingredients || [],
                instructions: instructions || [],
                addedByUid: addedBy.addedByUid,
                addedByName: addedBy.addedByName
            };

            const ref = await addDoc(collection(db, 'recipes'), newRecipe);
            importStatus.className = 'import-status success';
            importStatus.textContent = '✅ המתכון נשמר! מעבירה לעריכה...';
            setTimeout(() => { window.location.href = 'recipe-detail.html?id=' + ref.id + '&edit=1'; }, 800);

        } catch (err) {
            console.error(err);
            importStatus.className = 'import-status error';
            importStatus.textContent = '⚠️ לא הצלחנו לייבא או לשמור. נסי שוב או השתמשי בהזנה ידנית';
        }
    });

    /** הצעת קטגוריות לפי שם מתכון (keyword matching) – כל שורה: [שם קטגוריה, מילות מפתח...] */
    function suggestTagsFromName(name) {
        const n = (name || '').toLowerCase();
        const suggested = new Set();
        const map = [
            ['בשר', 'עוף', 'סטייק', 'המבורגר', 'כבש'], ['דגים', 'דג', 'סלמון', 'טונה', 'לברק'],
            ['פסטות', 'פסטה', 'ספגטי', 'מקרוני', 'פנה'], ['צמחוני', 'צמחוני', 'ירקות', 'טופו'],
            ['סלטים', 'סלט'], ['תוספות', 'תוספת', 'אורז', 'תפוחי אדמה', 'קוסקוס'],
            ['לחם ומאפים', 'לחם', 'מאפה', 'פיתה', 'לחמניה'], ['רוטבים וממרחים', 'רוטב', 'ממרח', 'טחינה', 'חומוס'],
            ['מרקים', 'מרק'], ['עוגות', 'עוגה'], ['עוגיות', 'עוגיות', 'עוגייה'], ['קינוחים', 'קינוח'],
            ['שוקולד', 'שוקולד'], ['ארוחות בוקר', 'בוקר', 'פנקייק', 'חביתה', 'וופל'],
            ['חטיפים', 'חטיף', 'נשנוש'], ['שתייה', 'שתייה', 'משקה', 'לימונענה', 'מיץ']
        ];
        map.forEach(row => {
            const tag = row[0];
            if (row.slice(1).some(kw => n.includes(kw))) suggested.add(tag);
        });
        return [...suggested];
    }

    function renderManualTagsContainer() {
        const container = document.getElementById('manualTagsContainer');
        if (!container) return;
        const previouslySelected = [...container.querySelectorAll('.manual-tag-chip.active')].map(b => b.dataset.tag);
        const name = (document.getElementById('recipeName') && document.getElementById('recipeName').value) || '';
        const suggested = suggestTagsFromName(name);
        const toSelect = [...new Set([...previouslySelected, ...suggested])];
        container.innerHTML = ALL_TAGS.map(tag => {
            const isSuggested = suggested.includes(tag);
            const isActive = toSelect.includes(tag);
            return `<button type="button" class="manual-tag-chip ${isSuggested ? 'suggested' : ''} ${isActive ? 'active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`;
        }).join('');
        container.querySelectorAll('.manual-tag-chip').forEach(btn => {
            btn.addEventListener('click', () => btn.classList.toggle('active'));
        });
    }

    const recipeForm = document.getElementById('recipeForm');
    if (recipeForm) {
        const recipeNameInput = document.getElementById('recipeName');
        if (recipeNameInput) {
            recipeNameInput.addEventListener('input', () => renderManualTagsContainer());
            recipeNameInput.addEventListener('change', () => renderManualTagsContainer());
        }
        window.__renderManualTags = renderManualTagsContainer;
        loadTagConfig().then(() => renderManualTagsContainer());

        recipeForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('recipeName').value;
            const source = document.getElementById('recipeSource').value || 'מתכון ביתי';
            const image = document.getElementById('recipeImage').value || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
            const url = (document.getElementById('recipeUrl') && document.getElementById('recipeUrl').value.trim()) || '';

            const ingredientsText = document.getElementById('recipeIngredients').value;
            const ingredients = ingredientsText.split('\n').filter(line => line.trim() !== '');

            const instructionsText = document.getElementById('recipeInstructions').value;
            const instructions = instructionsText.split('\n').filter(line => line.trim() !== '');

            const tagsContainer = document.getElementById('manualTagsContainer');
            const tags = tagsContainer ? [...tagsContainer.querySelectorAll('.manual-tag-chip.active')].map(b => b.dataset.tag) : [];

            const submitBtn = recipeForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'שומר...';

            try {
                const addedBy = getAddedByFields();
                const newRecipe = { name, source, image, url, ingredients, instructions, tags, addedByUid: addedBy.addedByUid, addedByName: addedBy.addedByName };
                const ref = await addDoc(collection(db, 'recipes'), newRecipe);
                window.location.href = 'recipe-detail.html?id=' + ref.id + '&edit=1';
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
                <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">מקור (שם החשבון באינסטגרם/טיקטוק)</label>
                <input id="irm-source" placeholder="למשל: @chef_name או שם החשבון" value="${escapeHtml(recipe.source || '')}" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:1rem;box-sizing:border-box;margin-bottom:14px;background:white;">
                <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">קישור לריל</label>
                <input id="irm-url" type="url" placeholder="https://www.instagram.com/reel/... או קישור לטיקטוק" value="${escapeHtml(recipe.url || '')}" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:1rem;box-sizing:border-box;margin-bottom:14px;background:white;">
                <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">קישור לתמונה (אופציונלי)</label>
                <input id="irm-image" type="url" placeholder="https://..." value="${escapeHtml(recipe.image || '')}" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:1rem;box-sizing:border-box;margin-bottom:14px;background:white;">
                <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">מרכיבים</label>
                <textarea id="irm-ingredients" rows="5" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:0.9rem;box-sizing:border-box;margin-bottom:14px;resize:vertical;">${escapeHtml((recipe.ingredients || []).join('\n'))}</textarea>
                <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">הוראות הכנה</label>
                <textarea id="irm-instructions" rows="6" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:0.9rem;box-sizing:border-box;margin-bottom:14px;resize:vertical;">${escapeHtml((recipe.instructions || []).join('\n'))}</textarea>
                <label style="display:block;margin-bottom:6px;color:#407076;font-size:0.9rem;">קטגוריות</label>
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
                const source = document.getElementById('irm-source').value.trim() || '';
                const reelUrl = document.getElementById('irm-url').value.trim() || '';
                const imageUrl = (document.getElementById('irm-image') && document.getElementById('irm-image').value.trim()) || recipe.image || '';
                const ingredients = document.getElementById('irm-ingredients').value.split('\n').filter(l => l.trim());
                const instructions = document.getElementById('irm-instructions').value.split('\n').filter(l => l.trim());
                const tags = [...modal.querySelectorAll('.irm-tag.active')].map(b => b.dataset.tag);

                const addedBy = getAddedByFields();
                const ref = await addDoc(collection(db, 'recipes'), {
                    name,
                    source: source || 'מתמונה',
                    image: imageUrl,
                    url: reelUrl,
                    ingredients,
                    instructions,
                    tags,
                    addedByUid: addedBy.addedByUid,
                    addedByName: addedBy.addedByName
                });
                modal.remove();
                window.location.href = 'recipe-detail.html?id=' + ref.id + '&edit=1';
            } catch (err) {
                console.error(err);
                saveBtn.textContent = 'שמור מתכון';
                saveBtn.disabled = false;
                alert('שגיאה בשמירה. נסי שוב.');
            }
        });
    }

    function setImagesStatus(type, text) {
        if (imagesStatus) {
            imagesStatus.className = 'import-status ' + (type || '');
            imagesStatus.textContent = text || '';
            imagesStatus.style.display = text ? 'block' : 'none';
            imagesStatus.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /** דחיסה אגרסיבית – מפחיתה timeout: רוחב מקס 900px, JPEG 0.72. טקסט באינסטגרם/טיקטוק עדיין קריא. */
    function compressImageFile(file) {
        return new Promise((resolve, reject) => {
            const fallback = () => {
                const reader = new FileReader();
                reader.onload = e => resolve({ data: e.target.result.split(',')[1], mediaType: file.type || 'image/jpeg' });
                reader.onerror = () => reject(new Error('קריאת הקובץ נכשלה'));
                reader.readAsDataURL(file);
            };
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                const maxW = 900;
                let w = img.width, h = img.height;
                if (w > maxW) {
                    h = Math.round((h * maxW) / w);
                    w = maxW;
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                try {
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
                    resolve({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
                } catch (e) {
                    fallback();
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                fallback();
            };
            img.src = url;
        });
    }

    /** שליחה ברצף: תמונה אחת לכל בקשה, then מיזוג תוצאות – מונע timeout בסקרינשוטים מרובי תמונות */
    async function extractSequentialAndMerge(files, onProgress) {
        const allIngredients = [];
        const allInstructions = [];
        let name = '';
        const tagSet = new Set();
        for (let i = 0; i < files.length; i++) {
            if (onProgress) onProgress(i + 1, files.length);
            const compressed = await compressImageFile(files[i]);
            let res = await fetch('/.netlify/functions/extract-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: [compressed] })
            });
            if (res.status === 502 || res.status === 504) {
                res = await fetch('/.netlify/functions/extract-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ images: [compressed] })
                });
            }
            if (res.status === 502 || res.status === 504) {
                throw new Error('TIMEOUT');
            }
            let data;
            try {
                data = await res.json();
            } catch (_) {
                throw new Error('תשובה לא תקינה מהשרת');
            }
            if (data.error) throw new Error(data.error);
            if (data.name && !name) name = data.name;
            if (Array.isArray(data.ingredients)) data.ingredients.forEach(x => allIngredients.push(String(x).trim()));
            if (Array.isArray(data.instructions)) data.instructions.forEach(x => allInstructions.push(String(x).trim()));
            if (Array.isArray(data.suggestedTags)) data.suggestedTags.forEach(t => tagSet.add(t));
        }
        const dedupe = (arr) => [...new Set(arr.filter(Boolean).map(s => s.trim()))];
        return {
            name: name || 'מתכון',
            ingredients: dedupe(allIngredients),
            instructions: dedupe(allInstructions),
            suggestedTags: [...tagSet]
        };
    }

    if (extractFromImagesBtn) {
        extractFromImagesBtn.addEventListener('click', async () => {
            const files = Array.from(recipeImageFiles?.files || []);
            if (files.length === 0) {
                setImagesStatus('error', '⚠️ קודם בחרי תמונות בלחצן "בחרי תמונות" למעלה (בטאב ייבוא מתמונות).');
                return;
            }
            extractFromImagesBtn.disabled = true;
            const useSequential = files.length > 1;

            try {
                let result;
                if (useSequential) {
                    setImagesStatus('loading', `⏳ מעבד תמונה 1 מתוך ${files.length}...`);
                    result = await extractSequentialAndMerge(files, (current, total) => {
                        setImagesStatus('loading', `⏳ מעבד תמונה ${current} מתוך ${total}...`);
                    });
                } else {
                    setImagesStatus('loading', '⏳ שולח תמונה ל-AI...');
                    const compressed = await compressImageFile(files[0]);
                    const response = await fetch('/.netlify/functions/extract-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ images: [compressed] })
                    });
                    if (response.status === 502 || response.status === 504) {
                        setImagesStatus('error', 'השרת לא הספיק להגיב (timeout). נסי שוב בעוד רגע.');
                        extractFromImagesBtn.disabled = false;
                        return;
                    }
                    let data;
                    try {
                        data = await response.json();
                    } catch (_) {
                        setImagesStatus('error', 'שגיאה בתשובת השרת. נסי שוב.');
                        extractFromImagesBtn.disabled = false;
                        return;
                    }
                    if (data.error) {
                        setImagesStatus('error', data.error);
                        extractFromImagesBtn.disabled = false;
                        return;
                    }
                    if (!response.ok) {
                        setImagesStatus('error', 'שגיאה בשרת (' + response.status + '). נסי שוב.');
                        extractFromImagesBtn.disabled = false;
                        return;
                    }
                    result = data;
                }

                const hasContent = (result.ingredients && result.ingredients.length) || (result.instructions && result.instructions.length);
                if (!hasContent) {
                    const errDetail = result.error || '';
                    setImagesStatus('error', 'לא זוהו מרכיבים או הוראות. ' + (errDetail ? errDetail + ' ' : '') + 'נסי תמונה ברורה יותר או תמונה אחת.');
                    extractFromImagesBtn.disabled = false;
                    return;
                }
                setImagesStatus('success', '✅ המתכון חולץ! בדקי ועדכני לפני השמירה.');
                const reelLinkInput = document.getElementById('imagesReelLink');
                if (reelLinkInput && reelLinkInput.value.trim()) result.url = reelLinkInput.value.trim();
                showImageResultModal(result);
            } catch (err) {
                console.error(err);
                const isTimeout = err.message === 'TIMEOUT';
                const msg = isTimeout
                    ? (useSequential ? 'השרת לא הספיק להגיב. נסי עם תמונה אחת או שתיים, או שוב בעוד רגע.' : 'השרת לא הספיק להגיב. נסי שוב בעוד רגע.')
                    : (err.message || 'חיבור ל-AI נכשל. נסי שוב.');
                setImagesStatus('error', msg);
            }
            extractFromImagesBtn.disabled = false;
        });
    }

    }; // end initFormWhenReady

    onUserChange((user) => {
        setBlocksVisibility(user);
        initFormWhenReady(user);
    });
    console.log('✅ add-recipe.js loaded (Firebase)');
});