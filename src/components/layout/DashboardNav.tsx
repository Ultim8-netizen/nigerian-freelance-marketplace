// src/components/layout/DashboardNav.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Search, Menu, User, Settings, LogOut, Wallet, X, ShoppingBag } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { F9Logo } from '@/components/brand/F9Logo';

interface UserProfile {
  full_name?: string;
  avatar_url?: string;
  wallet_balance?: number;
  user_type?: string;
}

interface UserData {
  email?: string;
}

interface DashboardNavProps {
  user: UserData;
  profile: UserProfile;
  onMenuToggle?: () => void;
}

export function DashboardNav({ user, profile, onMenuToggle }: DashboardNavProps) {
  const [notifications, setNotifications] = useState(3);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard shortcuts (Cmd/Ctrl + K for search, Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  // Mark notification as read (example usage for setNotifications)
  const markAllAsRead = () => {
    setNotifications(0);
  };

  // Determine if current page is active (example usage for pathname)
  const isActivePage = (path: string) => {
    return pathname === path;
  };

  return (
    <>
      <header 
        className={`sticky top-0 z-50 w-full border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg transition-all duration-300 ${
          isScrolled ? 'shadow-md' : 'shadow-sm'
        }`}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left Section: Logo & Mobile Menu */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={onMenuToggle}
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Link 
              href="/dashboard" 
              className="flex items-center transition-transform hover:scale-105 active:scale-95"
            >
              <F9Logo variant="full" size="md" animated />
            </Link>

            {/* Quick Nav Links (Desktop) - Added Marketplace */}
            <nav className="hidden lg:flex items-center gap-1 ml-6">
              <Link 
                href="/marketplace"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  isActivePage('/marketplace') 
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Marketplace</span>
              </Link>
            </nav>
          </div>

          {/* Center Section: Search (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <form onSubmit={handleSearchSubmit} className="relative w-full group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services, jobs, freelancers..."
                className="w-full pl-10 pr-20 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white transition-all"
                onFocus={() => setIsSearchOpen(true)}
              />
              <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hidden sm:inline-block">
                ⌘K
              </kbd>
            </form>
          </div>

          {/* Right Section: Actions & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Marketplace Quick Access (Mobile/Tablet) */}
            <Link href="/marketplace" className="lg:hidden">
              <Button
                variant={isActivePage('/marketplace') ? 'default' : 'ghost'}
                size="icon"
                className="hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Marketplace"
              >
                <ShoppingBag className="h-5 w-5" />
              </Button>
            </Link>

            {/* Search Icon (Mobile) */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Wallet Balance with Animation */}
            <Link href="/dashboard/wallet">
              <Button 
                variant="outline" 
                size="sm" 
                className={`hidden sm:flex items-center gap-2 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 ${
                  isActivePage('/dashboard/wallet') ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <Wallet className="h-4 w-4 text-green-600" />
                <span className="font-semibold bg-linear-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  ₦{(profile?.wallet_balance || 0).toLocaleString()}
                </span>
              </Button>
            </Link>

            {/* Notifications with Pulse Animation */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label={`Notifications ${notifications > 0 ? `(${notifications} unread)` : ''}`}
                >
                  <Bell className="h-5 w-5" />
                  {notifications > 0 && (
                    <>
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
                      >
                        {notifications}
                      </Badge>
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 animate-ping opacity-75" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 sm:w-96">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  <div className="flex items-center gap-2">
                    {notifications > 0 && (
                      <>
                        <Badge variant="secondary" className="ml-2">
                          {notifications} new
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={markAllAsRead}
                          className="text-xs h-6 px-2"
                        >
                          Mark all read
                        </Button>
                      </>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-96 overflow-y-auto">
                  <NotificationItem
                    title="New job posted"
                    description="Web Developer needed for e-commerce site"
                    time="5 min ago"
                    unread
                  />
                  <NotificationItem
                    title="Proposal accepted"
                    description="Your proposal for Logo Design was accepted"
                    time="1 hour ago"
                    unread
                  />
                  <NotificationItem
                    title="Payment received"
                    description="₦15,000 credited to your wallet"
                    time="2 hours ago"
                  />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/notifications" className="text-center w-full cursor-pointer font-medium text-blue-600">
                    View all notifications
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu with Enhanced Profile Card */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative h-10 w-10 rounded-full hover:ring-2 hover:ring-blue-500 transition-all"
                  aria-label="User menu"
                >
                  <Avatar className="h-10 w-10 ring-2 ring-white dark:ring-gray-800">
                    <AvatarImage src={profile?.avatar_url} alt={profile?.full_name} />
                    <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {getInitials(profile?.full_name || user?.email || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online Status Indicator */}
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-800" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-white">
                          {getInitials(profile?.full_name || user?.email || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{profile?.full_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="w-fit text-xs">
                      {profile?.user_type || 'User'}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link 
                    href="/dashboard/profile" 
                    className={`cursor-pointer ${isActivePage('/dashboard/profile') ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link 
                    href="/marketplace" 
                    className={`cursor-pointer ${isActivePage('/marketplace') ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                  >
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Marketplace
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link 
                    href="/dashboard/settings" 
                    className={`cursor-pointer ${isActivePage('/dashboard/settings') ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link 
                    href="/dashboard/wallet" 
                    className={`cursor-pointer ${isActivePage('/dashboard/wallet') ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    <span className="flex-1">Wallet</span>
                    <span className="text-xs text-green-600 font-semibold">
                      ₦{(profile?.wallet_balance || 0).toLocaleString()}
                    </span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 p-4 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchOpen(false)}
                aria-label="Close search"
              >
                <X className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold">Search</h2>
            </div>
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services, jobs, freelancers..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                autoFocus
              />
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function NotificationItem({
  title,
  description,
  time,
  unread = false,
}: {
  title: string;
  description: string;
  time: string;
  unread?: boolean;
}) {
  return (
    <div className={`flex flex-col space-y-1 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border-l-2 ${
      unread ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' : 'border-transparent'
    }`}>
      <div className="flex items-start justify-between">
        <p className={`text-sm ${unread ? 'font-semibold' : 'font-medium'}`}>{title}</p>
        {unread && (
          <span className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
        )}
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{description}</p>
      <p className="text-xs text-gray-500 dark:text-gray-500">{time}</p>
    </div>
  );
}