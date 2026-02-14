# Our-Recipes 🍳
### מתכונים שווים

A Hebrew recipe management PWA for two users to collect, organize, and cook from their favorite recipes.

[![Live Demo](https://img.shields.io/badge/demo-live-green)](https://noatron.github.io/Our-Recipes)
[![GitHub Pages](https://img.shields.io/badge/deployed-GitHub%20Pages-blue)](https://noatron.github.io/Our-Recipes)

---

## 📱 Features

### Current (v1.0)
- ✅ 7 active recipes with full details
- ✅ Search functionality
- ✅ Notebook-style design (ruled lines, handwritten aesthetic)
- ✅ Recipe detail pages with ingredients & instructions
- ✅ Checkbox tracking for ingredients and steps
- ✅ Mobile-responsive design
- ✅ Hebrew typography (Varela Round font)

### Planned
- ➕ Add/Edit/Delete recipes
- 📁 Recipe categories
- 🛒 Smart shopping list with quantity merging
- 📅 Weekly meal planning
- ⏱️ Built-in timers
- 👥 Serving size adjustment
- 📤 Recipe sharing
- 🎲 "Surprise me" random recipe

📖 **Full roadmap:** [docs/product-roadmap.md](docs/product-roadmap.md) (Hebrew)

---

## 🎨 Design

**Color Palette:**
- Primary: `#407076` (teal-blue)
- Secondary: `#698996` (gray-blue)
- Background: `#F8F7FF` (light lavender)
- Accent: `#FFD8BE` (peach)

**Typography:**
- Font: Varela Round (Hebrew support)
- Style: Notebook/handwritten aesthetic

**Design Philosophy:**
Reminiscent of grandmother's recipe notebooks - warm, familiar, and practical.

---

## 🚀 Getting Started

### Prerequisites
- Modern web browser
- No installation required (PWA)

### Running Locally

1. Clone the repository:
```bash
git clone https://github.com/noatron/Our-Recipes.git
cd Our-Recipes
```

2. Open `index.html` in your browser:
```bash
open index.html  # macOS
# or simply double-click index.html
```

### Deployment
The app is automatically deployed to GitHub Pages:
- **Live URL:** https://noatron.github.io/Our-Recipes
- Updates push automatically on commit to `main` branch

---

## 📂 Project Structure

```
Our-Recipes/
├── index.html           # Main page with recipe grid
├── recipe-detail.html   # Individual recipe view
├── styles.css           # Global styles and design system
├── script.js            # Search and navigation logic
├── recipe-detail.js     # Recipe display and checkbox tracking
├── recipes.json         # Recipe data store
├── images/              # Recipe images and assets
│   └── logo.png
└── docs/                # Documentation
    └── product-roadmap.md  # Full product specification (Hebrew)
```

---

## 🔧 Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Hosting:** GitHub Pages
- **Icons:** Lucide (SVG icons)
- **Fonts:** Varela Round (Google Fonts)

**Why vanilla JS?**
Simple, fast, no build process needed. Perfect for learning and quick iterations.

---

## 🗺️ Roadmap

### Phase 1: Core Features (Current)
- [x] Recipe display and search
- [ ] Add/Edit/Delete recipes
- [ ] Recipe categories

### Phase 2: Practical Features
- [ ] Personal notes per recipe
- [ ] Built-in timer
- [ ] Serving size adjustment
- [ ] Share recipe via WhatsApp

### Phase 3: Smart Shopping List
- [ ] Mark ingredients → shopping list
- [ ] Auto-merge quantities from multiple recipes
- [ ] Copy to WhatsApp format

### Phase 4: Advanced Features
- [ ] Weekly meal planner
- [ ] "Surprise me" random recipe
- [ ] Favorites/starred recipes
- [ ] Recipe recommendations

**Full details:** [docs/product-roadmap.md](docs/product-roadmap.md)

---

## 📥 Recipe Import (Planned)

Goal: Import ~300 recipes from cooking websites

**Strategy:**
- Hybrid approach: Auto-import with manual fallback
- Import in small batches (10-20 recipes)
- Validation and cleanup after each batch
- Manual editing for edge cases

---

## 🤝 Contributing

This is a personal project for two users. However, feedback and suggestions are welcome!

---

## 📝 License

This is a private project. All rights reserved.

---

## 👩‍💻 Developer

Built by **Noa** as a learning project in web development.

**Learning goals:**
- Hands-on web development (HTML, CSS, JavaScript)
- Git and GitHub workflow
- UX/UI design principles
- Progressive Web App (PWA) concepts

---

## 🔗 Links

- **Live App:** https://noatron.github.io/Our-Recipes
- **Repository:** https://github.com/noatron/Our-Recipes
- **Documentation:** [docs/product-roadmap.md](docs/product-roadmap.md)

---

**Last updated:** February 14, 2026  
**Version:** 1.0
