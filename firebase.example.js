// העתקה: לא להעלות את firebase.js ל-Git (הוא נוצר מ-env).
// להריץ: node scripts/generate-firebase-config.js
// אחרי הגדרת משתני הסביבה (ראו SECRETS.md).

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:xxxxx"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (err) {
        console.error('שגיאה בהתחברות:', err);
        return null;
    }
}

export async function signOutUser() {
    await signOut(auth);
}

export function onUserChange(callback) {
    return onAuthStateChanged(auth, callback);
}
