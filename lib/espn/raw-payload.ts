// A nyers ESPN summary tömörített tárolása (espn_game_raw.payload_gz, bytea).
// PostgREST a bytea-t hex literálként ("\x…") fogadja és adja vissza, ezért
// mindkét irány ezt az alakot használja. Csak szerveren / CLI-ben fut (node:zlib).

import { gunzipSync, gzipSync } from 'node:zlib';

const HEX_PREFIX = '\\x';

/** Nyers JSON → gzip → bytea hex literál. */
export function encodeRawPayload(payload: unknown): string {
  return HEX_PREFIX + gzipSync(JSON.stringify(payload)).toString('hex');
}

/** bytea hex literál → gunzip → nyers JSON (`unknown`, validálás a schemas.ts dolga). */
export function decodeRawPayload(value: string): unknown {
  if (!value.startsWith(HEX_PREFIX)) throw new Error('espn_game_raw.payload_gz: nem bytea hex literál');
  return JSON.parse(gunzipSync(Buffer.from(value.slice(HEX_PREFIX.length), 'hex')).toString('utf8')) as unknown;
}
