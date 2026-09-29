export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

const POSITION_PRIORITY: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

const POSITION_TOKEN_MAP: Record<string, Position[]> = {
  PG: ['PG'],
  POINTGUARD: ['PG'],
  PLAYMAKER: ['PG'],
  IRANYITO: ['PG'],
  BACKCOURT: ['PG', 'SG'],
  GUARD: ['PG', 'SG'],
  GUARDS: ['PG', 'SG'],
  G: ['PG', 'SG'],
  CG: ['PG', 'SG'],
  SG: ['SG'],
  SHOOTINGGUARD: ['SG'],
  DOBOHATVED: ['SG'],
  HATVED: ['SG'],
  WING: ['SF'],
  WINGS: ['SF'],
  BEDOBO: ['SF'],
  SF: ['SF'],
  SMALLFORWARD: ['SF'],
  KISCSATAR: ['SF'],
  FORWARD: ['SF', 'PF'],
  FORWARDS: ['SF', 'PF'],
  FORWARDCENTER: ['C', 'PF'],
  CENTERFORWARD: ['C', 'PF'],
  CSATAR: ['SF', 'PF'],
  F: ['SF', 'PF'],
  GF: ['SG', 'SF'],
  PF: ['PF'],
  POWERFORWARD: ['PF'],
  EROCSATAR: ['PF'],
  PF4: ['PF'],
  FC: ['PF', 'C'],
  CF: ['C', 'PF'],
  BIG: ['PF', 'C'],
  BIGMAN: ['PF', 'C'],
  FRONTCOURT: ['PF', 'C'],
  C: ['C'],
  CENTER: ['C'],
  POST: ['C'],
  '1': ['PG'],
  '2': ['SG'],
  '3': ['SF'],
  '4': ['PF'],
  '5': ['C'],
};

const DIGIT_TOKEN = ['1', '2', '3', '4', '5'];

const normalizeDescriptor = (raw: string) =>
  raw
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[–—]/g, '-');

const addUniquePositions = (target: Position[], candidates?: Position[]) => {
  (candidates ?? []).forEach(pos => {
    if (!target.includes(pos)) target.push(pos);
  });
};

export const parsePositionBuckets = (raw?: string | null): Position[] => {
  if (!raw) return [];
  const descriptor = normalizeDescriptor(raw);
  if (!descriptor) return [];

  const tokens = descriptor.split(/[^A-Z0-9]+/).filter(Boolean);
  const buckets: Position[] = [];

  if (tokens.length === 0) {
    addUniquePositions(buckets, POSITION_TOKEN_MAP[descriptor]);
    return buckets;
  }

  tokens.forEach(token => {
    if (POSITION_TOKEN_MAP[token]) {
      addUniquePositions(buckets, POSITION_TOKEN_MAP[token]);
      return;
    }

    if (DIGIT_TOKEN.includes(token)) {
      addUniquePositions(buckets, POSITION_TOKEN_MAP[token]);
      return;
    }

    if (/^\d{2,}$/.test(token)) {
      token.split('').forEach(digit => addUniquePositions(buckets, POSITION_TOKEN_MAP[digit]));
      return;
    }
  });

  if (buckets.length === 0) {
    addUniquePositions(buckets, POSITION_TOKEN_MAP[descriptor]);
  }

  if (buckets.length === 0) {
    if (descriptor.includes('PG')) addUniquePositions(buckets, ['PG']);
    if (descriptor.includes('SG')) addUniquePositions(buckets, ['SG']);
    if (descriptor.includes('SF')) addUniquePositions(buckets, ['SF']);
    if (descriptor.includes('PF')) addUniquePositions(buckets, ['PF']);
    if (descriptor.includes('C')) addUniquePositions(buckets, ['C']);
    if (descriptor.includes('G')) addUniquePositions(buckets, ['PG', 'SG']);
    if (descriptor.includes('F')) addUniquePositions(buckets, ['SF', 'PF']);
  }

  // If descriptor explicitly mentions center (CENTER, C/F, C-F), keep C as primary bucket.
  const mentionsCenter = descriptor.includes('CENTER') || /(^|[^A-Z])C([^A-Z]|$)/.test(descriptor);
  if (buckets.includes('C') && mentionsCenter) {
    return ['C', ...buckets.filter(pos => pos !== 'C')];
  }

  return buckets;
};

export const resolvePrimaryPosition = (raw?: string | null, fallback: Position = 'C'): Position => {
  const buckets = parsePositionBuckets(raw);
  if (buckets.length > 0) return buckets[0];

  return fallback;
};

export const buildPositionMetadata = (
  raw?: string | null,
  fallback: Position = 'C'
): {
  position: Position;
  positionLabel?: string;
  positionBuckets?: Position[];
} => {
  const buckets = parsePositionBuckets(raw);
  const position = buckets[0] ?? fallback;
  return {
    position,
    positionLabel: raw ?? undefined,
    positionBuckets: buckets.length > 0 ? buckets : undefined,
  };
};

export const POSITION_ORDER = POSITION_PRIORITY;
