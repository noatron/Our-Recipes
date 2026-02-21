import { db, signInWithGoogle, signOutUser, onUserChange } from './firebase.js';
import { collection, getDocs, setDoc, doc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const ADMIN_UIDS = ['xFDkce3C3uPAXt662tkyrwUju9d2'];
let currentUser = null;
let userFavorites = new Set();

function isAdmin() {
    return currentUser && ADMIN_UIDS.includes(currentUser.uid);
}

async function loadFavorites() {
    if (!currentUser) { userFavorites = new Set(); return; }
    try {
        const snap = await getDoc(doc(db, 'favorites', currentUser.uid));
        userFavorites = new Set(snap.exists() ? (snap.data().ids || []) : []);
    } catch(e) { userFavorites = new Set(); }
}

async function toggleFavorite(recipeId, e) {
    e.stopPropagation();
    if (!currentUser) { alert('יש להתחבר כדי לשמור מועדפים'); return; }
    if (userFavorites.has(recipeId)) {
        userFavorites.delete(recipeId);
    } else {
        userFavorites.add(recipeId);
    }
    await setDoc(doc(db, 'favorites', currentUser.uid), { ids: [...userFavorites] });
    const btn = document.querySelector(`.fav-btn[data-id="${recipeId}"]`);
    if (btn) btn.classList.toggle('active', userFavorites.has(recipeId));
}
window.toggleFavorite = toggleFavorite;

const CATEGORIES = ['הכל', 'עיקריות', 'תוספות', 'סלטים', 'מרקים', 'קינוחים', 'עוגות', 'עוגיות', 'מאפים', 'לחמים', 'כללי', 'ממרחים'];
const EDIT_CATEGORIES = ['עיקריות', 'תוספות', 'סלטים', 'מרקים', 'קינוחים', 'עוגות', 'עוגיות', 'מאפים', 'לחמים', 'כללי', 'ממרחים'];

const defaultRecipes = [
    { id: "1", name: "שקשוקה", category: "כללי", source: "סבתא רחל", image: "https://images.unsplash.com/photo-1587217850473-0238d26d4785?w=400&h=300&fit=crop" },
    { id: "2", name: "פסטה בולונז", category: "בשרי", source: "אתר טעים", image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop" },
    { id: "3", name: "עוגת שוקולד", category: "קינוחים", source: "מגזין אוכל", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop" }
];

function escapeHtml(str) {
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
    if (recipe.url) {
        try { return new URL(recipe.url).hostname.replace(/^www\./, ''); } catch (e) {}
    }
    return recipe.source || '';
}

function sortWithFavoritesFirst(recipes) {
    if (!currentUser || userFavorites.size === 0) return recipes;
    const favs = recipes.filter(r => userFavorites.has(r.id));
    const rest = recipes.filter(r => !userFavorites.has(r.id));
    return [...favs, ...rest];
}

function openQuickEdit(recipe, e) {
    e.stopPropagation();
    document.getElementById('quick-edit-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'quick-edit-modal';
    modal.style.cssText = `position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 16px;`;
    modal.innerHTML = `
        <div style="background: #F8F7FF; border-radius: 16px; padding: 24px; width: 100%; max-width: 360px; font-family: 'Varela Round', sans-serif; direction: rtl;">
            <h3 style="margin: 0 0 16px; color: #407076; text-align: center;">עריכה מהירה</h3>
            <label style="display:block; margin-bottom: 4px; color: #407076; font-size: 0.9rem;">שם מתכון</label>
            <input id="qe-name" value="${escapeHtml(recipe.name || '')}" style="width:100%; padding: 8px 12px; border: 1px solid #c5d9dc; border-radius: 8px; font-family: inherit; font-size: 1rem; box-sizing: border-box; margin-bottom: 12px;">
            <label style="display:block; margin-bottom: 4px; color: #407076; font-size: 0.9rem;">קטגוריה</label>
            <select id="qe-category" style="width:100%; padding: 8px 12px; border: 1px solid #c5d9dc; border-radius: 8px; font-family: inherit; font-size: 1rem; box-sizing: border-box; margin-bottom: 12px; background: white;">
                ${EDIT_CATEGORIES.map(cat => `<option value="${cat}" ${recipe.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
            </select>
            <label style="display:block; margin-bottom: 4px; color: #407076; font-size: 0.9rem;">קישור לתמונה</label>
            <input id="qe-image" value="${escapeHtml(recipe.image || '')}" placeholder="https://..." style="width:100%; padding: 8px 12px; border: 1px solid #c5d9dc; border-radius: 8px; font-family: inherit; font-size: 0.9rem; box-sizing: border-box; margin-bottom: 20px;">
            <div style="display: flex; gap: 8px;">
                <button id="qe-save" style="flex:1; padding: 10px; background: #407076; color: white; border: none; border-radius: 8px; font-family: inherit; font-size: 1rem; cursor: pointer;">✓ שמור</button>
                <button id="qe-cancel" style="flex:1; padding: 10px; background: transparent; color: #407076; border: 1px solid #407076; border-radius: 8px; font-family: inherit; font-size: 1rem; cursor: pointer;">ביטול</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('qe-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });
    document.getElementById('qe-save').addEventListener('click', async () => {
        const newName = document.getElementById('qe-name').value.trim();
        const newCategory = document.getElementById('qe-category').value;
        const newImage = document.getElementById('qe-image').value.trim();
        if (!newName) { alert('שם המתכון לא יכול להיות ריק'); return; }
        const saveBtn = document.getElementById('qe-save');
        saveBtn.textContent = 'שומר...';
        saveBtn.disabled = true;
        try {
            await setDoc(doc(db, 'recipes', recipe.id), { ...recipe, name: newName, category: newCategory, image: newImage });
            modal.remove();
            location.reload();
        } catch (err) {
            alert('שגיאה בשמירה, נסי שוב');
            saveBtn.textContent = '✓ שמור';
            saveBtn.disabled = false;
        }
    });
}

function displayRecipes(recipesToShow) {
    const recipesContainer = document.getElementById('recipes');
    if (recipesToShow.length === 0) {
        recipesContainer.innerHTML = '<div class="no-recipes">לא נמצאו מתכונים 😔</div>';
        return;
    }
    const showMenu = isAdmin();
    recipesContainer.innerHTML = recipesToShow.map(recipe => {
        const sourceLabel = getRecipeSourceLabel(recipe);
        return `
        <div class="recipe-card" onclick="showRecipe('${recipe.id}')">
            <img src="${recipe.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=200&fit=crop'}" alt="" class="recipe-image" onerror="this.style.display='none'">
            <div class="recipe-content">
                <h2 class="recipe-name">${escapeHtml(getRecipeDisplayName(recipe))}</h2>
                ${sourceLabel ? `<p class="recipe-source">${escapeHtml(sourceLabel)}</p>` : ''}
                ${recipe.addedBy ? `<p style="font-size:0.8rem; color:#698996; margin: 0 0 6px;">הוסיפה: ${escapeHtml(recipe.addedBy)}</p>` : ''}
                <div class="card-footer">
                    <span class="recipe-category">${escapeHtml(recipe.category || '')}</span>
                    <div style="display:flex; align-items:center; gap:2px;">
                        <button class="${userFavorites.has(recipe.id) ? 'fav-btn active' : 'fav-btn'}" data-id="${recipe.id}" onclick="toggleFavorite('${recipe.id}', event)">♥</button>
                        ${showMenu ? `
                        <div class="recipe-menu-wrapper">
                            <button class="recipe-menu-btn" onclick="toggleRecipeMenu(event, '${recipe.id}')">⋮</button>
                            <div class="recipe-menu-dropdown" id="menu-${recipe.id}">
                                <button onclick="quickEdit('${recipe.id}', event)">✏️ ערוך</button>
                                <button onclick="deleteRecipeClick('${recipe.id}', event)">🗑️ מחק</button>
                            </div>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

window.showRecipe = function(id) {
    localStorage.setItem('selectedRecipeId', id);
    window.location.href = 'recipe-detail.html';
}

window.quickEdit = function(id, e) {
    if (e) e.stopPropagation();
    document.getElementById('floating-recipe-menu')?.remove();
    const recipe = window._allRecipes?.find(r => r.id === id);
    if (recipe) openQuickEdit(recipe, { stopPropagation: () => {} });
}

window.deleteRecipeClick = function(id, e) {
    if (e) e.stopPropagation();
    deleteRecipe(id);
}

function setupSearch(allRecipes) {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = allRecipes.filter(recipe => {
            const name = (recipe.name || '').toLowerCase();
            const source = getRecipeSourceLabel(recipe).toLowerCase();
            return name.includes(searchTerm) || source.includes(searchTerm);
        });
        displayRecipes(filtered);
    });
}

function setupCategoryFilter(allRecipes) {
    const container = document.getElementById('category-filters');
    if (!container) return;
    container.innerHTML = CATEGORIES.map(cat => `
        <button class="category-chip ${cat === 'הכל' ? 'active' : ''}" data-category="${cat}">${cat}</button>
    `).join('');
    container.addEventListener('click', (e) => {
        if (!e.target.classList.contains('category-chip')) return;
        const activeCategory = e.target.dataset.category;
        container.querySelectorAll('.category-chip').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById('searchInput').value = '';
        const filtered = activeCategory === 'הכל' ? allRecipes : allRecipes.filter(r => r.category === activeCategory);
        displayRecipes(filtered);
    });
}

function showSurpriseModal() {
    document.getElementById('surprise-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'surprise-modal';
    modal.style.cssText = `position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 16px;`;
    modal.innerHTML = `
        <div style="background: #F8F7FF; border-radius: 16px; padding: 28px; width: 100%; max-width: 380px; font-family: 'Varela Round', sans-serif; direction: rtl; box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
            <h3 style="margin: 0 0 8px; color: #407076; text-align: center; font-size: 1.4rem;">🎲 מה מבשלים היום?</h3>
            <p style="text-align: center; color: #698996; font-size: 0.95rem; margin-bottom: 20px;">בחרי קטגוריה ואני אבחר מתכון בשבילך</p>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-bottom: 24px;">
                ${EDIT_CATEGORIES.map(cat => `<button class="surprise-cat-btn" data-cat="${cat}" style="background: white; border: 2px solid #407076; color: #407076; border-radius: 20px; padding: 8px 18px; font-family: 'Varela Round', sans-serif; font-size: 0.9rem; cursor: pointer;">${cat}</button>`).join('')}
            </div>
            <button id="surprise-cancel" style="width:100%; padding: 10px; background: transparent; color: #698996; border: 1px solid #c5d9dc; border-radius: 8px; font-family: inherit; font-size: 1rem; cursor: pointer;">ביטול</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.getElementById('surprise-cancel').addEventListener('click', () => modal.remove());
    modal.querySelectorAll('.surprise-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.cat;
            const filtered = (window._allRecipes || []).filter(r => r.category === cat);
            if (filtered.length === 0) { btn.textContent = 'אין מתכונים 😔'; return; }
            const random = filtered[Math.floor(Math.random() * filtered.length)];
            modal.remove();
            window.showRecipe(random.id);
        });
    });
}

async function initApp() {
    try {
        const snapshot = await getDocs(collection(db, 'recipes'));
        let recipes = [];
        if (snapshot.empty) {
            for (const recipe of defaultRecipes) {
                await setDoc(doc(db, 'recipes', recipe.id), recipe);
            }
            recipes = defaultRecipes;
        } else {
            snapshot.forEach(d => recipes.push({ id: d.id, ...d.data() }));
        }
        console.log('🍽️ נטענו מ-Firebase:', recipes.length, 'מתכונים');
        window._allRecipes = recipes;
        displayRecipes(sortWithFavoritesFirst(recipes));
        setupSearch(recipes);
        setupCategoryFilter(recipes);
    } catch (err) {
        console.error('שגיאה בטעינת מתכונים:', err);
        const container = document.getElementById('recipes');
        if (container) {
            container.innerHTML = `<div class="no-recipes"><p>שגיאה בטעינה: ${escapeHtml(err.message || String(err))}</p></div>`;
        }
    }
    document.getElementById('add-recipe-btn')?.addEventListener('click', () => { window.location.href = 'add-recipe.html'; });
    document.getElementById('surprise-btn')?.addEventListener('click', () => showSurpriseModal());
}

window.toggleRecipeMenu = function(e, id) {
    e.stopPropagation();
    const existing = document.getElementById('floating-recipe-menu');
    if (existing) { existing.remove(); if (existing.dataset.forId === id) return; }
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id = 'floating-recipe-menu';
    menu.dataset.forId = id;
    menu.style.cssText = `position: fixed; top: ${rect.bottom + 4}px; left: ${rect.left}px; background: white; border: 1px solid #c5d9dc; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); z-index: 9999; min-width: 120px; overflow: hidden; font-family: 'Varela Round', sans-serif; direction: rtl;`;
    menu.innerHTML = `
        <button onclick="quickEdit('${id}', event)" style="display:block;width:100%;padding:10px 16px;background:none;border:none;cursor:pointer;text-align:right;font-family:inherit;font-size:0.9rem;color:#333;">✏️ ערוך</button>
        <button onclick="deleteRecipeClick('${id}', event)" style="display:block;width:100%;padding:10px 16px;background:none;border:none;cursor:pointer;text-align:right;font-family:inherit;font-size:0.9rem;color:#c62828;">🗑️ מחק</button>
    `;
    document.body.appendChild(menu);
}

window.deleteRecipe = async function(id) {
    if (!confirm('למחוק את המתכון? לא ניתן לשחזר')) return;
    try {
        await deleteDoc(doc(db, 'recipes', id));
        location.reload();
    } catch (err) {
        alert('שגיאה במחיקה, נסי שוב');
    }
}

document.addEventListener('click', () => {
    document.getElementById('floating-recipe-menu')?.remove();
    document.querySelectorAll('.recipe-menu-dropdown.open').forEach(el => el.classList.remove('open'));
});

document.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => {
        const container = document.getElementById('recipes');
        if (container) container.innerHTML = `<div class="no-recipes"><p>שגיאה בטעינה: ${escapeHtml(err.message || String(err))}</p></div>`;
    });

    const authBtn = document.getElementById('auth-btn');
    const userName = document.getElementById('user-name');

    onUserChange(async (user) => {
        currentUser = user;
        await loadFavorites();
        if (user) {
            authBtn.textContent = 'התנתקות';
            userName.style.display = 'inline';
            userName.textContent = user.displayName?.split(' ')[0] || '';
        } else {
            authBtn.textContent = 'התחברות';
            userName.style.display = 'none';
            userName.textContent = '';
        }
        if (window._allRecipes) displayRecipes(sortWithFavoritesFirst(window._allRecipes));
    });

    authBtn?.addEventListener('click', async () => {
        if (currentUser) { await signOutUser(); } else { await signInWithGoogle(); }
    });
});