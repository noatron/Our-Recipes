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

    importBtn.addEventListener('click', async () => {
        const url = document.getElementById('recipeUrl').value.trim();
        if (!url) {
            importStatus.className = 'import-status error';
            importStatus.textContent = '⚠️ נא להזין קישור למתכון';
            return;
        }

        importStatus.className = 'import-status loading';
        importStatus.textContent = '⏳ מייבא מתכון...';

        try {
            const proxyUrl = `/.netlify/functions/fetch-recipe?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const name = doc.querySelector('h1')?.textContent?.trim() || 'מתכון חדש';
            const image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

            const savedRecipes = JSON.parse(localStorage.getItem('recipes') || '[]');
            const newId = savedRecipes.length > 0
                ? Math.max(...savedRecipes.map(r => r.id)) + 1
                : 1;

            const newRecipe = {
                id: newId,
                name: name,
                category: 'עיקריות',
                source: new URL(url).hostname,
                image: image,
                url: url,
                ingredients: [],
                instructions: []
            };

            savedRecipes.push(newRecipe);
            localStorage.setItem('recipes', JSON.stringify(savedRecipes));
            window.location.href = 'index.html';

        } catch (err) {
            importStatus.className = 'import-status error';
            importStatus.textContent = '⚠️ לא הצלחנו לייבא. נסי שוב או השתמשי בהזנה ידנית';
        }
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
            const ingredients = ingredientsText.split('\n').filter(line => line.trim() !== '');

            const instructionsText = document.getElementById('recipeInstructions').value;
            const instructions = instructionsText.split('\n').filter(line => line.trim() !== '');

            const savedRecipes = JSON.parse(localStorage.getItem('recipes') || '[]');
            const newId = savedRecipes.length > 0
                ? Math.max(...savedRecipes.map(r => r.id)) + 1
                : 1;

            const newRecipe = { id: newId, name, category, source, image, ingredients, instructions };

            savedRecipes.push(newRecipe);
            localStorage.setItem('recipes', JSON.stringify(savedRecipes));
            window.location.href = 'index.html';
        });
    }

    console.log('✅ add-recipe.js loaded');
});