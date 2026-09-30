// Supabase kliens-gyár az NBAStats `nba` sémájára.
// A közös (ASEStats `ugkettlebell`) projekt `public` sémájában az ASEStats táblái
// élnek, ezért minden kliens (böngésző, admin, CLI) ezen a gyáron át jön létre.
// Külön modul, hogy a CLI szkriptek a böngészős kliens (`lib/supabase.ts`)
// betöltése nélkül is elérjék.

import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';

export const DB_SCHEMA = 'nba' as const;

export function createNbaClient(
  url: string,
  key: string,
  auth: SupabaseClientOptions<typeof DB_SCHEMA>['auth'],
) {
  return createClient(url, key, { db: { schema: DB_SCHEMA }, auth });
}

export type NbaClient = ReturnType<typeof createNbaClient>;
