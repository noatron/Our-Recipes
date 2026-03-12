import { auth } from './firebase.js';
import { getMealById, addRecipeToMeal, removeRecipeFromMeal } from './meals.js';
import { doc, getDoc, getDocs, collection } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { db } from './firebase.js';

const TAG_GROUPS = [
    { label: 'מנות עיקריות', tags: ['בשר', 'דגים', 'פסטות', 'קישים ופשטידות', 'צמחוני'] },
    { label: 'סלטים', tags: ['סלטים'] },
    { label: 'תוספות', tags: ['תוספות'] },
    { label: 'לחם ומאפים', tags: ['לחם ומאפים'] },
    { label: 'רטבים וממרחים', tags: ['רטבים וממרחים'] },
    { label: 'מרקים', tags: ['מרקים'] },
    { label: 'קינוחים', tags: ['עוגות', 'עוגיות', 'קינוחים', 'שוקולד'] },
    { label: 'ארוחות בוקר', tags: ['ארוחות בוקר'] },
    { label: 'חטיפים', tags: ['חטיפים'] },
    { label: 'שתייה', tags: ['שתייה'] }
];

function filterRecipesForPicker(recipes, searchTerm, selectedTags) {
    let list = recipes;
    if (selectedTags.length > 0) {
        list = list.filter(r => Array.isArray(r.tags) && selectedTags.some(t => r.tags.includes(t)));
    }
    if ((searchTerm || '').trim()) {
        const term = searchTerm.trim().toLowerCase();
        list = list.filter(r => {
            const name = (r.name || '').toLowerCase();
            const source = (r.source || '').toLowerCase();
            return name.includes(term) || source.includes(term);
        });
    }
    return list;
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=200&fit=crop';

function ensureHttpsImage(url) {
    if (!url || !String(url).trim()) return url;
    return String(url).replace(/^http:\/\//i, 'https://');
}

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getRecipeDisplayName(recipe) {
    const name = (recipe.name || '').trim();
    if (!name || /error response|404|forbidden|not found/i.test(name)) return 'מתכון';
    return name;
}

function getRecipeSourceLabel(recipe) {
    if (recipe.source && String(recipe.source).trim()) return recipe.source.trim();
    if (recipe.url) {
        try { return new URL(recipe.url).hostname.replace(/^www\./, ''); } catch (e) {}
    }
    return '';
}

function getAddedByName(recipe) {
    return (recipe.addedByName && String(recipe.addedByName).trim()) ? recipe.addedByName.trim() : 'נועה';
}

/** אייקון Lucide להסרה מהארוחה */
const ICON_REMOVE = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

function buildRecipeCardHtml(recipe, opts) {
    const { mealId, isOwner } = opts || {};
    const sourceLabel = getRecipeSourceLabel(recipe);
    const addedByName = getAddedByName(recipe);
    const tags = Array.isArray(recipe.tags) ? recipe.tags : [];
    const tagsHtml = tags.length
        ? `<div class="recipe-tags">${tags.map(t => `<span class="recipe-tag">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';
    const numComments = recipe.commentsCount != null ? recipe.commentsCount : 0;
    const commentsLabel = numComments === 0 ? 'הערות' : (numComments === 1 ? 'הערה' : 'הערות');
    const commentsLinkHtml = `<a href="recipe-detail.html?id=${escapeHtml(recipe.id)}#comments" class="recipe-comments-link">${numComments} ${commentsLabel}</a>`;
    const shareBtnHtml = `<button type="button" class="recipe-card-share" data-recipe-id="${recipe.id}" aria-label="שתפי קישור" onclick="event.preventDefault(); event.stopPropagation(); window.shareRecipe('${recipe.id}')" title="שתפי קישור"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>`;
    const removeFromMealBtnHtml = (isOwner && mealId)
        ? `<button type="button" class="recipe-card-remove-from-meal" data-meal-id="${escapeHtml(mealId)}" data-recipe-id="${escapeHtml(recipe.id)}" aria-label="הסר מהארוחה" title="הסר מהארוחה">${ICON_REMOVE}</button>`
        : '';
    const imgSrc = ensureHttpsImage(recipe.image) || DEFAULT_IMAGE;
    return `
    <div class="recipe-card" data-recipe-id="${recipe.id}" onclick="window.showRecipe('${recipe.id}')">
        <div class="recipe-card-image-wrap">
            <img src="${escapeHtml(imgSrc)}" alt="" class="recipe-image" onerror="this.onerror=null;this.src='${escapeHtml(DEFAULT_IMAGE)}';">
            ${removeFromMealBtnHtml}
            ${shareBtnHtml}
        </div>
        <div class="recipe-content">
            <div class="recipe-title-row">
                <h2 class="recipe-name">${escapeHtml(getRecipeDisplayName(recipe))}</h2>
            </div>
            ${sourceLabel ? (recipe.url ? `<p class="recipe-source"><a href="${escapeHtml(recipe.url)}" target="_blank" rel="noopener noreferrer" class="recipe-source-link">${escapeHtml(sourceLabel)}</a></p>` : `<p class="recipe-source">${escapeHtml(sourceLabel)}</p>`) : ''}
            <p class="recipe-added-by">מאת ${escapeHtml(addedByName)}</p>
            <div class="recipe-comments-row">${commentsLinkHtml}</div>
            ${tagsHtml}
        </div>
    </div>
    `;
}

window.showRecipe = function (id) {
    localStorage.setItem('selectedRecipeId', id);
    window.location.href = 'recipe-detail.html';
};

window.shareRecipe = async function (recipeId) {
    const url = new URL('recipe-detail.html?id=' + encodeURIComponent(recipeId), window.location.href).href;
    try {
        if (typeof navigator.share === 'function') {
            await navigator.share({ title: 'מתכון – מפה לפה', url });
            alert('הקישור שותף ✓');
            return;
        }
    } catch (e) {
        if (e.name === 'AbortError') return;
    }
    try {
        await navigator.clipboard.writeText(url);
        alert('הקישור הועתק ללוח ✓');
    } catch (_) {
        prompt('העתיקי את הקישור:', url);
    }
};

async function loadRecipe(recipeId) {
    try {
        const snap = await getDoc(doc(db, 'recipes', recipeId));
        if (snap.exists()) return { id: snap.id, ...snap.data() };
    } catch (_) {}
    return null;
}

async function openRecipePicker(mealId, onDone) {
    const overlay = document.createElement('div');
    overlay.className = 'recipe-picker-overlay';
    const modal = document.createElement('div');
    modal.className = 'recipe-picker-modal';
    modal.innerHTML = `
        <div class="recipe-picker-search">
            <input type="text" id="recipePickerSearch" placeholder="חפשי מתכון..." aria-label="חיפוש מתכונים" autocomplete="off">
        </div>
        <div class="recipe-picker-chips" id="recipePickerChips"></div>
        <div class="recipe-picker-list" id="recipePickerList" aria-busy="true">טוען...</div>
        <div class="recipe-picker-actions">
            <button type="button" class="sl-btn sl-btn-primary" id="recipePickerConfirm">הוסיפי לארוחה</button>
            <button type="button" class="sl-btn sl-btn-secondary" id="recipePickerCancel">ביטול</button>
        </div>
    `;
    overlay.appendChild(modal);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);

    const chipsWrap = document.getElementById('recipePickerChips');
    const listEl = document.getElementById('recipePickerList');
    const searchInput = document.getElementById('recipePickerSearch');
    let allRecipes = [];
    try {
        const snapshot = await getDocs(collection(db, 'recipes'));
        allRecipes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<p style="color:#698996;padding:16px;">שגיאה בטעינת מתכונים.</p>';
        listEl.removeAttribute('aria-busy');
    }

    let selectedTag = '';
    const renderChips = () => {
        chipsWrap.innerHTML = '<button type="button" class="recipe-picker-chip active" data-tag="">הכל</button>' +
            TAG_GROUPS.map(g => `<button type="button" class="recipe-picker-chip" data-tags="${escapeHtml((g.tags || []).join(','))}">${escapeHtml(g.label)}</button>`).join('');
        chipsWrap.querySelectorAll('.recipe-picker-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                chipsWrap.querySelectorAll('.recipe-picker-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                selectedTag = chip.dataset.tags || chip.dataset.tag || '';
                renderList();
            });
        });
    };
    const renderList = () => {
        const tags = (selectedTag || '').split(',').map(t => t.trim()).filter(Boolean);
        const filtered = filterRecipesForPicker(allRecipes, (searchInput && searchInput.value) || '', tags);
        listEl.innerHTML = filtered.length === 0
            ? '<p style="color:#698996;padding:16px;">לא נמצאו מתכונים.</p>'
            : filtered.map(r => `<label><input type="checkbox" class="recipe-picker-check" data-recipe-id="${escapeHtml(r.id)}"> ${escapeHtml(r.name || 'מתכון')}</label>`).join('');
        listEl.removeAttribute('aria-busy');
    };

    renderChips();
    if (allRecipes.length > 0) renderList();
    if (searchInput) {
        searchInput.oninput = () => renderList();
        searchInput.onkeydown = (e) => { if (e.key === 'Enter') e.preventDefault(); renderList(); };
    }

    document.getElementById('recipePickerCancel').onclick = () => overlay.remove();
    document.getElementById('recipePickerConfirm').onclick = async () => {
        const checked = listEl.querySelectorAll('.recipe-picker-check:checked');
        if (checked.length === 0) {
            alert('בחרי לפחות מתכון אחד.');
            return;
        }
        const recipeIds = [...checked].map(cb => cb.dataset.recipeId).filter(Boolean);
        for (const recipeId of recipeIds) {
            try {
                await addRecipeToMeal(mealId, recipeId);
            } catch (e) {
                console.error(e);
                alert('שגיאה בהוספת מתכון. נסי שוב.');
                return;
            }
        }
        overlay.remove();
        alert(recipeIds.length === 1 ? 'המתכון נוסף לארוחה ✓' : recipeIds.length + ' מתכונים נוספו לארוחה ✓');
        if (typeof onDone === 'function') onDone();
    };
}

