import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAZH8KZfhz6V1zPWEL3qIBgekIgUJvmMeY",
    authDomain: "our-recipes-1d97e.firebaseapp.com",
    projectId: "our-recipes-1d97e",
    storageBucket: "our-recipes-1d97e.firebasestorage.app",
    messagingSenderId: "34335322566",
    appId: "1:34335322566:web:290e1438e050a7353882c7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);