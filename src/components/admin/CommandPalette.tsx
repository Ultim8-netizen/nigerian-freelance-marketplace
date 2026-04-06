'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Users, Banknote, Flag, MessageSquare,
  Settings, Shield, AlertTriangle,
  Loader2, UserCircle, ShoppingBag,
  ShieldAlert, Lock, LockOpen, UserX, UserCheck2,
  ChevronRight, CheckCircle2, XCircle, ArrowLeft,
} from 'lucide-react';
import type { SearchResult } from '@/app/api/admin/search/route';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaletteItem {
  id:          string;
  label:       string;
  description: string;
  href:        string;
  icon:        React.ElementType;
  category:    'nav' | 'action' | 'user' | 'transaction' | 'order' | 'flag';
}

// An action that requires a user target before executing.
// requiresUser: true  → phase switches to 'user_target' on selection.
// requiresUser: false → executes immediately (navigation or parameterless mutation).
type ActionDef =
  | {
      id:          string;
      label:       string;
      description: string;
      icon:        React.ElementType;
      keywords:    string[];
      requiresUser: true;
      apiAction:   string; // sent as `action` in POST /api/admin/actions body
    }
  | {
      id:          string;
      label:       string;
      description: string;
      icon:        React.ElementType;
      keywords:    string[];
      requiresUser: false;
      href:        string;
    };

type Phase = 'search' | 'user_target';
type ActionStatus = 'idle' | 'executing' | 'success' | 'error';

// ─── Static definitions ───────────────────────────────────────────────────────

const NAV_ITEMS: PaletteItem[] = [
  { id: 'nav-digest',    label: 'Digest',          description: 'Admin overview',                category: 'nav', href: '/f9-control',           icon: Shield        },
  { id: 'nav-users',     label: 'Users',           description: 'Browse and manage users',       category: 'nav', href: '/f9-control/users',     icon: Users         },
  { id: 'nav-flags',     label: 'Flags & Tickets', description: 'Disputes and contest tickets',  category: 'nav', href: '/f9-control/flags',     icon: Flag          },
  { id: 'nav-messaging', label: 'Messaging',       description: 'Direct and broadcast messages', category: 'nav', href: '/f9-control/messaging', icon: MessageSquare },
  { id: 'nav-finance',   label: 'Finance',         description: 'Wallets, withdrawals, escrow',  category: 'nav', href: '/f9-control/finance',   icon: Banknote      },
  { id: 'nav-config',    label: 'Configuration',   description: 'Platform settings',             category: 'nav', href: '/f9-control/config',    icon: Settings      },
  { id: 'nav-emergency', label: 'Emergency',       description: 'Emergency controls',            category: 'nav', href: '/f9-control/emergency', icon: AlertTriangle },
];

