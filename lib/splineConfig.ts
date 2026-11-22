import type { SplineEventName } from '@splinetool/runtime';
import type { RobotState } from './types';

/**
 * URL Scene 3D HD dari Spline.
 * Ganti URL ini jika Anda mempublikasikan versi terbaru dari project Spline.
 */
export const SPLINE_SCENE_URL =
  'https://prod.spline.design/Yd5I-ogWwKbAgCgv/scene.splinecode';

/**
 * Konfigurasi trigger event Spline untuk tiap state percakapan robot.
 *
 * CARA MENYESUAIKAN DENGAN SCENE SPLINE ANDA:
 * 1. Jalankan `npm run dev` dan buka DevTools Console (F12).
 * 2. Saat scene selesai dimuat, helper inspektor otomatis akan mencetak
 *    daftar semua NAMA OBJECT dan VARIABLES yang tersedia di scene Spline ini.
 * 3. Ganti nilai `targetObject` atau `variableName` di bawah agar cocok persis
 *    dengan nama object/event/state yang Anda buat di Spline Editor.
 */
export interface SplineEventTrigger {
  /** Nama event Spline: 'mouseDown' | 'mouseUp' | 'mouseHover' | 'keyDown' | 'start' | dst. */
  eventName: SplineEventName;
  /** Nama persis (case-sensitive) object di hierarki Spline, atau UUID object tersebut. */
  targetObject: string;
  /** Jika true, memanggil emitEventReverse alih-alih emitEvent. */
  reverse?: boolean;
}

export interface SplineVariableTrigger {
  /** Nama variable yang didefinisikan di panel Variables pada Spline Editor. */
  name: string;
  /** Nilai yang akan diset saat state aktif. */
  value: string | number | boolean;
}

export interface SplineStateAction {
  /** Daftar event yang akan dipicu melalui splineApp.emitEvent(...) */
  events?: SplineEventTrigger[];
  /** Daftar variable Spline yang akan diperbarui melalui splineApp.setVariable(...) */
  variables?: SplineVariableTrigger[];
}

/**
 * Konstanta nama object utama di scene Spline.
 * Ubah konstanta ini saja jika seluruh trigger mengarah ke object yang sama.
 */
export const SPLINE_OBJECTS = {
  ROBOT_ROOT: 'Robot',
  ROBOT_HEAD: 'Head',
  ROBOT_EYES: 'Eyes',
} as const;

/**
 * Pemetaan state aplikasi ('idle' | 'listening' | 'talking' | 'error')
 * ke aksi animasi di scene Spline.
 *
 * Catatan keamanan runtime:
 * Semua pemanggilan `emitEvent` dan `setVariable` di RobotScene.tsx dibungkus
 * dengan try/catch dan pengecekan keberadaan object, sehingga TIDAK akan error
 * meskipun nama object belum disesuaikan dengan scene Spline Anda.
 */
export const SPLINE_STATE_TRIGGERS: Record<RobotState, SplineStateAction> = {
  // Saat idle: biarkan animasi default/idle bawaan scene berjalan
  idle: {
    events: [
      {
        eventName: 'mouseUp',
        targetObject: SPLINE_OBJECTS.ROBOT_ROOT,
      },
    ],
    variables: [
      { name: 'isListening', value: false },
      { name: 'isTalking', value: false },
    ],
  },

  // Saat user mengirim pesan & robot menunggu/memproses respons AI ("mendengarkan")
  listening: {
    events: [
      {
        eventName: 'mouseDown',
        targetObject: SPLINE_OBJECTS.ROBOT_ROOT,
      },
    ],
    variables: [
      { name: 'isListening', value: true },
      { name: 'isTalking', value: false },
    ],
  },

  // Saat jawaban robot mulai muncul / streaming ("berbicara")
  talking: {
    events: [
      {
        eventName: 'mouseHover',
        targetObject: SPLINE_OBJECTS.ROBOT_HEAD,
      },
    ],
    variables: [
      { name: 'isListening', value: false },
      { name: 'isTalking', value: true },
    ],
  },

  // Saat terjadi error jaringan / API
  error: {
    events: [
      {
        eventName: 'mouseUp',
        targetObject: SPLINE_OBJECTS.ROBOT_ROOT,
      },
    ],
    variables: [
      { name: 'isListening', value: false },
      { name: 'isTalking', value: false },
    ],
  },
};

/**
 * Durasi (milidetik) robot bertahan di state 'talking' setelah jawaban selesai
 * sebelum otomatis kembali ke animasi 'idle' bawaan scene.
 */
export const TALKING_COOLDOWN_MS = 2400;

/**
 * Batas waktu (milidetik) sebelum menampilkan notifikasi jaringan lambat saat memuat scene 3D.
 */
export const SPLINE_LOAD_TIMEOUT_MS = 25000;

/**
 * Aktifkan log inspeksi daftar object & variable Spline di Console saat development.
 * Sangat berguna untuk melihat nama object asli di scene Spline Anda.
 */
export const ENABLE_SCENE_INSPECTOR = process.env.NODE_ENV === 'development';
