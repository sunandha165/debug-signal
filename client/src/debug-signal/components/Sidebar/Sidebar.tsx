import React from "react";
import type { NavItem } from "../../types";
import "./Sidebar.css";

export interface SidebarProps {
  items: NavItem[];
  onSelect?: (id: string) => void;
  quote?: { text: string; attribution: string };
}

const icons: Record<string, React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-7.5Z" />,
  repositories: <path d="M6 3.5h9a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-1.5 1.5H8A2.5 2.5 0 0 1 5.5 18V5.5A2 2 0 0 1 7.5 3.5H6Z" />,
  "debug-sessions": <path d="M12 3v3M12 3a5 5 0 0 1 5 5v1a5 5 0 0 1-10 0V8a5 5 0 0 1 5-5ZM4 12h3M17 12h3M6 18l2-2M18 18l-2-2" />,
  settings: <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a7.9 7.9 0 0 0-.15-1.5l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L14.5 3h-5l-.35 2.5a8 8 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.6A7.9 7.9 0 0 0 4 12a7.9 7.9 0 0 0 .15 1.5l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5L9.5 21.5h5l.35-2.5a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.6c.1-.5.15-1 .15-1.5Z" />,
};

/**
 * Product navigation rail. Presentational only — `onSelect` is provided so a
 * consuming app can wire up routing without this component knowing about it.
 */
export function Sidebar({ items, onSelect, quote }: SidebarProps) {
  return (
    <nav className="ds-sidebar" aria-label="Primary">
      <ul className="ds-sidebar-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`ds-sidebar-item${item.active ? " ds-sidebar-item--active" : ""}`}
              onClick={() => onSelect?.(item.id)}
              aria-current={item.active ? "page" : undefined}
            >
              <svg
                className="ds-sidebar-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {icons[item.id] ?? <circle cx="12" cy="12" r="8" />}
              </svg>
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      {quote && (
        <blockquote className="ds-sidebar-quote">
          <p>&ldquo;{quote.text}&rdquo;</p>
          <cite>— {quote.attribution}</cite>
        </blockquote>
      )}
    </nav>
  );
}
