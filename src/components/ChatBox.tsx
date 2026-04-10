'use client';

import { useEffect, useRef, useState } from 'react';
import type { Digest } from '@/lib/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function ChatBox({ digest }: { digest: Digest }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleAsk() {
    const question = input.trim();
    if (!question || asking) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setAsking(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, digest }),
      });

      // Non-streaming error responses (400, 429, 500) are JSON
      if (!res.ok) {
        let errMsg = `Error ${res.status}`;
        try {
          const data = await res.json();
          errMsg = data.error ?? errMsg;
        } catch {
          // ignore parse failure
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
        return;
      }

      if (!res.body) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'No response body.' },
        ]);
        return;
      }

      // Start streaming — add a placeholder assistant message
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', streaming: true },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + chunk },
          ];
        });
      }

      // Flush any remaining bytes and remove the streaming cursor
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const flushed = decoder.decode();
        return [
          ...prev.slice(0, -1),
          { ...last, content: last.content + flushed, streaming: false },
        ];
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setAsking(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }

  const showThinking =
    asking && (messages.length === 0 || messages[messages.length - 1].role === 'user');

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 border-b border-gray-200">
        Ask about today&apos;s digest
      </div>

      {/* Messages */}
      <div className="px-4 py-4 space-y-3 max-h-96 overflow-y-auto bg-white">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 italic">
            Try: &quot;What&apos;s the most controversial post?&quot; or &quot;Summarize the AI
            discussions.&quot;
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-0.5 h-3.5 bg-gray-500 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}

        {showThinking && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-400 px-3 py-2 rounded-lg text-sm italic">
              Thinking…
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 p-3 border-t border-gray-200 bg-white">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
          rows={2}
          className="flex-1 resize-none text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
        <button
          onClick={handleAsk}
          disabled={!input.trim() || asking}
          className="shrink-0 px-4 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 disabled:opacity-40 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
