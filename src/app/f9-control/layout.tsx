import {
  Shield, Users, Flag, MessageSquare, Banknote,
  LineChart, Settings, UserCircle, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { AdminSessionGuard } from '@/components/admin/AdminSessionGuard';
import { NotificationBell }  from '@/components/admin/NotificationBell';
import { CommandPalette }    from '@/components/admin/CommandPalette';

export default function F9ControlLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionGuard>
      <div className="min-h-screen bg-gray-100 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-950 text-gray-300 flex flex-col">
          <div className="h-16 flex items-center px-6 border-b border-gray-800">
            <Shield className="w-6 h-6 text-blue-500 mr-2" />
            <span className="font-bold text-white tracking-widest">F9_NX</span>
          </div>

          <nav className="flex-1 py-6 space-y-1 px-3">
            <NavLink href="/f9-control"           icon={<Shield />}        label="Digest"          />
            <NavLink href="/f9-control/users"     icon={<Users />}         label="Users"           />
            <NavLink href="/f9-control/flags"     icon={<Flag />}          label="Flags & Tickets" />
            <NavLink href="/f9-control/messaging" icon={<MessageSquare />} label="Messaging"       />
            <NavLink href="/f9-control/finance"   icon={<Banknote />}      label="Finance"         />
            <NavLink href="/f9-control/config"    icon={<Settings />}      label="Configuration"   />
            <NavLink href="/f9-control/emergency" icon={<AlertTriangle />} label="Emergency"       />

            {/*
              FIX #4 — Analytics page does not exist yet (deferred per spec Part 3f:
              "after core functionality is stable"). Rendering it as a disabled item
              prevents the nav link from resolving to a Next.js 404.
              Replace with a real <NavLink> once the analytics page is built.
            */}
            <DormantNavItem icon={<LineChart />} label="Analytics" tooltip="Coming soon" />

            {/* Staff — real link, page handles its own dormant state */}
            <div className="pt-6 mt-6 border-t border-gray-800">
              <NavLink href="/f9-control/staff" icon={<UserCircle />} label="Staff" muted />
            </div>
          </nav>
        </aside>

        {/* Main Content Zone */}
        <main className="flex-1 flex flex-col">
          <header className="h-16 bg-white border-b flex items-center justify-between px-8">
            {/* Command palette — ⌘K / Ctrl+K to open; routes to users, finance,
                orders with ?search= param, or jumps directly to any admin page. */}
            <CommandPalette />

            {/* Right-side controls */}
            <div className="flex items-center gap-3">
              {/* Notification bell — lights up for critical security events
                  and pending contest tickets. Navigates to /f9-control/flags. */}
              <NotificationBell />

              {/* Admin avatar */}
              <div className="w-8 h-8 rounded-full bg-gray-950 text-white flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-gray-200">
                ME
              </div>
            </div>
          </header>

          <div className="p-8 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </AdminSessionGuard>
  );
}

function NavLink({
  href,
  icon,
  label,
  muted = false,
}: {
  href:   string;
  icon:   React.ReactNode;
  label:  string;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-900 hover:text-white transition-colors ${
        muted ? 'text-gray-500' : ''
      }`}
    >
      <span className="w-5 h-5 mr-3">{icon}</span>
      {label}
    </Link>
  );
}

/** Non-interactive sidebar item for features not yet built. */
function DormantNavItem({
  icon,
  label,
  tooltip,
}: {
  icon:    React.ReactNode;
  label:   string;
  tooltip: string;
}) {
  return (
    <div
      title={tooltip}
      className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 cursor-not-allowed select-none"
    >
      <span className="w-5 h-5 mr-3 opacity-40">{icon}</span>
      <span className="opacity-40">{label}</span>
      <span className="ml-auto text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono">
        soon
      </span>
    </div>
  );
}