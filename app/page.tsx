'use client';
import { useState } from 'react';
import { Construction } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppSidebar } from '@/components/AppSidebar';
import { AppTopbar } from '@/components/AppTopbar';
import { GamesView } from '@/components/GamesView';
import { LoginForm } from '@/components/LoginForm';
import { SeasonTeamSelector } from '@/components/SeasonTeamSelector';
import { Card, CardContent } from '@/components/ui/card';
import { useSeasonTeamSelection } from '@/hooks/useSeasonTeamSelection';
import { useAuth } from '@/lib/auth-context';

// Auth guard: a törzsadat-hookok (RLS) csak bejelentkezve futhatnak, ezért az
// AppShell külön komponens, és csak a guard mögött mountolódik.
export default function Home() {
  const { user, loading, isAdmin, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-base dark flex items-center justify-center">
        <div className="text-primary text-xl font-display tracking-wider uppercase">Betöltés...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return <AppShell userEmail={user.email ?? ''} isAdmin={isAdmin} onSignOut={() => signOut()} />;
}

interface AppShellProps {
  userEmail: string;
  isAdmin: boolean;
  onSignOut: () => void;
}

// Az app-váz: navigáció, szezon- és csapatválasztó, tab routing. A nézetek a
// roadmap 2. lépésében épülnek (kész: Mérkőzések) – lásd context/progress-tracker.md.
function AppShell({ userEmail, isAdmin, onSignOut }: AppShellProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const selection = useSeasonTeamSelection();

  return (
    <div className={cn('app-shell dark bg-base', sidebarCollapsed && 'is-collapsed')}>
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={isAdmin}
        userEmail={userEmail}
        onCollapsedChange={setSidebarCollapsed}
      />
      <main className="px-4 sm:px-8 lg:px-9 py-6 sm:py-7 pb-24 md:pb-7">
        <AppTopbar
          activeTab={activeTab}
          userEmail={userEmail}
          isAdmin={isAdmin}
          onSignOut={onSignOut}
        />
        <SeasonTeamSelector selection={selection} />
        {activeTab === 'games' ? (
          <GamesView selection={selection} />
        ) : (
          <Card className="animate-fade-slide-up">
            <CardContent className="flex items-center gap-3 py-8 text-secondary">
              <Construction className="h-5 w-5 text-orange" strokeWidth={1.6} />
              <span>Ez a nézet még épül. Az adatimport már működik: <code className="font-mono text-cyan">npm run ingest:games</code></span>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
