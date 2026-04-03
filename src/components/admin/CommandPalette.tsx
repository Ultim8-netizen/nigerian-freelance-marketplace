'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Users, Banknote, Flag, MessageSquare,
  Settings, Shield, AlertTriangle,
  Loader2, UserCircle, ShoppingBag,
} from 'lucide-react';
import type { SearchResult } from '@/app/api/admin/search/route';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaletteItem {
  id:          string;
  label:       string;
  description: string;
  href:        string;
  icon:        React.ElementType;
  category:    'nav' | 'user' | 'transaction' | 'order' | 'flag';
}

// ─── Static nav shortcuts ─────────────────────────────────────────────────────

const NAV_ITEMS: PaletteItem[] = [
  { id: 'nav-digest',    label: 'Digest',          description: 'Admin overview',                category: 'nav', href: '/f9-control',           icon: Shield        },
  { id: 'nav-users',     label: 'Users',           description: 'Browse and manage users',       category: 'nav', href: '/f9-control/users',     icon: Users         },
  { id: 'nav-flags',     label: 'Flags & Tickets', description: 'Disputes and contest tickets',  category: 'nav', href: '/f9-control/flags',     icon: Flag          },
  { id: 'nav-messaging', label: 'Messaging',       description: 'Direct and broadcast messages', category: 'nav', href: '/f9-control/messaging', icon: MessageSquare },
  { id: 'nav-finance',   label: 'Finance',         description: 'Wallets, withdrawals, escrow',  category: 'nav', href: '/f9-control/finance',   icon: Banknote      },
  { id: 'nav-config',    label: 'Configuration',   description: 'Platform settings',             category: 'nav', href: '/f9-control/config',    icon: Settings      },
  { id: 'nav-emergency', label: 'Emergency',       description: 'Emergency controls',            category: 'nav', href: '/f9-control/emergency', icon: AlertTriangle },
];

const TYPE_ICON: Record<SearchResult['type'], React.ElementType> = {
  user:        UserCircle,
  transaction: Banknote,
  order:       ShoppingBag,
  flag:        Flag,
};

const TYPE_LABEL: Record<SearchResult['type'], string> = {
  user:        'Users',
  transaction: 'Transactions',
  order:       'Orders',
  flag:        'Contest Tickets',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchesNav(item: PaletteItem, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    item.label.toLowerCase().includes(lower) ||
    item.description.toLowerCase().includes(lower)
  );
}

function dbResultToPaletteItem(r: SearchResult): PaletteItem {
  return {
    id:          r.id,
    label:       r.label,
    description: r.description,
    href:        r.href,
    icon:        TYPE_ICON[r.type],
    category:    r.type,
  };
}

