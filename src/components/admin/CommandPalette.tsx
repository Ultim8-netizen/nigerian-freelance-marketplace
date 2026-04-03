'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Users, Banknote, Flag, MessageSquare,
  Settings, Shield, AlertTriangle, User, Package,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandItem {
  id:          string;
  label:       string;
  description: string;
  href:        string;
  icon:        React.ElementType;
  category:    'nav' | 'search';
}

// ─── Static nav shortcuts ─────────────────────────────────────────────────────

const NAV_ITEMS: CommandItem[] = [
  { id: 'nav-digest',    label: 'Digest',          description: 'Admin overview',                category: 'nav', href: '/f9-control',           icon: Shield        },
  { id: 'nav-users',     label: 'Users',           description: 'Browse and manage users',       category: 'nav', href: '/f9-control/users',     icon: Users         },
  { id: 'nav-flags',     label: 'Flags & Tickets', description: 'Disputes and contest tickets',  category: 'nav', href: '/f9-control/flags',     icon: Flag          },
  { id: 'nav-messaging', label: 'Messaging',       description: 'Direct and broadcast messages', category: 'nav', href: '/f9-control/messaging', icon: MessageSquare },
  { id: 'nav-finance',   label: 'Finance',         description: 'Wallets, withdrawals, escrow',  category: 'nav', href: '/f9-control/finance',   icon: Banknote      },
  { id: 'nav-config',    label: 'Configuration',   description: 'Platform settings',             category: 'nav', href: '/f9-control/config',    icon: Settings      },
  { id: 'nav-emergency', label: 'Emergency',       description: 'Emergency controls',            category: 'nav', href: '/f9-control/emergency', icon: AlertTriangle },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSearchItems(query: string): CommandItem[] {
  const q = encodeURIComponent(query.trim());
  return [
    {
      id:          'search-users',
      label:       `Search users for "${query}"`,
      description: 'Filter by name, email, or user ID',
      category:    'search',
      href:        `/f9-control/users?search=${q}`,
      icon:        User,
    },
    {
      id:          'search-txns',
      label:       `Search transactions for "${query}"`,
      description: 'Filter by transaction ID or reference',
      category:    'search',
      href:        `/f9-control/finance?search=${q}`,
      icon:        Banknote,
    },
    {
      id:          'search-orders',
      label:       `Search orders for "${query}"`,
      description: 'Filter by order ID or client name',
      category:    'search',
      href:        `/f9-control/finance/orders?search=${q}`,
      icon:        Package,
    },
  ];
}

function matchesQuery(item: CommandItem, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    item.label.toLowerCase().includes(lower) ||
    item.description.toLowerCase().includes(lower)
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter();

  const [open,     setOpen]     = useState(false);
  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState(0);

  const inputRef   = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Stable derived list — useMemo prevents a new array reference on every render,
  // which would otherwise cause the keyboard-navigation effect to re-subscribe
  // on every keystroke (exhaustive-deps warning on items).
  const items = useMemo<CommandItem[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return NAV_ITEMS;
    return [
      ...NAV_ITEMS.filter((item) => matchesQuery(item, trimmed)),
      ...buildSearchItems(trimmed),
    ];
  }, [query]);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setSelected(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelected(0);
  }, []);

  const execute = useCallback(
    (href: string) => {
      closePalette();
      router.push(href);
    },
    [closePalette, router],
  );

  // Reset selection in the onChange handler — not in an effect — to avoid
  // the cascading-render pattern flagged by react-hooks/set-state-in-effect.
  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelected(0);
  }, []);

  // ⌘K / Ctrl+K — global toggle
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) closePalette(); else openPalette();
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [open, openPalette, closePalette]);

  // Arrow / Enter / Escape navigation inside the palette
  useEffect(() => {
    if (!open) return;
    const onKeydown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closePalette();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelected((s) => Math.min(s + 1, items.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelected((s) => Math.max(s - 1, 0));
          break;
        case 'Enter':
          if (items[selected]) execute(items[selected].href);
          break;
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [open, items, selected, execute, closePalette]);

  return (
    <>
      {/* ── Header trigger ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Open command palette"
        onClick={openPalette}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPalette(); }}
        className="flex items-center w-full max-w-xl relative cursor-pointer"
      >
        <kbd className="absolute left-3 text-xs bg-gray-100 border px-1.5 rounded text-gray-500 pointer-events-none">
          ⌘K
        </kbd>
        <input
          readOnly
          type="text"
          placeholder="Global Search (Users, TXNs, Orders)..."
          className="w-full pl-12 pr-4 py-2 bg-gray-50 border-transparent rounded-lg text-sm cursor-pointer select-none focus:outline-none"
        />
      </div>

      {/* ── Palette modal ── */}
      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40"
          onMouseDown={(e) => {
            if (e.target === overlayRef.current) closePalette();
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden border border-gray-200">

            {/* Search input row */}
            <div className="flex items-center gap-2 px-4 border-b border-gray-100">
              <Search size={15} className="text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="Search users, TXNs, orders — or jump to a page…"
                className="flex-1 py-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
              />
              <kbd className="shrink-0 text-xs bg-gray-100 border px-1.5 py-0.5 rounded text-gray-400">
                Esc
              </kbd>
            </div>

            {/* Result list */}
            <div className="max-h-80 overflow-y-auto py-1.5">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-sm text-center text-gray-400">No results</p>
              ) : (
                <>
                  <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {query.trim() ? 'Results' : 'Navigation'}
                  </p>

                  {items.map((item, i) => {
                    const Icon     = item.icon;
                    const isActive = selected === i;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setSelected(i)}
                        onClick={() => execute(item.href)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <Icon
                          size={15}
                          className={isActive ? 'text-blue-600 shrink-0' : 'text-gray-400 shrink-0'}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                            {item.label}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{item.description}</p>
                        </div>
                        {isActive && (
                          <kbd className="shrink-0 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                            ↵
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer key-hints */}
            <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
              <span>
                <kbd className="bg-gray-100 border rounded px-1 mr-1">↑</kbd>
                <kbd className="bg-gray-100 border rounded px-1">↓</kbd>
                {' '}navigate
              </span>
              <span><kbd className="bg-gray-100 border rounded px-1">↵</kbd> select</span>
              <span><kbd className="bg-gray-100 border rounded px-1">Esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}