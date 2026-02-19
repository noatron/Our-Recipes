import { db } from './firebase.js';
import { collection, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const CATEGORIES = ['הכל', 'כללי', 'מרקים', 'בשרי', 'חלבי', 'פרווה', 'קינוחים', 'לחמים', 'סלטים', 'תוספות'];

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
    
    if (recipesToShow.length === 0) {
        recipesContainer.innerHTML = '<div class="no-recipes">לא נמצאו מתכונים 😔</div>';
        return;
    }
    
    recipesContainer.innerHTML = recipesToShow.map(recipe => {
        const sourceLabel = getRecipeSourceLabel(recipe);
        return `
        <div class="recipe-card" onclick="showRecipe('${recipe.id}')">
            <img src="${recipe.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=200&fit=crop'}" alt="" class="recipe-image" onerror="this.style.display='none'">
            <div class="recipe-content">
                <h2 class="recipe-name">${escapeHtml(getRecipeDisplayName(recipe))}</h2>
                ${sourceLabel ? `<p class="recipe-source">${escapeHtml(sourceLabel)}</p>` : ''}
                <div>
                    <span class="recipe-category">${escapeHtml(recipe.category || '')}</span>
                </div>
            </div>
        </div>
    `}).join('');
}

window.showRecipe = function(id) {
    localStorage.setItem('selectedRecipeId', id);
    window.location.href = 'recipe-detail.html';
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
    
    let activeCategory = 'הכל';
    
    container.innerHTML = CATEGORIES.map(cat => `
        <button class="category-chip ${cat === 'הכל' ? 'active' : ''}" data-category="${cat}">
            ${cat}
        </button>
    `).join('');
    
    container.addEventListener('click', (e) => {
        if (!e.target.classList.contains('category-chip')) return;
        
        activeCategory = e.target.dataset.category;
        container.querySelectorAll('.category-chip').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById('searchInput').value = '';
        
        const filtered = activeCategory === 'הכל' 
            ? allRecipes 
            : allRecipes.filter(r => r.category === activeCategory);
        displayRecipes(filtered);
    });
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
        
        displayRecipes(recipes);
        setupSearch(recipes);
        setupCategoryFilter(recipes);
        // כפתור רענון זמני
const refreshAllBtn = document.createElement('button');
refreshAllBtn.textContent = '🔄 רענן שמות ותמונות';
refreshAllBtn.style.cssText = 'position:fixed; bottom:90px; right:24px; z-index:1000; background:#d32f2f; color:white; border:none; border-radius:20px; padding:10px 16px; font-family:Varela Round,sans-serif; cursor:pointer;';
document.body.appendChild(refreshAllBtn);

refreshAllBtn.addEventListener('click', async () => {
    const toRefresh = recipes.filter(r => r.url && (!r.name || r.name === 'מתכון' || r.name === 'Error response' || r.name === 'מתכון חדש'));
    if (toRefresh.length === 0) { alert('אין מתכונים לרענון!'); return; }
    
    if (!confirm(`נרענן ${toRefresh.length} מתכונים. זה ייקח כמה דקות. להמשיך?`)) return;
    
    refreshAllBtn.disabled = true;
    let done = 0;
    
    for (const recipe of toRefresh) {
        try {
            const proxyUrl = `/.netlify/functions/fetch-recipe?url=${encodeURIComponent(recipe.url)}`;
            const response = await fetch(proxyUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const parsed = parser.parseFromString(html, 'text/html');
            
            const ogTitle = parsed.querySelector('meta[property="og:title"]');
            const title = parsed.querySelector('title');
            const ogImage = parsed.querySelector('meta[property="og:image"]');
            
            const name = ogTitle?.content || title?.textContent?.split('|')[0]?.split('-')[0]?.trim() || 'מתכון';
            const image = ogImage?.content || recipe.image;
            
            await setDoc(doc(db, 'recipes', recipe.id), { ...recipe, name, image });
            done++;
            refreshAllBtn.textContent = `🔄 ${done}/${toRefresh.length}...`;
        } catch (e) {
            console.warn('נכשל:', recipe.url);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    
    alert(`✅ סיום! ${done} מתכונים עודכנו.`);
    location.reload();
});
        
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