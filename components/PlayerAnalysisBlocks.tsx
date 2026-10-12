import type { AdvancedPlayerBlocks, PlayerAnalysis, SkillScores } from '@/lib/player-analysis';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SKILL_LABELS } from '@/lib/player-analysis';

const SKILL_ORDER: (keyof SkillScores)[] = ['scoring', 'shooting', 'playmaking', 'rebounding', 'defense', 'efficiency'];

const fixed = (value: number, digits = 1): string => value.toFixed(digits);
const share = (rate: number): string => `${Math.round(rate * 100)}%`;

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="uppercase-label text-xs text-secondary">{label}</span>
      <span className="font-mono text-sm tabular-nums" data-stat>{value}</span>
    </div>
  );
}

function SkillBars({ scores }: { scores: SkillScores }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Skill-pontok (poszt szerinti percentilis)">
      {SKILL_ORDER.map(skill => (
        <li key={skill} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3">
          <span className="text-sm text-secondary">{SKILL_LABELS[skill]}</span>
          <div className="bar-track" role="presentation">
            <div className="bar-fill" style={{ width: `${scores[skill]}%` }} />
          </div>
          <span className="text-right font-mono text-sm tabular-nums" data-stat>{scores[skill]}</span>
        </li>
      ))}
    </ul>
  );
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

// A motor szabály-alapú kimenete: szerepkörök, skill-pontok, erősségek és limitációk.
export function PlayerAnalysisSummary({ analysis }: { analysis: PlayerAnalysis }) {
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          {analysis.roles.map(role => (
            <Badge key={role} className="badge-cyan">{role}</Badge>
          ))}
          <Badge className="badge-neutral">{analysis.position}</Badge>
          <Badge className="badge-neutral">Megbízhatóság: {analysis.confidence}</Badge>
        </div>
        <p className="text-sm leading-relaxed">{analysis.summary}</p>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <SkillBars scores={analysis.skillScores} />
          <div className="flex flex-col gap-5">
            <PointList title="Erősségek" items={analysis.strengths} />
            <PointList title="Limitációk" items={analysis.limitations} />
            <PointList title="Fejlesztendő" items={analysis.improvements} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface BlockCardProps {
  title: string;
  metrics: MetricProps[];
  narrative: string;
  index: number;
}

function BlockCard({ title, metrics, narrative, index }: BlockCardProps) {
  return (
    <Card className="animate-fade-slide-up" style={{ ['--i' as unknown as string]: index }}>
      <CardContent className="flex flex-col gap-4">
        <h3 className="text-lg">{title}</h3>
        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
          {metrics.map(metric => (
            <Metric key={metric.label} {...metric} />
          ))}
        </div>
        {narrative && <p className="text-sm leading-relaxed text-secondary">{narrative}</p>}
      </CardContent>
    </Card>
  );
}

// Az öt haladó blokk (dobás, játéképítés, védekezés, pontszerzés, hatékonyság). A
// mutatók 36 percre vetítettek, a százalékok az összesített dobásokból jönnek (T12).
export function PlayerAdvancedBlocks({ blocks }: { blocks: AdvancedPlayerBlocks }) {
  const { shooting, playmaking, defense, scoring, efficiency } = blocks;
  return (
    <div className="stagger grid grid-cols-1 gap-4 xl:grid-cols-2">
      <BlockCard
        title="Dobás"
        index={0}
        metrics={[
          { label: 'TS%', value: `${fixed(shooting.tsPct)}%` },
          { label: 'eFG%', value: `${fixed(shooting.efg)}%` },
          { label: '3P%', value: `${fixed(shooting.threePct)}%` },
          { label: 'Közeli FG%', value: `${fixed(shooting.closeEffPct)}%` },
          { label: 'Közép FG%', value: `${fixed(shooting.midEffPct)}%` },
          { label: 'FT%', value: `${fixed(shooting.ftPct)}%` },
          { label: 'Közeli arány', value: share(shooting.rimRate) },
          { label: 'Közép arány', value: share(shooting.midRate) },
          { label: 'Hármas arány', value: share(shooting.threeRate) },
        ]}
        narrative={shooting.narrative}
      />
      <BlockCard
        title="Játéképítés"
        index={1}
        metrics={[
          { label: 'AST / 36', value: fixed(playmaking.astPer36) },
          { label: 'AST / TO', value: fixed(playmaking.astTo, 2) },
          { label: 'Használat / 36', value: fixed(playmaking.usageProxy) },
        ]}
        narrative={playmaking.narrative}
      />
      <BlockCard
        title="Védekezés"
        index={2}
        metrics={[
          { label: 'STL / 36', value: fixed(defense.stlPer36) },
          { label: 'BLK / 36', value: fixed(defense.blkPer36) },
          { label: 'DREB / 36', value: fixed(defense.defRebPer36) },
          { label: 'PF / 36', value: fixed(defense.foulsPer36) },
        ]}
        narrative={defense.narrative}
      />
      <BlockCard
        title="Pontszerzés"
        index={3}
        metrics={[
          { label: 'PTS / 36', value: fixed(scoring.ptsPer36) },
          { label: 'TS%', value: `${fixed(scoring.tsPct)}%` },
          { label: 'Használat / 36', value: fixed(scoring.usageProxy) },
        ]}
        narrative={scoring.narrative}
      />
      <BlockCard
        title="Hatékonyság"
        index={4}
        metrics={[
          { label: 'VAL / 36', value: fixed(efficiency.valPer36) },
          { label: 'TS%', value: `${fixed(efficiency.tsPct)}%` },
          { label: 'eFG%', value: `${fixed(efficiency.efg)}%` },
        ]}
        narrative={efficiency.narrative}
      />
    </div>
  );
}
