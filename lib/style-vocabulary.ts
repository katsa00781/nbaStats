export const OFFENSE_STYLE_LABELS = {
  transition: 'Gyorsindítás-orientált',
  halfcourt: 'Félpályás támadás',
  perimeter: 'Periméter-fókuszú',
  interior: 'Belső fókuszú',
  balanced: 'Kiegyensúlyozott támadás',
} as const;

export const DEFENSE_STYLE_LABELS = {
  pressure: 'Labdanyomás',
  rim: 'Festékvédelem',
  perimeter: 'Perimétervédelem',
  disciplined: 'Kevés faultos védekezés',
  balanced: 'Kiegyensúlyozott védekezés',
  limited: 'Nincs kiugró védőszignatúra',
} as const;

export const finalizeOffenseStyle = (styles: string[]) =>
  styles.length > 0 ? Array.from(new Set(styles)) : [OFFENSE_STYLE_LABELS.balanced];

export const finalizeDefenseStyle = (styles: string[], limited = false) =>
  styles.length > 0
    ? Array.from(new Set(styles))
    : [limited ? DEFENSE_STYLE_LABELS.limited : DEFENSE_STYLE_LABELS.balanced];