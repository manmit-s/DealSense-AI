'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, BarChart2, TrendingDown, Swords, Settings, Link2, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import clsx from 'clsx';

const navItems = [
  { name: 'Overview', href: '/dashboard/overview', icon: Home },
  { name: 'Prospects', href: '/dashboard/prospects', icon: Users },
  { name: 'Deals', href: '/dashboard/deals', icon: BarChart2 },
  { name: 'Retention', href: '/dashboard/retention', icon: TrendingDown },
  { name: 'Competitive', href: '/dashboard/competitive', icon: Swords },
];

const bottomItems = [
  { name: 'Integrations', href: '/dashboard/integrations', icon: Link2 },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside className={clsx(
      "bg-surface border-r border-border h-full flex flex-col transition-all duration-300 relative",
      collapsed ? "w-20" : "w-60"
    )}>
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-border">
        <div className={clsx("flex items-center gap-2", collapsed && "justify-center w-full")}>
          <div className="w-8 h-8 rounded bg-cyan flex items-center justify-center font-bold text-base">R</div>
          {!collapsed && <span className="font-mono font-bold text-lg tracking-wide">RevAI</span>}
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors group",
                isActive ? "bg-elevated text-cyan" : "text-text-secondary hover:bg-elevated hover:text-white"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Nav */}
      <div className="p-3 border-t border-border space-y-1">
        {bottomItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-text-secondary hover:bg-elevated hover:text-white transition-colors"
            title={collapsed ? item.name : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
          </Link>
        ))}
        
        <button
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-text-secondary hover:bg-red/10 hover:text-red transition-colors"
          title={collapsed ? "Log Out" : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium text-sm">Log Out</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 bg-elevated border border-border rounded-full p-1 text-text-secondary hover:text-white"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}