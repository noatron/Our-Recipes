import { db, auth, onUserChange, signInWithGoogle, signOutUser } from './firebase.js';
import { collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, increment, serverTimestamp, collectionGroup, query, where } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getMealsByUser, createMeal, addRecipeToMeal } from './meals.js';

/** קבוצות קטגוריות לדרופדאון */
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

/** רשימת כל הקטגוריות – לסינון, תצוגה וייבוא מתמונות */
const ALL_TAGS = ['בשר', 'דגים', 'פסטות', 'קישים ופשטידות', 'צמחוני', 'סלטים', 'תוספות', 'לחם ומאפים', 'רטבים וממרחים', 'מרקים', 'עוגות', 'עוגיות', 'קינוחים', 'שוקולד', 'ארוחות בוקר', 'חטיפים', 'שתייה'];

const defaultRecipes = [
    {
        id: "1",
        name: "שקשוקה",
        source: "סבתא רחל",
        image: "https://images.unsplash.com/photo-1587217850473-0238d26d4785?w=400&h=300&fit=crop",
        ingredients: ["6 ביצים", "2 עגבניות", "1 בצל", "2 שיני שום", "פלפל אדום", "כמון", "מלח ופלפל"],
        instructions: ["חותכים את הבצל והעגבניות לקוביות", "מטגנים את הבצל עד שמזהיב", "מוסיפים את העגבניות והתבלינים", "מבשלים 10 דקות", "עושים גומות ושוברים ביצים", "מכסים ומבשלים עד שהביצים מתקשות"]
    },
    {
        id: "2",
        name: "פסטה בולונז",
        source: "אתר טעים",
        image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
        ingredients: ["500 גרם בשר טחון", "פסטה", "רסק עגבניות", "בצל", "שום", "בזיליקום"],
        instructions: ["מטגנים בצל ושום", "מוסיפים בשר ומשחימים", "מוסיפים רסק עגבניות", "מבשלים 30 דקות", "מבשלים פסטה", "מערבבים ביחד"]
    },
    {
        id: "3",
        name: "עוגת שוקולד",
        source: "מגזין אוכל",
        image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop",
        ingredients: ["200 גרם שוקולד מריר", "4 ביצים", "כוס סוכר", "חצי כוס קמח", "חצי כוס חמאה"],
        instructions: ["מחממים תנור ל-180 מעלות", "ממיסים שוקולד וחמאה", "מקציפים ביצים וסוכר", "מערבבים הכל", "אופים 35 דקות"]
    },
    {
        id: "4",
        name: "סלט ירקות",
        source: "ספר בריאות",
        image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
        ingredients: ["חסה", "עגבנייה", "מלפפון", "בצל", "לימון", "שמן זית"],
        instructions: ["חותכים את כל הירקות", "מערבבים בקערה", "מוסיפים לימון ושמן", "מערבבים היטב"]
    },
    {
        id: "5",
        name: "מרק עוף",
        source: "אמא שלי",
        image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
        ingredients: ["עוף שלם", "גזר", "סלרי", "בצל", "שום", "מלח ופלפל"],
        instructions: ["שמים עוף בסיר", "מוסיפים ירקות ומים", "מבשלים 60 דקות", "מסננים", "מגישים חם"]
    },
    {
        id: "6",
        name: "פנקייקים",
        source: "בלוג בישול",
        image: "https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=400&h=300&fit=crop",
        ingredients: ["2 כוסות קמח", "2 ביצים", "כוס חלב", "סוכר", "אבקת אפייה"],
        instructions: ["מערבבים מרכיבים יבשים", "מוסיפים ביצים וחלב", "מחממים מחבת", "שופכים בצק", "הופכים כשמופיעים בועות"]
    },
    {
        id: "7",
        name: "חומוס",
        source: "דודה מזל",
        image: "https://images.unsplash.com/photo-1571368295935-d9551b53f6f3?w=400&h=300&fit=crop",
        ingredients: ["פחית חומוס מבושל", "טחינה גולמית", "לימון", "שום", "כמון", "מלח"],
        instructions: ["שמים הכל בבלנדר", "טוחנים עד לקבלת מרקם חלק", "טועמים ומתקנים תיבול", "מעבירים לצלחת", "מוסיפים שמן זית מעל"]
    }
];

/** שם המתכון לתצוגה – אם מהאתר נשמר דף שגיאה, מציגים "מתכון" (המקור יופיע מתחת) */
function getRecipeDisplayName(recipe) {
    const name = (recipe.name || '').trim();
    if (!name || /error response|404|forbidden|not found/i.test(name)) return 'מתכון';
    return name;
}

