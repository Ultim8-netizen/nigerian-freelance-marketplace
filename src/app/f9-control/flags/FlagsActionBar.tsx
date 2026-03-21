'use client';

/**
 * FlagsActionBar — per-row client action buttons for the Flags & Tickets page.
 *
 * Exists as a Client Component solely so each button can maintain its own
 * pending/feedback state without making the whole page a client component.
 * Server Actions are passed in as props from the server page.
 */

import { useState, useTransition } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';

type Feedback = 'idle' | 'pending' | 'ok' | 'error';

function ActionButton({
  label,
  variant,
  action,
  hiddenFields,
}: {
  label:        string;
  variant:      'default' | 'success' | 'danger';
  action:       (fd: FormData) => Promise<void>;
  hiddenFields: Record<string, string>;
}) {
  const [feedback, setFeedback] = useState<Feedback>('idle');
  const [isPending, start]      = useTransition();

  const colours = {
    default: 'border-gray-300 text-gray-600 hover:bg-gray-50',
    success: 'border-green-300 text-green-700 hover:bg-green-50',
    danger:  'border-red-300 text-red-600 hover:bg-red-50',
  };

  const handleClick = () => {
    const fd = new FormData();
    Object.entries(hiddenFields).forEach(([k, v]) => fd.set(k, v));
    setFeedback('pending');
    start(async () => {
      try {
        await action(fd);
        setFeedback('ok');
        // Keep "Done" visible briefly before resetting
        setTimeout(() => setFeedback('idle'), 2500);
      } catch {
        setFeedback('error');
        setTimeout(() => setFeedback('idle'), 3000);
      }
    });
  };

  if (feedback === 'ok') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 font-medium px-2">
        <CheckCircle size={12} /> Done
      </span>
    );
  }

  if (feedback === 'error') {
    return (
      <span className="text-xs text-red-600 font-medium px-2">Failed</span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${colours[variant]}`}
    >
      {isPending && <Loader2 size={12} className="animate-spin" />}
      {label}
    </button>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────

type TicketProps = {
  type:            'ticket';
  ticketId:        string;
  userId:          string;
  onDismissTicket: (fd: FormData) => Promise<void>;
  onReverseTicket: (fd: FormData) => Promise<void>;
};

type FlagProps = {
  type:           'flag';
  flagId:         string;
  userId:         string;
  onDismissFlag:  (fd: FormData) => Promise<void>;
  onSuspendUser:  (fd: FormData) => Promise<void>;
};

type FlagsActionBarProps = TicketProps | FlagProps;

export function FlagsActionBar(props: FlagsActionBarProps) {
  if (props.type === 'ticket') {
    return (
      <div className="flex gap-2 shrink-0">
        <ActionButton
          label="Reverse Action"
          variant="success"
          action={props.onReverseTicket}
          hiddenFields={{ ticket_id: props.ticketId, user_id: props.userId }}
        />
        <ActionButton
          label="Dismiss"
          variant="default"
          action={props.onDismissTicket}
          hiddenFields={{ ticket_id: props.ticketId, user_id: props.userId }}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-2 shrink-0">
      <ActionButton
        label="Suspend User"
        variant="danger"
        action={props.onSuspendUser}
        hiddenFields={{ flag_id: props.flagId, user_id: props.userId }}
      />
      <ActionButton
        label="Dismiss"
        variant="default"
        action={props.onDismissFlag}
        hiddenFields={{ flag_id: props.flagId, user_id: props.userId }}
      />
    </div>
  );
}