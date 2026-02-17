document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const importMode = document.getElementById('import-mode');
    const manualMode = document.getElementById('manual-mode');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.getAttribute('data-mode');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            importMode.classList.remove('active');
            manualMode.classList.remove('active');
            if (mode === 'import') {
                importMode.classList.add('active');
            } else {
                manualMode.classList.add('active');
            }
        });
    });

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
        setTimeout(() => {
            importStatus.className = 'import-status error';
            importStatus.textContent = '⚠️ הייבוא האוטומטי עדיין לא מוכן. בינתיים, אפשר להשתמש בהזנה ידנית ↖️';
        }, 1500);
    });

    const recipeForm = document.getElementById('recipeForm');
    if (recipeForm) {
        recipeForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('recipeName').value;
            const category = document.getElementById('recipeCategory').value;
            const source = document.getElementById('recipeSource').value || 'מתכון ביתי';
            const image = document.getElementById('recipeImage').value || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';

            const ingredientsText = document.getElementById('recipeIngredients').value;
            const ingredients = ingredientsText.split('\n')
                .filter(line => line.trim() !== '');

            const instructionsText = document.getElementById('recipeInstructions').value;
            const instructions = instructionsText.split('\n')
                .filter(line => line.trim() !== '');

            const savedRecipes = JSON.parse(localStorage.getItem('recipes') || '[]');
            const newId = savedRecipes.length > 0
                ? Math.max(...savedRecipes.map(r => r.id)) + 1
                : 1;

            const newRecipe = {
                id: newId,
                name,
                category,
                source,
                image,
                ingredients,
                instructions
            };

            savedRecipes.push(newRecipe);
            localStorage.setItem('recipes', JSON.stringify(savedRecipes));

            window.location.href = 'index.html';
        });
    }

    console.log('✅ add-recipe.js loaded');
});