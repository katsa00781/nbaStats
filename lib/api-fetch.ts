// Kliens oldali fetch helper: a Supabase session access tokenjét
// Authorization fejlécként csatolja az API hívásokhoz (lib/api-auth.ts párja).

import { supabase } from '@/lib/supabase';

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();

  // Érvénytelen / lejárt refresh token esetén a lokális sessiont eldobjuk,
  // így a SIGNED_OUT eseményre a felület a bejelentkező képernyőre vált.
  if (error) {
    console.warn('Session lekérése sikertelen, lokális kijelentkezés:', error.message);
    await supabase.auth.signOut({ scope: 'local' });
  }

  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}
