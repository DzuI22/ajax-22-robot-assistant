import { NextRequest, NextResponse } from 'next/server';
import type { ChatApiRequest, ChatRole } from '@/lib/types';

// Pastikan route berjalan di runtime Node.js pada Vercel Serverless Function
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Endpoint Vikey.ai (format kompatibel dengan OpenAI Chat Completions)
 */
const VIKEY_API_URL = 'https://api.vikey.ai/v1/chat/completions';

/**
 * Model default yang dipakai. Bisa diubah lewat environment variable VIKEY_MODEL
 * di .env.local atau dashboard Vercel tanpa menyentuh kode.
 */
const DEFAULT_MODEL = process.env.VIKEY_MODEL || 'gpt-4o-mini';

/**
 * Batas timeout pemanggilan API Vikey.ai (milidetik)
 */
const REQUEST_TIMEOUT_MS = 25000;

/**
 * Jumlah maksimal histori pesan yang diteruskan ke AI agar respons tetap cepat & hemat token
 */
const MAX_HISTORY_MESSAGES = 12;

/**
 * System prompt untuk membentuk kepribadian robot asisten:
 * ramah, ringkas, cerdas, dan sedikit humoris.
 */
const ROBOT_SYSTEM_PROMPT = `Kamu adalah AURA-01, asisten AI robot 3D futuristik yang ramah, cerdas, ringkas, dan sedikit humoris.
Panduan gaya bicara:
- Jawab dengan bahasa yang dipakai pengguna (umumnya Bahasa Indonesia yang santai tapi sopan).
- Berikan jawaban yang padat, jelas, dan langsung ke inti (umumnya 1–3 paragraf pendek, kecuali pengguna meminta penjelasan panjang).
- Sesekali sisipkan sentuhan humor ringan bertema robot/teknologi yang natural (jangan berlebihan).
- Jika tidak tahu sesuatu, akui dengan jujur secara ringan dan tawarkan bantuan alternatif.`;

interface VikeyMessage {
  role: 'system' | ChatRole;
  content: string;
}

/**
 * Membersihkan array histori dari frontend agar selalu sesuai format OpenAI Chat Completions
 */
function sanitizeHistory(rawHistory: unknown): VikeyMessage[] {
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .filter(
      (item): item is { role: ChatRole; content: string } =>
        Boolean(item) &&
        typeof item === 'object' &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 2000),
    }));
}

/**
 * Memetakan status HTTP error dari Vikey.ai ke pesan error ramah pengguna
 * (tidak pernah membocorkan detail teknis mentah atau API key).
 */
function mapVikeyErrorStatus(status: number): { status: number; message: string } {
  if (status === 401 || status === 403) {
    return {
      status: 502,
      message:
        'Autentikasi ke layanan AI gagal. Pastikan VIKEY_API_KEY pada server sudah benar dan aktif.',
    };
  }
  if (status === 429) {
    return {
      status: 429,
      message:
        'Permintaan sedang padat (rate limit). Tunggu beberapa detik lalu coba kirim lagi ya!',
    };
  }
  if (status === 408 || status === 504) {
    return {
      status: 504,
      message:
        'Proses berpikir robot memakan waktu terlalu lama. Coba kirim ulang pesan Anda.',
    };
  }
  return {
    status: 502,
    message:
      'Layanan AI sedang mengalami gangguan sementara. Silakan coba beberapa saat lagi.',
  };
}

/**
 * POST /api/chat
 * Menerima { message, history, stream? } dari frontend dan meneruskannya ke Vikey.ai
 * secara aman di sisi server menggunakan process.env.VIKEY_API_KEY.
 */
