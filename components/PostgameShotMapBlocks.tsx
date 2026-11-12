'use client';

import type { CourtShot, HeatmapContrast, HeatmapMode } from '@/components/PostgameShotChart';
import type { ZoneHeatCell } from '@/components/PostgameZoneHeatmapChart';
import type { ColumnDef } from '@/components/ui/data-table';
import type { PostgameShotMap, ShotZoneKey, TeamShotMapSummary } from '@/lib/postgame-report';
import type { GameShot } from '@/lib/shot-data';
import type { ShotZone } from '@/lib/supabase';
import { PostgameShotChart } from '@/components/PostgameShotChart';
import { PostgameZoneHeatmapChart } from '@/components/PostgameZoneHeatmapChart';
import { formatSigned } from '@/components/TeamStatsTable';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SHOT_ZONE_KEYS, SHOT_ZONE_LABELS } from '@/lib/postgame-report';
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';

const EMPTY = '–';
const ALL_PLAYERS = 'all';
const PLAYER_FIELD_ID = 'postgame-shot-player';
/** Ennél kevesebb dobásnál a hőtérkép csak tájékoztató (ASEStats-érték). */
const LOW_SAMPLE_SHOTS = 24;

type Side = 'own' | 'opponent';
type Layer = 'points' | 'heatmap' | 'both';

const ZONE_FROM_DB: Record<ShotZone, ShotZoneKey> = {
  rim: 'rim',
  paint: 'paint',
  mid: 'mid',
  corner3: 'corner3',
  above_break3: 'aboveBreak3',
};

/** Rövid zónanevek a kártyákhoz és a hőtérkép tengelyéhez. */
const SHORT_ZONE_LABELS: Record<ShotZoneKey, string> = {
  rim: 'Gyűrű',
  paint: 'Festék',
  mid: 'Középtáv',
  corner3: 'Saroktripla',
  aboveBreak3: 'Íven túli',
};

const pct = (value: number | null) => (value === null ? EMPTY : `${value.toFixed(1)}%`);
const periodLabel = (period: number) => (period <= 4 ? `${period}. negyed` : `${period - 4}. hosszabbítás`);

interface PostgameShotMapBlocksProps {
  shotMap: PostgameShotMap;
  /** A meccs mindkét csapatának dobásai (pályakoordinátával). */
  gameShots: readonly GameShot[];
  teamId: string;
  opponentTeamId: string;
  teamLabel: string;
  opponentLabel: string;
  /** Játékosnév azonosító szerint (a box score-ból). */
  playerNames: ReadonlyMap<string, string>;
}

/**
 * Dobástérkép és zónák: a kiválasztott csapat (vagy az ellenfél) zónaarányai és -hatékonysága,
 * a saját oldalon a szezonreferenciához mérve, a pályarajz (pontok / hőtérkép) és a zóna-delta hőtérkép.
 */
