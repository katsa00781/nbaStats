'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Target,
  Trophy,
  Calendar,
  ClipboardList,
  DatabaseZap,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavTone = 'ai' | 'negative';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  tone?: NavTone;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'analitika',
    label: 'Analitika',
    items: [
      { key: 'overview', label: 'Áttekintés', icon: LayoutDashboard },
      { key: 'players', label: 'Játékosok', icon: Users },
      { key: 'comparison', label: 'Elemzések', icon: Sparkles, tone: 'ai' },
      { key: 'situational', label: 'Szituációk', icon: Target },
    ],
  },
  {
    key: 'liga',
    label: 'Liga',
    items: [
      { key: 'standings', label: 'Tabella', icon: Trophy },
      { key: 'games', label: 'Mérkőzések', icon: Calendar },
      { key: 'gamelog', label: 'Meccs Log', icon: ClipboardList },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    adminOnly: true,
    items: [
      { key: 'import', label: 'Import', icon: DatabaseZap },
    ],
  },
];

const COLLAPSE_STORAGE_KEY = 'nba.sidebar.collapsed';
const COLLAPSE_EVENT = 'nba.sidebar.collapsed.change';
const getCollapsedSnapshot = () => window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
const getServerCollapsedSnapshot = () => false;
const subscribeCollapsed = (notify: () => void) => {
  window.addEventListener('storage', notify);
  window.addEventListener(COLLAPSE_EVENT, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(COLLAPSE_EVENT, notify);
  };
};
const toggleCollapsed = () => {
  window.localStorage.setItem(COLLAPSE_STORAGE_KEY, getCollapsedSnapshot() ? '0' : '1');
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
};

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
  userEmail: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  navMeta?: Record<string, number>;
}

export function AppSidebar({ activeTab, onTabChange, isAdmin, userEmail, onCollapsedChange, navMeta }: AppSidebarProps) {
  // Külső böngészős állapot: hidratálásbiztos feliratkozás, effectből
  // indított szinkron setState nélkül (React 19 lint-szabály).
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsedSnapshot, getServerCollapsedSnapshot);

  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const visibleGroups = NAV_GROUPS.filter(group => !group.adminOnly || isAdmin);
  const avatarLetter = userEmail.charAt(0).toUpperCase() || '?';

  return (
    <aside className="sidebar" data-collapsed={collapsed}>
      <div className="sb-header">
        <div className="sb-logo" aria-hidden="true">
          <Trophy className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </div>
        <div className="sb-brand">
          <span className="sb-wordmark">NBA</span>
          <span className="sb-sub">Statisztika</span>
        </div>
        <button
          type="button"
          className="sb-toggle"
          onClick={toggleCollapsed}
          aria-label="Navigáció kibontása / összecsukása"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      <nav className="sb-nav" aria-label="Fő navigáció">
        {visibleGroups.map(group => (
          <div key={group.key} className="sb-group">
            <div className="sb-group-label">{group.label}</div>
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              const meta = navMeta?.[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cn('nav-item', isActive && 'active')}
                  data-tone={item.tone}
                  onClick={() => onTabChange(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="nav-item-icon">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  </span>
                  <span className="nav-item-label">{item.label}</span>
                  {meta !== undefined && <span className="nav-item-meta">{meta}</span>}
                  <span className="nav-item-tip">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sb-footer">
        <div className="sb-avatar" aria-hidden="true">{avatarLetter}</div>
        <div className="sb-user">
          <span className="sb-user-email">{userEmail}</span>
          <span className="sb-user-role">{isAdmin ? 'Admin' : 'Felhasználó'}</span>
        </div>
      </div>
    </aside>
  );
}
