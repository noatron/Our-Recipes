import { db, auth, onUserChange, signInWithGoogle, signOutUser } from './firebase.js';
import { collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const CATEGORIES = ['הכל', 'כללי', 'מרקים', 'בשרי', 'חלבי', 'פרווה', 'קינוחים', 'לחמים', 'סלטים', 'תוספות'];

/** רשימת התגיות (זהה ל-extract-image) – לסינון ולתצוגה */
const ALL_TAGS = ['מהיר', 'בינוני', 'ארוך', 'מנה עיקרית', 'תוספת', 'מרק', 'סלט', 'קינוח', 'לחם ומאפה', 'עוגות ועוגיות', 'רוטב וממרח', 'שתייה', 'בוקר', 'צהריים', 'ערב', 'חטיף', 'צמחוני', 'טבעוני', 'ללא גלוטן', 'ילדים', 'שבת וחגים', 'אירוח', 'כל השבוע'];

const defaultRecipes = [
    {
        id: "1",
        name: "שקשוקה",
        category: "כללי",
        source: "סבתא רחל",
        image: "https://images.unsplash.com/photo-1587217850473-0238d26d4785?w=400&h=300&fit=crop",
        ingredients: ["6 ביצים", "2 עגבניות", "1 בצל", "2 שיני שום", "פלפל אדום", "כמון", "מלח ופלפל"],
        instructions: ["חותכים את הבצל והעגבניות לקוביות", "מטגנים את הבצל עד שמזהיב", "מוסיפים את העגבניות והתבלינים", "מבשלים 10 דקות", "עושים גומות ושוברים ביצים", "מכסים ומבשלים עד שהביצים מתקשות"]
    },
    {
        id: "2",
        name: "פסטה בולונז",
        category: "בשרי",
        source: "אתר טעים",
        image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
        ingredients: ["500 גרם בשר טחון", "פסטה", "רסק עגבניות", "בצל", "שום", "בזיליקום"],
        instructions: ["מטגנים בצל ושום", "מוסיפים בשר ומשחימים", "מוסיפים רסק עגבניות", "מבשלים 30 דקות", "מבשלים פסטה", "מערבבים ביחד"]
    },
    {
        id: "3",
        name: "עוגת שוקולד",
        category: "קינוחים",
        source: "מגזין אוכל",
        image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop",
        ingredients: ["200 גרם שוקולד מריר", "4 ביצים", "כוס סוכר", "חצי כוס קמח", "חצי כוס חמאה"],
        instructions: ["מחממים תנור ל-180 מעלות", "ממיסים שוקולד וחמאה", "מקציפים ביצים וסוכר", "מערבבים הכל", "אופים 35 דקות"]
    },
    {
        id: "4",
        name: "סלט ירקות",
        category: "סלטים",
        source: "ספר בריאות",
        image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
        ingredients: ["חסה", "עגבנייה", "מלפפון", "בצל", "לימון", "שמן זית"],
        instructions: ["חותכים את כל הירקות", "מערבבים בקערה", "מוסיפים לימון ושמן", "מערבבים היטב"]
    },
    {
        id: "5",
        name: "מרק עוף",
        category: "מרקים",
        source: "אמא שלי",
        image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
        ingredients: ["עוף שלם", "גזר", "סלרי", "בצל", "שום", "מלח ופלפל"],
        instructions: ["שמים עוף בסיר", "מוסיפים ירקות ומים", "מבשלים 60 דקות", "מסננים", "מגישים חם"]
    },
    {
        id: "6",
        name: "פנקייקים",
        category: "כללי",
        source: "בלוג בישול",
        image: "https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=400&h=300&fit=crop",
        ingredients: ["2 כוסות קמח", "2 ביצים", "כוס חלב", "סוכר", "אבקת אפייה"],
        instructions: ["מערבבים מרכיבים יבשים", "מוסיפים ביצים וחלב", "מחממים מחבת", "שופכים בצק", "הופכים כשמופיעים בועות"]
    },
    {
        id: "7",
        name: "חומוס",
        category: "כללי",
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

/** מקור המתכון – דומיין או טקסט מקור */
function getRecipeSourceLabel(recipe) {
    if (recipe.url) {
        try { return new URL(recipe.url).hostname.replace(/^www\./, ''); } catch (e) {}
    }
    return recipe.source || '';
}

function displayRecipes(recipesToShow) {
    const recipesContainer = document.getElementById('recipes');
    if (!recipesContainer) return;

    if (recipesToShow.length === 0) {
        recipesContainer.innerHTML = '<div class="no-recipes">לא נמצאו מתכונים 😔</div>';
        return;
    }

    const likeCount = (r) => (r.likesCount != null ? r.likesCount : 0);
    recipesContainer.innerHTML = recipesToShow.map(recipe => {
        const sourceLabel = getRecipeSourceLabel(recipe);
        const tags = Array.isArray(recipe.tags) ? recipe.tags : [];
        const tagsHtml = tags.length
            ? `<div class="recipe-tags">${tags.map(t => `<span class="recipe-tag">${escapeHtml(t)}</span>`).join('')}</div>`
            : '';
        const liked = !!recipe.likedByMe;
        const count = likeCount(recipe);
        return `
        <div class="recipe-card" data-recipe-id="${recipe.id}" onclick="window.showRecipe('${recipe.id}')">
            <img src="${recipe.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=200&fit=crop'}" alt="" class="recipe-image" onerror="this.style.display='none'">
            <div class="recipe-content">
                <h2 class="recipe-name">${escapeHtml(getRecipeDisplayName(recipe))}</h2>
                ${sourceLabel ? `<p class="recipe-source">${escapeHtml(sourceLabel)}</p>` : ''}
                <div class="recipe-meta-row">
                    <span class="recipe-category">${escapeHtml(recipe.category || '')}</span>
                    <button type="button" class="recipe-like-btn ${liked ? 'liked' : ''}" data-recipe-id="${recipe.id}" aria-label="עשי לב">
                        <span class="like-icon">${liked ? '❤️' : '🤍'}</span>
                        <span class="like-count">${count}</span>
                    </button>
                </div>
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

function setupCategoryFilter(allRecipes, applyFilters) {
    const container = document.getElementById('category-filters');
    if (!container) return;
    
    container.innerHTML = CATEGORIES.map(cat => `
        <button class="category-chip ${cat === 'הכל' ? 'active' : ''}" data-category="${cat}">
            ${cat}
        </button>
    `).join('');
    
    container.addEventListener('click', (e) => {
        if (!e.target.classList.contains('category-chip')) return;
        container.querySelectorAll('.category-chip').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById('searchInput').value = '';
        if (applyFilters) applyFilters();
    });
}

function setupTagFilters(allRecipes, applyFilters) {
    const container = document.getElementById('tag-filters');
    if (!container) return;
    
    const tagsInUse = new Set();
    allRecipes.forEach(r => {
        if (Array.isArray(r.tags)) r.tags.forEach(t => tagsInUse.add(t));
    });
    const tagsToShow = ALL_TAGS.filter(t => tagsInUse.has(t));
    if (tagsToShow.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = '<span class="tag-filters-label">תגיות:</span>' + tagsToShow.map(tag => `
        <button type="button" class="tag-chip" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
    `).join('');
    
    container.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tag-chip')) return;
        e.target.classList.toggle('active');
        if (applyFilters) applyFilters();
    });
}

function getActiveFilters() {
    const activeCategory = document.querySelector('#category-filters .category-chip.active')?.dataset.category || 'הכל';
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const selectedTags = [...(document.querySelectorAll('#tag-filters .tag-chip.active') || [])].map(b => b.dataset.tag);
    const favoritesOnly = document.getElementById('favoritesFilterBtn')?.classList.contains('active') || false;
    return { activeCategory, searchTerm, selectedTags, favoritesOnly };
}

function filterRecipes(allRecipes) {
    const { activeCategory, searchTerm, selectedTags, favoritesOnly } = getActiveFilters();
    let list = allRecipes;
    if (favoritesOnly) list = list.filter(r => !!r.likedByMe);
    if (activeCategory !== 'הכל') list = list.filter(r => r.category === activeCategory);
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
    try {
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

        setupCategoryFilter(recipes, applyFilters);
        setupTagFilters(recipes, applyFilters);
        setupSearch(applyFilters);

        const favoritesWrap = document.getElementById('favorites-filter-wrap');
        const favoritesBtn = document.getElementById('favoritesFilterBtn');
        if (favoritesBtn) {
            favoritesBtn.addEventListener('click', () => {
                favoritesBtn.classList.toggle('active');
                applyFilters();
            });
        }
        onUserChange((user) => {
            updateAuthUI(user);
            if (favoritesWrap) favoritesWrap.style.display = user ? 'block' : 'none';
            if (!user && favoritesBtn?.classList.contains('active')) favoritesBtn.classList.remove('active');
            enrichRecipesWithLikes(recipes, user).then(applyFilters);
        });
        updateAuthUI(auth.currentUser);
        if (favoritesWrap) favoritesWrap.style.display = auth.currentUser ? 'block' : 'none';
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