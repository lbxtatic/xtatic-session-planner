# Xtatic Teaching Plan Generator

A zero-backend React app that collects class details, generates adaptive session plans, records feedback, and iterates plans until the final session. Data is stored in `localStorage`.

## 🚀 Quick Start
```bash
npm i      # or yarn / pnpm
npm run dev
```
Open http://localhost:5173

## 🏗️ Build
```bash
npm run build
npm run preview
```

## ☁️ Deploy
### Vercel (recommended)
1. Push this repo to GitHub.
2. In Vercel, **New Project → Import GitHub Repo**.
3. Framework preset: **Vite** (auto-detected). Build command `vite build`, output `dist/`.
4. Deploy.

### Netlify
- Connect repo → Build: `vite build` → Publish dir: `dist`

### GitHub Pages
1. In `vite.config.js`, set `base: '/<repo-name>/'`.
2. Build, then publish the `dist` folder to `gh-pages`.
