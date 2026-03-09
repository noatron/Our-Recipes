/**
 * ארוחות – אוסף מתכונים שמרכיבים ארוחה אחת.
 * Firestore: collection "meals" – id, name, recipeIds[], createdBy: { uid, name }, createdAt
 */
import { db } from './firebase.js';
import { collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

const MEALS_COLLECTION = 'meals';

/**
 * @param {{ name: string, recipeIds: string[], createdBy: { uid: string, name: string } }}
 * @returns {Promise<{ id: string, name: string, recipeIds: string[], createdBy: { uid: string, name: string }, createdAt: object }>}
 */
export async function createMeal({ name, recipeIds, createdBy }) {
    const ref = await addDoc(collection(db, MEALS_COLLECTION), {
        name: (name || '').trim() || 'ארוחה חדשה',
        recipeIds: Array.isArray(recipeIds) ? recipeIds : [],
        createdBy: createdBy || {},
        createdAt: serverTimestamp()
    });
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data(), createdAt: snap.data().createdAt } : null;
}

/**
 * @param {string} mealId
 * @param {{ name?: string, recipeIds?: string[] }}
 */
export async function updateMeal(mealId, { name, recipeIds }) {
    const ref = doc(db, MEALS_COLLECTION, mealId);
    const updates = {};
    if (name !== undefined) updates.name = String(name).trim() || 'ארוחה';
    if (recipeIds !== undefined) updates.recipeIds = Array.isArray(recipeIds) ? recipeIds : [];
    await updateDoc(ref, updates);
}

/**
 * מוסיף מתכון לארוחה קיימת (מונע כפילויות).
 * @param {string} mealId
 * @param {string} recipeId
 */
export async function addRecipeToMeal(mealId, recipeId) {
    const ref = doc(db, MEALS_COLLECTION, mealId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('הארוחה לא נמצאה');
    const data = snap.data();
    const ids = Array.isArray(data.recipeIds) ? [...data.recipeIds] : [];
    if (ids.includes(recipeId)) return;
    ids.push(recipeId);
    await updateDoc(ref, { recipeIds: ids });
}

/**
 * מסיר מתכון מארוחה.
 * @param {string} mealId
 * @param {string} recipeId
 */
export async function removeRecipeFromMeal(mealId, recipeId) {
    const ref = doc(db, MEALS_COLLECTION, mealId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('הארוחה לא נמצאה');
    const data = snap.data();
    const ids = Array.isArray(data.recipeIds) ? data.recipeIds.filter(id => id !== recipeId) : [];
    await updateDoc(ref, { recipeIds: ids });
}

/**
 * @param {string} mealId
 */
export async function deleteMeal(mealId) {
    await deleteDoc(doc(db, MEALS_COLLECTION, mealId));
}

/**
 * @param {string} uid
 * @returns {Promise<Array<{ id: string, name: string, recipeIds: string[], createdBy: { uid: string, name: string }, createdAt: object }>>}
 */
export async function getMealsByUser(uid) {
    if (!uid) return [];
    const q = query(collection(db, MEALS_COLLECTION), where('createdBy.uid', '==', uid));
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data(), createdAt: d.data().createdAt }));
    list.sort((a, b) => {
        const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
    });
    return list;
}

/**
 * @param {string} mealId
 * @returns {Promise<{ id: string, name: string, recipeIds: string[], createdBy: { uid: string, name: string }, createdAt: object } | null>}
 */
export async function getMealById(mealId) {
    if (!mealId) return null;
    const snap = await getDoc(doc(db, MEALS_COLLECTION, mealId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data(), createdAt: snap.data().createdAt };
}
