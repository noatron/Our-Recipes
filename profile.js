import { auth, onUserChange, signInWithGoogle, signOutUser } from './firebase.js';
import { doc, getDoc, getDocs, collection } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { db } from './firebase.js';
import { getMealsByUser, createMeal, addRecipeToMeal } from './meals.js';

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

function updateAuthUI(user) {
    const btn = document.getElementById('profile-auth-btn');
    const nameEl = document.getElementById('profile-user-name');
    if (!btn) return;
    if (user) {
        if (nameEl) {
            nameEl.textContent = user.displayName || user.email || 'מחוברת';
            nameEl.style.display = 'inline';
        }
        btn.textContent = 'התנתקות';
        btn.onclick = () => signOutUser();
    } else {
        if (nameEl) nameEl.style.display = 'none';
        btn.textContent = 'התחברות';
        btn.onclick = () => signInWithGoogle();
    }
}

async function getRecipeImage(recipeId) {
    if (!recipeId) return DEFAULT_IMAGE;
    try {
        const snap = await getDoc(doc(db, 'recipes', recipeId));
        if (snap.exists() && snap.data().image) return ensureHttpsImage(snap.data().image);
    } catch (_) {}
    return DEFAULT_IMAGE;
}

function buildMealCardHtml(meal, thumbnailUrl, isMe) {
    const name = (meal.name || 'ארוחה').trim();
    const by = (meal.createdBy && meal.createdBy.name) ? meal.createdBy.name : 'משתמשת';
    const byUid = (meal.createdBy && meal.createdBy.uid) ? meal.createdBy.uid : '';
    const count = Array.isArray(meal.recipeIds) ? meal.recipeIds.length : 0;
    const recipesLabel = count === 1 ? 'מתכון אחד' : count + ' מתכונים';
    const img = thumbnailUrl || DEFAULT_IMAGE;
    const byHtml = byUid
        ? `<a href="profile.html?uid=${escapeHtml(byUid)}" class="meal-card-by-link" onclick="event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();">מאת ${escapeHtml(by)}</a>`
        : `מאת ${escapeHtml(by)}`;
    const addRecipeBtn = isMe
        ? `<button type="button" class="meal-card-add-recipe-btn" data-meal-id="${escapeHtml(meal.id)}" onclick="event.preventDefault(); event.stopPropagation();">＋ הוסיפי מתכון</button>`
        : '';
    return `
    <a href="meal-detail.html?id=${escapeHtml(meal.id)}" class="meal-card">
        <div class="meal-card-image-wrap">
            <img src="${escapeHtml(img)}" alt="" class="meal-card-image">
        </div>
        <div class="meal-card-content">
            <h3 class="meal-card-name">${escapeHtml(name)}</h3>
            <p class="meal-card-by">${byHtml}</p>
            <p class="meal-card-count">${escapeHtml(recipesLabel)}</p>
            ${addRecipeBtn}
        </div>
    </a>
    `;
}

async function loadAndRenderMeals(uid, isMe) {
    const loadingEl = document.getElementById('profile-loading');
    const gridEl = document.getElementById('profile-meals-grid');
    const emptyEl = document.getElementById('profile-empty');
    const loginHint = document.getElementById('profile-login-hint');

    loadingEl.style.display = 'block';
    gridEl.style.display = 'none';
    emptyEl.style.display = 'none';
    if (loginHint) loginHint.style.display = 'none';

    if (!uid) {
        loadingEl.style.display = 'none';
        if (loginHint) loginHint.style.display = 'block';
        return [];
    }

    let meals = [];
    try {
        meals = await getMealsByUser(uid);
    } catch (e) {
        console.error('getMealsByUser', e);
    }

    loadingEl.style.display = 'none';

    if (meals.length === 0) {
        emptyEl.style.display = 'block';
        if (!isMe) emptyEl.textContent = 'אין ארוחות להצגה.';
        return meals;
    }

    const thumbnails = await Promise.all(meals.map(m => {
        const firstId = Array.isArray(m.recipeIds) && m.recipeIds.length ? m.recipeIds[0] : null;
        return getRecipeImage(firstId);
    }));

    gridEl.innerHTML = meals.map((m, i) => buildMealCardHtml(m, thumbnails[i], isMe)).join('');
    gridEl.style.display = 'grid';

    const addWrap = document.getElementById('profile-add-recipes-wrap');
    if (addWrap) addWrap.style.display = isMe ? 'block' : 'none';

    if (isMe) {
        gridEl.querySelectorAll('.meal-card-add-recipe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const mealId = btn.dataset.mealId;
                if (mealId) openRecipePickerForMeal(mealId, uid, isMe, gridEl, loadingEl, emptyEl, loginHint);
            });
        });
    }
    return meals;
}

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

async function openRecipePickerForMeal(mealId, uid, isMe, gridEl, loadingEl, emptyEl, loginHint) {
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
        await loadAndRenderMeals(uid, isMe);
    };
}

