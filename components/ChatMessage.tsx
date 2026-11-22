'use client';

import React from 'react';
import { Bot, User } from 'lucide-react';
import type { ChatMessageItem } from '@/lib/types';

interface ChatMessageProps {
  message: ChatMessageItem;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex w-full items-end gap-2.5 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Avatar Robot di sisi kiri */}
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-400/35 bg-cyan-500/15 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.2)]">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Bubble Pesan */}
      <div
        className={`group relative max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed transition-all ${
          isUser
            ? 'rounded-br-sm border border-cyan-400/30 bg-gradient-to-br from-cyan-500/25 via-sky-500/20 to-indigo-600/25 text-slate-50 shadow-[0_4px_20px_rgba(6,182,212,0.12)]'
            : 'rounded-bl-sm border border-white/10 bg-white/[0.06] text-slate-100 backdrop-blur-md'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">
          {message.content}
          {message.isStreaming && (
            <span className="ml-1 inline-block h-3.5 w-1.5 align-middle rounded-sm bg-cyan-300 animate-pulse" />
          )}
        </p>

        <span
          className={`mt-1 block text-[10px] tracking-wide ${
            isUser ? 'text-right text-cyan-200/60' : 'text-left text-slate-400/75'
          }`}
        >
          {message.timestamp}
        </span>
      </div>

      {/* Avatar User di sisi kanan */}
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-indigo-400/35 bg-indigo-500/20 text-indigo-200">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
