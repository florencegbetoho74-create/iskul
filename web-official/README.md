# iSkul Official Website (`web-official`)

Site web officiel public de la plateforme iSkul (separe de la console admin).

## Developpement local

```bash
npm install
npm run dev
```

## Build production

```bash
npm run build
npm run preview
```

## Variables d'environnement

Copier `.env.example` vers `.env` et ajuster:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ANDROID_URL`
- `VITE_IOS_URL`
- `VITE_CONTACT_URL`
- `VITE_BLOG_URL`
- `VITE_FAQ_URL`
- `VITE_LEGAL_URL`
- `VITE_SUPPORT_EMAIL`

## Deploiement Vercel

1. Importer le repo GitHub dans Vercel.
2. Configurer:
   - `Framework Preset`: `Vite`
   - `Root Directory`: `web-official`
   - `Build Command`: `npm run build`
   - `Output Directory`: `dist`
3. Ajouter les variables d'environnement Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ANDROID_URL`
   - `VITE_IOS_URL`
   - `VITE_CONTACT_URL`
   - `VITE_BLOG_URL`
   - `VITE_FAQ_URL`
   - `VITE_LEGAL_URL`
   - `VITE_SUPPORT_EMAIL`
4. Redeployer.

Notes:
- `vercel.json` inclut un rewrite SPA pour que les routes React Router (`/cours`, `/parents`, etc.) fonctionnent en acces direct.
- L'inscription professeur depend aussi de la fonction Supabase `teacher-register` cote backend.
