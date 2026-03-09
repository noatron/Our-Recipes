import { auth, onUserChange, signInWithGoogle, signOutUser } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { db } from './firebase.js';
import { getMealsByUser } from './meals.js';

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

function buildMealCardHtml(meal, thumbnailUrl) {
    const name = (meal.name || 'ארוחה').trim();
    const by = (meal.createdBy && meal.createdBy.name) ? meal.createdBy.name : 'משתמשת';
    const byUid = (meal.createdBy && meal.createdBy.uid) ? meal.createdBy.uid : '';
    const count = Array.isArray(meal.recipeIds) ? meal.recipeIds.length : 0;
    const recipesLabel = count === 1 ? 'מתכון אחד' : count + ' מתכונים';
    const img = thumbnailUrl || DEFAULT_IMAGE;
    const byHtml = byUid
        ? `<a href="profile.html?uid=${escapeHtml(byUid)}" class="meal-card-by-link" onclick="event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();">מאת ${escapeHtml(by)}</a>`
        : `מאת ${escapeHtml(by)}`;
    return `
    <a href="meal-detail.html?id=${escapeHtml(meal.id)}" class="meal-card">
        <div class="meal-card-image-wrap">
            <img src="${escapeHtml(img)}" alt="" class="meal-card-image">
        </div>
        <div class="meal-card-content">
            <h3 class="meal-card-name">${escapeHtml(name)}</h3>
            <p class="meal-card-by">${byHtml}</p>
            <p class="meal-card-count">${escapeHtml(recipesLabel)}</p>
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

    gridEl.innerHTML = meals.map((m, i) => buildMealCardHtml(m, thumbnails[i])).join('');
    gridEl.style.display = 'grid';
    return meals;
}

function setProfileTitle(uid, isMe, meals) {
    const titleEl = document.getElementById('profile-title');
    if (!titleEl) return;
    if (isMe) {
        titleEl.textContent = 'הארוחות שלי';
        return;
    }
    const name = (meals.length && meals[0].createdBy && meals[0].createdBy.name) ? meals[0].createdBy.name : 'משתמש/ת';
    titleEl.textContent = 'הארוחות של ' + name;
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
}

document.addEventListener('DOMContentLoaded', () => {
    initProfile().catch(err => {
        console.error('profile init', err);
        document.getElementById('profile-loading').textContent = 'שגיאה בטעינה. נסי לרענן.';
    });
});
