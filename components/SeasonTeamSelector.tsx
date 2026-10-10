'use client';

import type { SeasonTeamSelection } from '@/hooks/useSeasonTeamSelection';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Star } from 'lucide-react';
import { toast } from 'sonner';

const SEASON_FIELD_ID = 'season-selector';
const TEAM_FIELD_ID = 'team-selector';
const FIELD_CLASS = 'w-full sm:w-64';

interface SeasonTeamSelectorProps {
  selection: SeasonTeamSelection;
}

// A globális szezon- és csapatszűrő. Tisztán megjelenítő komponens: az állapot
// és a törzsadat a `useSeasonTeamSelection()` hookból jön (T20, T21).
export function SeasonTeamSelector({ selection }: SeasonTeamSelectorProps) {
  const { seasons, teams, followedTeamId, season, team, selectSeason, selectTeam, loading, error, reload } = selection;

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  if (error) {
    return (
      <div role="alert" className="mb-6 flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 px-4 py-3 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0 text-negative" strokeWidth={1.8} />
        <span className="text-negative">{error}</span>
        <Button variant="ghost" size="sm" onClick={reload} className="ml-auto flex items-center gap-2">
          <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
          Újrapróbálás
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <div className={FIELD_CLASS}>
        <label htmlFor={SEASON_FIELD_ID} className="uppercase-label mb-2 block">Szezon</label>
        {loading ? (
          <div className="skeleton-shimmer h-9 w-full" />
        ) : seasons.length === 0 ? (
          <EmptyField>Nincs elérhető szezon.</EmptyField>
        ) : (
          <Select value={season?.id} onValueChange={selectSeason}>
            <SelectTrigger id={SEASON_FIELD_ID} className="w-full">
              <SelectValue placeholder="Válassz szezont" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className={FIELD_CLASS}>
        <label htmlFor={TEAM_FIELD_ID} className="uppercase-label mb-2 block">Csapat</label>
        {loading ? (
          <div className="skeleton-shimmer h-9 w-full" />
        ) : teams.length === 0 ? (
          <EmptyField>Nincs elérhető csapat.</EmptyField>
        ) : (
          <Select value={team?.id} onValueChange={selectTeam}>
            <SelectTrigger id={TEAM_FIELD_ID} className="w-full">
              <SelectValue placeholder="Válassz csapatot" />
            </SelectTrigger>
            <SelectContent>
              {teams.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {t.id === followedTeamId && (
                    <Star className="h-3.5 w-3.5 text-orange" strokeWidth={1.8} aria-label="Követett csapat" />
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

function EmptyField({ children }: { children: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border-active px-3 py-2 text-xs text-secondary">
      {children}
    </div>
  );
}