export function PostgameShotMapBlocks({
  shotMap,
  gameShots,
  teamId,
  opponentTeamId,
  teamLabel,
  opponentLabel,
  playerNames,
}: PostgameShotMapBlocksProps) {
  const [side, setSide] = useState<Side>('own');
  const [chosenPlayer, setChosenPlayer] = useState<{ side: Side; id: string }>({ side: 'own', id: ALL_PLAYERS });
  const [layer, setLayer] = useState<Layer>('points');
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('volume');
  const [heatmapContrast, setHeatmapContrast] = useState<HeatmapContrast>('normal');

  const sideTeamId = side === 'own' ? teamId : opponentTeamId;
  const summary = side === 'own' ? shotMap.team : shotMap.opponent;
  // Szezonreferencia csak a saját oldalon van (az ellenfél szezonbeli dobásai nincsenek betöltve).
  const season = side === 'own' ? shotMap.season : null;
  // Oldalváltáskor a játékos-választás visszaáll (a választás az oldalhoz kötött).
  const playerId = chosenPlayer.side === side ? chosenPlayer.id : ALL_PLAYERS;

  const sideShots = useMemo(() => gameShots.filter(shot => shot.teamId === sideTeamId), [gameShots, sideTeamId]);

  const shooters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const shot of sideShots) {
      if (shot.playerId) counts.set(shot.playerId, (counts.get(shot.playerId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, attempts]) => ({ id, attempts, name: playerNames.get(id) ?? 'Ismeretlen játékos' }))
      .sort((a, b) => b.attempts - a.attempts || a.name.localeCompare(b.name, 'hu'));
  }, [sideShots, playerNames]);

  const courtShots = useMemo<CourtShot[]>(
    () =>
      sideShots
        .filter(shot => playerId === ALL_PLAYERS || shot.playerId === playerId)
        .map(shot => ({
          x: shot.x,
          y: shot.y,
          made: shot.made,
          shotValue: shot.shotValue,
          playerName: shot.playerId ? (playerNames.get(shot.playerId) ?? 'Ismeretlen játékos') : 'Ismeretlen játékos',
          zoneLabel: SHORT_ZONE_LABELS[ZONE_FROM_DB[shot.zone]],
          timeLabel: `${periodLabel(shot.period)}${shot.clock ? ` ${shot.clock}` : ''}`,
        })),
    [sideShots, playerId, playerNames],
  );

  if (!summary) {
    return (
      <p className="text-sm text-secondary">
        Ehhez a mérkőzéshez nincs dobás-esemény a(z) {side === 'own' ? teamLabel : opponentLabel} oldalán.
      </p>
    );
  }

  const madeCount = courtShots.filter(shot => shot.made).length;
  const showHeatmap = layer !== 'points';

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <SegmentedControl
          label="Csapat"
          value={side}
          onChange={value => setSide(value as Side)}
          options={[
            { value: 'own', label: teamLabel },
            { value: 'opponent', label: opponentLabel },
          ]}
        />
        <div className="w-full sm:w-64">
          <label htmlFor={PLAYER_FIELD_ID} className="uppercase-label mb-2 block">Játékos</label>
          <Select value={playerId} onValueChange={id => setChosenPlayer({ side, id })}>
            <SelectTrigger id={PLAYER_FIELD_ID} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PLAYERS}>Összes játékos ({sideShots.length})</SelectItem>
              {shooters.map(shooter => (
                <SelectItem key={shooter.id} value={shooter.id}>
                  {shooter.name} ({shooter.attempts})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ZoneCards summary={summary} season={season} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-4">
            <SegmentedControl
              label="Réteg"
              value={layer}
              onChange={value => setLayer(value as Layer)}
              options={[
                { value: 'points', label: 'Pontok' },
                { value: 'heatmap', label: 'Hőtérkép' },
                { value: 'both', label: 'Mindkettő' },
              ]}
            />
            {showHeatmap && (
              <>
                <SegmentedControl
                  label="Hőtérkép"
                  value={heatmapMode}
                  onChange={value => setHeatmapMode(value as HeatmapMode)}
                  options={[
                    { value: 'volume', label: 'Volumen' },
                    { value: 'efficiency', label: 'FG%' },
                  ]}
                />
                <SegmentedControl
                  label="Kontraszt"
                  value={heatmapContrast}
                  onChange={value => setHeatmapContrast(value as HeatmapContrast)}
                  options={[
                    { value: 'soft', label: 'Lágy' },
                    { value: 'normal', label: 'Normál' },
                    { value: 'sharp', label: 'Éles' },
                  ]}
                />
              </>
            )}
          </div>
          <PostgameShotChart
            shots={courtShots}
            showPoints={layer !== 'heatmap'}
            showHeatmap={showHeatmap}
            heatmapMode={heatmapMode}
            heatmapContrast={heatmapContrast}
          />
          <p className="text-sm text-secondary">
            <span className="font-mono tabular-nums">{madeCount}/{courtShots.length}</span> mezőnydobás
            {courtShots.length > 0 && <> (<span className="font-mono tabular-nums">{pct((madeCount / courtShots.length) * 100)}</span>)</>}.
            Zöld pont: bement, piros kereszt: kimaradt. A kosártól 35 lábnál távolabbi dobás a pálya szélén látszik.
          </p>
          {courtShots.length > 0 && courtShots.length < LOW_SAMPLE_SHOTS && showHeatmap && (
            <p role="note" className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
              Kis minta ({courtShots.length} dobás): a hőtérkép csak tájékoztató.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <ZoneTable summary={summary} season={season} />
          {season && (
            <Card>
              <CardContent className="flex flex-col gap-2">
                <h4 className="uppercase-label text-sm text-secondary">Zóna-delta a szezonhoz</h4>
                <PostgameZoneHeatmapChart cells={zoneHeatCells(summary, season)} />
                <p className="text-xs text-secondary">
                  Zöld: több dobás / jobb FG% a zónában, mint a szezonban; piros: kevesebb / rosszabb. Ahol nincs kör,
                  ott nem volt kísérlet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CoverageNote shotMap={shotMap} side={side} />
    </div>
  );
}

interface SegmentedControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

/** Kis kapcsoló-csoport a shadcn Tabs triggereivel (tartalom-panel nélkül). */
function SegmentedControl({ label, value, onChange, options }: SegmentedControlProps) {
  return (
    <div>
      <span className="uppercase-label mb-2 block">{label}</span>
      <Tabs value={value} onValueChange={onChange}>
        <TabsList aria-label={label}>
          {options.map(option => (
            <TabsTrigger key={option.value} value={option.value}>{option.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

const zoneRate = (summary: TeamShotMapSummary, zone: ShotZoneKey) =>
  summary.attempts > 0 ? (summary.zones[zone].attempts / summary.attempts) * 100 : 0;

function ZoneCards({ summary, season }: { summary: TeamShotMapSummary; season: TeamShotMapSummary | null }) {
  const cards: Array<{ key: string; label: string; rate: number; fg: number | null; seasonRate: number | null }> = [
    { key: 'rim', label: 'Gyűrű (≤ 4 láb)', rate: summary.rimRate, fg: summary.rimPct, seasonRate: season?.rimRate ?? null },
    { key: 'paint', label: 'Festék (4–8 láb)', rate: summary.paintRate, fg: summary.paintPct, seasonRate: season?.paintRate ?? null },
    { key: 'mid', label: 'Középtáv', rate: summary.midRate, fg: summary.midPct, seasonRate: season?.midRate ?? null },
    { key: 'three', label: 'Tripla', rate: summary.threeRate, fg: summary.threePct, seasonRate: season?.threeRate ?? null },
    { key: 'corner3', label: 'Saroktripla', rate: summary.corner3Rate, fg: summary.corner3Pct, seasonRate: season?.corner3Rate ?? null },
  ];
  const sqiDelta = season ? summary.shotQualityIndex - season.shotQualityIndex : null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card, index) => (
        <StatCard
          key={card.key}
          label={card.label}
          value={pct(card.rate)}
          trend="neutral"
          trendValue={`FG% ${pct(card.fg)}${card.seasonRate === null ? '' : ` · ${formatSigned(card.rate - card.seasonRate)} pp`}`}
          accentColor="cyan"
          animationDelay={index * 60}
        />
      ))}
      <StatCard
        label="Dobáshely-mix index"
        value={summary.shotQualityIndex.toFixed(1)}
        trend={sqiDelta === null || Math.abs(sqiDelta) < 0.05 ? 'neutral' : sqiDelta > 0 ? 'up' : 'down'}
        trendValue={season ? `szezon ${season.shotQualityIndex.toFixed(1)}` : 'nincs szezonreferencia'}
        accentColor="orange"
        animationDelay={cards.length * 60}
      />
    </div>
  );
}

interface ZoneRow {
  zone: ShotZoneKey;
  made: number;
  attempts: number;
  rate: number;
  fg: number | null;
  seasonRate: number | null;
  seasonFg: number | null;
}

function zoneRows(summary: TeamShotMapSummary, season: TeamShotMapSummary | null): ZoneRow[] {
  return SHOT_ZONE_KEYS.map(zone => ({
    zone,
    made: summary.zones[zone].made,
    attempts: summary.zones[zone].attempts,
    rate: zoneRate(summary, zone),
    fg: summary.zones[zone].pct,
    seasonRate: season ? zoneRate(season, zone) : null,
    seasonFg: season ? season.zones[zone].pct : null,
  }));
}

const deltaCell = (game: number | null, reference: number | null) =>
  game === null || reference === null ? EMPTY : formatSigned(game - reference);

function zoneColumns(withSeason: boolean): ColumnDef<ZoneRow>[] {
  const base: ColumnDef<ZoneRow>[] = [
    { key: 'zone', label: 'Zóna', sortable: false, render: row => SHOT_ZONE_LABELS[row.zone] },
    { key: 'shots', label: 'Dobott', numeric: true, sortAccessor: row => row.attempts, render: row => `${row.made}/${row.attempts}` },
    { key: 'rate', label: 'Arány', numeric: true, sortAccessor: row => row.rate, render: row => pct(row.rate) },
    { key: 'fg', label: 'FG%', numeric: true, sortAccessor: row => row.fg ?? Number.NEGATIVE_INFINITY, render: row => pct(row.fg) },
  ];
  if (!withSeason) return base;
  return [
    ...base,
    { key: 'rateDelta', label: 'Δ arány', numeric: true, sortAccessor: row => row.rate - (row.seasonRate ?? row.rate), render: row => deltaCell(row.rate, row.seasonRate) },
    { key: 'fgDelta', label: 'Δ FG%', numeric: true, sortAccessor: row => (row.fg ?? 0) - (row.seasonFg ?? row.fg ?? 0), render: row => deltaCell(row.fg, row.seasonFg) },
    { key: 'seasonFg', label: 'Sz. FG%', numeric: true, sortAccessor: row => row.seasonFg ?? Number.NEGATIVE_INFINITY, render: row => pct(row.seasonFg) },
  ];
}

function ZoneTable({ summary, season }: { summary: TeamShotMapSummary; season: TeamShotMapSummary | null }) {
  return <DataTable columns={zoneColumns(season !== null)} rows={zoneRows(summary, season)} getRowId={row => row.zone} />;
}

function zoneHeatCells(summary: TeamShotMapSummary, season: TeamShotMapSummary): ZoneHeatCell[] {
  return SHOT_ZONE_KEYS.map(zone => {
    const game = summary.zones[zone].pct;
    const reference = season.zones[zone].pct;
    return {
      label: SHORT_ZONE_LABELS[zone],
      rateDelta: Math.round((zoneRate(summary, zone) - zoneRate(season, zone)) * 10) / 10,
      pctDelta: game === null || reference === null ? null : Math.round((game - reference) * 10) / 10,
    };
  });
}

/** Lefedettség: a dobástérkép dobásszáma a box score FGA-jához (csak a saját oldalra számolt). */
function CoverageNote({ shotMap, side }: { shotMap: PostgameShotMap; side: Side }) {
  const coverage = shotMap.coverage;
  return (
    <p className="text-xs text-secondary">
      Zónák az ESPN dobáskoordinátáiból (gyűrű ≤ 4 láb, festék 4–8 láb, középtáv a 8 láb feletti kettes, saroktripla
      az alapvonaltól 14 lábig). A dobáshely-mix index az ASEStats súlyozása (gyűrű és saroktripla +, középtáv −).
      {side === 'own' && coverage && (
        <>
          {' '}Lefedettség: <span className="font-mono tabular-nums">{coverage.shotMapAttempts}</span> dobás a box score{' '}
          <span className="font-mono tabular-nums">{coverage.boxAttempts}</span> mezőnykísérletéből.
        </>
      )}
      {side === 'own' && !shotMap.season && ' Szezonreferencia nincs (kis minta vagy liga-referencia).'}
    </p>
  );
}
