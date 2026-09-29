import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type StatInfo = {
  name: string;
  description: string;
  formula?: string;
  interpretation: string;
};

const statDescriptions: Record<string, StatInfo> = {
  points: {
    name: 'Pontok',
    description: 'A játékos által szerzett összes pont.',
    interpretation: 'Minél magasabb, annál jobb pontszerző.',
  },
  minutes: {
    name: 'Percek',
    description: 'A játékos által a pályán töltött idő.',
    interpretation: 'Mutatja a játékidőt és a fontosságot a csapatban.',
  },
  rebounds: {
    name: 'Lepattanók',
    description: 'Támadó és védekező lepattanók összege.',
    interpretation: 'Mutatja a palánk alatti dominanciát. Center játékosoknál 8+ jó értéknek számít.',
  },
  assists: {
    name: 'Gólpasszok',
    description: 'Olyan passz, ami közvetlenül pontszerzéshez vezet.',
    interpretation: 'Mutatja a játéktervezés képességét. Irányítóknál 4+ kiváló.',
  },
  steals: {
    name: 'Labdaszerzések',
    description: 'Az ellenfél labdájának megszerzése csel, pattanás vagy rossz passz miatt.',
    interpretation: 'Védekezési aktivitást mutat. 1+ per meccs jó értéknek számít.',
  },
  blocks: {
    name: 'Blokkolt dobások',
    description: 'Ellenfél dobásának megakadályozása.',
    interpretation: 'Palánk alatti védekezést mutat. Centerek esetén 1+ per meccs kiváló.',
  },
  turnovers: {
    name: 'Labdavesztések',
    description: 'A labda elvesztése az ellenfél javára.',
    interpretation: 'Alacsonyabb érték jobb. Assist/TO arány 2:1 felett jó.',
  },
  valuation: {
    name: 'Hatékonysági mutató (VAL)',
    description: 'Összetett mutató: (Pontok + Lepattanók + Gólpasszok + Labdaszerzések + Blokkolt) - (Kihagyott dobások + Labdavesztések + Hibák)',
    interpretation: '15+ kiváló, 10-15 jó, 5-10 átlagos, 5 alatt gyenge.',
  },
  'fg%': {
    name: 'Mezőnydobás %',
    description: 'A bedobott mezőnydobások aránya az összes kísérlethez képest.',
    formula: 'FG% = (Bedobott / Kísérlet) × 100',
    interpretation: '50%+ kiváló, 45-50% jó, 40-45% átlagos.',
  },
  '3p%': {
    name: 'Hármasdobás %',
    description: 'A bedobott hárompontosok aránya.',
    formula: '3P% = (Bedobott hárompontosok / Kísérlet) × 100',
    interpretation: '40%+ kiváló, 35-40% jó, 30-35% átlagos.',
  },
  'ft%': {
    name: 'Büntetődobás %',
    description: 'A bedobott büntetők aránya.',
    formula: 'FT% = (Bedobott büntetők / Kísérlet) × 100',
    interpretation: '85%+ kiváló, 75-85% jó, 70-75% átlagos.',
  },
  'ts%': {
    name: 'True Shooting Percentage (TS%)',
    description: 'A játékos összes pontszerzési hatékonyságát méri, figyelembe véve a mezőnydobásokat, triplákat és büntetőket.',
    formula: 'TS% = Pontok / (2 × (Mezőnydobás-kísérlet + 0.44 × Büntetők)) × 100',
    interpretation: '60%+ kiváló, 55-60% jó, 50-55% átlagos. Minél magasabb, annál hatékonyabb a pontszerzés. A legfontosabb dobóhatékonysági mutató.',
  },
  'efg%': {
    name: 'Effective Field Goal Percentage (eFG%)',
    description: 'A mezőnydobások hatékonyságát mutatja, úgy hogy a triplákat 1,5-szeres értéken számolja, mert azok 3 pontot érnek.',
    formula: 'eFG% = (Bedobott mezőnydobások + 0.5 × Triplák) / Mezőnydobás-kísérletek × 100',
    interpretation: '55%+ kiváló, 50-55% jó, 45-50% átlagos. Jobb mutató mint a sima FG%, mert figyelembe veszi a triplák nagyobb pontértékét.',
  },
  ortg: {
    name: 'Támadó hatékonyság (ORtg)',
    description: 'Csapatszintű mutató: 100 labdabirtoklásra jutó szerzett pont.',
    formula: 'ORtg = Szerzett pont / Labdabirtoklás × 100',
    interpretation: 'Magasabb érték jobb. A liga átlagához viszonyítva érdemes olvasni.',
  },
  drtg: {
    name: 'Védekező hatékonyság (DRtg)',
    description: 'Csapatszintű mutató: 100 labdabirtoklásra jutó kapott pont.',
    formula: 'DRtg = Kapott pont / Labdabirtoklás × 100',
    interpretation: 'Alacsonyabb érték jobb védekezést jelent. A liga átlagához viszonyítva érdemes olvasni.',
  },
};

interface StatInfoTooltipProps {
  stat: string;
  children: React.ReactNode;
}

export function StatInfoTooltip({ stat, children }: StatInfoTooltipProps) {
  const info = statDescriptions[stat.toLowerCase()];

  if (!info) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            {children}
            <Info className="h-3 w-3 text-secondary hover:text-primary transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs sm:max-w-sm md:max-w-md p-3" side="top">
          <div className="space-y-2">
            <div className="font-semibold text-orange">{info.name}</div>
            <p className="text-xs text-secondary">{info.description}</p>
            {info.formula && (
              <div className="text-xs bg-surface-1 p-2 rounded font-mono text-orange">
                {info.formula}
              </div>
            )}
            <div className="text-xs text-secondary border-t border-border-subtle pt-2">
              <span className="font-semibold text-primary">Értelmezés: </span>
              {info.interpretation}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
