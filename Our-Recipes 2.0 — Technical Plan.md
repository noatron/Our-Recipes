# Our-Recipes 2.0 — Technical Plan
*February 2026*

---

## Current Stack
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication (Google) ✅
- **Serverless:** Netlify Functions (handles CORS for recipe import) ✅
- **Hosting:** GitHub Pages
- **Dev tools:** Cursor, Live Server, Git

---

## What's Being Added
- **Firebase Storage** — for image uploads (recipe photos/screenshots)
- **Anthropic Claude API** — for auto-tagging, natural language search, image extraction
- Called via a new Netlify Function (keeps API key secure, same pattern as existing import function)

---

## Data Model Changes

### Current recipe document (Firestore):
```js
{
  id: "abc123",
  title: "פסטה ברוטב עגבניות",
  url: "https://...",
  category: "פרווה",
  createdAt: timestamp
}
```

### New recipe document:
```js
{
  id: "abc123",
  title: "פסטה ברוטב עגבניות",
  url: "https://...",           // for link-based recipes
  category: "פרווה",            // existing field, unchanged
  tags: ["מנה עיקרית", "ערב", "צמחוני", "מהיר"],  // NEW
  addedBy: {                    // NEW
    uid: "google-uid",
    name: "נועה"
  },
  sourceType: "link" | "image" | "manual",  // NEW
  // For image/manual recipes only:
  ingredients: "...",           // NEW (optional)
  instructions: "...",          // NEW (optional)
  imageUrl: "https://...",      // NEW (optional, Firebase Storage)
  favoritesCount: 3,            // NEW
  createdAt: timestamp
}
```

### New: users collection
```js
{
  uid: "google-uid",
  name: "נועה",
  email: "noa@gmail.com",
  role: "admin" | "approved" | "pending",
  createdAt: timestamp
}
```

### New: favorites collection
```js
{
  userId: "google-uid",
  recipeId: "abc123",
  createdAt: timestamp
}
```

---

## New Netlify Functions

### 1. `/api/ai-tag` — Auto-tag a recipe
**Input:** recipe title
**Output:** suggested tags array

### 2. `/api/ai-search` — Natural language search
**Input:** user query + all recipe titles+tags
**Output:** ranked recipe IDs

### 3. `/api/extract-image` — Extract recipe from image
**Input:** base64 image
**Output:** `{ title, ingredients, instructions, suggestedTags }`

---

## Security & Privacy

