import { db, auth, onUserChange, signInWithGoogle, signOutUser } from './firebase.js';
import { collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/** קבוצות קטגוריות לדרופדאון */
const TAG_GROUPS = [
    { label: 'מנות עיקריות', tags: ['בשר', 'דגים', 'פסטות', 'טרטים ופשטידות', 'צמחוני'] },
    { label: 'סלטים', tags: ['סלטים'] },
    { label: 'תוספות', tags: ['תוספות'] },
    { label: 'לחם ומאפים', tags: ['לחם ומאפים'] },
    { label: 'רוטבים וממרחים', tags: ['רוטבים וממרחים'] },
    { label: 'מרקים', tags: ['מרקים'] },
    { label: 'קינוחים', tags: ['עוגות', 'עוגיות', 'קינוחים', 'שוקולד'] },
    { label: 'ארוחות בוקר', tags: ['ארוחות בוקר'] },
    { label: 'חטיפים', tags: ['חטיפים'] },
    { label: 'שתייה', tags: ['שתייה'] }
];

/** רשימת כל הקטגוריות – לסינון, תצוגה וייבוא מתמונות */
const ALL_TAGS = ['בשר', 'דגים', 'פסטות', 'טרטים ופשטידות', 'צמחוני', 'סלטים', 'תוספות', 'לחם ומאפים', 'רוטבים וממרחים', 'מרקים', 'עוגות', 'עוגיות', 'קינוחים', 'שוקולד', 'ארוחות בוקר', 'חטיפים', 'שתייה'];

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

function displayRecipes(recipesToShow) {
    const recipesContainer = document.getElementById('recipes');
    if (!recipesContainer) return;

    if (recipesToShow.length === 0) {
        recipesContainer.innerHTML = '<div class="no-recipes">לא נמצאו מתכונים 😔</div>';
        return;
    }

    const likeCount = (r) => (r.likesCount != null ? r.likesCount : 0);
    const commentsCount = (r) => (r.commentsCount != null ? r.commentsCount : 0);
    recipesContainer.innerHTML = recipesToShow.map(recipe => {
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
        return `
        <div class="recipe-card" data-recipe-id="${recipe.id}" onclick="window.showRecipe('${recipe.id}')">
            <div class="recipe-card-image-wrap">
                <img src="${escapeHtml(ensureHttpsImage(recipe.image) || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=200&fit=crop')}" alt="" class="recipe-image" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=200&fit=crop';">
                ${editBtnHtml}
            </div>
            <div class="recipe-content">
                <div class="recipe-title-row">
                    <h2 class="recipe-name">${escapeHtml(getRecipeDisplayName(recipe))}</h2>
                    <button type="button" class="recipe-like-btn ${liked ? 'liked' : ''}" data-recipe-id="${recipe.id}" aria-label="עשי לב">
                        <span class="like-icon">${getHeartSvg(liked)}</span>
                        <span class="like-count">${count}</span>
                    </button>
                </div>
                ${sourceLabel ? (recipe.url ? `<p class="recipe-source"><a href="${escapeHtml(recipe.url)}" target="_blank" rel="noopener noreferrer" class="recipe-source-link">${escapeHtml(sourceLabel)}</a></p>` : `<p class="recipe-source">${escapeHtml(sourceLabel)}</p>`) : ''}
                <p class="recipe-added-by">הוסיף ע"י ${escapeHtml(addedByName)}</p>
                <div class="recipe-comments-row">${commentsLinkHtml}</div>
                ${tagsHtml}
            </div>
        </div>
    `}).join('');

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

/** מעשיר את רשימת המתכונים ב-likedByMe לפי המשתמש המחובר */
async function enrichRecipesWithLikes(recipes, user) {
    await Promise.all(recipes.map(async (r) => {
        r.likedByMe = false;
        if (!user) return;
        const snap = await getDoc(doc(db, 'recipes', r.id, 'likes', user.uid));
        r.likedByMe = snap.exists();
    }));
}

/** עדכון תצוגת Auth (כפתור + שם) */
function updateAuthUI(user) {
    const btn = document.getElementById('auth-btn');
    const nameEl = document.getElementById('user-name');
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
            await setDoc(likeRef, { createdAt: serverTimestamp() });
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

function setupSearch(applyFilters) {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    searchInput.addEventListener('input', () => { if (applyFilters) applyFilters(); });
}

/** הפתיעי אותי – הגרלת 3–5 מתכונים; אופציונלי: קטגוריה + רק מועדפים. "יש לי במטבח" – חיפוש לפי מצרכים. */
function setupSurpriseMe(allRecipes, tagGroupsData, applyFilters) {
    const surpriseBtn = document.getElementById('surpriseBtn');
    const surpriseCategory = document.getElementById('surprise-category');
    const surpriseFavoritesOnly = document.getElementById('surprise-favorites-only');
    const surpriseBar = document.getElementById('surprise-bar');
    const surpriseAgainBtn = document.getElementById('surpriseAgainBtn');
    const surpriseBackBtn = document.getElementById('surpriseBackBtn');
    const ingredientsSearch = document.getElementById('ingredients-search');
    const ingredientsSuggestBtn = document.getElementById('ingredientsSuggestBtn');
    if (!surpriseBtn || !surpriseBar) return;

    const tagGroups = tagGroupsData || TAG_GROUPS;
    const allTags = tagGroups.reduce((arr, g) => arr.concat(g.tags || []), []);
    const uniqueTags = [...new Set(allTags)];
    if (surpriseCategory) {
        surpriseCategory.innerHTML = '<option value="">כל הקטגוריות</option>' +
            uniqueTags.map(t => '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>').join('');
    }

    function getPool() {
        let pool = [...allRecipes];
        const tag = (surpriseCategory && surpriseCategory.value && surpriseCategory.value.trim()) || '';
        if (tag) pool = pool.filter(r => Array.isArray(r.tags) && r.tags.includes(tag));
        if (surpriseFavoritesOnly && surpriseFavoritesOnly.checked) pool = pool.filter(r => !!r.likedByMe);
        return pool;
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
        const pool = getPool();
        const count = Math.min(5, Math.max(3, pool.length));
        if (pool.length === 0) {
            displayRecipes([]);
            surpriseBar.style.display = 'none';
            return;
        }
        const picked = shuffle(pool).slice(0, count);
        displayRecipes(picked);
        surpriseBar.style.display = 'flex';
    }

    /** חיפוש לפי מצרכים/טקסט – מילים בשם או במרכיבים */
    function searchByIngredients(text) {
        const words = (text || '').trim().split(/[\s,]+/).filter(Boolean).map(w => w.toLowerCase());
        if (words.length === 0) return [];
        return allRecipes
            .map(r => {
                const name = (r.name || '').toLowerCase();
                const ingText = (Array.isArray(r.ingredients) ? r.ingredients.join(' ') : '').toLowerCase();
                const tagsText = (Array.isArray(r.tags) ? r.tags.join(' ') : '').toLowerCase();
                const combined = name + ' ' + ingText + ' ' + tagsText;
                let score = 0;
                words.forEach(w => {
                    if (combined.includes(w)) score++;
                });
                return { recipe: r, score };
            })
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 15)
            .map(x => x.recipe);
    }

    function showIngredientsSuggestions() {
        const text = ingredientsSearch ? ingredientsSearch.value.trim() : '';
        const list = searchByIngredients(text);
        displayRecipes(list);
        surpriseBar.style.display = 'flex';
    }

    surpriseBtn.addEventListener('click', drawSurprise);
    if (surpriseAgainBtn) surpriseAgainBtn.addEventListener('click', drawSurprise);
    if (surpriseBackBtn) {
        surpriseBackBtn.addEventListener('click', () => {
            surpriseBar.style.display = 'none';
            if (applyFilters) applyFilters();
        });
    }
    if (ingredientsSuggestBtn && ingredientsSearch) {
        ingredientsSuggestBtn.addEventListener('click', showIngredientsSuggestions);
        ingredientsSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') showIngredientsSuggestions(); });
    }

    if (surpriseFavoritesOnly) {
        onUserChange((user) => {
            surpriseFavoritesOnly.style.display = user ? '' : 'none';
            if (!user) surpriseFavoritesOnly.checked = false;
        });
        surpriseFavoritesOnly.style.display = auth.currentUser ? '' : 'none';
    }
}

function setupTagGroupDropdown(applyFilters, tagGroupsData) {
    const groups = tagGroupsData || TAG_GROUPS;
    const select = document.getElementById('tag-group-select');
    if (!select) return;
    select.innerHTML = '<option value="">הכל</option>' + groups.map(g =>
        '<optgroup label="' + escapeHtml(g.label) + '">' +
        (g.tags || []).map(t => '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>').join('') +
        '</optgroup>'
    ).join('');
    select.addEventListener('change', () => { if (applyFilters) applyFilters(); });
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

function getActiveFilters() {
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const groupSelect = document.getElementById('tag-group-select');
    const groupTag = (groupSelect && groupSelect.value && groupSelect.value.trim()) || '';
    const selectedTags = groupTag ? [groupTag] : [];
    const favoritesOnly = document.getElementById('favoritesFilterBtn')?.classList.contains('active') || false;
    return { searchTerm, selectedTags, favoritesOnly };
}

function filterRecipes(allRecipes) {
    const { searchTerm, selectedTags, favoritesOnly } = getActiveFilters();
    let list = allRecipes;
    if (favoritesOnly) list = list.filter(r => !!r.likedByMe);
    if (selectedTags.length > 0) list = list.filter(r => Array.isArray(r.tags) && selectedTags.some(t => r.tags.includes(t)));
    if (searchTerm) {
        list = list.filter(recipe => {
            const name = (recipe.name || '').toLowerCase();
            const source = getRecipeSourceLabel(recipe).toLowerCase();
            return name.includes(searchTerm) || source.includes(searchTerm);
        });
    }
    return list;
}

async function initApp() {
    const container = document.getElementById('recipes');
    if (container) {
        container.innerHTML = '<div class="recipes-loading" aria-live="polite">טוען מתכונים...</div>';
    }

    try {
        let tagGroupsData = TAG_GROUPS;
        try {
            const configSnap = await getDoc(doc(db, 'config', 'tags'));
            if (configSnap.exists() && Array.isArray(configSnap.data().tagGroups) && configSnap.data().tagGroups.length) {
                tagGroupsData = configSnap.data().tagGroups;
            }
        } catch (_) {}

        const snapshot = await getDocs(collection(db, 'recipes'));
        let recipes = [];
        
        if (snapshot.empty) {
            // אין מתכונים ב-Firebase - נעלה את ברירות המחדל
            for (const recipe of defaultRecipes) {
                await setDoc(doc(db, 'recipes', recipe.id), recipe);
            }
            recipes = defaultRecipes;
        } else {
            snapshot.forEach(d => recipes.push({ id: d.id, ...d.data() }));
        }

        console.log('🍽️ נטענו מ-Firebase:', recipes.length, 'מתכונים');

        window.__allRecipes = recipes;
        const applyFilters = () => {
            const filtered = filterRecipes(recipes);
            displayRecipes(filtered);
        };
        window.__applyFilters = applyFilters;

        setupTagGroupDropdown(applyFilters, tagGroupsData);
        setupSearch(applyFilters);
        setupSurpriseMe(recipes, tagGroupsData, applyFilters);

        const favoritesWrap = document.getElementById('favorites-filter-wrap');
        const favoritesBtn = document.getElementById('favoritesFilterBtn');
        if (favoritesBtn) {
            favoritesBtn.addEventListener('click', () => {
                favoritesBtn.classList.toggle('active');
                applyFilters();
            });
        }
        onUserChange(async (user) => {
            updateAuthUI(user);
            if (favoritesWrap) favoritesWrap.style.display = user ? 'block' : 'none';
            if (!user && favoritesBtn?.classList.contains('active')) favoritesBtn.classList.remove('active');
            const pendingBanner = document.getElementById('pending-approval-banner');
            const addBtn = document.getElementById('add-recipe-btn');
            if (user) {
                const approved = await getApprovedUids();
                const isApproved = approved.includes(user.uid);
                if (!isApproved) {
                    if (pendingBanner) pendingBanner.style.display = 'block';
                    if (addBtn) addBtn.style.display = 'none';
                    await addToPendingUsers(user);
                } else {
                    if (pendingBanner) pendingBanner.style.display = 'none';
                    if (addBtn) addBtn.style.display = '';
                }
            } else {
                if (pendingBanner) pendingBanner.style.display = 'none';
                if (addBtn) addBtn.style.display = '';
            }
            enrichRecipesWithLikes(recipes, user).then(applyFilters);
        });
        updateAuthUI(auth.currentUser);
        if (favoritesWrap) favoritesWrap.style.display = auth.currentUser ? 'block' : 'none';
        const pendingBanner = document.getElementById('pending-approval-banner');
        const addBtn = document.getElementById('add-recipe-btn');
        if (auth.currentUser) {
            const approved = await getApprovedUids();
            if (!approved.includes(auth.currentUser.uid)) {
                if (pendingBanner) pendingBanner.style.display = 'block';
                if (addBtn) addBtn.style.display = 'none';
                await addToPendingUsers(auth.currentUser);
            } else {
                if (pendingBanner) pendingBanner.style.display = 'none';
                if (addBtn) addBtn.style.display = '';
            }
        }

        // מציגים את הרשימה מיד; הלבבות מתעדכנים ברקע
        applyFilters();
        enrichRecipesWithLikes(recipes, auth.currentUser).then(applyFilters);

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