import type { ScoutingReport } from '@/lib/pregame-scouting';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Gauge, Scale, ShieldAlert, Trophy } from 'lucide-react';

const STAT_ICON_PROPS = { className: 'h-5 w-5', strokeWidth: 1.6 } as const;

const CONFIDENCE_LABELS: Record<ScoutingReport['winProbability']['confidence'], string> = {
  Low: 'Alacsony',
  Medium: 'Közepes',
  High: 'Magas',
};

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

function ProfileRow({ title, profile }: { title: string; profile: NonNullable<ScoutingReport['ownTeamProfile']> }) {
  return (
    <div>
      <h3 className="uppercase-label mb-2 text-sm text-secondary">{title}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="badge-orange">Tempó: {profile.tempo}</Badge>
        {profile.offense.map(style => (
          <Badge key={`o-${style}`} className="badge-cyan">{style}</Badge>
        ))}
        {profile.defense.map(style => (
          <Badge key={`d-${style}`} className="badge-neutral">{style}</Badge>
        ))}
      </div>
    </div>
  );
}

/** A négy fő kártya: nyerési esély, várható győztes, bizonyosság, az X-faktorok swing-je. */
export function ScoutingHeadlineCards({ report }: { report: ScoutingReport }) {
  const { winProbability, xFactorImpact } = report;
  const winner =
    winProbability.predictedWinner === 'own'
      ? report.ownTeamName
      : winProbability.predictedWinner === 'opponent'
        ? report.opponentTeamName
        : 'Kiegyenlített';
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Nyerési esély"
        value={`${winProbability.ownPct.toFixed(1)}%`}
        trend="neutral"
        trendValue={`ellenfél ${winProbability.opponentPct.toFixed(1)}%`}
        accentColor="orange"
        icon={<Gauge {...STAT_ICON_PROPS} />}
        animationDelay={0}
      />
      <StatCard
        label="Várható győztes"
        value={winner}
        trend="neutral"
        trendValue="modell-becslés"
        accentColor="cyan"
        icon={<Trophy {...STAT_ICON_PROPS} />}
        animationDelay={60}
      />
      <StatCard
        label="Bizonyosság"
        value={CONFIDENCE_LABELS[winProbability.confidence]}
        trend="neutral"
        trendValue={winProbability.confidenceReasons[0] ?? 'nincs jelzett korlát'}
        accentColor="cyan"
        icon={<ShieldAlert {...STAT_ICON_PROPS} />}
        animationDelay={120}
      />
      <StatCard
        label="X-faktor swing"
        value={xFactorImpact ? `+${xFactorImpact.combinedDeltaPct.toFixed(1)}%` : '–'}
        trend="neutral"
        trendValue="kontrollált forgatókönyvben"
        accentColor="green"
        icon={<Scale {...STAT_ICON_PROPS} />}
        animationDelay={180}
      />
    </div>
  );
}

/** A szabály-alapú összefoglaló: profilok, fő előnyök és kockázatok, játékterv, tartalék terv. */
export function ScoutingOverview({ report }: { report: ScoutingReport }) {
  const { fanSummary } = report;
  return (
    <Card className="animate-fade-slide-up">
      <CardContent className="flex flex-col gap-6">
        {fanSummary && <p className="text-sm leading-relaxed">{fanSummary.headline}</p>}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ProfileRow title={`${report.opponentTeamName} (ellenfél)`} profile={report.profile} />
          {report.ownTeamProfile && <ProfileRow title={`${report.ownTeamName} (saját)`} profile={report.ownTeamProfile} />}
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <PointList title="Az ellenfél veszélyei" items={report.threats} />
            <PointList title="Az ellenfél sebezhetőségei" items={report.vulnerabilities} />
            {fanSummary && <PointList title="Fő előnyök" items={fanSummary.keyEdges} />}
          </div>
          <div className="flex flex-col gap-5">
            <PointList title="Fókuszpontok" items={report.focusPoints} />
            {fanSummary && <PointList title="Játékterv" items={fanSummary.gamePlan} />}
            {fanSummary && <PointList title="Tartalék terv" items={fanSummary.fallbackPlan} />}
            {fanSummary && <PointList title="Fő kockázatok" items={fanSummary.majorRisks} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
