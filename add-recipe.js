import { db, onUserChange } from './firebase-v2.js';
import { collection, addDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { extractRecipeName, extractRecipeImage, suggestTags } from './recipe-import-utils.js';

let currentUser = null;
onUserChange(user => { currentUser = user; });

async function urlAlreadyExists(url) {
    const q = query(collection(db, 'recipes'), where('url', '==', url));
    const existing = await getDocs(q);
    return !existing.empty;
}

function parseUrlsFromCsv(text) {
    if (!text || !text.trim()) return [];
    const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const urlLike = /^https?:\/\//i;
    const urls = [];
    for (const line of lines) {
        const parts = line.split(/[\t,;]/).map(p => p.trim());
        let found = false;
        for (const p of parts) {
            if (urlLike.test(p)) { urls.push(p); found = true; break; }
        }
        if (!found && urlLike.test(line)) urls.push(line);
    }
    return [...new Set(urls)];
}

async function importOneRecipe(url) {
    const proxyUrl = `/.netlify/functions/fetch-recipe?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const name = extractRecipeName(doc, url) || 'מתכון חדש';
    const image = extractRecipeImage(doc, url);
    const newRecipe = {
        name, category: 'כללי',
        source: new URL(url).hostname,
        image, url,
        tags: suggestTags(name),
        addedBy: currentUser?.displayName?.split(' ')[0] || 'אנונימי',
        ingredients: [], instructions: []
    };
    await addDoc(collection(db, 'recipes'), newRecipe);
    return { name, url };
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

const EDIT_CATEGORIES = ['עיקריות', 'תוספות', 'סלטים', 'מרקים', 'קינוחים', 'עוגות', 'עוגיות', 'מאפים', 'לחמים', 'כללי', 'ממרחים'];

function showPreviewModal({ name, image, url, tags = [] }) {
    document.getElementById('recipe-preview-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'recipe-preview-modal';
    modal.style.cssText = `position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 16px;`;
    modal.innerHTML = `
        <div style="background: #F8F7FF; border-radius: 16px; padding: 28px; width: 100%; max-width: 420px; font-family: 'Varela Round', sans-serif; direction: rtl; box-shadow: 0 8px 32px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto;">
            <h3 style="margin: 0 0 20px; color: #407076; text-align: center; font-size: 1.3rem;">בדיקה לפני שמירה</h3>

            <label style="display:block; margin-bottom: 4px; color: #407076; font-size: 0.9rem;">שם המתכון</label>
            <input id="pm-name" value="${escapeHtml(name)}" style="width:100%; padding: 10px 12px; border: 2px solid #c5d9dc; border-radius: 8px; font-family: inherit; font-size: 1rem; box-sizing: border-box; margin-bottom: 14px; background: white;">

            <label style="display:block; margin-bottom: 4px; color: #407076; font-size: 0.9rem;">קטגוריה</label>
            <select id="pm-category" style="width:100%; padding: 10px 12px; border: 2px solid #c5d9dc; border-radius: 8px; font-family: inherit; font-size: 1rem; box-sizing: border-box; margin-bottom: 14px; background: white; cursor: pointer;">
                ${EDIT_CATEGORIES.map(cat => `<option value="${cat}" ${cat === 'כללי' ? 'selected' : ''}>${cat}</option>`).join('')}
            </select>

            <label style="display:block; margin-bottom: 4px; color: #407076; font-size: 0.9rem;">קישור לתמונה</label>
            <input id="pm-image" value="${escapeHtml(image)}" placeholder="https://..." style="width:100%; padding: 10px 12px; border: 2px solid #c5d9dc; border-radius: 8px; font-family: inherit; font-size: 0.85rem; box-sizing: border-box; margin-bottom: 14px; background: white;">

            <label style="display:block; margin-bottom: 4px; color: #407076; font-size: 0.9rem;">תגיות מוצעות — לחצי להסיר/להוסיף</label>
            <div id="pm-tags" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px;">
                ${tags.map(tag => `
                    <button type="button" class="tag-chip active" data-tag="${tag}"
                        style="background:#407076; color:white; border:2px solid #407076; border-radius:20px; padding:6px 14px; font-family:'Varela Round',sans-serif; font-size:0.85rem; cursor:pointer;">
                        ${tag}
                    </button>
                `).join('')}
            </div>

            <div style="display: flex; gap: 10px;">
                <button id="pm-save" style="flex:1; padding: 12px; background: #407076; color: white; border: none; border-radius: 8px; font-family: inherit; font-size: 1rem; cursor: pointer;">✓ שמור מתכון</button>
                <button id="pm-cancel" style="flex:1; padding: 12px; background: transparent; color: #407076; border: 2px solid #407076; border-radius: 8px; font-family: inherit; font-size: 1rem; cursor: pointer;">ביטול</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // toggle tag chips
    modal.querySelectorAll('.tag-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            btn.style.background = btn.classList.contains('active') ? '#407076' : 'white';
            btn.style.color = btn.classList.contains('active') ? 'white' : '#407076';
        });
    });

    document.getElementById('pm-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });

    document.getElementById('pm-save').addEventListener('click', async () => {
        const finalName = document.getElementById('pm-name').value.trim() || name;
        const finalCategory = document.getElementById('pm-category').value;
        const finalImage = document.getElementById('pm-image').value.trim() || image;
        const finalTags = [...modal.querySelectorAll('.tag-chip.active')].map(b => b.dataset.tag);

        const saveBtn = document.getElementById('pm-save');
        saveBtn.textContent = 'שומר...';
        saveBtn.disabled = true;

        try {
            const newRecipe = {
                name: finalName,
                category: finalCategory,
                source: new URL(url).hostname,
                image: finalImage,
                url,
                tags: finalTags,
                addedBy: currentUser?.displayName?.split(' ')[0] || 'אנונימי',
                ingredients: [],
                instructions: []
            };
            await addDoc(collection(db, 'recipes'), newRecipe);
            modal.remove();
            window.location.href = 'index.html';
        } catch (err) {
            console.error(err);
            saveBtn.textContent = '✓ שמור מתכון';
            saveBtn.disabled = false;
            alert('שגיאה בשמירה. נסי שוב.');
        }
    });
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
            if (mode === 'import') importMode.classList.add('active');
            else if (mode === 'csv') { if (csvMode) csvMode.classList.add('active'); }
            else manualMode.classList.add('active');
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
        importStatus.textContent = '⏳ בודקת כפילות...';
        try {
            const exists = await urlAlreadyExists(url);
            if (exists) {
                importStatus.className = 'import-status error';
                importStatus.textContent = '⚠️ המתכון הזה כבר קיים באוסף!';
                return;
            }
            importStatus.textContent = '⏳ מייבאת מתכון...';
            const proxyUrl = `/.netlify/functions/fetch-recipe?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const name = extractRecipeName(doc, url) || 'מתכון חדש';
            const image = extractRecipeImage(doc, url);
            const tags = suggestTags(name);
            importStatus.className = 'import-status success';
            importStatus.textContent = '✅ המתכון נשלף! בדקי את הפרטים לפני השמירה.';
            showPreviewModal({ name, image, url, tags });
        } catch (err) {
            console.error(err);
            importStatus.className = 'import-status error';
            importStatus.textContent = '⚠️ לא הצלחנו לייבא. נסי שוב או השתמשי בהזנה ידנית';
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
            const ingredients = document.getElementById('recipeIngredients').value.split('\n').filter(l => l.trim());
            const instructions = document.getElementById('recipeInstructions').value.split('\n').filter(l => l.trim());
            const submitBtn = recipeForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'שומר...';
            try {
                const newRecipe = {
                    name, category, source, image, ingredients, instructions,
                    tags: suggestTags(name),
                    addedBy: currentUser?.displayName?.split(' ')[0] || 'אנונימי'
                };
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

    // ייבוא CSV
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
            csvStatus.textContent = '⚠️ לא נמצאו קישורים.';
            return;
        }
        csvImportBtn.disabled = true;
        let done = 0, skipped = 0, failed = 0;
        const total = urls.length;
        const setStatus = (msg) => {
            csvStatus.className = 'import-status loading csv-bulk-status';
            csvStatus.textContent = msg;
        };
        setStatus(`⏳ מייבא 0 מתוך ${total}...`);
        for (let i = 0; i < urls.length; i++) {
            try {
                const exists = await urlAlreadyExists(urls[i]);
                if (exists) { skipped++; }
                else { await importOneRecipe(urls[i]); done++; }
                setStatus(`⏳ מייבא ${done} מתוך ${total}${skipped ? ` (${skipped} כפולים)` : ''}...`);
            } catch (err) {
                failed++;
            }
            if (i < urls.length - 1) await new Promise(r => setTimeout(r, 1200));
        }
        csvImportBtn.disabled = false;
        csvStatus.className = 'import-status success csv-bulk-status';
        csvStatus.textContent = `✅ סיום: ${done} יובאו, ${skipped} כפולים${failed ? `, ${failed} נכשלו` : ''}.`;
        if (csvFile) csvFile.value = '';
        if (csvPaste) csvPaste.value = '';
    }

    if (csvImportBtn) csvImportBtn.addEventListener('click', runCsvImport);

    console.log('✅ add-recipe.js loaded');
});