### Firestore Security Rules
The most important security layer. Without these, anyone with the URL could delete all recipes.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    function isApproved() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['approved', 'admin'];
    }

    // Recipes: anyone can read, only approved users can write
    match /recipes/{recipeId} {
      allow read: if true;
      allow create: if isApproved();
      allow update, delete: if isApproved() &&
        (resource.data.addedBy.uid == request.auth.uid || isAdmin());
    }

    // Users: each user reads/writes only their own doc
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if isAdmin();
    }

    // Favorites: users manage only their own
    match /favorites/{favoriteId} {
      allow read: if true;
      allow write: if request.auth != null &&
        request.auth.uid == resource.data.userId;
    }
  }
}
```

### Firebase Storage Rules
```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /recipes/{imageId} {
      allow read: if true;
      allow write: if request.auth != null
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### API Key Security
- Anthropic API key lives **only** in Netlify environment variables — never in frontend code
- Firebase config (apiKey, projectId) is safe to be public — security comes from Firestore rules
- Never commit `.env` files to Git — `.env` must be in `.gitignore`

### Privacy
- We store: Google display name, email — provided by Google with user consent
- We do NOT store passwords (Google handles auth)
- Emails stored in Firestore but never shown in the UI
- Images stored in Firebase Storage under random IDs (not linked to user name)
- No third-party analytics or tracking
- Closed group — anonymous users can browse but cannot contribute personal data

### Abuse Prevention
- Pending approval flow: strangers who find the link can't add content
- Image upload: 5MB limit enforced in Storage rules and frontend
- AI functions: simple rate limit — max 20 calls/hour per IP (added in Netlify function)

---

## Testing Plan

### Manual Checklist — Run Before Each Wave Is Done

**Authentication & permissions:**
- [ ] Anonymous user can browse, cannot add/favorite
- [ ] New Google login shows "pending" screen
- [ ] Admin can approve user
- [ ] Approved user can add recipe
- [ ] Approved user cannot edit someone else's recipe
- [ ] Admin can edit/delete any recipe

**Mobile (real device, not just DevTools):**
- [ ] All buttons are thumb-reachable
- [ ] No horizontal scroll
- [ ] Images load correctly
- [ ] Modals don't overflow screen
- [ ] Hebrew text renders correctly

**Data integrity:**
- [ ] Deleting a recipe removes its favorites entries
- [ ] favoritesCount stays accurate
- [ ] Tags save and load correctly

### Testing AI Functions
Before building UI around them, test each Netlify function directly using the browser or a simple test script:
- Verify response format
- Test edge cases: very long title, non-food image, empty input

### Browsers to Test
- Chrome on Android (primary)
- Safari on iOS (important — different behavior)
- Chrome desktop

---

## Costs — Honest Breakdown

### What you already use (free):
| Service | Cost |
|---|---|
| Firebase Firestore + Auth | Free (Spark plan) |
| Firebase Storage | Free up to 5GB |
| Netlify Functions | Free (125k calls/month) |
| GitHub Pages | Free |

### New cost: Anthropic API

| Action | Cost per call | Est. monthly | Monthly cost |
|---|---|---|---|
| Auto-tag a recipe | ~$0.002 | 20 new recipes | $0.04 |
| Natural language search | ~$0.01 | 50 searches | $0.50 |
| Extract recipe from image | ~$0.03 | 10 images | $0.30 |
| Backfill 244 recipes (one-time) | ~$0.50 total | Once ever | $0.50 |
| **Total ongoing** | | | **~$1/month** |

Realistic ceiling with heavy use: **$3-5/month**.

### Free Alternatives

| Use case | Free alternative | Tradeoff |
|---|---|---|
| Auto-tagging | Keyword matching in JS | Less smart, misses nuance |
| Natural language search | Fuse.js (fuzzy search library) | No semantic understanding |
| Image extraction | No good free option | — |

### Recommended Approach (minimize cost):
- **Wave 2 tags:** Start with keyword matching (free). Upgrade to Claude later if results are poor.
- **Wave 3 search:** Fuse.js (free). Covers 80% of use cases.
- **Wave 4 image extraction:** Claude API only (no free alternative). ~$0.30/month.

This means **ongoing cost is near $0** until Wave 4, then ~$1/month.

### How to check your Anthropic API key:
1. Go to **console.anthropic.com**
2. Log in
3. Left menu → "API Keys"
4. If a key exists — you're ready. If not — create one (free to create, pay per use).

---

## Wave-by-Wave Implementation

### 🌊 Wave 1 — Identity & Favorites
*No new APIs. Pure Firebase + UI.*

**1.1 — User approval system**
- On Google login: check `users` collection in Firestore
- No record → create with `role: "pending"` → show waiting screen
- Admin panel: list of pending users, one-click approve
- Implement Firestore security rules (see above)

**1.2 — "Added by" display**
- Add `addedBy` to all new recipes on save
- Backfill 244 existing recipes with `{ name: "נועה" }`
- Show name below recipe title on card

**1.3 — Favorites**
- Heart button on every card (requires login)
- Write/delete to `favorites` collection on click
- Show count ("♥ 3") on card
- "המועדפים שלי" tab in main nav

**1.4 — Mobile audit**
- Test every screen on a real phone and fix issues

---

### 🌊 Wave 2 — Tags
**2.1 —** Tag UI on recipe add/edit form (checkboxes by group)
**2.2 —** Auto-suggest on import (keyword matching or Claude)
**2.3 —** Backfill existing 244 recipes
**2.4 —** Tag filter panel in main view

---

### 🌊 Wave 3 — Surprise Me + Smart Search
**3.1 —** "הפתעי אותי" button → 3-5 suggestions → "another one" option
**3.2 —** Natural language search box (Fuse.js or Claude)

---

### 🌊 Wave 4 — Add Recipe from Image
**4.1 —** Firebase Storage setup + rules
**4.2 —** Image upload UI in "add recipe" modal
**4.3 —** Claude extracts content → editable confirmation form → save

---

## Distributing the App — PWA vs. App Store

### Short answer: PWA is the right choice for 10-20 users.

A PWA (Progressive Web App) means users open the website in their browser, tap "Add to Home Screen," and it appears on their home screen like a real app — with no browser UI, full screen, your icon.

**This is already possible with what you have.** It just needs a proper `manifest.json` and service worker (worth checking if these exist already).

| | PWA | App Store |
|---|---|---|
| Cost | Free | $99/year (Apple) + months of dev |
| Install | "Add to Home Screen" | Download from App Store |
| Look & feel | Identical for your use case | Identical |
| Push notifications | Limited on iOS | Full |
| Right for | Up to ~100 users | Thousands |

**How you'll distribute:** Send friends a link → "open this in Chrome/Safari and add to your home screen." That's it.

If the app grows significantly later, the path to a real app store listing is to wrap the existing web app using Capacitor (a tool that converts web apps to native apps) — but that's a future decision.

---

## How We Work Together in Cursor

1. **I explain** what we're building before any code
2. **One file at a time** — I won't ask you to edit multiple files simultaneously
3. **Test after every step** — Live Server on desktop, then real phone
4. **Commit to Git after every working step** — small commits, never accumulate changes
5. **When something breaks** — `git diff` to see what changed, `git stash` to revert

### Session starter:
> "We're continuing Our-Recipes. Last time we finished [X]. Today I want to work on [Y]."

---

## Before Starting Wave 1 — Checklist

- [ ] Confirm Google Auth works end-to-end (user can log in and see their name)
- [ ] Check API key at console.anthropic.com
- [ ] Confirm Netlify is live and functions are deploying
- [ ] Check if `manifest.json` exists in the project (for PWA)
- [ ] Decide: keyword matching or Claude for Wave 2 tags?

---

## Estimated Timeline
*(Sessions of ~1-2 hours)*

| Wave | Sessions |
|---|---|
| Wave 1 — Identity & Favorites | 3-4 |
| Wave 2 — Tags | 4-5 |
| Wave 3 — Surprise Me | 2-3 |
| Wave 4 — Image Import | 3-4 |
| **Total** | **12-16 sessions** |