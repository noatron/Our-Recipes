import { getMealById } from './meals.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { db } from './firebase.js';

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

function buildRecipeCardHtml(recipe) {
    const sourceLabel = getRecipeSourceLabel(recipe);
    const addedByName = getAddedByName(recipe);
    const tags = Array.isArray(recipe.tags) ? recipe.tags : [];
    const tagsHtml = tags.length
        ? `<div class="recipe-tags">${tags.map(t => `<span class="recipe-tag">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';
    const count = recipe.likesCount != null ? recipe.likesCount : 0;
    const numComments = recipe.commentsCount != null ? recipe.commentsCount : 0;
    const commentsLabel = numComments === 0 ? 'הערות' : (numComments === 1 ? 'הערה' : 'הערות');
    const commentsLinkHtml = `<a href="recipe-detail.html?id=${escapeHtml(recipe.id)}#comments" class="recipe-comments-link">${numComments} ${commentsLabel}</a>`;
    const shareBtnHtml = `<button type="button" class="recipe-card-share" data-recipe-id="${recipe.id}" aria-label="שתפי קישור" onclick="event.preventDefault(); event.stopPropagation(); window.shareRecipe('${recipe.id}')" title="שתפי קישור"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>`;
    const imgSrc = ensureHttpsImage(recipe.image) || DEFAULT_IMAGE;
    return `
    <div class="recipe-card" data-recipe-id="${recipe.id}" onclick="window.showRecipe('${recipe.id}')">
        <div class="recipe-card-image-wrap">
            <img src="${escapeHtml(imgSrc)}" alt="" class="recipe-image" onerror="this.onerror=null;this.src='${escapeHtml(DEFAULT_IMAGE)}';">
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

async function initMealDetail() {
    const params = new URLSearchParams(window.location.search);
    const mealId = params.get('id');
    const loadingEl = document.getElementById('meal-detail-loading');
    const errorEl = document.getElementById('meal-detail-error');
    const emptyEl = document.getElementById('meal-detail-empty');
    const headerEl = document.getElementById('meal-detail-header');
    const recipesEl = document.getElementById('meal-detail-recipes');
    const nameEl = document.getElementById('meal-detail-name');
    const metaEl = document.getElementById('meal-detail-meta');
    const shoppingBtn = document.getElementById('meal-detail-shopping-btn');

    if (!mealId) {
        loadingEl.style.display = 'none';
        errorEl.textContent = 'לא נבחרה ארוחה.';
        errorEl.style.display = 'block';
        return;
    }

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
        return;
    }

    const mealName = (meal.name || 'ארוחה').trim();
    const by = (meal.createdBy && meal.createdBy.name) ? meal.createdBy.name : 'משתמשת';
    const recipeIds = Array.isArray(meal.recipeIds) ? meal.recipeIds : [];

    nameEl.textContent = mealName;
    metaEl.textContent = 'מאת ' + by + ' · ' + recipeIds.length + (recipeIds.length === 1 ? ' מתכון' : ' מתכונים');
    headerEl.style.display = 'block';

    if (recipeIds.length === 0) {
        emptyEl.style.display = 'block';
        recipesEl.style.display = 'none';
        return;
    }

    const recipes = [];
    for (const id of recipeIds) {
        const r = await loadRecipe(id);
        if (r) recipes.push(r);
    }

    recipesEl.innerHTML = recipes.map(r => buildRecipeCardHtml(r)).join('');
    recipesEl.style.display = 'grid';
    emptyEl.style.display = 'none';

    const withIngredients = recipes.filter(r => Array.isArray(r.ingredients) && r.ingredients.length > 0);
    if (withIngredients.length > 0) {
        shoppingBtn.style.display = 'inline-flex';
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
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initMealDetail().catch(err => {
        console.error('meal-detail init', err);
        document.getElementById('meal-detail-loading').textContent = 'שגיאה בטעינה.';
    });
});