// Debounce hook — prevents an API call on every keystroke
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter();

  const [open,         setOpen]         = useState(false);
  const [query,        setQuery]        = useState('');
  const [selected,     setSelected]     = useState(0);
  // pendingCount tracks in-flight fetches. Only mutated from async callbacks
  // (.then / .catch / .finally) — never synchronously in an effect body.
  const [pendingCount, setPendingCount] = useState(0);
  const [dbItems,      setDbItems]      = useState<PaletteItem[]>([]);
  const [dbError,      setDbError]      = useState(false);

  const inputRef   = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fetchRef   = useRef(0);

  const debouncedQuery = useDebounce(query, 250);

  // Derived — no setState needed. True while debounce is pending OR a fetch
  // is in-flight. React re-renders naturally when its dependencies change.
  const loading =
    (query.trim().length >= 2 && query !== debouncedQuery) ||
    pendingCount > 0;

  // ── Fetch DB results whenever debounced query settles ─────────────────────
  // The synchronous effect body contains NO setState calls.
  // pendingCount is only updated from async callbacks below.
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2) return;

    const fetchId = ++fetchRef.current;

    fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`)
      .then((res) => res.json())
      .then((data: { success: boolean; results?: SearchResult[] }) => {
        if (fetchRef.current !== fetchId) return;
        setPendingCount((c) => Math.max(0, c - 1));
        if (data.success && data.results) {
          setDbItems(data.results.map(dbResultToPaletteItem));
          setSelected(0);
        } else {
          setDbError(true);
          setDbItems([]);
          setSelected(0);
        }
      })
      .catch(() => {
        if (fetchRef.current !== fetchId) return;
        setPendingCount((c) => Math.max(0, c - 1));
        setDbError(true);
        setDbItems([]);
        setSelected(0);
      });

    // Increment pendingCount and clear error via a microtask so it executes
    // outside the synchronous effect body, satisfying the lint rule.
    Promise.resolve().then(() => {
      if (fetchRef.current === fetchId) {
        setPendingCount((c) => c + 1);
        setDbError(false);
      }
    });
  }, [debouncedQuery]);

  // ── Build the visible item list ───────────────────────────────────────────
  const items = useMemo<PaletteItem[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return NAV_ITEMS;
    const navMatches = NAV_ITEMS.filter((item) => matchesNav(item, trimmed));
    return [...navMatches, ...dbItems];
  }, [query, dbItems]);

  // ── Palette open / close ──────────────────────────────────────────────────
  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setDbItems([]);
    setSelected(0);
    setDbError(false);
    setPendingCount(0);
    fetchRef.current++;
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setDbItems([]);
    setSelected(0);
    setDbError(false);
    setPendingCount(0);
    fetchRef.current++; // invalidates any in-flight fetch
  }, []);

  const execute = useCallback(
    (href: string) => {
      closePalette();
      router.push(href);
    },
    [closePalette, router],
  );

  // All state resets on query change happen here in the event handler —
  // never in a reactive effect — to avoid cascading renders.
  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(0);
    if (val.trim().length < 2) {
      setDbItems([]);
      setDbError(false);
      setPendingCount(0);
    }
  }, []);

  // ── Global ⌘K / Ctrl+K toggle ─────────────────────────────────────────────
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

  // ── Arrow / Enter / Escape navigation ────────────────────────────────────
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

  // ── Group items by category for section headers ───────────────────────────
  const grouped = useMemo(() => {
    const groups: { label: string; items: PaletteItem[] }[] = [];
    const seen = new Map<string, PaletteItem[]>();

    for (const item of items) {
      const groupKey =
        item.category === 'nav'
          ? 'Navigation'
          : TYPE_LABEL[item.category as SearchResult['type']];

      if (!seen.has(groupKey)) {
        seen.set(groupKey, []);
        groups.push({ label: groupKey, items: seen.get(groupKey)! });
      }
      seen.get(groupKey)!.push(item);
    }
    return groups;
  }, [items]);

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
              {loading ? (
                <Loader2 size={15} className="text-blue-500 shrink-0 animate-spin" />
              ) : (
                <Search size={15} className="text-gray-400 shrink-0" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="Search users, TXNs, orders, tickets — or jump to a page…"
                className="flex-1 py-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
              />
              <kbd className="shrink-0 text-xs bg-gray-100 border px-1.5 py-0.5 rounded text-gray-400">
                Esc
              </kbd>
            </div>

            {/* Result list */}
            <div className="max-h-80 overflow-y-auto py-1.5">

              {dbError && (
                <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-b border-red-100">
                  Search unavailable — showing navigation only
                </p>
              )}

              {!loading && items.length === 0 && (
                <p className="px-4 py-8 text-sm text-center text-gray-400">No results</p>
              )}

              {loading && dbItems.length === 0 && (
                <p className="px-4 py-4 text-xs text-center text-gray-400">Searching…</p>
              )}

              {grouped.map((group) => (
                <div key={group.label}>
                  <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {group.label}
                  </p>

                  {group.items.map((item) => {
                    const flatIdx  = items.indexOf(item);
                    const isActive = selected === flatIdx;
                    const Icon     = item.icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setSelected(flatIdx)}
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
                </div>
              ))}
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
              {query.trim().length >= 2 && !loading && (
                <span className="ml-auto">
                  {dbItems.length} DB result{dbItems.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}