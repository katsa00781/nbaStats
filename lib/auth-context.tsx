'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Aktív session ellenőrzése. Ha a tárolt refresh token már érvénytelen
    // (lejárt / rotálódott / a felhasználó törölve lett), a getSession hibát ad:
    // ilyenkor csak lokálisan jelentkezünk ki, hogy a beragadt token eltűnjön
    // a localStorage-ból és tiszta állapotból lehessen újra bejelentkezni.
    const initSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('Session helyreállítása sikertelen, lokális kijelentkezés:', error.message);
        await supabase.auth.signOut({ scope: 'local' });
        if (!active) return;
        setUser(null);
        setLoading(false);
        return;
      }

      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    };

    void initSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    // Ha a szerver már nem ismeri a sessiont, a lokális tárolót akkor is ürítjük
    if (error) {
      console.warn('Kijelentkezés hibája, lokális session törlése:', error.message);
      await supabase.auth.signOut({ scope: 'local' });
    }
    setUser(null);
  };

  const isAdmin = user?.user_metadata?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
