// Server-only Supabase admin kliens factory az API route-okhoz.
// Egyetlen helyen történik az env ellenőrzés és a kliens létrehozás –
// a route-ok nem duplikálják a bootstrap kódot.
// FIGYELEM: kizárólag szerver oldalon használható (SUPABASE_SERVICE_ROLE_KEY).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL hiányzik.');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY hiányzik.');

  cachedAdmin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return cachedAdmin;
}
