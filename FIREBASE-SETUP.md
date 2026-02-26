# הגדרה ראשונית ב-Firebase (פעם אחת)

כדי שמערכת האישור תעבוד, צריך ליצור ב-**Firebase Console** → Firestore Database שני מסמכים:

## 1. `config/admins`
מסמך עם שדה `uids` (מערך) שמכיל את ה-UID של האדמין (למשל נועה).

- **נתיב:** `config` → מסמך עם ID: `admins`
- **שדות:**  
  `uids` (מערך/array): `["ה-UID-שלך-מגוגל"]`

איך למצוא את ה-UID: התחברי לאפליקציה עם גוגל, ב-Firebase Console → Authentication → Users – שם מופיע ה-UID של כל משתמש.

## 2. `config/approvedUsers`
מסמך עם שדה `uids` (מערך) של משתמשות שמורשות להוסיף מתכונים. בהתחלה רק האדמין.

- **נתיב:** `config` → מסמך עם ID: `approvedUsers`
- **שדות:**  
  `uids` (מערך/array): `["אותו-UID-של-נועה"]`

אחרי שאושרת משתמשת חדשה מדף "ניהול משתמשות", ה-UID שלה יתווסף אוטומטית ל-`approvedUsers`.
