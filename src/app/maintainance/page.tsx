import { createClient } from '@/lib/supabase/server';
import { Shield } from 'lucide-react';

// ─── Human-readable messages per feature flag reason ─────────────────────────

const REASON_MESSAGES: Record<string, { heading: string; body: string }> = {
  REGISTRATIONS_DISABLED: {
    heading: 'Registrations Temporarily Paused',
    body:    'New account creation is temporarily unavailable. Existing users can still log in normally.',
  },
  MARKETPLACE_DISABLED: {
    heading: 'Marketplace Temporarily Unavailable',
    body:    'The F9 marketplace is temporarily offline. Freelance services and messaging are unaffected.',
  },
  ORDERS_DISABLED: {
    heading: 'Orders Temporarily Paused',
    body:    'New order placement is temporarily unavailable. Active orders are unaffected.',
  },
  PROPOSALS_DISABLED: {
    heading: 'Proposals Temporarily Paused',
    body:    'New job proposals are temporarily unavailable. Active orders and messaging are unaffected.',
  },
};

const DEFAULT_MESSAGE = {
  heading: 'F9 is currently under maintenance',
  body:    'We are performing scheduled maintenance and will be back shortly. Thank you for your patience.',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams?.reason ?? null;

  // If a specific feature is disabled, use its message.
  // Otherwise fall back to the admin-configured custom message from platform_config,
  // then to the hardcoded default.
  let heading = DEFAULT_MESSAGE.heading;
  let body    = DEFAULT_MESSAGE.body;

  if (reason && REASON_MESSAGES[reason]) {
    heading = REASON_MESSAGES[reason].heading;
    body    = REASON_MESSAGES[reason].body;
  } else {
    // Full maintenance mode — try to read the admin's custom message.
    // This query runs on the server so it's safe even if the client app is
    // blocked.  If the DB itself is down, the catch block uses the hardcoded
    // default so the page always renders.
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('platform_config')
        .select('string_value')
        .eq('key', 'maintenance_message')
        .single();

      if (data?.string_value) {
        body = data.string_value;
      }
    } catch {
      // DB unavailable — fall through to hardcoded default
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">

        {/* F9 Shield */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Shield className="w-10 h-10 text-blue-400" />
          </div>
        </div>

        {/* Wordmark */}
        <div>
          <p className="text-blue-400 font-bold tracking-widest text-sm uppercase mb-3">
            F9 Platform
          </p>
          <h1 className="text-3xl font-bold text-white mb-4">{heading}</h1>
          <p className="text-gray-400 leading-relaxed">{body}</p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Status note */}
        <div className="space-y-2">
          <p className="text-gray-600 text-sm">
            For urgent matters, contact the F9 team directly.
          </p>
          {!reason && (
            <p className="text-gray-700 text-xs">
              If you are an administrator,{' '}
              <a
                href="/f9-control"
                className="text-blue-500 hover:text-blue-400 underline underline-offset-2"
              >
                access the admin portal
              </a>
              {' '}to manage platform status.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}