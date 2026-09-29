// API route auth guard: a bejövő Supabase access tokent validálja.
// Minden import/cleanup/riport route elején hívandó – korábban ezek a
// route-ok auth nélkül voltak elérhetők.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type AuthResult = { ok: true } | { ok: false; response: NextResponse };

const unauthorized = (message: string): AuthResult => ({
  ok: false,
  response: NextResponse.json({ ok: false, error: message }, { status: 401 }),
});

const forbidden = (message: string): AuthResult => ({
  ok: false,
  response: NextResponse.json({ ok: false, error: message }, { status: 403 }),
});

export async function requireAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!token) {
    return unauthorized('Hiányzó Authorization fejléc – jelentkezz be.');
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) {
      return unauthorized('Érvénytelen vagy lejárt munkamenet.');
    }
  } catch {
    return unauthorized('Az auth ellenőrzés nem elérhető (hiányzó szerver konfiguráció).');
  }

  return { ok: true };
}

// Admin guard: token-validálás után a Supabase user_metadata.role === 'admin'
// meglétét is megköveteli. Minden mutáló route (import, törlés, riport mentés)
// ezt hívja a requireAuth helyett.
export async function requireAdmin(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!token) {
    return unauthorized('Hiányzó Authorization fejléc – jelentkezz be.');
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) {
      return unauthorized('Érvénytelen vagy lejárt munkamenet.');
    }
    const role = (data.user.user_metadata as Record<string, unknown> | null)?.role;
    if (role !== 'admin') {
      return forbidden('Ehhez a művelethez admin jogosultság szükséges.');
    }
  } catch {
    return unauthorized('Az auth ellenőrzés nem elérhető (hiányzó szerver konfiguráció).');
  }

  return { ok: true };
}
