# BreakRoom 8

BreakRoom 8 adalah game 8-ball pool HTML5 yang bisa dimainkan lokal, di HP lewat jaringan Wi-Fi yang sama, dan siap deploy ke Vercel. Game utama memakai build HTML5 dari 8Ball-Pool-HTML5 dengan wrapper UI modern dan layer online room.

## Jalankan Lokal

```bash
npm install
npm run dev
```

Buka:

- Laptop: `http://localhost:5173/`
- HP satu Wi-Fi: `http://192.168.100.159:5173/`

## Multiplayer

Ada dua mode transport:

- Supabase Realtime: untuk multiplayer online beda device dan beda jaringan.
- BroadcastChannel fallback: hanya untuk test antar tab browser ketika Supabase belum dikonfigurasi.

Buat file `.env.local` untuk test lokal atau isi Environment Variables di Vercel:

```bash
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Setelah env terisi, jalankan ulang build/dev server. Klik `Host`, bagikan kode atau link room, lalu lawan klik `Join`.

## Deploy Vercel

Import repository ini ke Vercel. `vercel.json` akan menjalankan:

```bash
npm run build
```

Build menghasilkan folder `dist/` berisi static site. Multiplayer lintas device tetap memakai Supabase Realtime dari browser, jadi tidak perlu server WebSocket custom di Vercel.
