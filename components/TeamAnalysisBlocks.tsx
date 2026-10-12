import type { Position, TeamAnalysis } from '@/lib/team-analysis';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { finalizeDefenseStyle, finalizeOffenseStyle } from '@/lib/style-vocabulary';
import { formatSigned } from '@/components/TeamStatsTable';
import { AlertTriangle } from 'lucide-react';

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

const percent = (ratio: number): string => `${Math.round(ratio * 100)}%`;

/** A liga-profil sorainak értéke a mutató fajtája szerint (a motor nyers értéket ad). */
function formatProfileValue(key: string, value: number): string {
  switch (key) {
    case 'two_rate':
    case 'three_rate':
    case 'assist_rate':
    case 'usage_concentration':
    case 'frontcourt_presence':
      return percent(value);
    case 'three_pct':
      return `${value.toFixed(1)}%`;
    case 'ft_rate':
      return value.toFixed(3);
    case 'net_rtg':
      return formatSigned(value);
    default:
      return value.toFixed(1);
  }
}

function PointList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="uppercase-label mb-2 text-sm text-secondary">{title}</h3>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm marker:text-muted">
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ProfileBars({ entries }: { entries: TeamAnalysis['leagueProfile']['entries'] }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Liga-profil (percentilis a szakasz csapatai között)">
      {entries.map(entry => (
        <li key={entry.key} className="grid grid-cols-[8.5rem_1fr_3.5rem_2.5rem] items-center gap-3">
          <span className="text-sm text-secondary" title={entry.tier}>{entry.label}</span>
          <div className="bar-track" role="presentation">
            <div className="bar-fill" style={{ width: `${entry.percentile}%` }} />
          </div>
          <span className="text-right font-mono text-sm tabular-nums text-secondary" data-stat>
            {formatProfileValue(entry.key, entry.value)}
          </span>
          <span className="text-right font-mono text-sm tabular-nums" data-stat>{entry.percentile}</span>
        </li>
      ))}
    </ul>
  );
}

interface TeamAnalysisSummaryProps {
  analysis: TeamAnalysis;
}

// A motor szabály-alapú kimenete: stílus, klaszter, összefoglaló, liga-profil, erősségek,
// limitációk és kockázatok.
export function TeamAnalysisSummary({ analysis }: TeamAnalysisSummaryProps) {
  const { leagueProfile } = analysis;
  const peers = leagueProfile.clusterPeers.length > 0 ? ` Hasonló csapatok: ${leagueProfile.clusterPeers.join(', ')}.` : '';
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          {finalizeOffenseStyle(analysis.style.offense).map(style => (
            <Badge key={`o-${style}`} className="badge-cyan">{style}</Badge>
          ))}
          {finalizeDefenseStyle(analysis.style.defense).map(style => (
            <Badge key={`d-${style}`} className="badge-neutral">{style}</Badge>
          ))}
          <Badge className="badge-orange">{leagueProfile.clusterLabel}</Badge>
        </div>
        <p className="text-sm leading-relaxed">{analysis.summary}{peers}</p>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ProfileBars entries={leagueProfile.entries} />
          <div className="flex flex-col gap-5">
            <PointList title="Erősségek" items={analysis.strengths} />
            <PointList title="Limitációk" items={analysis.limitations} />
            <PointList
              title="Kockázatok"
              items={analysis.riskPriorities.map(risk => risk.replace(/^\d+\.\s*/, ''))}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TeamRosterBlocksProps {
  analysis: TeamAnalysis;
  /** Kevés alkalmas játékos: a roster-alapú megállapítások nem megbízhatók. */
  thinRoster: boolean;
  eligiblePlayers: number;
  minReliablePlayers: number;
}

// A védekezési profil és a roster: poszt szerinti percmegoszlás, szerepkörök, jelzések.
export function TeamRosterBlocks({ analysis, thinRoster, eligiblePlayers, minReliablePlayers }: TeamRosterBlocksProps) {
  const { defensiveProfile, rosterSummary } = analysis;
  const roles = Object.entries(rosterSummary.roleCounts).filter(([, count]) => count > 0);
  const flags = [
    rosterSummary.flags.scorerDependency && 'Magas használat-koncentráció (két játékoson múlik a labdabirtoklás)',
    rosterSummary.flags.lowPlaymakingDepth && 'Kevés játéképítő mélység',
    rosterSummary.flags.weakReboundingPresence && 'Korlátozott magas posztok jelenléte',
  ].filter((flag): flag is string => Boolean(flag));

  return (
    <div className="stagger grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="animate-fade-slide-up" style={{ ['--i' as unknown as string]: 0 }}>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-lg">Védekezési profil</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm marker:text-muted">
            <li>{defensiveProfile.rimProtection}</li>
            <li>{defensiveProfile.perimeterDefense}</li>
            <li>{defensiveProfile.rebounding}</li>
            <li>{defensiveProfile.foulDiscipline}</li>
          </ul>
          {defensiveProfile.notes.map(note => (
            <p key={note} className="text-sm leading-relaxed text-secondary">{note}</p>
          ))}
        </CardContent>
      </Card>

      <Card className="animate-fade-slide-up" style={{ ['--i' as unknown as string]: 1 }}>
        <CardContent className="flex flex-col gap-4">
          <h3 className="text-lg">Roster</h3>
          {thinRoster && (
            <p role="note" className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
              Csak {eligiblePlayers} alkalmas játékos van (legalább {minReliablePlayers} kell), ezért a szerepkörök,
              a használat-koncentráció és a kockázatok kevéssé megbízhatók.
            </p>
          )}
          <div>
            <h4 className="uppercase-label mb-2 text-sm text-secondary">Percmegoszlás poszt szerint</h4>
            <ul className="flex flex-col gap-2" aria-label="Percmegoszlás poszt szerint">
              {POSITIONS.map(position => (
                <li key={position} className="grid grid-cols-[2.5rem_1fr_3rem] items-center gap-3">
                  <span className="text-sm text-secondary">{position}</span>
                  <div className="bar-track" role="presentation">
                    <div className="bar-fill" style={{ width: `${rosterSummary.positionMinutesShare[position]}%` }} />
                  </div>
                  <span className="text-right font-mono text-sm tabular-nums" data-stat>
                    {rosterSummary.positionMinutesShare[position].toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {roles.length > 0 && (
            <div>
              <h4 className="uppercase-label mb-2 text-sm text-secondary">Szerepkörök</h4>
              <div className="flex flex-wrap gap-2">
                {roles.map(([role, count]) => (
                  <Badge
                    key={role}
                    className="badge-neutral"
                    title={rosterSummary.rolePlayers[role]?.filter(Boolean).join(', ') || undefined}
                  >
                    {role} · {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <PointList title="Jelzések" items={flags} />
          <PointList title="Megfigyelések" items={analysis.rosterInsights} />
        </CardContent>
      </Card>
    </div>
  );
}
