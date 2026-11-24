'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import type { ItineraryData, TripInput } from '../types/travel';

export interface LocalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  appliedUpdate: boolean;
}

interface ItineraryChatbotProps {
  tripInput: TripInput;
  itinerary: ItineraryData;
  messages: LocalChatMessage[];
  onSendMessage: (
    userText: string,
    assistantReply: string,
    updatedItinerary?: ItineraryData
  ) => Promise<void> | void;
}

const QUICK_PROMPTS = [
  'Swap Day 2 evening for a quieter local dinner',
  'Make this itinerary ~20% more budget-friendly',
  'Add morning coffee and bakery spots near our route',
];

export function ItineraryChatbot({
  tripInput,
  itinerary,
  messages,
  onSendMessage,
}: ItineraryChatbotProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  async function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setInput('');
    setError(null);
    setSending(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25_000);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/trips/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          tripInput,
          currentItinerary: itinerary,
          history: historyPayload,
          message: trimmed,
        }),
      });

      const rawText = await res.text();
      let data: {
        reply?: string;
        shouldUpdateItinerary?: boolean;
        updatedItinerary?: ItineraryData;
        error?: string;
      } = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText) as typeof data;
        } catch {
          if (res.status === 504) {
            throw new Error(
              'The assistant timed out while updating your itinerary (504). Please try a simpler request or retry.'
            );
          }
          if (res.status === 502 || res.status === 503) {
            throw new Error(
              'The AI assistant is temporarily busy. Please try again in a few moments.'
            );
          }
          throw new Error(`Server returned an unexpected response (${res.status}).`);
        }
      }

      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Unable to process your request.');
      }

      await onSendMessage(
        trimmed,
        data.reply,
        data.shouldUpdateItinerary ? data.updatedItinerary : undefined
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError(
          'The assistant took too long to respond and timed out. Please try a shorter or simpler edit.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Chat request failed.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSending(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitPrompt(input);
  }

  return (
    <aside
      aria-label="AI Travel Chatbot"
      className="bg-white border border-slate-200 rounded-2xl flex flex-col h-[600px] lg:sticky lg:top-24"
    >
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5 text-sky-600 shrink-0" />
          <div>
            <h2 className="text-base font-bold font-display text-[#0B1D3A]">
              TripGenie Assistant
            </h2>
            <p className="text-xs text-slate-500">Ask questions or modify any day</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-sm text-slate-700 leading-relaxed">
              Ask me anything about your {tripInput.destination} trip, or tell me what to adjust—like
              swapping activities, slowing the pace, or optimizing daily meals.
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Try asking:</p>
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={sending}
                  onClick={() => void submitPrompt(prompt)}
                  className="block w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-[#0B1D3A] hover:border-sky-400 hover:bg-sky-50/50 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#0B1D3A] text-white'
                    : 'bg-[#F8FAFC] border border-slate-200 text-[#0B1D3A]'
                }`}
              >
                {msg.content}
              </div>
              {msg.appliedUpdate && (
                <span className="mt-1 text-xs font-medium text-emerald-700">
                  Itinerary updated with this change
                </span>
              )}
            </div>
          ))
        )}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
            <span>Updating recommendations...</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleFormSubmit} className="p-3 border-t border-slate-200 flex gap-2">
        <label htmlFor="chatbot-input" className="sr-only">
          Ask TripGenie Assistant
        </label>
        <input
          id="chatbot-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Ask or modify itinerary..."
          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-[#0B1D3A] placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send message"
          className="px-4 py-2.5 rounded-xl bg-sky-500 text-white hover:bg-sky-600 transition-colors disabled:opacity-50 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  );
}
