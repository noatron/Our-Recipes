#!/usr/bin/env node
/**
 * יוצר את firebase.js – רק ה-API key מגיע ממשתנה סביבה (סודי).
 * הרצה: node scripts/generate-firebase-config.js
 * דרוש: FIREBASE_API_KEY (ב-Netlify או ב-.env מקומי)
 */

const fs = require('fs');
const path = require('path');

const apiKey = process.env.FIREBASE_API_KEY && process.env.FIREBASE_API_KEY.trim();
if (!apiKey) {
  console.error('Missing: FIREBASE_API_KEY');
  console.error('Set it in Netlify (Site configuration → Environment variables) or in .env for local.');
  process.exit(1);
}

// שאר הערכים לא סודיים – נשארים קבועים
const content = `import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "${apiKey}",
    authDomain: "our-recipes-1d97e.firebaseapp.com",
    projectId: "our-recipes-1d97e",
    storageBucket: "our-recipes-1d97e.firebasestorage.app",
    messagingSenderId: "34335322566",
    appId: "1:34335322566:web:290e1438e050a7353882c7"
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
`;

const outPath = path.join(__dirname, '..', 'firebase.js');
fs.writeFileSync(outPath, content, 'utf8');
console.log('Written', outPath);
