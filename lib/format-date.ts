// Dátumformázás a nézetekhez. A `games.game_date` amerikai keleti parti nap:
// időzóna-átváltás nélkül írjuk ki, hogy a böngésző időzónája ne tolja el. A
// kezdési időpont (`start_time`) viszont a néző helyi idejében jelenik meg.

const LOCAL_START_FORMAT = new Intl.DateTimeFormat('hu-HU', {
  month: 'short',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** `YYYY-MM-DD` → `2026. 03. 01.` */
export function formatGameDate(gameDate: string): string {
  const [year, month, day] = gameDate.split('-');
  return `${year}. ${month}. ${day}.`;
}

/** ISO időpont → a néző helyi ideje, pl. `okt. 22., Cs 04:00`. */
export function formatLocalStart(startTime: string): string {
  return LOCAL_START_FORMAT.format(new Date(startTime));
}
