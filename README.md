# NL50 Leak Lab

Timed, modular NL50 (0.25/0.50) 6-max trainer: preflop charts, range reading, pot-odds math, postflop decisions and a leak tracker. Single page, hosted on GitHub Pages, with stats synced across devices through Firebase.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app |
| `firebase-config.js` | Your Firebase project settings (you fill this in) |
| `firestore.rules` | Security rules: each user can only read/write their own data |
| `sw.js` | Offline cache so the app opens with no connection |
| `manifest.webmanifest`, `icon-*.png` | Home-screen app name and icon |

## 1. Create the Firebase project (about 10 minutes)

1. Go to https://console.firebase.google.com and click **Create a project**. Name it `leak-lab`. Google Analytics is not needed.
2. **Authentication** → Get started → **Sign-in method** → enable **Email/Password** (just the first toggle) → Save.
3. **Firestore Database** → Create database → pick a location near you → start in **production mode**.
4. In Firestore, open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.
5. **Project settings** (gear icon) → General → **Your apps** → click the `</>` (Web) icon → name it `leak-lab` → Register app (no Firebase Hosting needed).
6. Copy the values from the `firebaseConfig` it shows into `firebase-config.js` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

The config values are safe to publish; they only identify the project. The rules file is what keeps your data private.

## 2. Publish on GitHub Pages

1. On https://github.com/new create a repository named `leak-lab` (public; Pages is free for public repos). Don't add a README.
2. From this folder:

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/leak-lab.git
   git push -u origin main
   ```

   (Or use **uploading an existing file** on the empty repo page and drag every file in.)
3. In the repo: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**.
4. After a minute it's live at `https://YOUR-USERNAME.github.io/leak-lab/`.
5. Optional: Firebase console → Authentication → **Settings → Authorized domains** → add `YOUR-USERNAME.github.io`.

## 3. Install on iPhone

1. Open the GitHub Pages address in **Safari**.
2. Share → **Add to Home Screen** → Add.
3. Open it from the home screen → gear icon → **Sync** → Create account (first device) or Sign in (other devices).

## Game settings

Settings (gear icon) → **Game**: table size (6-max or 9-max), ante per player, rake % and cap, your open sizes and the villain 3-bet size range.

- **9-max** adds UTG, UTG+1, UTG+2 and LJ. The three earliest seats have their own charts (`rfi.UTG9`, `rfi.UTG1`, `rfi.UTG2`, plus `3bet_vs.EP9`, `flat.vsEP9`, `bbdef.vsEP9`); LJ uses the 6-max UTG charts.
- **Ante** goes into every pot. When total antes reach 1bb, opening and BB-defend ranges widen one step (two steps at 2bb).
- **Rake** is taken from pots that see a flop (no flop, no drop). It raises the equity you need to call in every pot-odds calculation, and at 4% or more it tightens cold-calls and BB defence one step.

A step moves each edge of a range by one notch (K9s+ ↔ K8s+, 77-JJ ↔ 66-JJ). The Charts tab shows the base charts and notes when your settings adjust them.

## How sync works

- Every answer is logged to Firestore under `users/{your uid}`: one document per spot in `stats` (attempt, correct and time counters) and one per mistake in `misses`. Settings and edited charts live on the user document.
- Counters use atomic increments, so drilling on two devices at once never overwrites anything.
- Offline: Firestore queues writes and sends them when you reconnect. Answers made while signed out are kept on the device and uploaded the next time you sign in.
- **Reset stats** on the Leaks tab clears the cloud copy too.

## Updating the app

Edit `index.html`, commit and push. GitHub Pages redeploys in about a minute, and the app loads the new version on its next launch (it checks the network first and falls back to the offline copy after 3 seconds). If you change `sw.js` itself, bump `CACHE` (for example `leak-lab-v5`).
