# איך למחוק את ה-API key מהקוד (שלב אחר שלב)

מטרה: ה-API key של Firebase **לא יופיע יותר בקוד** ב-GitHub, ויגיע רק מ-Netlify (או מ-.env מקומי).

---

## צעד 1: להוסיף משתנה אחד ב-Netlify

1. לפתוח **Netlify** → האתר שלך → **Site configuration** → **Environment variables**.
2. **Add a variable** / **New variable**.
3. **Key:** `FIREBASE_API_KEY`  
   **Value:** להדביק את המפתח (הערך שמופיע כרגע ב-firebase.js בשורת apiKey, בלי המרכאות).  
   לדוגמה: `AIzaSyAZH8KZfhz6V1zPWEL3qIBgekIgUJvmMeY`
4. **Create variable** / **Save**.

(מספיק משתנה **אחד** – רק ה-API key. שאר הערכים נשארים בסקריפט ולא סודיים.)

---

## צעד 2: להפסיק לעקוב אחרי firebase.js ב-Git

כך הקובץ firebase.js (שעדיין מכיל את המפתח) **יימחק מהמאגר** – הוא יישאר אצלך במחשב אבל לא יעלה יותר ל-GitHub.

1. לפתוח **טרמינל**.
2. להריץ:
   ```bash
   cd /Users/noat/Desktop/simple-recipe-app
   git rm --cached firebase.js
   ```
3. אם מופיעה הודעה ש-firebase.js לא ב-git – לא נורא (אולי כבר הוספת אותו ל-.gitignore). ממשיכים.

---

## צעד 3: לעשות commit ו-push

1. באותו טרמינל:
   ```bash
   git add .
   git status
   ```
2. ב-`git status` אמור להופיע ש-firebase.js נמחק (או "deleted") מה-tracking. אם יש שינויים נוספים (למשל הסקריפט) – גם הם יופיעו.
3. להריץ:
   ```bash
   git commit -m "Remove firebase.js from repo; API key only from Netlify env"
   git push
   ```

מעכשיו ב-GitHub **לא יהיה** קובץ firebase.js (או שהוא יהיה ב-.gitignore ולא יעלה). המפתח לא יופיע בקוד.

---

## צעד 4: לבדוק ב-Netlify

1. ב-Netlify → **Deploys**.
2. אמור להופיע deploy חדש אחרי ה-push.
3. אם ה-build **מצליח** – Netlify הריץ את הסקריפט ויצר firebase.js עם המפתח מהמשתנה. האתר יעבוד.
4. אם ה-build **נכשל** – לפתוח את הלוג; אם כתוב "Missing: FIREBASE_API_KEY" – לחזור ל-Environment variables ולוודא ש-`FIREBASE_API_KEY` קיים עם ערך ב-Production.

---

## צעד 5: פיתוח מקומי (אצלך במחשב)

כדי שהאפליקציה תעבוד אצלך (localhost), צריך ש-firebase.js יהיה קיים. יוצרים אותו פעם אחת מהמשתנה:

**אפשרות א – קובץ .env**

1. בתיקיית הפרויקט ליצור קובץ **.env** (נקודה בהתחלה).
2. לכתוב בו שורה אחת:
   ```
   FIREBASE_API_KEY=AIzaSyAZH8KZfhz6V1zPWEL3qIBgekIgUJvmMeY
   ```
   (או הערך האמיתי שלך.)
3. להריץ:
   ```bash
   node --env-file=.env scripts/generate-firebase-config.js
   ```
4. אמורה להופיע הודעה: Written .../firebase.js. מעכשיו האתר המקומי יעבוד.

**אפשרות ב – בלי .env**

בטרמינל (לפני ההרצה):

```bash
export FIREBASE_API_KEY=AIzaSyAZH8KZfhz6V1zPWEL3qIBgekIgUJvmMeY
node scripts/generate-firebase-config.js
```

(החליפי בערך האמיתי.)

---

## סיכום

| מה עשית | תוצאה |
|---------|--------|
| הוספת FIREBASE_API_KEY ב-Netlify | המפתח שמור רק שם (לא בקוד). |
| הרצת `git rm --cached firebase.js` + commit + push | firebase.js לא עולה יותר ל-GitHub. |
| Netlify build רץ | נוצר firebase.js עם המפתח מהמשתנה. |
| מקומית: .env + הרצת הסקריפט | נוצר firebase.js אצלך בלי להדביק מפתח בקוד. |

**הערה:** ב-Netlify משתמשים ב-**Environment variables** (לא ב-GitHub Secrets). GitHub Secrets רלוונטיים אם בונים/מעלים עם **GitHub Actions** – אז אפשר לשמור שם את אותו ערך ולהעביר ל-build. במצב הנוכחי (build ב-Netlify) מספיק להגדיר רק ב-Netlify.
