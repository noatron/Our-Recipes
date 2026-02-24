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
