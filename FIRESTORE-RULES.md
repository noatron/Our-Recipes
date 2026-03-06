# כללי אבטחה (Firestore Rules)

הקובץ `firestore.rules` מגדיר מי יכול לקרוא ולכתוב ל-Firestore.

## מה מוגדר

| נתיב | קריאה | כתיבה |
|------|--------|--------|
| `recipes` | כולם | רק משתמשות מחוברות (יצירה, עריכה, מחיקה) |
| `recipes/{id}/likes/{userId}` | כולם | רק המשתמש יכול להוסיף/להסיר את הלב של עצמו |
| `recipes/{id}/comments` | כולם | יצירה – מחוברות; מחיקה – רק מחברת התגובה |

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
