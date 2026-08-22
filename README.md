# Fly Dimo Fly

A Flappy Bird style browser game — tap to flap Dimo through Constable Dhakkan's
barricades, grab golden coins for a shield, and rack up your best score.

Pure static site: `index.html` + `style.css` + `game.js` + three `.mp3` sound
effects in `assets/`. No build step, no dependencies.

## Run it locally

Just open `index.html` in a browser. (Some browsers restrict audio/local
files when opened directly via `file://` — if sound doesn't play locally,
serve it instead:)

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Deploy to GitHub

```bash
git init
git add .
git commit -m "Fly Dimo Fly"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo you just pushed.
2. Framework preset: choose **Other** (it's a static site, no build needed).
3. Build command: leave blank. Output directory: leave as `.` / root.
4. Click **Deploy** — you'll get a live URL in about a minute.

Any time you push to `main`, Vercel redeploys automatically.

## Controls

- Tap / click / press Space to flap
- Grab a golden coin for a temporary shield (glowing ring) that absorbs one hit
- Clipping the ceiling just bounces you back down — only the ground and an
  unshielded barricade hit end the run

## Installing as an app (PWA)

This is a full Progressive Web App — it can be installed to a phone or
desktop home screen and works offline after the first load.

- **Android / Chrome / Edge**: an "Install App" button appears automatically
  once the browser decides the site is installable. Tap it, or use the
  browser's own menu → "Install app" / "Add to Home Screen".
- **iOS Safari**: there's no automatic prompt on iOS, so the button instead
  shows "Add to Home Screen" instructions — tap the Share icon, then
  "Add to Home Screen".
- **Desktop Chrome/Edge**: look for the install icon in the address bar, or
  use the in-page "Install App" button.

Once deployed on Vercel (HTTPS is required for installability — Vercel gives
you this by default), the install prompt will work exactly the same way on
the live URL.