/** SVG לב בצבע האפליקציה – מלא (liked) או רק קו (לא liked) */
function getHeartSvg(liked) {
    const fill = liked ? '#407076' : 'none';
    const stroke = liked ? '#407076' : '#698996';
    return `<svg class="heart-svg" viewBox="0 0 24 24" width="22" height="22" fill="${fill}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

/** קישור תמונה ל-HTTPS כדי למנוע Mixed Content */
function ensureHttpsImage(url) {
    if (!url || !String(url).trim()) return url;
    return String(url).replace(/^http:\/\//i, 'https://');
}

/** מקור המתכון – דומיין או טקסט מקור */
function getRecipeSourceLabel(recipe) {
    if (recipe.source && String(recipe.source).trim()) return recipe.source.trim();
    if (recipe.url) {
        try { return new URL(recipe.url).hostname.replace(/^www\./, ''); } catch (e) {}
    }
    return '';
}

/** שם המוסיפה – לתצוגת "הוסיף ע"י" (מתכונים ישנים: נועה) */
function getAddedByName(recipe) {
    return (recipe.addedByName && String(recipe.addedByName).trim()) ? recipe.addedByName.trim() : 'נועה';
}

/** Carousel-only card: cinematic image, title (2 lines), מאת. One tap → recipe detail. */
function buildCarouselCardHtml(recipe) {
    const addedByName = getAddedByName(recipe);
    const imgSrc = ensureHttpsImage(recipe.image) || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=534&fit=crop';
    return `
    <div class="recipe-card-carousel" data-recipe-id="${recipe.id}" onclick="window.showRecipe('${recipe.id}')">
        <div class="carousel-card-image-wrap">
            <img src="${escapeHtml(imgSrc)}" alt="" class="carousel-card-image" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=534&fit=crop';">
        </div>
        <div class="carousel-card-copy">
            <h2 class="carousel-card-title">${escapeHtml(getRecipeDisplayName(recipe))}</h2>
            <p class="carousel-card-by">מאת ${escapeHtml(addedByName)}</p>
        </div>
    </div>
    `;
}

/** Grid card: full recipe card with image, title, source, מאת, comments, tags, like, add-to-meal, edit, share. */
function buildGridCardHtml(recipe) {
    const likeCount = (r) => (r.likesCount != null ? r.likesCount : 0);
    const commentsCount = (r) => (r.commentsCount != null ? r.commentsCount : 0);
    const sourceLabel = getRecipeSourceLabel(recipe);
    const addedByName = getAddedByName(recipe);
    const tags = Array.isArray(recipe.tags) ? recipe.tags : [];
    const tagsHtml = tags.length
        ? `<div class="recipe-tags">${tags.map(t => `<span class="recipe-tag">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';
    const liked = !!recipe.likedByMe;
    const count = likeCount(recipe);
    const numComments = commentsCount(recipe);
    const commentsLabel = numComments === 0 ? 'הערות' : (numComments === 1 ? 'הערה' : 'הערות');
    const commentsLinkHtml = `<a href="recipe-detail.html#comments" class="recipe-comments-link" data-recipe-id="${recipe.id}" onclick="event.preventDefault(); event.stopPropagation(); window.showRecipeToComments('${recipe.id}')">${numComments} ${commentsLabel}</a>`;
    const editBtnHtml = `<button type="button" class="recipe-card-edit" data-recipe-id="${recipe.id}" aria-label="ערוך מתכון" onclick="event.preventDefault(); event.stopPropagation(); window.showRecipeEdit('${recipe.id}')" title="ערוך מתכון"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>`;
    const shareBtnHtml = `<button type="button" class="recipe-card-share" data-recipe-id="${recipe.id}" aria-label="שתפי קישור" onclick="event.preventDefault(); event.stopPropagation(); window.shareRecipe('${recipe.id}')" title="שתפי קישור"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>`;
    const showAddToMeal = !!(window.__isApproved && auth.currentUser);
    const addToMealBtnHtml = showAddToMeal ? `<button type="button" class="recipe-add-to-meal-btn" data-recipe-id="${recipe.id}" aria-label="הוספה לארוחה" onclick="event.preventDefault(); event.stopPropagation(); window.openAddToMealSheet('${recipe.id}')" title="＋ לארוחה">＋ לארוחה</button>` : '';
    return `
    <div class="recipe-card" data-recipe-id="${recipe.id}" onclick="window.showRecipe('${recipe.id}')">
        <div class="recipe-card-image-wrap">
            <img src="${escapeHtml(ensureHttpsImage(recipe.image) || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=200&fit=crop')}" alt="" class="recipe-image" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=200&fit=crop';">
            ${shareBtnHtml}
            ${editBtnHtml}
        </div>
        <div class="recipe-content">
            <div class="recipe-title-row">
                <h2 class="recipe-name">${escapeHtml(getRecipeDisplayName(recipe))}</h2>
                <div class="recipe-card-actions">
                    ${addToMealBtnHtml}
                    <button type="button" class="recipe-like-btn ${liked ? 'liked' : ''}" data-recipe-id="${recipe.id}" aria-label="עשי לב">
                        <span class="like-icon">${getHeartSvg(liked)}</span>
                        <span class="like-count">${count}</span>
                    </button>
                </div>
            </div>
            ${sourceLabel ? (recipe.url ? `<p class="recipe-source"><a href="${escapeHtml(recipe.url)}" target="_blank" rel="noopener noreferrer" class="recipe-source-link">${escapeHtml(sourceLabel)}</a></p>` : `<p class="recipe-source">${escapeHtml(sourceLabel)}</p>`) : ''}
            <p class="recipe-added-by">${recipe.addedByUid ? `<a href="profile.html?uid=${encodeURIComponent(recipe.addedByUid)}" class="recipe-added-by-link" onclick="event.stopPropagation()">מאת ${escapeHtml(addedByName)}</a>` : `מאת ${escapeHtml(addedByName)}`}</p>
            <div class="recipe-comments-row">${commentsLinkHtml}</div>
            ${tagsHtml}
        </div>
    </div>
    `;
}

function buildRecipeCardHtml(recipe, options = {}) {
    if (options.carousel) return buildCarouselCardHtml(recipe);
    return buildGridCardHtml(recipe);
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** mode: 'carousel' (browse) | 'grid' (search/filter). count only for grid. */
function displayRecipes(recipesToShow, options = {}) {
    const recipesContainer = document.getElementById('recipes');
    if (!recipesContainer) return;

    const mode = options.mode || 'grid';
    const count = options.count ?? recipesToShow.length;

    if (recipesToShow.length === 0) {
        recipesContainer.innerHTML = '<div class="no-recipes">לא נמצאו מתכונים 😔</div>';
        return;
    }

    recipesContainer.style.opacity = '0';
    if (mode === 'carousel') {
        const toShow = shuffleArray(recipesToShow);
        recipesContainer.innerHTML = `<div class="recipes-carousel-outer"><div class="recipes-carousel">${toShow.map(r => buildRecipeCardHtml(r, { carousel: true })).join('')}</div></div>`;
    } else {
        recipesContainer.innerHTML = `<p class="recipes-results-header">מציג ${count} מתכונים</p><div class="recipes-grid">${recipesToShow.map(r => buildRecipeCardHtml(r)).join('')}</div>`;
    }
    requestAnimationFrame(() => { recipesContainer.style.opacity = '1'; });

    recipesContainer.querySelectorAll('.recipe-like-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.dataset.recipeId;
            if (id) window.toggleLike(id);
        });
    });
}

window.showRecipe = function(id) {
    localStorage.setItem('selectedRecipeId', id);
    window.location.href = 'recipe-detail.html';
}

window.showRecipeToComments = function(id) {
    localStorage.setItem('selectedRecipeId', id);
    window.location.href = 'recipe-detail.html#comments';
}

window.showRecipeEdit = function(id) {
    localStorage.setItem('selectedRecipeId', id);
    window.location.href = 'recipe-detail.html?edit=1';
}

/** קישור לשיתוף מתכון (מהכרטיס או מדף המתכון) */
function getRecipeShareUrl(recipeId) {
    if (!recipeId) return '';
    return new URL('recipe-detail.html?id=' + encodeURIComponent(recipeId), window.location.href).href;
}

window.shareRecipe = async function(recipeId) {
    const url = getRecipeShareUrl(recipeId);
    if (!url) return;
    const recipes = window.__allRecipes || [];
    const r = recipes.find(x => x.id === recipeId);
    const title = (r && r.name ? r.name : 'מתכון') + ' – מפה לפה';
    try {
        if (typeof navigator.share === 'function') {
            await navigator.share({ title, url, text: title });
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
        prompt('העתיקי את הקישור לשיתוף:', url);
    }
};

/** מעשיר את רשימת המתכונים ב-likedByMe לפי המשתמש המחובר – שאילתה אחת במקום N */
async function enrichRecipesWithLikes(recipes, user) {
    recipes.forEach(r => { r.likedByMe = false; });
    if (!user) return;
    try {
        const q = query(collectionGroup(db, 'likes'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        const likedRecipeIds = new Set();
        snapshot.forEach(d => likedRecipeIds.add(d.ref.parent.parent.id));
        recipes.forEach(r => { r.likedByMe = likedRecipeIds.has(r.id); });
    } catch (e) {
        // נפילה ל-N קריאות אם אין אינדקס או שדה userId במסמכי likes ישנים
        await Promise.all(recipes.map(async (r) => {
            const snap = await getDoc(doc(db, 'recipes', r.id, 'likes', user.uid));
            r.likedByMe = snap.exists();
        }));
    }
}

/** עדכון תצוגת Auth — פרופיל dropdown: מועדפים + התנתקות (מחובר) או התחברות (לא מחובר) */
function updateAuthUI(user) {
    const dropdownLogin = document.getElementById('header-dropdown-login');
    const dropdownLogout = document.getElementById('header-dropdown-logout');
    const dropdownFavorites = document.getElementById('header-dropdown-favorites');
    if (user) {
        if (dropdownFavorites) dropdownFavorites.style.display = '';
        if (dropdownLogout) dropdownLogout.style.display = '';
        if (dropdownLogin) dropdownLogin.style.display = 'none';
    } else {
        if (dropdownFavorites) dropdownFavorites.style.display = 'none';
        if (dropdownLogout) dropdownLogout.style.display = 'none';
        if (dropdownLogin) dropdownLogin.style.display = '';
    }
}

/** פרופיל: פתיחת/סגירת dropdown, מועדפים / התחברות / התנתקות */
function setupProfileDropdown(applyFilters) {
    const profileBtn = document.getElementById('header-profile-btn');
    const dropdown = document.getElementById('header-profile-dropdown');
    const favoritesFilterBtn = document.getElementById('favoritesFilterBtn');
    const dropdownFavorites = document.getElementById('header-dropdown-favorites');
    const dropdownLogout = document.getElementById('header-dropdown-logout');
    const dropdownLogin = document.getElementById('header-dropdown-login');
    if (!profileBtn || !dropdown) return;

    function closeDropdown() {
        dropdown.hidden = true;
        profileBtn.setAttribute('aria-expanded', 'false');
    }

    function syncFavoritesItemState() {
        if (dropdownFavorites && favoritesFilterBtn) {
            if (favoritesFilterBtn.classList.contains('active')) dropdownFavorites.classList.add('active');
            else dropdownFavorites.classList.remove('active');
        }
    }

    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !dropdown.hidden;
        dropdown.hidden = isOpen;
        profileBtn.setAttribute('aria-expanded', String(!isOpen));
        if (!isOpen) syncFavoritesItemState();
    });

    document.addEventListener('click', () => closeDropdown());
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    if (dropdownFavorites && favoritesFilterBtn && applyFilters) {
        dropdownFavorites.addEventListener('click', () => {
            favoritesFilterBtn.classList.toggle('active');
            syncFavoritesItemState();
            applyFilters();
        });
    }
    if (dropdownLogout) {
        dropdownLogout.addEventListener('click', () => {
            signOutUser();
            closeDropdown();
        });
    }
    if (dropdownLogin) {
        dropdownLogin.addEventListener('click', () => {
            signInWithGoogle();
            closeDropdown();
        });
    }
}

/** מוריד/מוסיף לב למתכון (דורש התחברות) */
async function toggleLike(recipeId) {
    const user = auth.currentUser;
    if (!user) {
        alert('התחברי עם גוגל כדי לעשות לב למתכונים 💚');
        return;
    }
    const recipes = window.__allRecipes;
    const applyFilters = window.__applyFilters;
    if (!recipes || !applyFilters) return;
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const likeRef = doc(db, 'recipes', recipeId, 'likes', user.uid);
    const recipeRef = doc(db, 'recipes', recipeId);

    try {
        if (recipe.likedByMe) {
            await deleteDoc(likeRef);
            await updateDoc(recipeRef, { likesCount: increment(-1) });
            recipe.likedByMe = false;
            recipe.likesCount = (recipe.likesCount ?? 0) - 1;
        } else {
            await setDoc(likeRef, { userId: user.uid, createdAt: serverTimestamp() });
            await updateDoc(recipeRef, { likesCount: increment(1) });
            recipe.likedByMe = true;
            recipe.likesCount = (recipe.likesCount ?? 0) + 1;
        }
        applyFilters();
    } catch (err) {
        console.error('toggleLike', err);
        alert('שגיאה בעדכון הלב. נסי שוב.');
    }
}

window.toggleLike = toggleLike;

/** bottom sheet: הוסיפי לארוחה קיימת / צרי ארוחה חדשה – רק למשתמשות מאושרות */
window.openAddToMealSheet = async function (recipeId) {
    const user = auth.currentUser;
    if (!user || !window.__isApproved) return;
    const overlay = document.createElement('div');
    overlay.className = 'add-to-meal-overlay';
    const sheet = document.createElement('div');
    sheet.className = 'add-to-meal-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'הוספת מתכון לארוחה');
    const close = () => {
        sheet.classList.remove('add-to-meal-sheet-open');
        overlay.classList.remove('add-to-meal-overlay-open');
        setTimeout(() => overlay.remove(), 280);
    };
    overlay.appendChild(sheet);
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    sheet.innerHTML = '<div class="add-to-meal-sheet-inner"><h3 class="add-to-meal-title">הוספה לארוחה</h3><p class="add-to-meal-sub">הוסיפי לארוחה קיימת</p><div class="add-to-meal-list" aria-busy="true">טוען...</div><p class="add-to-meal-sub add-to-meal-new-label">צרי ארוחה חדשה</p><div class="add-to-meal-new-row"><input type="text" class="add-to-meal-input" placeholder="שם הארוחה" id="addToMealNewName" maxlength="80"><button type="button" class="sl-btn sl-btn-primary" id="addToMealCreateBtn">שמירה</button></div></div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
        overlay.classList.add('add-to-meal-overlay-open');
        sheet.classList.add('add-to-meal-sheet-open');
    });

    const listEl = sheet.querySelector('.add-to-meal-list');
    const inputEl = document.getElementById('addToMealNewName');
    const createBtn = document.getElementById('addToMealCreateBtn');
    let meals = [];
    try {
        meals = await getMealsByUser(user.uid);
    } catch (e) {
        console.error('getMealsByUser', e);
    }
    if (meals.length === 0) {
        listEl.innerHTML = '<p class="add-to-meal-empty">אין לך עדיין ארוחות. צרי ארוחה חדשה למטה.</p>';
    } else {
        listEl.innerHTML = meals.map(m => `<button type="button" class="add-to-meal-item" data-meal-id="${escapeHtml(m.id)}">${escapeHtml(m.name || 'ארוחה')} (${(m.recipeIds || []).length} מתכונים)</button>`).join('');
        listEl.querySelectorAll('.add-to-meal-item').forEach(btn => {
            btn.addEventListener('click', async () => {
                const mealId = btn.dataset.mealId;
                if (!mealId) return;
                btn.disabled = true;
                try {
                    await addRecipeToMeal(mealId, recipeId);
                    close();
                    if (typeof alert === 'function') alert('המתכון נוסף לארוחה ✓');
                } catch (err) {
                    console.error(err);
                    alert('שגיאה בהוספה. נסי שוב.');
                } finally {
                    btn.disabled = false;
                }
            });
        });
    }
    listEl.removeAttribute('aria-busy');

    createBtn.addEventListener('click', async () => {
        const name = (inputEl && inputEl.value || '').trim();
        if (!name) {
            alert('הזיני שם לארוחה.');
            return;
        }
        createBtn.disabled = true;
        try {
            const meal = await createMeal({
                name,
                recipeIds: [recipeId],
                createdBy: { uid: user.uid, name: user.displayName || user.email || 'משתמשת' }
            });
            if (meal) {
                close();
                if (typeof alert === 'function') alert('ארוחה נוצרה והמתכון נוסף ✓');
            }
        } catch (err) {
            console.error(err);
            alert('שגיאה ביצירת ארוחה. נסי שוב.');
        } finally {
            createBtn.disabled = false;
        }
    });
};

const SEARCH_PLACEHOLDERS = ['חפשי מתכון...', 'מה יש לך במטבח?', 'קינוח לשבת?'];

function setupSearch(applyFilters) {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    searchInput.addEventListener('input', () => { if (applyFilters) applyFilters(); });
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && applyFilters) applyFilters(); });
    let phIndex = 0;
    if (SEARCH_PLACEHOLDERS.length > 0) {
        setInterval(() => {
            phIndex = (phIndex + 1) % SEARCH_PLACEHOLDERS.length;
            searchInput.placeholder = SEARCH_PLACEHOLDERS[phIndex];
        }, 3500);
    }
}

function setupHeaderChips(applyFilters) {
    const chips = document.querySelectorAll('.header-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => { c.classList.remove('active'); c.setAttribute('aria-selected', 'false'); });
            chip.classList.add('active');
            chip.setAttribute('aria-selected', 'true');
            if (applyFilters) applyFilters();
        });
    });
}

/** במובייל: כפתור "הפתעות ורעיונות" פותח/סוגר את הבלוק */
function setupSurpriseMobileToggle() {
    const wrap = document.getElementById('surpriseMobileWrap');
    const toggle = document.getElementById('surpriseMobileToggle');
    const content = document.getElementById('surpriseMobileContent');
    if (!wrap || !toggle || !content) return;
    toggle.addEventListener('click', () => {
        const expanded = wrap.classList.toggle('surprise-mobile-expanded');
        toggle.setAttribute('aria-expanded', String(expanded));
    });
    const moreWrap = document.getElementById('mobileMoreWrap');
    if (moreWrap && window.matchMedia('(max-width: 768px)').matches) {
        moreWrap.removeAttribute('open');
    }
}

/** הפתיעי אותי – הגרלת 3–5 מתכונים. כפתור בהדר + בר "ההפתעה שלך". */
function setupSurpriseMe(allRecipes, tagGroupsData, applyFilters) {
    const headerSurpriseBtn = document.getElementById('headerSurpriseBtn');
    const surpriseBar = document.getElementById('surprise-bar');
    const surpriseAgainBtn = document.getElementById('surpriseAgainBtn');
    const surpriseBackBtn = document.getElementById('surpriseBackBtn');
    if (!surpriseBar) return;

    /** מתכונים שכבר הוצגו בהגרלה הנוכחית – "עוד אחת" יציע מתכונים אחרים */
    let surpriseAlreadyShownIds = new Set();

    function getPool() {
        return [...allRecipes];
    }

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function drawSurprise() {
        let pool = getPool();
        pool = pool.filter(r => !surpriseAlreadyShownIds.has(r.id));
        if (pool.length < 3) {
            surpriseAlreadyShownIds.clear();
            pool = getPool();
        }
        const count = Math.min(5, Math.max(3, pool.length));
        if (pool.length === 0) {
            displayRecipes([]);
            surpriseBar.style.display = 'none';
            return;
        }
        const picked = shuffle(pool).slice(0, count);
        picked.forEach(r => surpriseAlreadyShownIds.add(r.id));
        displayRecipes(picked);
        surpriseBar.style.display = 'flex';
    }

    function runSurprise() {
        surpriseAlreadyShownIds.clear();
        drawSurprise();
    }

    if (headerSurpriseBtn) headerSurpriseBtn.addEventListener('click', runSurprise);
    if (surpriseAgainBtn) surpriseAgainBtn.addEventListener('click', drawSurprise);
    if (surpriseBackBtn) {
        surpriseBackBtn.addEventListener('click', () => {
            surpriseBar.style.display = 'none';
            surpriseAlreadyShownIds.clear();
            if (applyFilters) applyFilters();
        });
    }
}

/** כפתור "צור לי רשימת קניות" – מודל לבחירת מתכונים, איגום מרכיבים (ללא תבלינים/שמן), מעבר לרשימה עם שיתוף */
function setupCreateShoppingListModal(allRecipes) {
    const btn = document.getElementById('createShoppingListBtn');
    if (!btn || typeof window.ShoppingList === 'undefined') return;
    btn.addEventListener('click', () => {
        const recipes = (window.__allRecipes || allRecipes || []).filter(r => Array.isArray(r.ingredients) && r.ingredients.length > 0);
        if (recipes.length === 0) {
            alert('אין מתכונים עם מרכיבים. הוסיפי מתכונים קודם.');
            return;
        }
        const overlay = document.createElement('div');
        overlay.className = 'create-sl-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;padding:16px;';
        const box = document.createElement('div');
        box.className = 'create-sl-modal';
        box.style.cssText = 'background:#F8F7FF;border-radius:16px;padding:24px;max-width:480px;width:100%;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;font-family:Varela Round,sans-serif;direction:rtl;box-shadow:0 8px 32px rgba(0,0,0,0.2);';
        const listHtml = recipes.map(r =>
            '<label class="create-sl-recipe"><input type="checkbox" class="create-sl-check" data-recipe-id="' + escapeHtml(r.id) + '" data-recipe-name="' + escapeHtml(r.name || '') + '"> ' + escapeHtml(r.name || 'מתכון') + '</label>'
        ).join('');
        box.innerHTML =
            '<h3 style="margin:0 0 8px;color:#407076;font-size:1.25rem;">צור לי רשימת קניות</h3>' +
            '<p style="margin:0 0 16px;color:#698996;font-size:0.9rem;">בחרי מתכונים – המרכיבים יתאחדו לרשימה אחת (תבלינים ושמן לא ייכללו).</p>' +
            '<div class="create-sl-list" style="overflow-y:auto;flex:1;min-height:0;margin-bottom:20px;">' + listHtml + '</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
            '<button type="button" class="sl-btn sl-btn-primary" id="createSlConfirm">צור רשימה</button>' +
            '<button type="button" class="sl-btn sl-btn-secondary" id="createSlCancel">ביטול</button>' +
            '</div>';
        overlay.appendChild(box);
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);

        document.getElementById('createSlCancel').onclick = () => overlay.remove();
        document.getElementById('createSlConfirm').onclick = () => {
            const checked = box.querySelectorAll('.create-sl-check:checked');
            if (checked.length === 0) {
                alert('בחרי לפחות מתכון אחד.');
                return;
            }
            window.ShoppingList.clear();
            checked.forEach(cb => {
                const recipe = recipes.find(r => r.id === cb.dataset.recipeId);
                if (recipe && recipe.ingredients && recipe.ingredients.length) {
                    window.ShoppingList.addItems(recipe.id, recipe.name, recipe.ingredients);
                }
            });
            overlay.remove();
            window.location.href = 'shopping-list.html?fromCreate=1';
        };
    });
}

function setupTagGroupDropdown(applyFilters, tagGroupsData) {
    const select = document.getElementById('tag-group-select');
    if (select) {
        const groups = tagGroupsData || TAG_GROUPS;
        select.innerHTML = '<option value="">הכל</option>' + groups.map(g =>
            '<optgroup label="' + escapeHtml(g.label) + '">' +
            (g.tags || []).map(t => '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>').join('') +
            '</optgroup>'
        ).join('');
        select.addEventListener('change', () => { if (applyFilters) applyFilters(); });
    }
}

/** מחזיר רשימת UID של משתמשות מאושרות */
async function getApprovedUids() {
    try {
        const snap = await getDoc(doc(db, 'config', 'approvedUsers'));
        if (snap.exists() && Array.isArray(snap.data().uids)) return snap.data().uids;
    } catch (_) {}
    return [];
}

/** רושם משתמשת ברשימת הממתינות (לאדמין) */
async function addToPendingUsers(user) {
    try {
        await setDoc(doc(db, 'pendingUsers', user.uid), {
            displayName: user.displayName || '',
            email: user.email || '',
            createdAt: serverTimestamp()
        }, { merge: true });
    } catch (_) {}
}

/** נורמליזציה לחיפוש – לשימוש בחיפוש שם ומצרכים */
function normalizeForSearch(str) {
    if (!str || typeof str !== 'string') return '';
    let s = str.trim().toLowerCase();
    s = s.replace(/ים\s/g, ' ').replace(/ים$/g, '');
    s = s.replace(/י\s/g, ' ').replace(/י$/g, '');
    return s;
}

/** חיפוש לפי מצרכים/טקסט – מחזיר מתכונים שהמילים מופיעות בשם/מרכיבים/תגיות */
function searchByIngredientsFromList(recipes, text) {
    const rawWords = (text || '').trim().split(/[\s,]+/).filter(Boolean);
    if (rawWords.length === 0) return [];
    const words = rawWords.map(w => normalizeForSearch(w)).filter(Boolean);
    if (words.length === 0) return [];
    return recipes
        .map(r => {
            const name = (r.name || '').trim();
            const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
            const tags = Array.isArray(r.tags) ? r.tags : [];
            const units = [name, ...ingredients, ...tags].map(u => (u && String(u).trim()) || '').filter(Boolean);
            let score = 0;
            units.forEach(unit => {
                const normalizedUnit = normalizeForSearch(unit);
                if (words.every(w => normalizedUnit.includes(w))) score += words.length;
            });
            return { recipe: r, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.recipe);
}

function getActiveFilters() {
    const searchTerm = (document.getElementById('searchInput')?.value || '').trim();
    const activeChip = document.querySelector('.header-chip.active');
    let selectedTags = [];
    if (activeChip) {
        const tag = activeChip.getAttribute('data-tag');
        const tags = activeChip.getAttribute('data-tags');
        if (tags) selectedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
        else if (tag) selectedTags = [tag];
    }
    const favoritesOnly = document.getElementById('favoritesFilterBtn')?.classList.contains('active') || false;
    return { searchTerm, selectedTags, favoritesOnly };
}

/** True when no search and chip is "הכל" → show carousel (browse) mode */
function isBrowseMode() {
    const { searchTerm, selectedTags } = getActiveFilters();
    return !searchTerm && selectedTags.length === 0;
}

function filterRecipes(allRecipes) {
    const { searchTerm, selectedTags, favoritesOnly } = getActiveFilters();
    let list = allRecipes;
    if (favoritesOnly) list = list.filter(r => !!r.likedByMe);
    if (selectedTags.length > 0) list = list.filter(r => Array.isArray(r.tags) && selectedTags.some(t => r.tags.includes(t)));
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const byNameOrSource = list.filter(recipe => {
            const name = (recipe.name || '').toLowerCase();
            const source = getRecipeSourceLabel(recipe).toLowerCase();
            return name.includes(term) || source.includes(term);
        });
        const byIngredients = searchByIngredientsFromList(list, searchTerm);
        const ids = new Set([...byNameOrSource.map(r => r.id), ...byIngredients.map(r => r.id)]);
        list = list.filter(r => ids.has(r.id));
    }
    return list;
}

const RECIPES_CACHE_KEY = 'app_recipes_cache';
const RECIPES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 דקות

function getRecipesFromCache() {
    try {
        const raw = sessionStorage.getItem(RECIPES_CACHE_KEY);
        if (!raw) return null;
        const { timestamp, recipes } = JSON.parse(raw);
        if (!Array.isArray(recipes) || Date.now() - (timestamp || 0) > RECIPES_CACHE_TTL_MS) return null;
        return recipes;
    } catch (_) {
        return null;
    }
}

function setRecipesCache(recipes) {
    try {
        sessionStorage.setItem(RECIPES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), recipes }));
    } catch (_) {}
}

async function initApp() {
    const container = document.getElementById('recipes');

    try {
        let tagGroupsData = TAG_GROUPS;
        try {
            const configSnap = await getDoc(doc(db, 'config', 'tags'));
            if (configSnap.exists() && Array.isArray(configSnap.data().tagGroups) && configSnap.data().tagGroups.length) {
                tagGroupsData = configSnap.data().tagGroups;
            }
        } catch (_) {}

        const scrollToIdOnLoad = new URLSearchParams(window.location.search).get('scrollTo');
        const cached = scrollToIdOnLoad ? null : getRecipesFromCache();
        let recipes = [];
        let fromCache = false;

        if (cached && cached.length > 0) {
            recipes = cached;
            fromCache = true;
            console.log('🍽️ טעינה מהירה מהמטמון:', recipes.length, 'מתכונים');
        }

        if (!fromCache) {
            if (container) container.innerHTML = '<div class="recipes-loading" aria-live="polite">טוען מתכונים...</div>';
            const snapshot = await getDocs(collection(db, 'recipes'));
            if (snapshot.empty) {
                for (const recipe of defaultRecipes) {
                    await setDoc(doc(db, 'recipes', recipe.id), recipe);
                }
                recipes = defaultRecipes;
            } else {
                snapshot.forEach(d => recipes.push({ id: d.id, ...d.data() }));
            }
            console.log('🍽️ נטענו מ-Firebase:', recipes.length, 'מתכונים');
            setRecipesCache(recipes);
        }

        window.__allRecipes = recipes;
        const applyFilters = () => {
            const list = window.__allRecipes || recipes;
            const filtered = filterRecipes(list);
            const browseMode = isBrowseMode();
            if (browseMode) {
                displayRecipes(filtered, { mode: 'carousel' });
            } else {
                displayRecipes(filtered, { mode: 'grid', count: filtered.length });
            }
        };
        window.__applyFilters = applyFilters;

        setupHeaderChips(applyFilters);
        setupSearch(applyFilters);
        setupSurpriseMe(recipes, tagGroupsData, applyFilters);
        setupProfileDropdown(applyFilters);

        const favoritesFilterBtn = document.getElementById('favoritesFilterBtn');
        onUserChange(async (user) => {
            updateAuthUI(user);
            window.__isApproved = false;
            if (!user && favoritesFilterBtn?.classList.contains('active')) favoritesFilterBtn.classList.remove('active');
            const pendingBanner = document.getElementById('pending-approval-banner');
            const addBtn = document.getElementById('add-recipe-btn');
            if (user) {
                const approved = await getApprovedUids();
                const isApproved = approved.includes(user.uid);
                window.__isApproved = isApproved;
                if (!isApproved) {
                    const showBanner = !sessionStorage.getItem('pendingBannerSeen');
                    if (pendingBanner) pendingBanner.style.display = showBanner ? 'block' : 'none';
                    if (showBanner) sessionStorage.setItem('pendingBannerSeen', '1');
                    await addToPendingUsers(user);
                } else {
                    if (pendingBanner) pendingBanner.style.display = 'none';
                }
                if (addBtn) addBtn.style.display = '';
            } else {
                if (pendingBanner) pendingBanner.style.display = 'none';
                if (addBtn) addBtn.style.display = 'none';
            }
            enrichRecipesWithLikes(recipes, user).then(applyFilters);
        });
        updateAuthUI(auth.currentUser);
        const pendingBanner = document.getElementById('pending-approval-banner');
        const addBtn = document.getElementById('add-recipe-btn');
        if (auth.currentUser) {
            const approved = await getApprovedUids();
            window.__isApproved = approved.includes(auth.currentUser.uid);
            if (!window.__isApproved) {
                const showBanner = !sessionStorage.getItem('pendingBannerSeen');
                if (pendingBanner) pendingBanner.style.display = showBanner ? 'block' : 'none';
                if (showBanner) sessionStorage.setItem('pendingBannerSeen', '1');
                await addToPendingUsers(auth.currentUser);
            } else {
                if (pendingBanner) pendingBanner.style.display = 'none';
            }
            if (addBtn) addBtn.style.display = '';
        } else {
            if (addBtn) addBtn.style.display = 'none';
        }

        // מציגים את הרשימה מיד; הלבבות מתעדכנים ברקע
        applyFilters();
        enrichRecipesWithLikes(recipes, auth.currentUser).then(applyFilters);

        // גלילה למתכון שחזרנו אליו (אחרי שמירה / כפתור חזרה)
        if (scrollToIdOnLoad) {
            const scrollAfterRender = () => {
                const card = document.querySelector('.recipe-card[data-recipe-id="' + scrollToIdOnLoad + '"]');
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (window.history.replaceState) window.history.replaceState(null, '', 'index.html');
                }
            };
            setTimeout(scrollAfterRender, 100);
        }

        // אם טענו מהמטמון – מרעננים ברקע ומעדכנים
        if (fromCache) {
            getDocs(collection(db, 'recipes')).then(snapshot => {
                if (snapshot.empty) return;
                const fresh = [];
                snapshot.forEach(d => fresh.push({ id: d.id, ...d.data() }));
                window.__allRecipes = fresh;
                setRecipesCache(fresh);
                if (window.__applyFilters) window.__applyFilters();
                enrichRecipesWithLikes(fresh, auth.currentUser).then(() => {
                    if (window.__applyFilters) window.__applyFilters();
                });
            }).catch(() => {});
        }
    } catch (err) {
        console.error('שגיאה בטעינת מתכונים:', err);
        const msg = err && (err.message || String(err)) || 'שגיאה לא ידועה';
        const container = document.getElementById('recipes');
        if (container) {
            container.innerHTML = `
                <div class="no-recipes" style="max-width: 400px; margin: 0 auto; text-align: center; padding: 24px;">
                    <p style="margin-bottom: 12px;">לא הצלחנו לטעון מתכונים מ-Firebase.</p>
                    <p style="font-size: 0.85rem; color: #c62828; margin-bottom: 16px; word-break: break-all;">${escapeHtml(msg)}</p>
                    <p style="font-size: 0.9rem; color: #698996;">נסי לרענן את הדף. אם פתחת מקובץ (file://) — הרצי דרך שרת מקומי.</p>
                </div>
            `;
        }
    }
    
    const addBtn = document.getElementById('add-recipe-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            window.location.href = 'add-recipe.html';
        });
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => {
        console.error('initApp rejected:', err);
        const container = document.getElementById('recipes');
        if (container) {
            const msg = err && (err.message || String(err)) || 'שגיאה לא ידועה';
            container.innerHTML = `<div class="no-recipes" style="max-width: 400px; margin: 0 auto; text-align: center; padding: 24px;"><p>שגיאה בטעינה: ${escapeHtml(msg)}</p></div>`;
        }
    });
});