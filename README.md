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