export async function POST(req: NextRequest) {
  // 1. Validasi keberadaan API Key (HANYA di server, tidak pernah dikirim ke client)
  const apiKey = process.env.VIKEY_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    return NextResponse.json(
      {
        error:
          'Server AI belum dikonfigurasi. Tambahkan VIKEY_API_KEY pada .env.local atau Environment Variables Vercel.',
      },
      { status: 500 }
    );
  }

  // 2. Parse & validasi payload dari client
  let body: Partial<ChatApiRequest>;
  try {
    body = (await req.json()) as Partial<ChatApiRequest>;
  } catch {
    return NextResponse.json(
      { error: 'Format permintaan tidak valid.' },
      { status: 400 }
    );
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json(
      { error: 'Pesan tidak boleh kosong.' },
      { status: 400 }
    );
  }

  if (message.length > 2000) {
    return NextResponse.json(
      { error: 'Pesan terlalu panjang. Maksimal 2.000 karakter.' },
      { status: 400 }
    );
  }

  const wantsStream = Boolean(body.stream);
  const history = sanitizeHistory(body.history);

  const messages: VikeyMessage[] = [
    { role: 'system', content: ROBOT_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: message },
  ];

  // 3. Siapkan AbortController untuk timeout agar request tidak menggantung
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // =========================================================================
    // PEMANGGILAN SERVER-SIDE KE VIKEY.AI
    // Header Authorization menggunakan VIKEY_API_KEY dari environment variable server.
    // =========================================================================
    const vikeyResponse = await fetch(VIKEY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 600,
        stream: wantsStream,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Tangani HTTP error dari Vikey.ai secara aman
    if (!vikeyResponse.ok) {
      const mapped = mapVikeyErrorStatus(vikeyResponse.status);
      // Log minimal di server untuk debugging operator tanpa mengirimnya ke browser
      console.error(`[API /chat] Vikey.ai merespons status ${vikeyResponse.status}`);
      return NextResponse.json(
        { error: mapped.message },
        { status: mapped.status }
      );
    }

    const contentType = vikeyResponse.headers.get('content-type') || '';

    // 4A. Mode Streaming (SSE / ReadableStream) jika diminta client dan didukung respons Vikey.ai
    if (wantsStream && contentType.includes('text/event-stream') && vikeyResponse.body) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const stream = new ReadableStream({
        async start(streamController) {
          const reader = vikeyResponse.body!.getReader();
          let buffer = '';
          let sentDone = false;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split(/\r?\n/);
              // Simpan baris terakhir yang mungkin belum utuh ke iterasi berikutnya
              buffer = lines.pop() || '';

              for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line || !line.startsWith('data:')) continue;

                const dataPayload = line.slice(5).trim();
                if (dataPayload === '[DONE]') {
                  if (!sentDone) {
                    sentDone = true;
                    streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
                  }
                  continue;
                }

                try {
                  const parsed = JSON.parse(dataPayload) as {
                    choices?: Array<{
                      delta?: { content?: string };
                      message?: { content?: string };
                    }>;
                  };
                  const delta =
                    parsed.choices?.[0]?.delta?.content ??
                    parsed.choices?.[0]?.message?.content ??
                    '';

                  if (delta) {
                    streamController.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`)
                    );
                  }
                } catch {
                  // Abaikan chunk SSE non-JSON seperti komentar keep-alive
                }
              }
            }

            if (!sentDone) {
              streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
            }
          } catch (streamErr) {
            console.error('[API /chat] Stream terputus:', streamErr);
            streamController.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  error: 'Koneksi streaming terputus. Silakan coba lagi.',
                })}\n\n`
              )
            );
          } finally {
            reader.releaseLock();
            streamController.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    // 4B. Mode Standar JSON -> { reply: string }
    const data = (await vikeyResponse.json()) as {
      choices?: Array<{
        message?: { content?: string };
      }>;
    };

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return NextResponse.json(
        {
          error:
            'Robot menerima respons kosong dari server AI. Silakan coba tanyakan lagi.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        {
          error:
            'Koneksi ke server AI timeout. Coba kirim pesan Anda sekali lagi ya!',
        },
        { status: 504 }
      );
    }

    console.error('[API /chat] Network/Unexpected error:', error);
    return NextResponse.json(
      {
        error:
          'Tidak dapat terhubung ke server AI saat ini. Periksa koneksi internet lalu coba lagi.',
      },
      { status: 502 }
    );
  }
}
