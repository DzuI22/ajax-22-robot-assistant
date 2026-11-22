'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  ChevronDown,
  MessageSquare,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import ChatMessage from './ChatMessage';
import type { ChatMessageItem, RobotState } from '@/lib/types';

interface ChatBoxProps {
  messages: ChatMessageItem[];
  isLoading: boolean;
  errorMessage: string | null;
  robotState: RobotState;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onDismissError: () => void;
}

const QUICK_PROMPTS = [
  'Siapa kamu dan apa yang bisa kamu bantu?',
  'Berikan 1 fakta unik soal robotika',
  'Bantu aku cari ide proyek seru',
];

const STATE_LABEL: Record<RobotState, { text: string; dotClass: string }> = {
  idle: { text: 'Online', dotClass: 'bg-emerald-400 shadow-[0_0_8px_#34d399]' },
  listening: {
    text: 'Mendengarkan...',
    dotClass: 'bg-cyan-400 animate-ping',
  },
  talking: {
    text: 'Merespons...',
    dotClass: 'bg-indigo-400 animate-pulse shadow-[0_0_8px_#818cf8]',
  },
  error: { text: 'Gangguan', dotClass: 'bg-rose-400' },
};

export default function ChatBox({
  messages,
  isLoading,
  errorMessage,
  robotState,
  isOpen,
  onToggleOpen,
  onSendMessage,
  onClearChat,
  onDismissError,
}: ChatBoxProps) {
  const [input, setInput] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !isOpen) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isLoading, isOpen]);

  // Tutup keyboard mobile otomatis saat panel chat di-minimize
  useEffect(() => {
    if (!isOpen) {
      inputRef.current?.blur();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput('');
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isLoading) return;
    onSendMessage(prompt);
  };

  const statusMeta = STATE_LABEL[robotState];

  return (
    <>
      {/* Tombol Minimalis */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 sm:bottom-5 z-30 flex justify-center px-4">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-label="Buka panel chat AI Robot"
          aria-hidden={isOpen}
          tabIndex={isOpen ? -1 : 0}
          className={`group inline-flex h-fit w-fit items-center gap-2 rounded-full border border-white/15 bg-slate-950/75 px-3.5 py-2 text-xs font-medium text-slate-100 shadow-[0_6px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all ease-out hover:scale-105 hover:border-cyan-400/50 hover:bg-slate-900/90 active:scale-95 ${
            isOpen
              ? 'pointer-events-none opacity-0 translate-y-3 scale-90 duration-200'
              : 'pointer-events-auto opacity-100 translate-y-0 scale-100 duration-300 delay-150'
          }`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
          </span>
          <MessageSquare className="h-3.5 w-3.5 text-cyan-300" />
          <span>Chat</span>
        </button>
      </div>

      {/* Panel Chat Utama */}
      <div className="chat-overlay-anchor">
        <section
          aria-label="Chat dengan AI Robot Assistant"
          aria-hidden={!isOpen}
          data-open={isOpen ? 'true' : 'false'}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          className={`chat-panel-shell flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950/70 shadow-[0_12px_48px_rgba(0,0,0,0.68),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl ${
            isOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          {/* Header Chat Box */}
          <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.03] px-3.5 py-2.5 sm:px-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 text-cyan-300">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display truncate text-xs sm:text-sm font-semibold tracking-wide text-white">
                  AJA𝕏-22 Assistant
                </h2>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-300/80">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${statusMeta.dotClass}`}
                    />
                  </span>
                  <span className="truncate">{statusMeta.text}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={onClearChat}
                  disabled={isLoading}
                  title="Bersihkan percakapan"
                  aria-label="Bersihkan percakapan"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onToggleOpen}
                title="Perkecil chat"
                aria-label="Perkecil panel chat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Area Histori Percakapan */}
          <div
            ref={scrollContainerRef}
            className="chat-scrollbar flex-1 space-y-3 overflow-y-auto overscroll-contain touch-pan-y px-3.5 py-3 sm:px-4"
          >
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {messages.length <= 1 && !isLoading && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleQuickPrompt(prompt)}
                    className="rounded-full border border-cyan-400/20 bg-cyan-500/[0.08] px-3 py-1 text-[11px] text-cyan-100/90 hover:border-cyan-400/45 hover:bg-cyan-500/20 transition text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {isLoading &&
              !(
                messages.length > 0 &&
                messages[messages.length - 1].role === 'assistant' &&
                messages[messages.length - 1].isStreaming &&
                messages[messages.length - 1].content.length > 0
              ) && (
                <div className="flex items-end gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-400/35 bg-cyan-500/15 text-cyan-300">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="relative overflow-hidden rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.07] px-4 py-3">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent animate-shimmer"
                    />
                    <div className="relative flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full bg-cyan-300 animate-typing-dot"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="h-2 w-2 rounded-full bg-cyan-300 animate-typing-dot"
                        style={{ animationDelay: '180ms' }}
                      />
                      <span
                        className="h-2 w-2 rounded-full bg-cyan-300 animate-typing-dot"
                        style={{ animationDelay: '360ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* Banner Error Ramah */}
          {errorMessage && (
            <div
              role="alert"
              className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs text-rose-100"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-300" />
                <span className="truncate sm:whitespace-normal">{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Tutup pesan error"
                className="shrink-0 rounded p-0.5 text-rose-200 hover:bg-rose-400/20 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-white/10 bg-white/[0.02] p-2.5 sm:p-3"
          >
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/75 px-3 py-1.5 focus-within:border-cyan-400/50 focus-within:ring-1 focus-within:ring-cyan-400/30 transition">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ketik pesan untuk AJA𝕏-22..."
                disabled={isLoading}
                maxLength={1500}
                autoComplete="off"
                className="w-full bg-transparent py-1 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Kirim pesan"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.35)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
