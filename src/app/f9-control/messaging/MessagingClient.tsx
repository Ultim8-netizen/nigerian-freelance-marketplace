'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle, Send, Inbox, Clock, FileText, Radio } from 'lucide-react';
import type { Tables } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type InboxRow = Pick<Tables<'notifications'>, 'id' | 'type' | 'title' | 'message' | 'is_read' | 'created_at'>;
type SentRow  = Pick<Tables<'admin_action_logs'>, 'id' | 'action_type' | 'reason' | 'created_at' | 'target_user_id'>;

interface MessagingClientProps {
  inbox:           InboxRow[];
  sentLog:         SentRow[];
  onSendDirect:    (fd: FormData) => Promise<void>;
  onSendBroadcast: (fd: FormData) => Promise<void>;
}

// ─── Notification type options (must exist in notifications.type) ─────────────

const NOTIF_TYPES = [
  'admin_warning',
  'level_1_advisory',
  'general_announcement',
  'account_update',
  'platform_notice',
];

const AUDIENCES = [
  { value: 'all',        label: 'All active users' },
  { value: 'freelancer', label: 'Freelancers only' },
  { value: 'client',     label: 'Clients only' },
  { value: 'both',       label: 'Dual-role users' },
];

// ─── Templates ───────────────────────────────────────────────────────────────
// Hardcoded — no template table in schema. Clicking a template populates the form.

