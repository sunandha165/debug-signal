import React, { useState } from "react";
import type { ConversationMessage } from "../../types";
import "./Conversation.css";

export interface ConversationProps {
  messages: ConversationMessage[];
  onClear?: () => void;
  onSend?: (text: string) => void;
  inputPlaceholder?: string;
}

/**
 * Chat-style transcript between the developer and DebugSignal, with a
 * lightweight composer at the bottom. `onSend`/`onClear` are optional so
 * this renders fine as a static preview.
 */
export function Conversation({
  messages,
  onClear,
  onSend,
  inputPlaceholder = "You can also type a message…",
}: ConversationProps) {
  const [draft, setDraft] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setDraft("");
  };

  return (
    <section className="ds-card ds-conversation" aria-label="Conversation">
      <header className="ds-conversation-header">
        <h3 className="ds-card-title">Conversation</h3>
        <button type="button" className="ds-conversation-clear" onClick={onClear}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7M6 7l.7 12.2a1.5 1.5 0 0 0 1.5 1.4h7.6a1.5 1.5 0 0 0 1.5-1.4L18 7" />
          </svg>
          Clear
        </button>
      </header>

      <div className="ds-conversation-messages ds-scrollarea">
        {messages.map((m) => (
          <article key={m.id} className={`ds-message ds-message--${m.speaker}`}>
            <div className="ds-message-avatar" aria-hidden="true">
              {m.speaker === "assistant" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M4 15v-3a2 2 0 0 1 2-2M20 15v-3a2 2 0 0 0-2-2M4 15a2 2 0 0 0 2 2h1M20 15a2 2 0 0 1-2 2h-1M8 10V7a4 4 0 0 1 8 0v3" />
                  <rect x="7" y="17" width="10" height="3" rx="1.5" />
                </svg>
              ) : (
                m.authorName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="ds-message-body">
              <div className="ds-message-meta">
                <span className="ds-message-author">{m.authorName}</span>
                <span className="ds-message-time">{m.timestamp}</span>
              </div>
              <p className="ds-message-text">{m.text}</p>
            </div>
          </article>
        ))}
      </div>

      <form className="ds-conversation-composer" onSubmit={handleSubmit}>
        <span className="ds-conversation-mic" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </span>
        <input
          type="text"
          className="ds-conversation-input"
          placeholder={inputPlaceholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Type a message"
        />
        <button type="submit" className="ds-conversation-send" aria-label="Send message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12h15M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </section>
  );
}
