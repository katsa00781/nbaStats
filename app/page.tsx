'use client';
import { useState } from 'react';
import { Construction } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppSidebar } from '@/components/AppSidebar';
import { AppTopbar } from '@/components/AppTopbar';
import { LoginForm } from '@/components/LoginForm';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';

// 0. fázis: csak az app-váz (auth guard + navigáció). A nézetek a roadmap
// 2. lépésében épülnek meg – lásd context/progress-tracker.md.
export default function Home() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  return (
    <div className={cn('app-shell dark bg-base', sidebarCollapsed && 'is-collapsed')}>
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={isAdmin}
        userEmail={user.email ?? ''}
        onCollapsedChange={setSidebarCollapsed}
      />
      <main className="px-4 sm:px-8 lg:px-9 py-6 sm:py-7 pb-24 md:pb-7">
        <AppTopbar
          activeTab={activeTab}
          userEmail={user.email ?? ''}
          isAdmin={isAdmin}
          onSignOut={() => signOut()}
        />
        <Card className="animate-fade-slide-up">
          <CardContent className="flex items-center gap-3 py-8 text-secondary">
            <Construction className="h-5 w-5 text-orange" strokeWidth={1.6} />
            <span>Ez a nézet még épül. Az adatimport már működik: <code className="font-mono text-cyan">npm run ingest:games</code></span>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
