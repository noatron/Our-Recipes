const CATEGORIES = ['הכל', 'כללי', 'מרקים', 'בשרי', 'חלבי', 'פרווה', 'קינוחים', 'לחמים', 'סלטים', 'תוספות'];

// מתכונים לדוגמה
const recipes = [
    {
        id: 1,
        name: "שקשוקה",
        category: "כללי",
        source: "סבתא רחל",
        image: "https://images.unsplash.com/photo-1587217850473-0238d26d4785?w=400&h=300&fit=crop",
        ingredients: ["6 ביצים", "2 עגבניות", "1 בצל", "2 שיני שום", "פלפל אדום", "כמון", "מלח ופלפל"],
        instructions: ["חותכים את הבצל והעגבניות לקוביות", "מטגנים את הבצל עד שמזהיב", "מוסיפים את העגבניות והתבלינים", "מבשלים 10 דקות", "עושים גומות ושוברים ביצים", "מכסים ומבשלים עד שהביצים מתקשות"]
    },
    {
        id: 2,
        name: "פסטה בולונז",
        category: "בשרי",
        source: "אתר טעים",
        image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
        ingredients: ["500 גרם בשר טחון", "פסטה", "רסק עגבניות", "בצל", "שום", "בזיליקום"],
        instructions: ["מטגנים בצל ושום", "מוסיפים בשר ומשחימים", "מוסיפים רסק עגבניות", "מבשלים 30 דקות", "מבשלים פסטה", "מערבבים ביחד"]
    },
    {
        id: 3,
        name: "עוגת שוקולד",
        category: "קינוחים",
        source: "מגזין אוכל",
        image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop",
        ingredients: ["200 גרם שוקולד מריר", "4 ביצים", "כוס סוכר", "חצי כוס קמח", "חצי כוס חמאה"],
        instructions: ["מחממים תנור ל-180 מעלות", "ממיסים שוקולד וחמאה", "מקציפים ביצים וסוכר", "מערבבים הכל", "אופים 35 דקות"]
    },
    {
        id: 4,
        name: "סלט ירקות",
        category: "סלטים",
        source: "ספר בריאות",
        image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
        ingredients: ["חסה", "עגבנייה", "מלפפון", "בצל", "לימון", "שמן זית"],
        instructions: ["חותכים את כל הירקות", "מערבבים בקערה", "מוסיפים לימון ושמן", "מערבבים היטב"]
    },
    {
        id: 5,
        name: "מרק עוף",
        category: "מרקים",
        source: "אמא שלי",
        image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
        ingredients: ["עוף שלם", "גזר", "סלרי", "בצל", "שום", "מלח ופלפל"],
        instructions: ["שמים עוף בסיר", "מוסיפים ירקות ומים", "מבשלים 60 דקות", "מסננים", "מגישים חם"]
    },
    {
        id: 6,
        name: "פנקייקים",
        category: "כללי",
        source: "בלוג בישול",
        image: "https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=400&h=300&fit=crop",
        ingredients: ["2 כוסות קמח", "2 ביצים", "כוס חלב", "סוכר", "אבקת אפייה"],
        instructions: ["מערבבים מרכיבים יבשים", "מוסיפים ביצים וחלב", "מחממים מחבת", "שופכים בצק", "הופכים כשמופיעים בועות"]
    },
    {
        id: 7,
        name: "חומוס",
        category: "כללי",
        source: "דודה מזל",
        image: "https://images.unsplash.com/photo-1571368295935-d9551b53f6f3?w=400&h=300&fit=crop",
        ingredients: ["פחית חומוס מבושל", "טחינה גולמית", "לימון", "שום", "כמון", "מלח"],
        instructions: ["שמים הכל בבלנדר", "טוחנים עד לקבלת מרקם חלק", "טועמים ומתקנים תיבול", "מעבירים לצלחת", "מוסיפים שמן זית מעל"]
    }
];

// פונקציה להצגת המתכונים
function displayRecipes(recipesToShow) {
    const recipesContainer = document.getElementById('recipes');
    
    if (recipesToShow.length === 0) {
        recipesContainer.innerHTML = '<div class="no-recipes">לא נמצאו מתכונים 😔</div>';
        return;
    }
    
    recipesContainer.innerHTML = recipesToShow.map(recipe => `
        <div class="recipe-card" onclick="showRecipe(${recipe.id})">
            <img src="${recipe.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=200&fit=crop'}" alt="" class="recipe-image" onerror="this.style.display='none'">
            <div class="recipe-content">
                <h2 class="recipe-name">${recipe.name}</h2>
                <div class="recipe-meta"></div>
                <div>
                    <span class="recipe-category">${recipe.category}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// פונקציה להצגת מתכון ספציפי
function showRecipe(id) {
    localStorage.setItem('selectedRecipeId', id);
    window.location.href = 'recipe-detail.html';
}

// פונקציה לחיפוש מתכונים
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const savedRecipes = JSON.parse(localStorage.getItem('recipes') || '[]');
        const filtered = savedRecipes.filter(recipe =>
            recipe.name.toLowerCase().includes(searchTerm) ||
            recipe.category.toLowerCase().includes(searchTerm)
        );
        displayRecipes(filtered);
    });
}

// פונקציה לפילטור לפי קטגוריה
function setupCategoryFilter() {
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
        
        // עדכון ה-chip הפעיל
        container.querySelectorAll('.category-chip').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        // ניקוי החיפוש
        document.getElementById('searchInput').value = '';
        
        // פילטור
        const savedRecipes = JSON.parse(localStorage.getItem('recipes') || '[]');
        const filtered = activeCategory === 'הכל' 
            ? savedRecipes 
            : savedRecipes.filter(r => r.category === activeCategory);
        displayRecipes(filtered);
    });
}

// אתחול האפליקציה
document.addEventListener('DOMContentLoaded', () => {
    const savedRecipes = localStorage.getItem('recipes');
    
    if (savedRecipes) {
        const recipesFromStorage = JSON.parse(savedRecipes);
        displayRecipes(recipesFromStorage);
    } else {
        localStorage.setItem('recipes', JSON.stringify(recipes));
        displayRecipes(recipes);
    }
    
    setupSearch();
    setupCategoryFilter();
    console.log('🍽️ האפליקציה טעונה בהצלחה!');
    
    const addBtn = document.getElementById('add-recipe-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            window.location.href = 'add-recipe.html';
        });
    }
});