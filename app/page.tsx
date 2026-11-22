'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cpu, Sparkles } from 'lucide-react';
import RobotScene from '@/components/RobotScene';
import ChatBox from '@/components/ChatBox';
import { TALKING_COOLDOWN_MS } from '@/lib/splineConfig';
import type { ChatApiErrorResponse, ChatApiResponse, ChatMessageItem, RobotState } from '@/lib/types';

function formatTime(): string {
  return new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createWelcomeMessage(): ChatMessageItem {
  return {
    id: 'welcome-aura-01',
    role: 'assistant',
    content:
      'Halo! Aku AURA-01, asisten robot 3D-mu. Ada yang bisa kubantu hari ini? Kamu juga bisa geser area 3D untuk berinteraksi denganku!',
    // Statis agar tidak menyebabkan React hydration mismatch antara timezone server Vercel & browser
    timestamp: 'Online',
  };
}

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessageItem[]>(() => [
    createWelcomeMessage(),
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [robotState, setRobotState] = useState<RobotState>('idle');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);

  const talkingTimeoutRef = useRef<number | null>(null);

  // Bersihkan timer saat komponen unmount
  useEffect(() => {
    return () => {
      if (talkingTimeoutRef.current) {
        window.clearTimeout(talkingTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Mengembalikan robot ke state 'idle' setelah jeda singkat sesudah selesai berbicara.
   */
  const scheduleReturnToIdle = useCallback(() => {
    if (talkingTimeoutRef.current) {
      window.clearTimeout(talkingTimeoutRef.current);
    }
    talkingTimeoutRef.current = window.setTimeout(() => {
      setRobotState('idle');
    }, TALKING_COOLDOWN_MS);
  }, []);

  /**
   * Mengirim pesan ke backend Next.js (/api/chat) dengan dukungan streaming SSE
   * serta fallback otomatis ke format JSON standar { reply: string }.
   */
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (talkingTimeoutRef.current) {
        window.clearTimeout(talkingTimeoutRef.current);
      }

      setErrorMessage(null);
      setIsLoading(true);
      // 1. Trigger animasi "mendengarkan" pada scene Spline
      setRobotState('listening');

      const userMessage: ChatMessageItem = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: formatTime(),
      };

      // Siapkan histori percakapan sebelum pesan baru ditambahkan
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome-aura-01' && m.content.trim().length > 0)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMessage]);

      const assistantMsgId = `assistant-${Date.now()}`;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            history: historyPayload,
            stream: true,
          }),
        });

        // Tangani error HTTP dari route handler
        if (!response.ok) {
          let friendlyError =
            'Maaf, terjadi kendala saat menghubungi AI. Coba lagi sebentar ya.';
          try {
            const errData = (await response.json()) as Partial<ChatApiErrorResponse>;
            if (errData.error) {
              friendlyError = errData.error;
            }
          } catch {
            // Gunakan pesan fallback ramah
          }
          setErrorMessage(friendlyError);
          setRobotState('error');
          scheduleReturnToIdle();
          return;
        }

        const contentType = response.headers.get('content-type') || '';

        // 2A. Tangani respons Streaming (SSE) secara bertahap
        if (contentType.includes('text/event-stream') && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let accumulated = '';
          let assistantMessageAdded = false;
          let streamHadError = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';

            for (const eventChunk of events) {
              const line = eventChunk
                .split('\n')
                .find((l) => l.startsWith('data:'));
              if (!line) continue;

              const payload = line.slice(5).trim();
              if (payload === '[DONE]') continue;

              try {
                const parsed = JSON.parse(payload) as {
                  delta?: string;
                  error?: string;
                };

                if (parsed.error) {
                  streamHadError = true;
                  setErrorMessage(parsed.error);
                  setRobotState('error');
                  break;
                }

                if (parsed.delta) {
                  accumulated += parsed.delta;

                  if (!assistantMessageAdded) {
                    assistantMessageAdded = true;
                    // 2. Trigger animasi "talking" saat jawaban mulai muncul
                    setRobotState('talking');
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: assistantMsgId,
                        role: 'assistant',
                        content: accumulated,
                        timestamp: formatTime(),
                        isStreaming: true,
                      },
                    ]);
                  } else {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: accumulated }
                          : m
                      )
                    );
                  }
                }
              } catch {
                // Abaikan chunk yang tidak lengkap
              }
            }
          }

          // Tandai streaming selesai
          if (assistantMessageAdded) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, isStreaming: false } : m
              )
            );
          } else if (!streamHadError) {
            setErrorMessage(
              'Robot menerima respons kosong dari server AI. Silakan coba lagi.'
            );
            setRobotState('error');
          }

          scheduleReturnToIdle();
          return;
        }

        // 2B. Tangani respons JSON standar { reply: string }
        const data = (await response.json()) as Partial<ChatApiResponse>;
        if (!data.reply) {
          setErrorMessage(
            'Robot tidak menerima jawaban yang valid. Silakan coba lagi.'
          );
          setRobotState('error');
          scheduleReturnToIdle();
          return;
        }

        // Trigger animasi "talking" saat jawaban muncul
        setRobotState('talking');
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: data.reply as string,
            timestamp: formatTime(),
          },
        ]);
        scheduleReturnToIdle();
      } catch {
        setErrorMessage(
          'Koneksi terputus. Pastikan perangkat Anda terhubung ke internet lalu coba lagi.'
        );
        setRobotState('error');
        scheduleReturnToIdle();
      } finally {
        setIsLoading(false);
      }
    },
    [messages, scheduleReturnToIdle]
  );

  const handleClearChat = useCallback(() => {
    setMessages([createWelcomeMessage()]);
    setErrorMessage(null);
    setRobotState('idle');
  }, []);

  return (
<main
  className="stage-layout bg-[#e8e8e8]"
  data-chat-open={isChatOpen ? 'true' : 'false'}
>
      {/* Top Minimal Floating HUD Header (pointer-events-none agar tidak menghalangi 3D) */}
      <header className="hud-header-bar pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-slate-950/60 px-3.5 py-1.5 backdrop-blur-xl shadow-lg">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/30 to-indigo-500/30 text-cyan-300">
            <Cpu className="h-3.5 w-3.5" />
          </div>
          <span className="font-display text-xs sm:text-sm font-semibold tracking-wider text-white">
            AJA𝕏<span className="text-cyan-400">-22</span>
          </span>
          <span className="hidden sm:inline-block h-3 w-px bg-white/15" />
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-300">
            <Sparkles className="h-3 w-3 text-cyan-300" />
            AI Robot Assistant 3D
          </span>
        </div>

        {/* Indikator status 3D Scene */}
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur-xl">
          <span
            className={`h-2 w-2 rounded-full ${
              isSceneReady
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span>{isSceneReady ? '3D HD Aktif' : 'Memuat 3D...'}</span>
        </div>
      </header>

      {/* Container Utama Scene 3D Spline */}
      <div className="spline-stage">
        <RobotScene
          robotState={robotState}
          onSceneReady={() => setIsSceneReady(true)}
        />
      </div>

      {/* Hanya render tombol & panel chat setelah loading 3D selesai */}
      {isSceneReady && (
        <ChatBox
          messages={messages}
          isLoading={isLoading}
          errorMessage={errorMessage}
          robotState={robotState}
          isOpen={isChatOpen}
          onToggleOpen={() => setIsChatOpen((prev) => !prev)}
          onSendMessage={handleSendMessage}
          onClearChat={handleClearChat}
          onDismissError={() => setErrorMessage(null)}
        />
      )}
    </main>
  );
}
