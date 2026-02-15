
// Toggle between import and manual modes
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const importMode = document.getElementById('import-mode');
    const manualMode = document.getElementById('manual-mode');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.getAttribute('data-mode');

            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');

            // Hide all modes
            importMode.classList.remove('active');
            manualMode.classList.remove('active');

            // Show selected mode
            if (mode === 'import') {
                importMode.classList.add('active');
            } else {
                manualMode.classList.add('active');
            }
        });
    });

    // Import button functionality (placeholder for now)
    const importBtn = document.getElementById('importBtn');
    const importStatus = document.getElementById('import-status');

    importBtn.addEventListener('click', () => {
        const url = document.getElementById('recipeUrl').value;
        
        if (!url) {
            importStatus.className = 'import-status error';
            importStatus.textContent = '⚠️ נא להזין קישור למתכון';
            return;
        }

        importStatus.className = 'import-status loading';
        importStatus.textContent = '⏳ מייבא מתכון...';

        // TODO: This is where we'll add the actual import logic
        setTimeout(() => {
            importStatus.className = 'import-status error';
            importStatus.textContent = '⚠️ הייבוא האוטומטי עדיין לא מוכן. בינתיים, אפשר להשתמש בהזנה ידנית ↖️';
        }, 1500);
    });
// Manual form submission
const recipeForm = document.getElementById('recipeForm');
if (recipeForm) {
    recipeForm.addEventListener('submit', (e) => {
        e.preventDefault(); // מונע רענון דף
        
        // אוסף את הנתונים מהטופס
        const name = document.getElementById('recipeName').value;
        const category = document.getElementById('recipeCategory').value;
        const source = document.getElementById('recipeSource').value || 'מתכון ביתי';
        const image = document.getElementById('recipeImage').value || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
        
        // מרכיבים - מפצל לפי שורות והופך לאובייקטים
        const ingredientsText = document.getElementById('recipeIngredients').value;
        const ingredients = ingredientsText.split('\n')
            .filter(line => line.trim() !== '')
            .map(text => ({ text: text.trim(), completed: false }));
        
        // הוראות - מפצל לפי שורות והופך לאובייקטים
        const instructionsText = document.getElementById('recipeInstructions').value;
        const instructions = instructionsText.split('\n')
            .filter(line => line.trim() !== '')
            .map(text => ({ text: text.trim(), completed: false }));
        
        // טוען את המתכונים הקיימים
        const savedRecipes = JSON.parse(localStorage.getItem('recipes') || '[]');
        
        // יוצר ID חדש (הגבוה ביותר + 1)
        const newId = savedRecipes.length > 0 
            ? Math.max(...savedRecipes.map(r => r.id)) + 1 
            : 1;
        
        // יוצר את המתכון החדש
        const newRecipe = {
            id: newId,
            name,
            category,
            source,
            image,
            ingredients,
            instructions
        };
        
        // מוסיף למערך ושומר
        savedRecipes.push(newRecipe);
        localStorage.setItem('recipes', JSON.stringify(savedRecipes));
        
        // חוזר לעמוד הבית
        window.location.href = 'index.html';
    });
}
    console.log('✅ add-recipe.js loaded');
});