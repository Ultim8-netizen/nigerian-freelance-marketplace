'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, ShieldAlert, Clock, ShieldCheck } from 'lucide-react';
import type { Tables } from '@/types';
import { useStepUpAuth } from '@/components/admin/StepUpAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Control {
  key:         string;
  label:       string;
  description: string;
  danger:      boolean;
  invertLogic?: boolean;
  enabled:     boolean;
}

type AuditRow = Pick<
  Tables<'admin_action_logs'>,
  'id' | 'action_type' | 'reason' | 'created_at' | 'admin_id'
>;

interface EmergencyClientProps {
  controls:              Control[];
  recentActions:         AuditRow[];
  /** Current value of platform_config[maintenance_mode].string_value */
  currentMaintenanceMsg: string;
  onToggle:              (fd: FormData) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dt(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

type FeedbackState = 'idle' | 'pending' | 'ok' | 'error';

// ─── Generic control card ─────────────────────────────────────────────────────

function ControlCard({
  control,
  onToggle,
  requireStepUp,
}: {
  control:       Control;
  onToggle:      (fd: FormData) => Promise<void>;
  requireStepUp: (action: () => Promise<void>) => Promise<void>;
}) {
  const [feedback, setFeedback]     = useState<FeedbackState>('idle');
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason]         = useState('');
  const [isPending, start]          = useTransition();

  const isAlarming = control.invertLogic ? !control.enabled : control.enabled;

  const handleToggleClick = () => {
    setConfirming(true);
    setFeedback('idle');
  };

  const handleConfirm = () => {
    const fd = new FormData();
    fd.set('key', control.key);
    fd.set('enabled', String(!control.enabled));
    if (reason) fd.set('reason', reason);

    setFeedback('pending');
    start(async () => {
      try {
        await requireStepUp(() => onToggle(fd));
        setFeedback('ok');
        setConfirming(false);
        setReason('');
        setTimeout(() => setFeedback('idle'), 2500);
      } catch {
        setFeedback('error');
      }
    });
  };

  return (
    <Card className={`p-5 border-l-4 ${
      isAlarming ? 'border-l-red-500' : 'border-l-green-500'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-900 text-sm">{control.label}</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isAlarming ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
              {isAlarming ? 'ACTIVE / ALARMING' : 'NORMAL'}
            </span>
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <ShieldCheck size={11} /> Step-Up
            </span>
          </div>
          <p className="text-xs text-gray-500">{control.description}</p>
        </div>

        <button
          type="button"
          onClick={handleToggleClick}
          disabled={isPending || confirming}
          aria-checked={control.enabled}
          role="switch"
          className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60 ${
            control.enabled ? 'bg-red-500' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            control.enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
          <span className="sr-only">{control.enabled ? 'Disable' : 'Enable'} {control.label}</span>
        </button>
      </div>

      {confirming && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-medium flex items-center gap-1.5">
            <ShieldAlert size={12} />
            Confirm: This will {control.enabled ? 'DISABLE' : 'ENABLE'}{' '}
            <strong>{control.label}</strong> for all users immediately.
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Reason (optional but recommended)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Suspicious activity detected, routine maintenance…"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded transition-colors"
            >
              {isPending && <Loader2 size={11} className="animate-spin" />}
              Confirm
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setReason(''); }}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded"
            >
              Cancel
            </button>
            {feedback === 'ok'    && <span className="text-xs text-green-600 font-medium">Applied ✓</span>}
            {feedback === 'error' && <span className="text-xs text-red-600 font-medium">Failed — try again</span>}
          </div>
        </div>
      )}

      {!confirming && feedback === 'ok' && (
        <p className="mt-2 text-xs text-green-600 font-medium">Applied ✓</p>
      )}
    </Card>
  );
}

// ─── Maintenance-specific control card ───────────────────────────────────────
//
// Identical to ControlCard except the confirmation panel includes a textarea
// for the custom maintenance message. On confirm, `maintenance_message` is
// appended to the FormData so the server action can write it to
// platform_config[maintenance_mode].string_value — which the maintenance page
// reads at render time.

function MaintenanceControlCard({
  control,
  currentMessage,
  onToggle,
  requireStepUp,
}: {
  control:        Control;
  currentMessage: string;
  onToggle:       (fd: FormData) => Promise<void>;
  requireStepUp:  (action: () => Promise<void>) => Promise<void>;
}) {
  const [feedback, setFeedback]             = useState<FeedbackState>('idle');
  const [confirming, setConfirming]         = useState(false);
  const [reason, setReason]                 = useState('');
  const [maintenanceMsg, setMaintenanceMsg] = useState(currentMessage);
  const [isPending, start]                  = useTransition();

  const isAlarming = control.enabled; // maintenance_mode has no invertLogic

  const handleToggleClick = () => {
    setConfirming(true);
    setFeedback('idle');
  };

  const handleConfirm = () => {
    const fd = new FormData();
    fd.set('key', control.key);                          // 'maintenance_mode'
    fd.set('enabled', String(!control.enabled));
    if (reason) fd.set('reason', reason);
    fd.set('maintenance_message', maintenanceMsg.trim()); // consumed by server action

    setFeedback('pending');
    start(async () => {
      try {
        await requireStepUp(() => onToggle(fd));
        setFeedback('ok');
        setConfirming(false);
        setReason('');
        setTimeout(() => setFeedback('idle'), 2500);
      } catch {
        setFeedback('error');
      }
    });
  };

  return (
    <Card className={`p-5 border-l-4 ${
      isAlarming ? 'border-l-red-500' : 'border-l-green-500'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-900 text-sm">{control.label}</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isAlarming ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
              {isAlarming ? 'ACTIVE / ALARMING' : 'NORMAL'}
            </span>
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <ShieldCheck size={11} /> Step-Up
            </span>
          </div>
          <p className="text-xs text-gray-500">{control.description}</p>
          {/* Live preview of the current message when maintenance is active */}
          {control.enabled && currentMessage && (
            <p className="mt-1.5 text-xs text-red-600 italic truncate max-w-xs">
              Showing: &ldquo;{currentMessage}&rdquo;
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggleClick}
          disabled={isPending || confirming}
          aria-checked={control.enabled}
          role="switch"
          className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60 ${
            control.enabled ? 'bg-red-500' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            control.enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
          <span className="sr-only">
            {control.enabled ? 'Disable' : 'Enable'} {control.label}
          </span>
        </button>
      </div>

      {confirming && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-medium flex items-center gap-1.5">
            <ShieldAlert size={12} />
            Confirm: This will {control.enabled ? 'DISABLE' : 'ENABLE'}{' '}
            <strong>{control.label}</strong> for all users immediately.
          </div>

          {/* ── Custom maintenance message field ──────────────────────────── */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Custom maintenance message{' '}
              <span className="text-gray-400 font-normal">
                (shown to users on /maintenance)
              </span>
            </label>
            <textarea
              rows={3}
              value={maintenanceMsg}
              onChange={(e) => setMaintenanceMsg(e.target.value)}
              placeholder="e.g. We're upgrading the payment system. Back in ~2 hours."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              Leave blank to show the default message.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Reason (optional but recommended)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Suspicious activity detected, routine maintenance…"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded transition-colors"
            >
              {isPending && <Loader2 size={11} className="animate-spin" />}
              Confirm
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setReason(''); }}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded"
            >
              Cancel
            </button>
            {feedback === 'ok'    && <span className="text-xs text-green-600 font-medium">Applied ✓</span>}
            {feedback === 'error' && <span className="text-xs text-red-600 font-medium">Failed — try again</span>}
          </div>
        </div>
      )}

      {!confirming && feedback === 'ok' && (
        <p className="mt-2 text-xs text-green-600 font-medium">Applied ✓</p>
      )}
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EmergencyClient({
  controls,
  recentActions,
  currentMaintenanceMsg,
  onToggle,
}: EmergencyClientProps) {
  const { requireStepUp, StepUpModal } = useStepUpAuth();

  return (
    <div className="space-y-8">
      {StepUpModal}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {controls.map((c) =>
          c.key === 'maintenance_mode' ? (
            <MaintenanceControlCard
              key={c.key}
              control={c}
              currentMessage={currentMaintenanceMsg}
              onToggle={onToggle}
              requireStepUp={requireStepUp}
            />
          ) : (
            <ControlCard
              key={c.key}
              control={c}
              onToggle={onToggle}
              requireStepUp={requireStepUp}
            />
          )
        )}
      </div>

      {/* Audit trail */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={15} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Emergency Action Log
          </h3>
        </div>

        {recentActions.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No emergency actions recorded.</p>
        ) : (
          <ul className="space-y-2">
            {recentActions.map((a) => (
              <li key={a.id} className="flex items-start justify-between py-2 border-b border-gray-100 text-sm gap-4">
                <div className="min-w-0">
                  <p className="text-gray-800">{a.reason ?? a.action_type}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    admin: {a.admin_id?.slice(0, 8)}…
                  </p>
                </div>
                <p className="text-xs text-gray-400 shrink-0">{dt(a.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}