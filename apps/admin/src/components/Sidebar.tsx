'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { tx } from '@unified/motion';

import { useAuth, useHasPermission } from '@/lib/auth-store.js';

/**
 * Admin collapsible sidebar — Design-System.md §7.1.
 *
 * Width animates via Framer Motion `layout`; collapsed state persists in
 * localStorage so the user's preference survives reloads.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  permission?: string;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/social', label: 'Social hub', icon: Send, permission: 'social.read' },
  { href: '/users', label: 'Users', icon: Users, permission: 'users.read' },
  { href: '/roles', label: 'Roles', icon: ShieldCheck, permission: 'roles.read' },
  { href: '/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.read' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const saved = window.localStorage.getItem('admin:sidebar:collapsed');
    if (saved === '1') setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      window.localStorage.setItem('admin:sidebar:collapsed', next ? '1' : '0');
      return next;
    });
  }

  return (
    <motion.aside
      layout
      animate={{ width: collapsed ? 72 : 256 }}
      transition={tx.smooth}
      className="sticky top-0 flex h-screen flex-col bg-surface-raised shadow-neu-raised"
      aria-label="Primary"
    >
      <div className="flex items-center justify-between p-4">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-display text-lg font-semibold"
            >
              Unified
            </motion.span>
          )}
        </AnimatePresence>
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="grid h-11 w-11 place-items-center rounded-md shadow-neu-soft active:shadow-neu-sunken"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} active={pathname.startsWith(item.href)} />
        ))}
      </nav>

      <div className="border-t border-surface-sunken/40 p-3">
        <AnimatePresence initial={false}>
          {!collapsed && user ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-2 px-1 text-sm text-text-secondary"
            >
              <p className="truncate font-medium text-text-primary">
                {user.firstName ?? user.email ?? user.id}
              </p>
              {user.email ? <p className="truncate text-xs">{user.email}</p> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <button
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 rounded-md p-3 text-left text-sm shadow-neu-soft active:shadow-neu-sunken"
        >
          <LogOut size={16} />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Sign out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}

function NavLink({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  const allowed = useHasPermission(item.permission ?? '');
  if (item.permission && !allowed) return null;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-md p-3 text-sm transition-shadow ${
        active ? 'shadow-neu-sunken bg-surface-sunken' : 'shadow-neu-soft hover:shadow-neu-raised'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={18} />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
