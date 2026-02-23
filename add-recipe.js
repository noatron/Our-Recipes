import { db } from './firebase.js';
import { collection, addDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { extractRecipeName, extractRecipeImage } from './recipe-import-utils.js';

const ALL_TAGS = ['מהיר', 'בינוני', 'ארוך', 'מנה עיקרית', 'תוספת', 'מרק', 'סלט', 'קינוח', 'לחם ומאפה', 'עוגות ועוגיות', 'רוטב וממרח', 'שתייה', 'בוקר', 'צהריים', 'ערב', 'חטיף', 'צמחוני', 'טבעוני', 'ללא גלוטן', 'ילדים', 'שבת וחגים', 'אירוח', 'כל השבוע'];

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
    const newRecipe = { name, category: 'כללי', source: new URL(url).hostname, image, url, ingredients: [], instructions: [] };
    await addDoc(collection(db, 'recipes'), newRecipe);
    return { name, url };
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

const EDIT_CATEGORIES = ['עיקריות', 'תוספות', 'סלטים', 'מרקים', 'קינוחים', 'עוגות', 'עוגיות', 'מאפים', 'לחמים', 'כללי', 'ממרחים'];

function showPreviewModal({ name, image, url }) {
    document.getElementById('recipe-preview-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'recipe-preview-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `<div style="background:#F8F7FF;border-radius:16px;padding:28px;width:100%;max-width:420px;font-family:'Varela Round',sans-serif;direction:rtl;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
        <h3 style="margin:0 0 20px;color:#407076;text-align:center;font-size:1.3rem;">בדיקה לפני שמירה</h3>
        <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">שם המתכון</label>
        <input id="pm-name" value="${escapeHtml(name)}" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:1rem;box-sizing:border-box;margin-bottom:14px;background:white;">
        <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">קטגוריה</label>
        <select id="pm-category" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:1rem;box-sizing:border-box;margin-bottom:14px;background:white;cursor:pointer;">
            ${EDIT_CATEGORIES.map(cat => `<option value="${cat}" ${cat === 'כללי' ? 'selected' : ''}>${cat}</option>`).join('')}
        </select>
        <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">קישור לתמונה</label>
        <input id="pm-image" value="${escapeHtml(image)}" placeholder="https://..." style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;background:white;">
        <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">הוסיף/ה</label>
        <input id="pm-addedby" placeholder="שם המוסיף..." style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:1rem;box-sizing:border-box;margin-bottom:20px;background:white;">
        <div style="display:flex;gap:10px;">
            <button id="pm-save" style="flex:1;padding:12px;background:#407076;color:white;border:none;border-radius:8px;font-family:inherit;font-size:1rem;cursor:pointer;">שמור מתכון</button>
            <button id="pm-cancel" style="flex:1;padding:12px;background:transparent;color:#407076;border:2px solid #407076;border-radius:8px;font-family:inherit;font-size:1rem;cursor:pointer;">ביטול</button>
        </div></div>`;
    document.body.appendChild(modal);
    document.getElementById('pm-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });
    document.getElementById('pm-save').addEventListener('click', async () => {
        const finalName = document.getElementById('pm-name').value.trim() || name;
        const finalCategory = document.getElementById('pm-category').value;
        const finalImage = document.getElementById('pm-image').value.trim() || image;
        const finalAddedBy = document.getElementById('pm-addedby').value.trim();
        const saveBtn = document.getElementById('pm-save');
        saveBtn.textContent = 'שומר...'; saveBtn.disabled = true;
        try {
            await addDoc(collection(db, 'recipes'), { name: finalName, category: finalCategory, source: new URL(url).hostname, image: finalImage, url, addedBy: finalAddedBy, ingredients: [], instructions: [] });
            modal.remove(); window.location.href = 'index.html';
        } catch (err) { console.error(err); saveBtn.textContent = 'שמור מתכון'; saveBtn.disabled = false; alert('שגיאה בשמירה.'); }
    });
}

function showImagePreviewModal({ name, ingredients, instructions, suggestedTags }) {
    document.getElementById('image-preview-modal')?.remove();
    const tags = suggestedTags || [];
    const modal = document.createElement('div');
    modal.id = 'image-preview-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `<div style="background:#F8F7FF;border-radius:16px;padding:28px;width:100%;max-width:500px;font-family:'Varela Round',sans-serif;direction:rtl;box-shadow:0 8px 32px rgba(0,0,0,0.2);max-height:90vh;overflow-y:auto;">
        <h3 style="margin:0 0 20px;color:#407076;text-align:center;font-size:1.3rem;">בדיקה לפני שמירה</h3>
        <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">שם המתכון</label>
        <input id="ipm-name" value="${escapeHtml(name || '')}" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:1rem;box-sizing:border-box;margin-bottom:14px;background:white;">
        <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">קטגוריה</label>
        <select id="ipm-category" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:1rem;box-sizing:border-box;margin-bottom:14px;background:white;cursor:pointer;">
            ${EDIT_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
        </select>
        <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">מרכיבים</label>
        <textarea id="ipm-ingredients" rows="5" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:0.9rem;box-sizing:border-box;margin-bottom:14px;resize:vertical;">${escapeHtml((ingredients || []).join('\n'))}</textarea>
        <label style="display:block;margin-bottom:4px;color:#407076;font-size:0.9rem;">הוראות הכנה</label>
        <textarea id="ipm-instructions" rows="6" style="width:100%;padding:10px 12px;border:2px solid #c5d9dc;border-radius:8px;font-family:inherit;font-size:0.9rem;box-sizing:border-box;margin-bottom:14px;resize:vertical;">${escapeHtml((instructions || []).join('\n'))}</textarea>
        <label style="display:block;margin-bottom:6px;color:#407076;font-size:0.9rem;">תגיות</label>
        <div id="ipm-tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px;">
            ${ALL_TAGS.map(tag => `<button type="button" class="ipm-tag-btn ${tags.includes(tag) ? 'active' : ''}" data-tag="${tag}" style="background:${tags.includes(tag) ? '#407076' : 'white'};color:${tags.includes(tag) ? 'white' : '#698996'};border:1.5px solid ${tags.includes(tag) ? '#407076' : '#c5d9dc'};border-radius:20px;padding:4px 12px;font-family:'Varela Round',sans-serif;font-size:0.8rem;cursor:pointer;">${tag}</button>`).join('')}
        </div>
        <div style="display:flex;gap:10px;">
            <button id="ipm-save" style="flex:1;padding:12px;background:#407076;color:white;border:none;border-radius:8px;font-family:inherit;font-size:1rem;cursor:pointer;">שמור מתכון</button>
            <button id="ipm-cancel" style="flex:1;padding:12px;background:transparent;color:#407076;border:2px solid #407076;border-radius:8px;font-family:inherit;font-size:1rem;cursor:pointer;">ביטול</button>
        </div></div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('.ipm-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            const a = btn.classList.contains('active');
            btn.style.background = a ? '#407076' : 'white';
            btn.style.color = a ? 'white' : '#698996';
            btn.style.borderColor = a ? '#407076' : '#c5d9dc';
        });
    });
    document.getElementById('ipm-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });
    document.getElementById('ipm-save').addEventListener('click', async () => {
        const finalName = document.getElementById('ipm-name').value.trim() || name;
        const finalCategory = document.getElementById('ipm-category').value;
        const finalIngredients = document.getElementById('ipm-ingredients').value.split('\n').filter(l => l.trim());
        const finalInstructions = document.getElementById('ipm-instructions').value.split('\n').filter(l => l.trim());
        const finalTags = [...modal.querySelectorAll('.ipm-tag-btn.active')].map(b => b.dataset.tag);
        const saveBtn = document.getElementById('ipm-save');
        saveBtn.textContent = 'שומר...'; saveBtn.disabled = true;
        try {
            await addDoc(collection(db, 'recipes'), { name: finalName, category: finalCategory, source: 'מתמונה', image: '', tags: finalTags, ingredients: finalIngredients, instructions: finalInstructions });
            modal.remove(); window.location.href = 'index.html';
        } catch (err) { console.error(err); saveBtn.textContent = 'שמור מתכון'; saveBtn.disabled = false; alert('שגיאה בשמירה.'); }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const importMode = document.getElementById('import-mode');
    const manualMode = document.getElementById('manual-mode');
    const csvMode = document.getElementById('csv-mode');
    const imageMode = document.getElementById('image-mode');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.getAttribute('data-mode');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            [importMode, manualMode, csvMode, imageMode].forEach(el => el && el.classList.remove('active'));
            if (mode === 'import') importMode.classList.add('active');
            else if (mode === 'csv' && csvMode) csvMode.classList.add('active');
            else if (mode === 'image' && imageMode) imageMode.classList.add('active');
            else manualMode.classList.add('active');
        });
    });

    const importBtn = document.getElementById('importBtn');
    const importStatus = document.getElementById('import-status');
    importBtn.addEventListener('click', async () => {
        const url = document.getElementById('recipeUrl').value.trim();
        if (!url) { importStatus.className = 'import-status error'; importStatus.textContent = 'נא להזין קישור למתכון'; return; }
        importStatus.className = 'import-status loading'; importStatus.textContent = 'בודקת כפילות...';
        try {
            if (await urlAlreadyExists(url)) { importStatus.className = 'import-status error'; importStatus.textContent = 'המתכון הזה כבר קיים!'; return; }
            importStatus.textContent = 'מייבאת מתכון...';
            const response = await fetch(`/.netlify/functions/fetch-recipe?url=${encodeURIComponent(url)}`);
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const name = extractRecipeName(doc, url) || 'מתכון חדש';
            const image = extractRecipeImage(doc, url);
            importStatus.className = 'import-status success'; importStatus.textContent = 'המתכון נשלף! בדקי לפני השמירה.';
            showPreviewModal({ name, image, url });
        } catch (err) { console.error(err); importStatus.className = 'import-status error'; importStatus.textContent = 'לא הצלחנו לייבא. נסי שוב.'; }
    });

    const recipeForm = document.getElementById('recipeForm');
    if (recipeForm) {
        recipeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('recipeName').value;
            const category = document.getElementById('recipeCategory').value;
            const source = document.getElementById('recipeSource').value || 'מתכון ביתי';
            const image = document.getElementById('recipeImage').value || '';
            const ingredients = document.getElementById('recipeIngredients').value.split('\n').filter(l => l.trim());
            const instructions = document.getElementById('recipeInstructions').value.split('\n').filter(l => l.trim());
            const submitBtn = recipeForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true; submitBtn.textContent = 'שומר...';
            try {
                await addDoc(collection(db, 'recipes'), { name, category, source, image, ingredients, instructions });
                window.location.href = 'index.html';
            } catch (err) { console.error(err); submitBtn.disabled = false; submitBtn.textContent = 'שמור מתכון'; alert('שגיאה. נסי שוב.'); }
        });
    }

    const csvFile = document.getElementById('csvFile');
    const csvPaste = document.getElementById('csvPaste');
    const csvImportBtn = document.getElementById('csvImportBtn');
    const csvStatus = document.getElementById('csv-status');
    async function runCsvImport() {
        let text = (csvPaste?.value || '').trim();
        if (csvFile?.files?.length) text = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result || ''); r.onerror = rej; r.readAsText(csvFile.files[0], 'UTF-8'); });
        const urls = parseUrlsFromCsv(text);
        if (!urls.length) { csvStatus.className = 'import-status error csv-bulk-status'; csvStatus.textContent = 'לא נמצאו קישורים.'; return; }
        csvImportBtn.disabled = true;
        let done = 0, skipped = 0, failed = 0;
        const total = urls.length;
        for (let i = 0; i < urls.length; i++) {
            try { if (await urlAlreadyExists(urls[i])) { skipped++; } else { await importOneRecipe(urls[i]); done++; } }
            catch (err) { failed++; }
            csvStatus.className = 'import-status loading csv-bulk-status';
            csvStatus.textContent = `מייבא ${done} מתוך ${total}${skipped ? ` (${skipped} כפולים)` : ''}...`;
            if (i < urls.length - 1) await new Promise(r => setTimeout(r, 1200));
        }
        csvImportBtn.disabled = false;
        csvStatus.className = 'import-status success csv-bulk-status';
        csvStatus.textContent = `סיום: ${done} יובאו, ${skipped} כפולים${failed ? `, ${failed} נכשלו` : ''}.`;
    }
    if (csvImportBtn) csvImportBtn.addEventListener('click', runCsvImport);

    const imageFileInput = document.getElementById('recipeImageFile');
    const extractImageBtn = document.getElementById('extractImageBtn');
    const imageStatus = document.getElementById('image-status');
    if (imageFileInput) {
        imageFileInput.addEventListener('change', () => {
            const file = imageFileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('image-preview');
                const previewContainer = document.getElementById('image-preview-container');
                if (preview) preview.src = e.target.result;
                if (previewContainer) previewContainer.style.display = 'block';
                if (extractImageBtn) extractImageBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        });
    }
    if (extractImageBtn) {
        extractImageBtn.addEventListener('click', async () => {
            const file = imageFileInput.files[0];
            if (!file) return;
            extractImageBtn.disabled = true; extractImageBtn.textContent = 'מחלצת...';
            imageStatus.className = 'import-status loading'; imageStatus.textContent = 'שולחת תמונה ל-AI...';
            try {
                const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = (e) => res(e.target.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
                const response = await fetch('/.netlify/functions/extract-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, mediaType: file.type }) });
                const result = await response.json();
                if (result.error) { imageStatus.className = 'import-status error'; imageStatus.textContent = result.error; extractImageBtn.disabled = false; extractImageBtn.textContent = 'חלצי מתכון מהתמונה'; return; }
                imageStatus.className = 'import-status success'; imageStatus.textContent = 'המתכון חולץ! בדקי לפני שמירה.';
                showImagePreviewModal(result);
            } catch (err) { console.error(err); imageStatus.className = 'import-status error'; imageStatus.textContent = 'שגיאה. נסי שוב.'; extractImageBtn.disabled = false; extractImageBtn.textContent = 'חלצי מתכון מהתמונה'; }
        });
    }

    console.log('add-recipe.js loaded');
});