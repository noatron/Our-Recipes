# הסתרת מפתחות (API Keys & Secrets)

המפתחות **לא** נשמרים בקוד אלא במשתני סביבה.

---

## 1. Netlify (לאתר החי)

1. נכנסים ל־[Netlify](https://app.netlify.com) → האתר → **Site configuration** → **Environment variables**.
2. לוחצים **Add a variable** / **Add environment variables**.
3. מוסיפים:

| משתנה | תיאור | חובה |
|--------|--------|------|
| `FIREBASE_API_KEY` | מפתח Firebase (מ־Firebase Console → Project settings) | ✓ |
| `FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` | ✓ |
| `FIREBASE_PROJECT_ID` | מזהה הפרויקט ב־Firebase | ✓ |
| `FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` | ✓ |
| `FIREBASE_MESSAGING_SENDER_ID` | מספר (מ־Firebase Console) | ✓ |
| `FIREBASE_APP_ID` | `1:xxxx:web:xxxx` | ✓ |
| `ANTHROPIC_API_KEY` | מפתח ל־Anthropic (לפונקציית extract-image) | אם משתמשים בחילוץ מתמונה |

4. שומרים. ב־**Deploy** הבא Netlify יריץ את `node scripts/generate-firebase-config.js` וייצור את `firebase.js` עם הערכים האלה.

---

## 2. GitHub Secrets (אופציונלי)

**GitHub Secrets** זמינים רק ב־**GitHub Actions** (workflow ב־`.github/workflows/`).  
Netlify **לא** קורא אוטומטית ל־GitHub Secrets – הוא משתמש במשתנים שמוגדרים אצלו ב־Environment variables.

אם את בונה/מעלה עם **GitHub Actions** (ולא רק "Connect to Git" ב־Netlify):

1. ב־GitHub: **Repository → Settings → Secrets and variables → Actions**.
2. **New repository secret** – יוצרים secret לכל ערך (למשל `FIREBASE_API_KEY`, `ANTHROPIC_API_KEY`).
3. ב־workflow אפשר להעביר אותם ל־Netlify או לכתוב ל־`.env` לפני build.

בפרויקט הנוכחי ה־build רץ **בתוך Netlify** (לא ב־Actions), ולכן מספיק להגדיר את כל המשתנים ב־**Netlify Environment variables** כמו בסעיף 1.

---

## 3. פיתוח מקומי

כדי שה־build המקומי יעבוד בלי להדביק מפתחות בקוד:

**אפשרות א – קובץ `.env` (לא עולה ל־Git):**

1. יוצרים בקובץ `.env` בשורש הפרויקט (הקובץ כבר ב־`.gitignore`):

```env
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=our-recipes-1d97e.firebaseapp.com
FIREBASE_PROJECT_ID=our-recipes-1d97e
FIREBASE_STORAGE_BUCKET=our-recipes-1d97e.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=34335322566
FIREBASE_APP_ID=1:34335322566:web:290e1438e050a7353882c7
```

2. מריצים את סקריפט ה־build עם טעינת `.env` (בלי להתקין חבילות, עם Node 20+):

```bash
node --env-file=.env scripts/generate-firebase-config.js
```

(אם Node ישן יותר, מתקינים `dotenv`:  
`npm init -y && npm i dotenv`  
ואז:  
`node -r dotenv/config scripts/generate-firebase-config.js`.)

**אפשרות ב – export בטרמינל:**

```bash
export FIREBASE_API_KEY=AIzaSy...
export FIREBASE_AUTH_DOMAIN=our-recipes-1d97e.firebaseapp.com
# ... ושאר המשתנים
node scripts/generate-firebase-config.js
```

אחרי ש־`firebase.js` נוצר, מריצים שרת מקומי (למשל `npx serve .` או `python3 -m http.server 5500`) ופותחים את האתר.

---

## 4. אחרי השינוי – פעם ראשונה

1. **מוסיפים את כל משתני Firebase ב־Netlify** (כמו בטבלה בסעיף 1).
2. **מוציאים את `firebase.js` מה־Git** (כי מעכשיו הוא נוצר ב־build):

   ```bash
   git rm --cached firebase.js
   git commit -m "Stop tracking firebase.js; generated from env"
   ```

3. עושים **push**. Netlify יריץ build שיוצר `firebase.js` מהמשתנים – והאתר יעבוד בלי מפתחות בקוד.

4. **מקומית:** יוצרים `.env` (או עושים export) ומריצים פעם אחת:

   ```bash
   node --env-file=.env scripts/generate-firebase-config.js
   ```

   (או עם `dotenv` כמו למעלה.)

מעכשיו המפתחות מוסתרים: לא ב־Git, רק ב־Netlify (ובמקומי ב־`.env` שלא עולה ל־Git).
