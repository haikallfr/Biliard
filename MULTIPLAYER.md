# Multiplayer Setup

## Cara Kerja

Game ini adalah static site, jadi cocok untuk Vercel. Untuk realtime beda device, browser terhubung langsung ke Supabase Realtime Broadcast:

1. Host membuat room code.
2. Guest masuk memakai kode atau link room.
3. Klien yang sedang mendapat giliran mengirim snapshot state bola, turn, target solids/stripes, foul, dan status game.
4. Klien lawan mengunci input saat bukan gilirannya dan menerapkan snapshot yang diterima.

Fallback `BroadcastChannel` tetap tersedia untuk test antar tab saat Supabase belum diisi, tetapi tidak bisa menembus device berbeda.

## Environment Variables

Isi di `.env.local` untuk lokal dan di Vercel Project Settings untuk production:

```bash
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Anon/publishable key memang public untuk aplikasi frontend. Jangan gunakan service role key atau secret key di browser.

## Vercel

Vercel menjalankan build static:

```bash
npm run build
```

Script build menulis `runtime-config.js` dari environment variables, lalu menyalin semua asset game ke `dist/`.

Vercel Functions tidak dipakai sebagai WebSocket server. Realtime tetap berjalan karena koneksi WebSocket dibuat langsung dari browser ke Supabase.

## Test

1. Jalankan `npm run dev`.
2. Buka dua tab browser.
3. Klik `Host` di tab pertama.
4. Copy link room.
5. Buka link di tab kedua dan klik `Join`.
6. Setelah Supabase env terisi, lakukan hal yang sama dari dua device berbeda.