async function loadAndRenderMeal(mealId) {
    const loadingEl = document.getElementById('meal-detail-loading');
    const errorEl = document.getElementById('meal-detail-error');
    const emptyEl = document.getElementById('meal-detail-empty');
    const headerEl = document.getElementById('meal-detail-header');
    const recipesEl = document.getElementById('meal-detail-recipes');
    const nameEl = document.getElementById('meal-detail-name');
    const metaEl = document.getElementById('meal-detail-meta');
    const shoppingBtn = document.getElementById('meal-detail-shopping-btn');
    const addRecipesBtn = document.getElementById('meal-detail-add-recipes-btn');

    let meal = null;
    try {
        meal = await getMealById(mealId);
    } catch (e) {
        console.error('getMealById', e);
    }

    loadingEl.style.display = 'none';

    if (!meal) {
        errorEl.textContent = 'הארוחה לא נמצאה.';
        errorEl.style.display = 'block';
        return null;
    }

    const user = auth.currentUser;
    const isOwner = !!(user && meal.createdBy && meal.createdBy.uid === user.uid);

    const mealName = (meal.name || 'ארוחה').trim();
    const by = (meal.createdBy && meal.createdBy.name) ? meal.createdBy.name : 'משתמשת';
    const recipeIds = Array.isArray(meal.recipeIds) ? meal.recipeIds : [];

    nameEl.textContent = mealName;
    const headerTitleEl = document.getElementById('meal-detail-header-title');
    if (headerTitleEl) headerTitleEl.textContent = mealName;
    metaEl.textContent = 'מאת ' + by + ' · ' + recipeIds.length + (recipeIds.length === 1 ? ' מתכון' : ' מתכונים');
    headerEl.style.display = 'block';

    if (addRecipesBtn) {
        addRecipesBtn.style.display = isOwner ? 'inline-flex' : 'none';
        addRecipesBtn.onclick = () => openRecipePicker(mealId, () => loadAndRenderMeal(mealId));
    }

    if (recipeIds.length === 0) {
        emptyEl.style.display = 'block';
        recipesEl.style.display = 'none';
        shoppingBtn.style.display = 'none';
        return meal;
    }

    const recipes = [];
    for (const id of recipeIds) {
        const r = await loadRecipe(id);
        if (r) recipes.push(r);
    }

    recipesEl.innerHTML = recipes.map(r => buildRecipeCardHtml(r, { mealId, isOwner })).join('');
    recipesEl.style.display = 'grid';
    emptyEl.style.display = 'none';

    recipesEl.querySelectorAll('.recipe-card-remove-from-meal').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const mid = btn.dataset.mealId;
            const rid = btn.dataset.recipeId;
            if (!mid || !rid) return;
            if (!confirm('להסיר את המתכון מהארוחה?')) return;
            try {
                await removeRecipeFromMeal(mid, rid);
                await loadAndRenderMeal(mid);
            } catch (err) {
                console.error(err);
                alert('שגיאה בהסרת המתכון. נסי שוב.');
            }
        });
    });

    const withIngredients = recipes.filter(r => Array.isArray(r.ingredients) && r.ingredients.length > 0);
    if (withIngredients.length > 0) {
        shoppingBtn.style.display = 'inline-flex';
        let hint = document.getElementById('meal-detail-sl-hint');
        if (!hint) {
            hint = document.createElement('p');
            hint.id = 'meal-detail-sl-hint';
            hint.className = 'meal-detail-meta';
            hint.style.cssText = 'margin-top:8px;color:#698996;font-size:0.9rem;';
            hint.textContent = 'המרכיבים יתאחדו לפי מוצר; מלח, תבלינים ושמן לא ייכללו.';
            shoppingBtn.parentNode.insertBefore(hint, shoppingBtn.nextSibling);
        }
        hint.style.display = '';
        shoppingBtn.onclick = () => {
            if (typeof window.ShoppingList === 'undefined') {
                alert('רשימת הקניות אינה זמינה.');
                return;
            }
            window.ShoppingList.clear();
            withIngredients.forEach(r => {
                window.ShoppingList.addItems(r.id, r.name, r.ingredients);
            });
            window.location.href = 'shopping-list.html?fromCreate=1';
        };
    } else {
        shoppingBtn.style.display = 'none';
        const hint = document.getElementById('meal-detail-sl-hint');
        if (hint) hint.style.display = 'none';
    }
    return meal;
}

async function initMealDetail() {
    const params = new URLSearchParams(window.location.search);
    const mealId = params.get('id');
    const loadingEl = document.getElementById('meal-detail-loading');
    const errorEl = document.getElementById('meal-detail-error');

    if (!mealId) {
        loadingEl.style.display = 'none';
        errorEl.textContent = 'לא נבחרה ארוחה.';
        errorEl.style.display = 'block';
        return;
    }

    await loadAndRenderMeal(mealId);
}

document.addEventListener('DOMContentLoaded', () => {
    initMealDetail().catch(err => {
        console.error('meal-detail init', err);
        document.getElementById('meal-detail-loading').textContent = 'שגיאה בטעינה.';
    });
});