/** פותח בחירת ארוחה (חדשה או קיימת) ואז בורר מתכונים */
async function openMealChooserThenPicker(uid, isMe, meals, gridEl, loadingEl, emptyEl, loginHint) {
    const user = auth.currentUser;
    if (!user) return;
    const overlay = document.createElement('div');
    overlay.className = 'recipe-picker-overlay';
    const modal = document.createElement('div');
    modal.className = 'recipe-picker-modal';
    modal.innerHTML = '<p class="recipe-picker-modal-title">לאיזו ארוחה להוסיף מתכונים?</p><div id="mealChooserList" class="meal-chooser-list"></div><div class="recipe-picker-actions"><button type="button" class="sl-btn sl-btn-secondary" id="mealChooserCancel">ביטול</button></div>';
    overlay.appendChild(modal);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);

    const listEl = document.getElementById('mealChooserList');
    listEl.innerHTML = '<button type="button" class="meal-chooser-item" data-meal-id="">＋ ארוחה חדשה</button>' +
        meals.map(m => `<button type="button" class="meal-chooser-item" data-meal-id="${escapeHtml(m.id)}">${escapeHtml(m.name || 'ארוחה')} (${(m.recipeIds || []).length})</button>`).join('');

    const close = () => overlay.remove();
    document.getElementById('mealChooserCancel').onclick = close;

    listEl.querySelectorAll('.meal-chooser-item').forEach(btn => {
        btn.addEventListener('click', async () => {
            let mealId = btn.dataset.mealId || '';
            if (!mealId) {
                try {
                    const newMeal = await createMeal({
                        name: 'ארוחה חדשה',
                        recipeIds: [],
                        createdBy: { uid: user.uid, name: user.displayName || user.email || '' }
                    });
                    if (newMeal) mealId = newMeal.id;
                } catch (e) {
                    console.error(e);
                    alert('שגיאה ביצירת ארוחה. נסי שוב.');
                    return;
                }
            }
            close();
            if (mealId) openRecipePickerForMeal(mealId, uid, isMe, gridEl, loadingEl, emptyEl, loginHint);
        });
    });
}

function setProfileTitle(uid, isMe, meals) {
    const titleEl = document.getElementById('profile-title');
    if (!titleEl) return;
    const svg = titleEl.querySelector('svg');
    const iconHtml = svg ? svg.outerHTML + ' ' : '';
    if (isMe) {
        titleEl.innerHTML = iconHtml + 'הארוחות שלי';
        return;
    }
    const name = (meals.length && meals[0].createdBy && meals[0].createdBy.name) ? meals[0].createdBy.name : 'משתמש/ת';
    titleEl.innerHTML = iconHtml + ('הארוחות של ' + name);
}

async function initProfile() {
    const params = new URLSearchParams(window.location.search);
    const viewUid = params.get('uid') || null;
    const currentUser = auth.currentUser;

    updateAuthUI(currentUser);
    onUserChange((user) => {
        updateAuthUI(user);
        const uid = viewUid || (user ? user.uid : null);
        const isMe = !viewUid && !!user;
        loadAndRenderMeals(uid, isMe).then(meals => setProfileTitle(uid, isMe, meals));
    });

    const uid = viewUid || (currentUser ? currentUser.uid : null);
    const isMe = !viewUid && !!currentUser;

    if (!currentUser && !viewUid) {
        document.getElementById('profile-loading').style.display = 'none';
        document.getElementById('profile-login-hint').style.display = 'block';
        setProfileTitle(null, false, []);
        return;
    }

    if (!uid) {
        document.getElementById('profile-loading').style.display = 'none';
        setProfileTitle(null, false, []);
        return;
    }

    const meals = await loadAndRenderMeals(uid, isMe);
    setProfileTitle(uid, isMe, meals);

    const addBtn = document.getElementById('profile-add-recipes-btn');
    if (addBtn && isMe) {
        addBtn.onclick = async () => {
            const user = auth.currentUser;
            if (!user) return;
            const currentUid = user.uid;
            const gridEl = document.getElementById('profile-meals-grid');
            const loadingEl = document.getElementById('profile-loading');
            const emptyEl = document.getElementById('profile-empty');
            const loginHint = document.getElementById('profile-login-hint');
            let currentMeals = [];
            try {
                currentMeals = await getMealsByUser(currentUid);
            } catch (e) {
                console.error(e);
                return;
            }
            if (currentMeals.length === 0) {
                try {
                    const newMeal = await createMeal({
                        name: 'ארוחה חדשה',
                        recipeIds: [],
                        createdBy: { uid: user.uid, name: user.displayName || user.email || '' }
                    });
                    if (newMeal) {
                        openRecipePickerForMeal(newMeal.id, currentUid, true, gridEl, loadingEl, emptyEl, loginHint);
                    }
                } catch (e) {
                    console.error(e);
                    alert('שגיאה ביצירת ארוחה. נסי שוב.');
                }
            } else {
                openMealChooserThenPicker(currentUid, true, currentMeals, gridEl, loadingEl, emptyEl, loginHint);
            }
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initProfile().catch(err => {
        console.error('profile init', err);
        document.getElementById('profile-loading').textContent = 'שגיאה בטעינה. נסי לרענן.';
    });
});
