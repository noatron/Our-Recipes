# כללי אבטחה (Firestore Rules)

## מקור אמת (חשוב לטווח ארוך)

| עקרון | מה לעשות |
|--------|-----------|
| **מקור אחד** | הכללים **תמיד** נערכים בקובץ `firestore.rules` בגיט — לא עורכים “רק בקונסול” בלי לעדכן את הריפו. |
| **פריסה** | אחרי כל שינוי: `firebase deploy --only firestore:rules` **או** העתקה מלאה מ־`firestore.rules` ל־Console → **Publish**. |
| **אין סטיות** | אם הכללים ב-Firebase שונים מהקובץ בריפו — תקבלי באגים (כמו `permission-denied` למרות שמחוברים). |

**האפליקציה בקוד מניחה** את המודל של `firestore.rules` (למשל `config/approvedUsers`, `addedByUid` במתכונים, לא `users/{uid}.role`).

### פריסה אוטומטית מ-GitHub (אופציונלי)

קובץ: `.github/workflows/deploy-firestore-rules.yml` — רץ על `push` ל־`main` כשיש שינוי ב־`firestore.rules`.

1. ליצור טוקן CI: `firebase login:ci` (מקומי, פעם אחת).
2. ב-GitHub: **Repository → Settings → Secrets and variables → Actions → New repository secret**
3. שם: `FIREBASE_TOKEN`, ערך: הטוקן שהופק.
4. מעכשיו כל שינוי ב־`firestore.rules` שמפוש ל־`main` יפרסם כללים (אם ה-workflow רץ בהצלחה).

אם אין `FIREBASE_TOKEN`, עדיין אפשר לפרוס ידנית (אפשרות 1–2 למטה).

---

הקובץ `firestore.rules` מגדיר מי יכול לקרוא ולכתוב ל-Firestore.

## מה מוגדר

| נתיב | קריאה | כתיבה |
|------|--------|--------|
| `recipes` | כולם | רק משתמשות מחוברות (יצירה, עריכה, מחיקה) |
| `recipes/{id}/likes/{userId}` | כולם | רק המשתמש יכול להוסיף/להסיר את הלב של עצמו |
| `recipes/{id}/comments` | כולם | יצירה – מחוברות; מחיקה – רק מחברת התגובה |
| `meals` | כולם | יצירה/עריכה/מחיקה רק למשתמש מאושר ושל הארוחה שלו (`createdBy.uid`) |

## איך להעלות את הכללים ל-Firebase

### אפשרות 1: Firebase Console (הכי פשוט)

1. נכנסים ל-[Firebase Console](https://console.firebase.google.com/) → בוחרים את הפרויקט.
2. **Firestore Database** → לשונית **Rules**.
3. מעתיקים את כל התוכן מקובץ `firestore.rules` ומדביקים במקום הקיים.
4. לוחצים **Publish**.

### אפשרות 2: Firebase CLI

אם מותקן אצלך Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

(דורש `firebase init` עם Firestore והעתקה של `firestore.rules` לתיקייה שהקלִי מצפה לה.)

## אינדקס ל־"לבבות" (collection group)

כדי שדף הבית יטען מהר (שאילתה אחת לכל הלבבות של המשתמש), צריך אינדקס על ה־collection group `likes` לפי השדה `userId`:

1. ב־Firebase Console → **Firestore** → **Indexes**.
2. לשונית **Single field** (לא Composite).
3. **Collection group ID:** `likes`.
4. **Field path:** `userId`, **Query scope:** Collection group.
5. ליצור את האינדקס.

אם האינדקס חסר, הקונסול בדפדפן יציג קישור ליצירת האינדקס; אפשר גם ללחוץ עליו.

## אינדקס ל־ארוחות (meals)

לשאילתה לפי `createdBy.uid`: אם Firebase מבקש אינדקס, יוצרים **Single field** על הקולקשן `meals` ושדה `createdBy.uid`.
