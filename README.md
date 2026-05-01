# BreakRoom 8 Ball

Game biliar 8-ball berbasis web dengan React, Matter.js, dan canvas. Proyek ini bisa langsung di-deploy ke Vercel.

## Jalankan lokal

```bash
npm install
npm run dev
```

## Multiplayer

Game tetap bisa dimainkan tanpa konfigurasi backend. Dalam mode itu, multiplayer memakai `BroadcastChannel`, cocok untuk simulasi antar tab di browser yang sama.

Untuk multiplayer online antar perangkat, buat project Supabase lalu isi environment variables berikut di `.env.local` dan di Vercel:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Supabase Realtime broadcast dipakai sebagai transport room. Di Vercel, set variables yang sama di Project Settings, lalu deploy.

## Deploy Vercel

```bash
npm run build
```

Import repository ini ke Vercel. Vercel akan membaca `vercel.json` dan menjalankan build Vite secara otomatis.
