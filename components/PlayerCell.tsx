'use client';

import type { PlayerSeasonStats } from '@/lib/player-data';
import type { Position } from '@/lib/positions';
import { parsePositionBuckets } from '@/lib/positions';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const AVATAR_SIZE = 30;
const EMPTY = '–';

const POSITION_BADGES: Record<Position, string> = {
  PG: 'dt-badge--pg',
  SG: 'dt-badge--sg',
  SF: 'dt-badge--sf',
  PF: 'dt-badge--pf',
  C: 'dt-badge--c',
};

/** Monogram a kép nélküli játékoshoz. */
export function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface PlayerCellProps {
  player: Pick<PlayerSeasonStats, 'name' | 'headshotUrl'>;
  /** Ha meg van adva, a név gomb: a játékos részleteit nyitja meg. */
  onOpen?: () => void;
}

/** Headshot (kép híján monogram) + név; a box score táblája is ezt használja. */
export function PlayerCell({ player, onOpen }: PlayerCellProps) {
  return (
    <span className="dt-player">
      {player.headshotUrl ? (
        <Image
          src={player.headshotUrl}
          alt=""
          width={AVATAR_SIZE}
          height={AVATAR_SIZE}
          className="h-7.5 w-7.5 shrink-0 rounded-full border border-border-active bg-surface-3 object-cover object-top"
        />
      ) : (
        <span className="dt-player-avatar" aria-hidden="true">{playerInitials(player.name)}</span>
      )}
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="dt-player-name rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
        >
          {player.name}
        </button>
      ) : (
        <span className="font-semibold">{player.name}</span>
      )}
    </span>
  );
}

export function PositionBadge({ position }: { position: string | null }) {
  if (!position) return <span className="text-muted">{EMPTY}</span>;
  // Az ESPN többnyire csak G / F / C rövidítést ad: a szín az első illeszkedő poszté.
  const primary = parsePositionBuckets(position)[0];
  return <span className={cn('dt-badge', primary ? POSITION_BADGES[primary] : 'dt-badge--neutral')}>{position}</span>;
}