const TEMPLATES = [
  {
    id: 'maintenance',
    label: 'Scheduled Maintenance',
    type: 'platform_notice',
    title: 'Scheduled Platform Maintenance',
    message: 'F9 will undergo scheduled maintenance on [DATE] from [TIME] to [TIME] WAT. Services may be temporarily unavailable. We apologise for any inconvenience.',
  },
  {
    id: 'policy_update',
    label: 'Policy Update',
    type: 'platform_notice',
    title: 'Important Policy Update',
    message: 'We have updated our Terms of Service and Marketplace Guidelines effective [DATE]. Please review the changes at [LINK].',
  },
  {
    id: 'trust_reminder',
    label: 'Trust Score Reminder',
    type: 'level_1_advisory',
    title: 'Action Required: Trust Score',
    message: 'Your trust score has fallen below the threshold required for certain platform features. Please review the guidelines and complete any pending verification steps.',
  },
  {
    id: 'promo',
    label: 'Promotional Broadcast',
    type: 'general_announcement',
    title: 'Exciting News from F9',
    message: 'We are thrilled to announce [ANNOUNCEMENT]. Log in now to take advantage of this update.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dt(s: string | null) {
  if (!s) return 'N/A';
  return new Date(s).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

type FeedbackState = 'idle' | 'pending' | 'ok' | 'error';

// ─── Compose Tab ─────────────────────────────────────────────────────────────

function ComposeTab({
  onSendDirect,
  onSendBroadcast,
  seed,
}: {
  onSendDirect:    (fd: FormData) => Promise<void>;
  onSendBroadcast: (fd: FormData) => Promise<void>;
  seed: { type: string; title: string; message: string } | null;
}) {
  const [mode, setMode]       = useState<'direct' | 'broadcast'>('direct');
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [isPending, start]    = useTransition();

  // Form fields — kept in state so templates can populate them
  const [type,    setType]    = useState(seed?.type    ?? NOTIF_TYPES[0]);
  const [title,   setTitle]   = useState(seed?.title   ?? '');
  const [message, setMessage] = useState(seed?.message ?? '');
  const [link,    setLink]    = useState('');
  const [recipient, setRecipient] = useState('');
  const [audience,  setAudience]  = useState('all');

  // Re-populate when a template seed is provided from the parent
  const applyTemplate = (t: typeof TEMPLATES[number]) => {
    setType(t.type);
    setTitle(t.title);
    setMessage(t.message);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const action = mode === 'direct' ? onSendDirect : onSendBroadcast;
    setFeedback('pending');
    start(async () => {
      try {
        await action(fd);
        setFeedback('ok');
        setTitle(''); setMessage(''); setLink(''); setRecipient('');
        setTimeout(() => setFeedback('idle'), 3000);
      } catch (err) {
        console.error(err);
        setFeedback('error');
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex gap-2">
        {(['direct', 'broadcast'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === m
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {m === 'direct' ? <Send size={14} /> : <Radio size={14} />}
            {m === 'direct' ? 'Direct Message' : 'Broadcast'}
          </button>
        ))}
      </div>

      {mode === 'broadcast' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
          ⚠ Broadcast sends to up to 500 active users. This action is logged and irreversible.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Recipient / audience */}
        {mode === 'direct' ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Recipient Email</label>
            <input
              name="recipient_email"
              type="email"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Audience</label>
            <select
              name="audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notification Type</label>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {NOTIF_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
          <input
            name="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
          <textarea
            name="message"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Notification body text…"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Optional link */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Link (optional)</label>
          <input
            name="link"
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/some/page"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} />}
            {mode === 'direct' ? 'Send Message' : 'Broadcast Now'}
          </button>

          {feedback === 'ok' && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle size={12} /> Sent successfully
            </span>
          )}
          {feedback === 'error' && (
            <span className="text-xs text-red-600 font-medium">Failed — check recipient and try again</span>
          )}
        </div>
      </form>

      {/* Quick-apply templates */}
      <div className="pt-4 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Quick-fill from Template</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 rounded-lg transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Inbox Tab ────────────────────────────────────────────────────────────────

function InboxTab({ inbox }: { inbox: InboxRow[] }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">Notifications received by your admin account.</p>
      {inbox.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Inbox is empty.</p>
      ) : (
        <ul className="space-y-2">
          {inbox.map((n) => (
            <li
              key={n.id}
              className={`p-3 rounded-lg border text-sm ${
                n.is_read ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{n.title}</p>
                  <p className="text-gray-600 mt-0.5">{n.message}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {n.type.replace(/_/g, ' ')}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">{dt(n.created_at)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Broadcast History Tab ────────────────────────────────────────────────────

function BroadcastHistoryTab({ sentLog }: { sentLog: SentRow[] }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        All direct messages and broadcasts sent by admin accounts, from <code className="bg-gray-100 px-1 rounded">admin_action_logs</code>.
      </p>
      {sentLog.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No sent messages.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50">
              <tr>
                {['Type', 'Details', 'Recipient', 'Sent At'].map((h) => (
                  <th key={h} className="px-4 py-2 text-xs font-medium text-gray-500 border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sentLog.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      log.action_type === 'broadcast'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {log.action_type === 'broadcast' ? 'Broadcast' : 'Direct'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700 max-w-xs truncate">{log.reason ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 font-mono">
                    {log.target_user_id ? log.target_user_id.slice(0, 8) + '…' : 'All / Filtered'}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">{dt(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Templates Tab ───────────────────────────────────────────────────────────

function TemplatesTab({ onUse }: { onUse: (t: typeof TEMPLATES[number]) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Click <strong>Use Template</strong> to pre-fill the Compose form.
      </p>
      {TEMPLATES.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{t.label}</p>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">{t.type}</p>
              <p className="text-sm text-gray-700 mt-1.5 line-clamp-2">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onUse(t)}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Use Template
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'compose',   label: 'Compose',           icon: Send      },
  { id: 'inbox',     label: 'Inbox',             icon: Inbox     },
  { id: 'history',   label: 'Broadcast History', icon: Clock     },
  { id: 'templates', label: 'Templates',         icon: FileText  },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function MessagingClient({
  inbox,
  sentLog,
  onSendDirect,
  onSendBroadcast,
}: MessagingClientProps) {
  const [active, setActive] = useState<TabId>('compose');
  // When "Use Template" is clicked on the Templates tab, we switch to Compose
  // and seed the form fields
  const [templateSeed, setTemplateSeed] = useState<typeof TEMPLATES[number] | null>(null);

  const handleUseTemplate = (t: typeof TEMPLATES[number]) => {
    setTemplateSeed(t);
    setActive('compose');
  };

  return (
    <Card className="overflow-hidden">
      {/* Tab nav */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`shrink-0 flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors ${
              active === id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {active === 'compose' && (
          <ComposeTab
            onSendDirect={onSendDirect}
            onSendBroadcast={onSendBroadcast}
            seed={templateSeed}
          />
        )}
        {active === 'inbox'     && <InboxTab inbox={inbox} />}
        {active === 'history'   && <BroadcastHistoryTab sentLog={sentLog} />}
        {active === 'templates' && <TemplatesTab onUse={handleUseTemplate} />}
      </div>
    </Card>
  );
}