'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error('Bejelentkezési hiba', {
        description: error.message === 'Invalid login credentials'
          ? 'Hibás email vagy jelszó'
          : error.message,
      });
    } else {
      toast.success('Sikeres bejelentkezés!');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base p-4">
      <Card className="w-full max-w-md border-border-active shadow-panel animate-fade-slide-up">
        <CardHeader className="space-y-4 pb-6">
          <div className="flex items-center justify-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-surface-2 border border-border-active shadow-glow-orange">
              <Trophy className="h-8 w-8 text-orange" strokeWidth={1.6} />
            </div>
          </div>
          <div className="space-y-1 text-center">
            <CardTitle className="font-display text-2xl uppercase tracking-widest text-primary">
              NBA Statisztika
            </CardTitle>
            <CardDescription className="text-secondary text-sm">
              Jelentkezz be a statisztikák kezeléséhez
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="font-display text-xs uppercase tracking-widest text-secondary"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="pelda@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="font-display text-xs uppercase tracking-widest text-secondary"
              >
                Jelszó
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-orange text-base font-display uppercase tracking-widest text-sm hover:bg-orange-dim transition-all duration-200 hover:shadow-glow-orange-hot disabled:opacity-50"
            >
              {isLoading ? 'Bejelentkezés...' : 'Bejelentkezés'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
