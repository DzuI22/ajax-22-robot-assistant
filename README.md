# AURA-01 — AI Robot Assistant (3D Spline + Next.js + Vikey.ai)

Website interaktif full-stack bertema **AI Robot Assistant** dengan visual 3D HD dari **Spline**, UI chat futuristik bergaya *dark glassmorphism*, backend aman di Next.js App Router yang terintegrasi dengan **Vikey.ai**, serta responsif penuh untuk **Mobile Portrait, Mobile Landscape, dan Desktop**.

---

## Fitur Utama

- **3D Robot HD dari Spline**: Menggunakan `@splinetool/react-spline` dengan dynamic client-side loading (`ssr: false`), loading screen dengan progress bar halus, dan Error Boundary fallback.
- **Trigger Animasi Terprogram**: State chat (`idle`, `listening`, `talking`, `error`) terhubung ke instance Spline melalui `lib/splineConfig.ts` (`emitEvent` dan `setVariable`) serta dilengkapi **Dev Scene Inspector** di Console untuk melihat nama object asli di scene Spline Anda.
- **Backend Aman (Vikey.ai)**: API key hanya dibaca di server (`app/api/chat/route.ts`) melalui `process.env.VIKEY_API_KEY`, mendukung **streaming SSE** maupun **JSON `{ reply: string }`**, lengkap dengan timeout & error handling ramah pengguna.
- **Responsif Portrait & Landscape**:
  - **Mobile Portrait**: Scene 3D menempati ~62% bagian atas layar, chat berada di bagian bawah (bisa di-collapse untuk tampilan 3D penuh).
  - **Mobile/Tablet Landscape**: Scene 3D melebar di sisi kiri (~60%), chat otomatis bergeser menjadi panel sempit di sisi kanan.
  - **Desktop**: Scene 3D penuh dengan floating glassmorphism chat box di bagian bawah tanpa menghalangi interaksi orbit/drag.

---

## Struktur Folder

```text
ai-robot-assistant/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts       # Backend API Route (Vikey.ai, server-side only)
│   ├── globals.css            # Tailwind + media query orientation portrait/landscape
│   ├── layout.tsx             # Root layout, font & viewport config
│   └── page.tsx               # Halaman utama & orkestrasi state chat <-> 3D robot
├── components/
│   ├── RobotScene.tsx         # Wrapper Spline 3D + loading screen + trigger animasi
│   ├── ChatBox.tsx            # Floating glassmorphism chat box (collapse/expand)
│   └── ChatMessage.tsx        # Komponen bubble percakapan user & robot
├── lib/
│   ├── splineConfig.ts        # Konstanta URL scene + konfigurasi object/event Spline
│   └── types.ts               # Definisi tipe TypeScript bersama
├── .env.example               # Template environment variable
├── next.config.mjs
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Cara Menjalankan Secara Lokal

### 1. Ekstrak / Clone Project
Ekstrak file `.zip` ini atau clone repository ke komputer Anda, lalu masuk ke folder project:
```bash
cd ai-robot-assistant
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Buat File `.env.local`
Salin `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```
Buka `.env.local` dan masukkan API key Vikey.ai Anda:
```env
VIKEY_API_KEY=isi_api_key_vikey_anda_di_sini
# Opsional: sesuaikan jika akun Vikey.ai Anda memakai model ID berbeda
# VIKEY_MODEL=gpt-4o-mini
```

### 4. Jalankan Development Server
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## Cara Menyesuaikan Trigger Animasi Spline

Karena setiap project Spline memiliki nama object/event/variable yang berbeda:
1. Jalankan `npm run dev` lalu buka **Browser DevTools (F12) → Console**.
2. Setelah scene 3D selesai dimuat, cari grup log **`[Spline Inspector]`** — di sana otomatis tercantum tabel seluruh **nama Object** dan **Variables** yang ada di scene `Yd5I-ogWwKbAgCgv`.
3. Buka file `lib/splineConfig.ts`, lalu sesuaikan nilai `SPLINE_OBJECTS` dan `SPLINE_STATE_TRIGGERS` (`listening`, `talking`, `idle`) dengan nama object atau variable dari hasil inspeksi tersebut.

---

## Cara Deploy ke Vercel

### Opsi A — Via GitHub & Dashboard Vercel (Direkomendasikan)
1. Push folder project ini ke repository GitHub Anda (pastikan `.env.local` **tidak** ikut ter-commit — sudah otomatis diabaikan oleh `.gitignore`).
2. Masuk ke [vercel.com](https://vercel.com) → klik **Add New Project** → pilih repository Anda.
3. Pada bagian **Environment Variables**, tambahkan:
   - **Name**: `VIKEY_API_KEY`
   - **Value**: *(API key Vikey.ai Anda)*
   - *(Opsional)* **Name**: `VIKEY_MODEL` jika ingin menentukan model khusus.
4. Klik **Deploy** — selesai!

### Opsi B — Via Vercel CLI
```bash
npm i -g vercel
vercel
# Tambahkan environment variable untuk production:
vercel env add VIKEY_API_KEY production
vercel --prod
```
