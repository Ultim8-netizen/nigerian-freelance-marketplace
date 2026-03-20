import { Shield, Users, Flag, MessageSquare, Banknote, LineChart, Settings, UserCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { AdminSessionGuard } from '@/components/admin/AdminSessionGuard';

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
            <NavLink href="/f9-control"           icon={<Shield />}       label="Digest"          />
            <NavLink href="/f9-control/users"     icon={<Users />}        label="Users"           />
            <NavLink href="/f9-control/flags"     icon={<Flag />}         label="Flags & Tickets" />
            <NavLink href="/f9-control/messaging" icon={<MessageSquare />} label="Messaging"      />
            <NavLink href="/f9-control/finance"   icon={<Banknote />}     label="Finance"         />
            <NavLink href="/f9-control/analytics" icon={<LineChart />}    label="Analytics"       />
            <NavLink href="/f9-control/config"    icon={<Settings />}     label="Configuration"   />
            <NavLink href="/f9-control/emergency" icon={<AlertTriangle />} label="Emergency"      />

            {/* Staff — now a real link. The page handles its own dormant state. */}
            <div className="pt-6 mt-6 border-t border-gray-800">
              <NavLink href="/f9-control/staff" icon={<UserCircle />} label="Staff" muted />
            </div>
          </nav>
        </aside>

        {/* Main Content Zone */}
        <main className="flex-1 flex flex-col">
          <header className="h-16 bg-white border-b flex items-center justify-between px-8">
            <div className="flex items-center w-full max-w-xl relative">
              <kbd className="absolute left-3 text-xs bg-gray-100 border px-1.5 rounded text-gray-500">⌘K</kbd>
              <input
                type="text"
                placeholder="Global Search (Users, TXNs, Orders)..."
                className="w-full pl-12 pr-4 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg text-sm transition-all"
              />
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-950 text-white flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-gray-200">
              ME
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
  /** When true, renders slightly dimmed to indicate a secondary / dormant section. */
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