// All executable actions. Keywords are matched case-insensitively against the
// current query so the admin can type natural phrases like "warn", "freeze wallet",
// "suspend", "reinstate" and see the right action surface immediately.
const ACTIONS: ActionDef[] = [
  {
    id:          'action-warn',
    label:       'Warn User',
    description: 'Issue a Level 1 Advisory notice to a user',
    icon:        ShieldAlert,
    keywords:    ['warn', 'advisory', 'level 1', 'notice'],
    requiresUser: true,
    apiAction:   'warn_user',
  },
  {
    id:          'action-freeze',
    label:       'Freeze Wallet',
    description: 'Freeze a user\'s wallet — blocks withdrawals, account stays active',
    icon:        Lock,
    keywords:    ['freeze', 'wallet', 'lock', 'block withdrawal'],
    requiresUser: true,
    apiAction:   'freeze_wallet',
  },
  {
    id:          'action-unfreeze',
    label:       'Unfreeze Wallet',
    description: 'Lift a wallet freeze and restore normal transaction ability',
    icon:        LockOpen,
    keywords:    ['unfreeze', 'unlock', 'wallet', 'restore'],
    requiresUser: true,
    apiAction:   'unfreeze_wallet',
  },
  {
    id:          'action-suspend',
    label:       'Suspend User',
    description: 'Set account status to suspended',
    icon:        UserX,
    keywords:    ['suspend', 'ban', 'deactivate', 'disable'],
    requiresUser: true,
    apiAction:   'suspend_user',
  },
  {
    id:          'action-unsuspend',
    label:       'Unsuspend User',
    description: 'Reinstate a suspended account to active status',
    icon:        UserCheck2,
    keywords:    ['unsuspend', 'reinstate', 'reactivate', 'lift', 'unban'],
    requiresUser: true,
    apiAction:   'unsuspend_user',
  },
  {
    id:          'action-broadcast',
    label:       'New Broadcast',
    description: 'Compose and send a broadcast message to a user segment',
    icon:        MessageSquare,
    keywords:    ['broadcast', 'announce', 'message all', 'bulk message', 'segment'],
    requiresUser: false,
    href:        '/f9-control/messaging',
  },
  {
    id:          'action-direct',
    label:       'Send Direct Message',
    description: 'Send a direct notification to a specific user',
    icon:        MessageSquare,
    keywords:    ['direct message', 'dm', 'notify user', 'send message'],
    requiresUser: false,
    href:        '/f9-control/messaging',
  },
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

function matchesKeywords(action: ActionDef, q: string): boolean {
  const lower = q.toLowerCase();
  return action.keywords.some((kw) => kw.includes(lower) || lower.includes(kw.split(' ')[0]));
}

function matchesNav(item: PaletteItem, q: string): boolean {
  const lower = q.toLowerCase();
  return item.label.toLowerCase().includes(lower) || item.description.toLowerCase().includes(lower);
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

function actionToPaletteItem(a: ActionDef): PaletteItem {
  return {
    id:          a.id,
    label:       a.label,
    description: a.description,
    href:        '',    // never used for actions; execution path is separate
    icon:        a.icon,
    category:    'action',
  };
}

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

  // ── Core open/query state ─────────────────────────────────────────────────
  const [open,         setOpen]         = useState(false);
  const [query,        setQuery]        = useState('');
  const [selected,     setSelected]     = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [dbItems,      setDbItems]      = useState<PaletteItem[]>([]);
  const [dbError,      setDbError]      = useState(false);

  // ── Two-phase action state ────────────────────────────────────────────────
  // phase='search'      — normal mode (nav + actions + DB results)
  // phase='user_target' — an action requiring a user was selected; query now
  //                       searches profiles only; DB results filtered to users
  const [phase,         setPhase]         = useState<Phase>('search');
  const [pendingAction, setPendingAction] = useState<ActionDef | null>(null);
  const [actionStatus,  setActionStatus]  = useState<ActionStatus>('idle');
  const [actionMessage, setActionMessage] = useState<string>('');

  const inputRef   = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fetchRef   = useRef(0);

  const debouncedQuery = useDebounce(query, 250);

  const loading =
    (query.trim().length >= 2 && query !== debouncedQuery) ||
    pendingCount > 0;

  // ── Fetch DB results ──────────────────────────────────────────────────────
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
          // In user_target phase only surface user results so the admin is
          // picking a target, not navigating to orders or transactions.
          const filtered = phase === 'user_target'
            ? data.results.filter((r) => r.type === 'user')
            : data.results;
          setDbItems(filtered.map(dbResultToPaletteItem));
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

    Promise.resolve().then(() => {
      if (fetchRef.current === fetchId) {
        setPendingCount((c) => c + 1);
        setDbError(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);
  // `phase` deliberately excluded — we don't want to re-fetch on phase change,
  // only re-filter. Re-filtering happens inside the fetch callback above.

  // ── Build visible item list ───────────────────────────────────────────────
  const items = useMemo<PaletteItem[]>(() => {
    const trimmed = query.trim();

    if (phase === 'user_target') {
      // Only user results from DB search; no nav or action items.
      return dbItems;
    }

    if (!trimmed) {
      // Empty query: show nav shortcuts + all actions as a quick-reference list.
      return [
        ...NAV_ITEMS,
        ...ACTIONS.map(actionToPaletteItem),
      ];
    }

    const navMatches    = NAV_ITEMS.filter((item) => matchesNav(item, trimmed));
    const actionMatches = ACTIONS
      .filter((a) => matchesKeywords(a, trimmed))
      .map(actionToPaletteItem);

    return [...navMatches, ...actionMatches, ...dbItems];
  }, [query, dbItems, phase]);

  // ── Reset helpers ─────────────────────────────────────────────────────────
  const resetToSearch = useCallback(() => {
    setPhase('search');
    setPendingAction(null);
    setActionStatus('idle');
    setActionMessage('');
    setQuery('');
    setDbItems([]);
    setSelected(0);
    setDbError(false);
    setPendingCount(0);
    fetchRef.current++;
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
    resetToSearch();
  }, [resetToSearch]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setPhase('search');
    setPendingAction(null);
    setActionStatus('idle');
    setActionMessage('');
    setQuery('');
    setDbItems([]);
    setSelected(0);
    setDbError(false);
    setPendingCount(0);
    fetchRef.current++;
  }, []);

  // ── Execute: handles both nav items and action items ──────────────────────
  const execute = useCallback(
    async (item: PaletteItem) => {
      if (item.category !== 'action') {
        // Normal navigation item — just push.
        closePalette();
        router.push(item.href);
        return;
      }

      // Find the ActionDef that corresponds to this palette item.
      const actionDef = ACTIONS.find((a) => a.id === item.id);
      if (!actionDef) return;

      if (!actionDef.requiresUser) {
        // Standalone action — navigate immediately.
        closePalette();
        router.push(actionDef.href);
        return;
      }

      if (phase === 'search') {
        // First phase: action selected, switch to user-target mode.
        setPendingAction(actionDef);
        setPhase('user_target');
        setQuery('');
        setDbItems([]);
        setSelected(0);
        fetchRef.current++;
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }

      // Should not reach here — user items are handled via executeUserTarget.
    },
    [closePalette, router, phase],
  );

  // ── Execute once a target user has been selected in user_target phase ─────
  const executeUserTarget = useCallback(
    async (userItem: PaletteItem) => {
      if (!pendingAction || !pendingAction.requiresUser) return;

      // Extract the raw user UUID from the prefixed palette item id (e.g. "user-<uuid>").
      const targetUserId = userItem.id.replace(/^user-/, '');

      setActionStatus('executing');

      try {
        const res  = await fetch('/api/admin/actions', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            action:         pendingAction.apiAction,
            target_user_id: targetUserId,
          }),
        });
        const data = await res.json() as { success: boolean; message?: string; error?: string };

        if (!res.ok || !data.success) {
          setActionStatus('error');
          setActionMessage(data.error ?? 'Action failed');
        } else {
          setActionStatus('success');
          setActionMessage(data.message ?? 'Done');
          // Auto-close after a short success display so the admin sees confirmation.
          setTimeout(() => closePalette(), 1400);
        }
      } catch {
        setActionStatus('error');
        setActionMessage('Network error — action may not have completed');
      }
    },
    [pendingAction, closePalette],
  );

  const handleItemSelect = useCallback(
    (item: PaletteItem) => {
      if (phase === 'user_target') {
        void executeUserTarget(item);
      } else {
        void execute(item);
      }
    },
    [phase, execute, executeUserTarget],
  );

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

  // ── Global ⌘K / Ctrl+K ───────────────────────────────────────────────────
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

  // ── Arrow / Enter / Escape ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKeydown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          // In user_target phase: first Escape goes back to search, not close.
          // In executing/success/error states: Escape always closes.
          if (phase === 'user_target' && actionStatus === 'idle') {
            e.preventDefault();
            resetToSearch();
          } else {
            closePalette();
          }
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
          if (actionStatus === 'idle' && items[selected]) {
            handleItemSelect(items[selected]);
          }
          break;
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [open, items, selected, phase, actionStatus, handleItemSelect, closePalette, resetToSearch]);

  // ── Group items for display ───────────────────────────────────────────────
  const grouped = useMemo(() => {
    const groups: { label: string; items: PaletteItem[] }[] = [];
    const seen = new Map<string, PaletteItem[]>();

    for (const item of items) {
      const groupKey =
        item.category === 'nav'    ? 'Navigation'   :
        item.category === 'action' ? 'Actions'      :
        TYPE_LABEL[item.category as SearchResult['type']];

      if (!seen.has(groupKey)) {
        seen.set(groupKey, []);
        groups.push({ label: groupKey, items: seen.get(groupKey)! });
      }
      seen.get(groupKey)!.push(item);
    }
    return groups;
  }, [items]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Header trigger ─────────────────────────────────────────────── */}
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

      {/* ── Palette modal ───────────────────────────────────────────────── */}
      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40"
          onMouseDown={(e) => {
            if (e.target === overlayRef.current) closePalette();
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden border border-gray-200">

            {/* ── Phase breadcrumb (user_target only) ── */}
            {phase === 'user_target' && pendingAction && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
                <button
                  type="button"
                  onClick={resetToSearch}
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  <ArrowLeft size={11} />
                  Back
                </button>
                <ChevronRight size={11} className="text-blue-400" />
                <span className="font-semibold">{pendingAction.label}</span>
                <ChevronRight size={11} className="text-blue-400" />
                <span>Select target user</span>
              </div>
            )}

            {/* ── Executing / success / error overlay ── */}
            {actionStatus !== 'idle' && (
              <div className={`flex items-center gap-3 px-4 py-3 text-sm font-medium border-b ${
                actionStatus === 'executing' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                actionStatus === 'success'   ? 'bg-green-50 border-green-100 text-green-700' :
                                               'bg-red-50 border-red-100 text-red-700'
              }`}>
                {actionStatus === 'executing' && <Loader2 size={14} className="shrink-0 animate-spin" />}
                {actionStatus === 'success'   && <CheckCircle2 size={14} className="shrink-0" />}
                {actionStatus === 'error'     && <XCircle size={14} className="shrink-0" />}
                <span>{
                  actionStatus === 'executing' ? 'Executing…' : actionMessage
                }</span>
                {actionStatus === 'error' && (
                  <button
                    type="button"
                    onClick={resetToSearch}
                    className="ml-auto text-xs underline hover:no-underline"
                  >
                    Try again
                  </button>
                )}
              </div>
            )}

            {/* ── Search input ── */}
            {actionStatus === 'idle' && (
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
                  placeholder={
                    phase === 'user_target'
                      ? 'Search by name or email…'
                      : 'Search users, TXNs, orders — or type an action (warn, freeze, suspend)…'
                  }
                  className="flex-1 py-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
                />
                <kbd className="shrink-0 text-xs bg-gray-100 border px-1.5 py-0.5 rounded text-gray-400">
                  {phase === 'user_target' ? 'Esc to go back' : 'Esc'}
                </kbd>
              </div>
            )}

            {/* ── Result list ── */}
            {actionStatus === 'idle' && (
              <div className="max-h-80 overflow-y-auto py-1.5">

                {dbError && (
                  <p className="px-4 py-2 text-xs text-red-500 bg-red-50 border-b border-red-100">
                    Search unavailable — showing navigation only
                  </p>
                )}

                {!loading && items.length === 0 && (
                  <p className="px-4 py-8 text-sm text-center text-gray-400">
                    {phase === 'user_target' ? 'No users found — try a different name or email' : 'No results'}
                  </p>
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
                      const isAction = item.category === 'action';

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setSelected(flatIdx)}
                          onClick={() => handleItemSelect(item)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isActive
                              ? isAction ? 'bg-amber-50' : 'bg-blue-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <Icon
                            size={15}
                            className={
                              isActive
                                ? isAction ? 'text-amber-600 shrink-0' : 'text-blue-600 shrink-0'
                                : 'text-gray-400 shrink-0'
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate ${
                              isActive
                                ? isAction ? 'text-amber-700' : 'text-blue-700'
                                : 'text-gray-800'
                            }`}>
                              {item.label}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{item.description}</p>
                          </div>

                          {/* Right-side affordance */}
                          {isActive && isAction && (
                            // Action items show what pressing Enter will do
                            <span className={`shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
                              phase === 'user_target'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {phase === 'user_target' ? 'Execute' : 'Select user →'}
                            </span>
                          )}
                          {isActive && !isAction && (
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
            )}

            {/* ── Footer ── */}
            <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
              <span>
                <kbd className="bg-gray-100 border rounded px-1 mr-1">↑</kbd>
                <kbd className="bg-gray-100 border rounded px-1">↓</kbd>
                {' '}navigate
              </span>
              <span><kbd className="bg-gray-100 border rounded px-1">↵</kbd> select</span>
              <span>
                <kbd className="bg-gray-100 border rounded px-1">Esc</kbd>
                {' '}{phase === 'user_target' ? 'back' : 'close'}
              </span>
              {query.trim().length >= 2 && !loading && phase === 'search' && (
                <span className="ml-auto">
                  {dbItems.length} DB result{dbItems.length !== 1 ? 's' : ''}
                </span>
              )}
              {phase === 'user_target' && (
                <span className="ml-auto text-amber-600 font-medium">
                  ↵ to execute · Esc to cancel
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}