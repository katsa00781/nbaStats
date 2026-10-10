# UI Context – "Dark Command Center"

_Utoljára frissítve: 2026-08-30 · Teljes újraírás a valós `app/globals.css` alapján._

> **Single Source of Truth: `app/globals.css`.**
> A nyers tokenek az első `:root` blokkban (15–69. sor), a Tailwind utility-vé konvertálás a `@theme inline` blokkban (75–133. sor). Színt, fontot vagy radiust **sehol máshol nem definiálunk** – sem komponensben, sem külön config fájlban.
>
> Ha ez a dokumentum és a `globals.css` ellentmond egymásnak, a CSS a mérvadó, és ez a fájl a hibás.

---

## 1. Téma

Sötét mód **only** – nincs light mode, nincs téma-váltó. Az `<html>` elem fix `className="dark"` attribútumot kap (`app/layout.tsx`), a `<body>` pedig `bg-base text-primary antialiased` osztályokat.

A `@custom-variant dark (&:where(.dark, .dark *))` deklaráció miatt a `dark:` prefix működik, de a gyakorlatban felesleges: minden mindig sötét.

A vizuális nyelv: **sportos telemetria**. Mély kék-fekete alap, felfelé világosodó felület-rétegek, cián accent, monospace számok, szűk sarkok, glow-alapú interakció. Nem „barátságos consumer app", hanem műszerfal.

---

## 2. Színrendszer

### Surface skála – mélységi rétegek

| Token | Hex | Tailwind | Szerep |
|---|---|---|---|
| `--bg-base` | `#050B14` | `bg-base` | Oldal háttér |
| `--bg-surface-1` | `#0A1628` | `bg-surface-1` | Card alap, sidebar |
| `--bg-surface-2` | `#0F1F3D` | `bg-surface-2` | Hover, popover, input, tábla-fejléc |
| `--bg-surface-3` | `#162440` | `bg-surface-3` | Beágyazott elem, aktív tab háttér |

### Accentek

| Token | Hex | Tailwind | Szerep |
|---|---|---|---|
| `--accent-cyan` | `#00D4FF` | `text-cyan` / `bg-cyan` | Primary, fókusz, link, aktív állapot |
| `--accent-cyan-dim` | `#0096B8` | `text-cyan-dim` | Gradiens vég, scrollbar hover |
| `--accent-orange` | `#FF6B35` | `text-orange` | CTA, kiemelt érték |
| `--accent-orange-dim` | `#B84A22` | `text-orange-dim` | Narancs gradiens vég |
| `--accent-ai` | `#7C3AED` | `text-ai` / `bg-ai` | AI generált tartalom |
| `--accent-ai-dim` | `#5B21B6` | `text-ai-dim` | AI gradiens vég |

### Szöveg

| Token | Hex | Tailwind |
|---|---|---|
| `--text-primary` | `#E8F4FF` | `text-primary` |
| `--text-secondary` | `#7A9ABB` | `text-secondary` |
| `--text-muted` | `#4A6D95` | `text-muted` |

> A `--text-secondary` és `--text-muted` **szándékosan világosabb**, mint az eredeti `AseStat 2` mockupokban – olvashatósági döntés, lásd `BACKLOG.md` „Design konzisztencia" sprint. A `CLAUDE.md` még a régi (`#5A7A99` / `#2D4A6B`) értékeket írja; **az itt szereplő értékek a helyesek**.

### Szemantikus jelzések

| Token | Hex | Tailwind | Szerep |
|---|---|---|---|
| `--positive` | `#10D98A` | `text-positive` | Nyert, növekedés, delta-up |
| `--negative` | `#FF4757` | `text-negative` | Vesztett, csökkenés, élő jelzés |
| `--warning` | `#FFB627` | `text-warning` | Figyelmeztetés, elavult adat |

### Vonalak – solid értékek, nem rgba

| Token | Hex | Tailwind |
|---|---|---|
| `--border-subtle` | `#0F2040` | `border-border-subtle` |
| `--border-active` | `#1E3A5F` | `border-border-active` |
| `--border-strong` | `#2A4A75` | `border-border-strong` |

A `@layer base` globálisan `border-color: var(--border-subtle)`-t ad **minden** elemnek, így a `border` utility önmagában is helyes színt kap.

### Glow-k – rgba, box-shadow / drop-shadow használatra

| Token | Érték |
|---|---|
| `--glow-cyan` | `rgba(0, 212, 255, 0.15)` |
| `--glow-cyan-hot` | `rgba(0, 212, 255, 0.45)` |
| `--glow-orange` | `rgba(255, 107, 53, 0.15)` |
| `--glow-orange-hot` | `rgba(255, 107, 53, 0.45)` |
| `--glow-ai` | `rgba(124, 58, 237, 0.18)` |
| `--glow-positive` | `rgba(16, 217, 138, 0.18)` |
| `--glow-negative` | `rgba(255, 71, 87, 0.18)` |

---

## 3. Tipográfia – 3 család, szigorú szereposztás

A fontokat az `app/layout.tsx` tölti `next/font/google`-lal, `subsets: ["latin", "latin-ext"]` (a magyar ékezetekhez kötelező), `weight: ["400","500","600","700"]`, `display: "swap"`.

| Család | CSS változó | Tailwind | Mire való |
|---|---|---|---|
| **Barlow Condensed** | `--font-display` | `font-display` | H1–H4, label, badge, gomb, tab trigger. Label-eknél ALL CAPS + `0.12em` tracking. |
| **DM Sans** | `--font-body` | `font-sans` (default) | Body szöveg, leírások, paragrafusok. |
| **JetBrains Mono** | `--font-mono` | `font-mono` | **Minden numerikus érték**, kötelező `tabular-nums`. |

### Base szintű tipográfia (`@layer base`)

```
h1  600 · clamp(2rem, 4vw, 3rem) · line-height 1     ← az egyetlen fluid méret a rendszerben
h2  600 · 1.75rem · line-height 1.05
h3  600 · 1.25rem · line-height 1.1
```
Mindhárom `--font-display` + `letter-spacing: -0.01em`.

### Két globális segédszelektor

- **`.stat` / `[data-stat]`** → mono + `font-variant-numeric: tabular-nums` + `font-feature-settings: "tnum","zero"` + `letter-spacing: -0.02em`.
  Minden statisztikai szám kapja meg valamelyiket – a `StatCard` automatikusan `data-stat`-tel rendereli az értéket.
- **`.label` / `[data-label]` / `.uppercase-label`** → display font 600, uppercase, `0.12em` tracking, `0.75rem`, `--text-secondary`.

A `html, body` `font-feature-settings: "ss01", "cv11"` beállítást kap.

---

## 4. Sarok (radius)

Szűk, sűrű skála – ez adja a telemetria-karaktert. **Ne kerekíts jobban.**

| Token | Érték | Kontextus |
|---|---|---|
| `--radius-xs` | `2px` | Badge, tag |
| `--radius-sm` | `4px` | Input, select, textarea, kis gomb, tab trigger |
| `--radius-md` | `6px` | Gomb, tabs-list |
| `--radius-lg` | `10px` | Card, DataTable shell |
| `--radius-xl` | `14px` | Modál |

A shadcn `--radius` alapértéke `var(--radius-md)` = **6px** (nem `0.625rem`).

---

## 5. Glow és árnyék

Tailwind utility-ként (`@theme inline`) **és** kézzel írt osztályként is elérhetők, azonos értékekkel:

| Osztály | Érték |
|---|---|
| `shadow-glow-cyan` | `0 0 20px var(--glow-cyan)` |
| `shadow-glow-cyan-hot` | `0 0 32px var(--glow-cyan-hot)` |
| `shadow-glow-orange` | `0 0 20px var(--glow-orange)` |
| `shadow-glow-orange-hot` | `0 0 32px var(--glow-orange-hot)` |
| `shadow-glow-ai` | `0 0 24px var(--glow-ai)` |
| `shadow-glow-positive` | `0 0 20px var(--glow-positive)` |
| `shadow-glow-negative` | `0 0 20px var(--glow-negative)` |
| `shadow-panel` | `0 1px 0 0 rgba(255,255,255,.03) inset, 0 24px 60px -28px rgba(0,0,0,.8)` |

Az interakció **glow-alapú, nem szín-váltás**: hover/focus esetén cián fény gyúl, nem átszíneződik az elem.

---

## 6. Háttér

A `body` három rétegű `background-image`-et kap, `background-attachment: fixed`:

1. Pont-rács: `radial-gradient(circle at 1px 1px, rgba(0,212,255,0.045) 1px, transparent 0)` @ `24px 24px`
2. Cián glow folt bal felül: `radial-gradient(1200px 600px at 20% -10%, rgba(0,212,255,.05), transparent 60%)`
3. Narancs glow folt jobb alul: `radial-gradient(900px 500px at 95% 110%, rgba(255,107,53,.04), transparent 60%)`

Egyedi felületre két utility áll rendelkezésre: **`.grid-overlay`** (32px rács `--border-subtle` vonalakkal) és **`.dot-overlay`** (16px pontok `--border-active` színnel).

Scrollbar: 8px, track `--bg-surface-1`, thumb `--border-active` 2px sarokkal, hover `--accent-cyan-dim`.
Kijelölés (`::selection`): cián háttér, `--bg-base` szöveg.

---

## 7. Komponens könyvtár

shadcn/ui **New York** stílus, Tailwind CSS 4 + Radix UI primitíveken.

- Helye: `components/ui/`
- Alapkomponensek: `badge`, `button`, `card`, `input`, `label`, `select`, `tabs`, `textarea`, `tooltip`
- Projekt-szintű saját komponensek ugyanitt: `stat-card.tsx`, `data-table.tsx`
- Új shadcn komponens: `npx shadcn@latest add <name>` — **soha ne kézzel írj `components/ui/`-ba**, kivéve a fenti két projekt-komponenst
- Variánsok: `cva` (Class Variance Authority), a `button.tsx` mintájára
- Osztály-kombinálás: `cn()` (`lib/utils.ts` – clsx + tailwind-merge)

### shadcn változó-override-ok

A `globals.css` 3. blokkja átírja a shadcn default változókat a Dark Command Center palettára, így minden alapkomponens azonnal helyes:

```
--background → --bg-base          --card       → --bg-surface-1
--foreground → --text-primary     --popover    → --bg-surface-2
--primary    → --accent-cyan      --secondary  → --bg-surface-2
--muted      → --bg-surface-2     --accent     → --bg-surface-3
--destructive→ --negative         --border     → --border-subtle
--input      → --bg-surface-2     --ring       → --accent-cyan
--radius     → --radius-md
--chart-1..5 → cyan · orange · positive · ai · warning
```

### `data-slot` szelektoros override-ok

A `globals.css` 5. blokkja a Radix `data-slot` attribútumokra illeszt:

| Slot | Stílus |
|---|---|
| `card` | `--bg-surface-1`, 1px `--border-subtle`, `--radius-lg`, 200ms `--ease-snap` átmenet. Hover → `--bg-surface-2` + `--border-active`. |
| `button[data-variant="default"]` | Tömör cián, `--bg-base` szöveg, display font 600, uppercase, `0.08em` tracking. Hover → `0 0 24px var(--glow-cyan-hot)` + `brightness(1.08)`. |
| `button[data-variant="secondary"]` | `--bg-surface-2` + `--border-active`; hover → `--bg-surface-3` + `--accent-cyan-dim` keret. |
| `button[data-variant="ghost"]` | Átlátszó, `--text-secondary`; hover → `--bg-surface-2` + `--text-primary`. |
| `button[data-variant="outline"]` | Átlátszó, `--border-active` keret; hover → `--bg-surface-2` + `--accent-cyan-dim`. |
| `button[data-variant="destructive"]` | `color-mix(--negative 18%)` háttér, negatív szöveg, 35% keret; hover → 28%. |
| `button[data-variant="link"]` | Átlátszó, cián szöveg. |
| `badge` | Display font 600, uppercase, `0.12em`, `0.7rem`, padding `0.2rem 0.55rem`, `--radius-xs`. |
| `input` / `select-trigger` / `textarea` | `--bg-surface-1`, `--border-active`, `--radius-sm`. Az input és select-trigger **mono fontot** kap. Fókusz → cián keret + `0 0 0 3px color-mix(--accent-cyan 18%)`. Placeholder `--text-muted`. |
| `tabs-list` | Inline-flex, `--bg-surface-1`, `--border-subtle`, `--radius-md`, 4px padding, 2px gap. |
| `tabs-trigger` | Display 600 uppercase `0.1em` `0.78rem`, `--text-secondary`. Aktív → `--bg-surface-3` + cián szöveg + `inset 0 -2px 0 0 cyan, 0 0 16px var(--glow-cyan)`. |

### Badge variánsok

Hét kézi osztály, egységes képlettel: háttér `color-mix(<token> 14%, transparent)`, szöveg a token, keret `color-mix(<token> 30%, transparent)`.

`.badge-cyan` · `.badge-orange` · `.badge-ai` · `.badge-positive` · `.badge-negative` · `.badge-warning` · `.badge-neutral`

Két kivétel: az **`.badge-ai`** erősebb (16% háttér / 40% keret) és literál `#C4B5FD` szöveget használ, mert a `--accent-ai` sötét háttéren nem olvasható. A **`.badge-neutral`** nem color-mix-et, hanem `--bg-surface-2` / `--text-secondary` / `--border-active` hármast.

---

## 8. Projekt-szintű komponensek

### `components/ui/stat-card.tsx` – KPI kártya

```ts
export type AccentColor = "cyan" | "orange" | "green" | "purple";
export type TrendDir = "up" | "down" | "neutral";

export interface StatCardProps {
  label: string;
  value: string | number;
  trend?: TrendDir;
  trendValue?: string;
  icon?: ReactNode;
  accentColor?: AccentColor;   // default "cyan"
  animationDelay?: number;     // ms, inline animationDelay
  className?: string;
}
```

Accent leképezés inline CSS változókra (`--accent-color`, `--accent-glow`):
`cyan → --accent-cyan/--glow-cyan` · `orange → --accent-orange/--glow-orange` · `green → --positive/--glow-positive` · `purple → --accent-ai/--glow-ai`.

Felépítés: `rounded-[10px] bg-surface-1 border border-border-subtle`, `min-h-35 pl-6 pr-5 py-4.5`, belépéskor `animate-fade-slide-up`.
**Bal oldali 3px accent sín** a `before:` pszeudoelemen (`before:w-0.75` + `0 0 12px` glow) – ez a rendszer legfelismerhetőbb vizuális jele.
Címke: `font-display uppercase text-[0.7rem] tracking-[0.14em] text-secondary`.
Érték: `font-mono tabular-nums text-[2.5rem] leading-none tracking-[-0.03em]` + `animate-count-up` + `data-stat`.
Hover: `-translate-y-0.5` + `surface-1 → surface-2` gradiens + accent-színű glow árnyék.

> **Mobil korlát**: a `text-[2.5rem]` és a `min-h-35` breakpoint nélküli – négy StatCard nem fér ki telefonon. A mobil megoldás külön komponens (`StatTile`) (az ASEStats mobil appjában; itt nincs mobil kliens).

### `components/ui/data-table.tsx` – generikus tábla

```ts
export type SortDir = "asc" | "desc";

export type ColumnDef<T> = {
  key: string;
  label: string;
  numeric?: boolean;                      // → data-num, jobbra igazítás, mono
  center?: boolean;
  sortable?: boolean;                     // default TRUE – csak a `false` tiltja
  sortAccessor?: (row: T) => string | number;
  width?: number;                         // px, inline style a <th>-n
  render?: (row: T, idx: number) => ReactNode;
};

// A DataTableProps<T> nem exportált:
//   columns, rows, initialSort?, activeRowId?, getRowId?, footer?, className?
export function DataTable<T>(...): JSX.Element
```

Viselkedés: saját (uncontrolled) sort state; a `toggleSort` **desc → asc → rendezetlen** ciklust jár be; magyar rendezés (`localeCompare(…, "hu")`); a `null` értékek hátra kerülnek; számok numerikusan hasonlítódnak. `getRowId` default a sor indexe. Sort ikon: Lucide `ChevronUp`, `strokeWidth={2.5}`.

Használat: `GameLog.tsx`, `PlayersList.tsx`, `GameDetails.tsx`, `StandingsView.tsx`.

### DataTable CSS réteg (`globals.css` 9. blokk)

DOM: `.dt-shell > .dt-scroll > table.dt-table` + opcionális `.dt-foot`.

| Csoport | Osztályok |
|---|---|
| Váz | `.dt-shell` (surface-1, `--radius-lg`), `.dt-scroll` (overflow-x auto, vékony scrollbar), `.dt-table` |
| Fejléc | `.dt-th` + `[data-num]` / `[data-center]` / `[data-sortable]` / `[data-sorted]`, `.dt-sort`, `.dt-sort-icon` |
| Cella | `.dt-td`, `.dt-num` + `--muted` / `--strong` / `--pos` / `--neg`, `.dt-rank` |
| Játékos | `.dt-player`, `.dt-player-avatar` (30px kör), `.dt-player-name` (cián, kattintható), `.dt-player-meta` |
| Csapat | `.dt-team`, `.dt-team-logo` (26px), `.dt-team-name` |
| Badge | `.dt-badge` + `--win` / `--loss` / `--pg` / `--sg` / `--sf` / `--pf` / `--c` / `--neutral` |
| Trend | `.dt-trend` + `--up` / `--down` / `--flat` |
| Bar | `.dt-bar`, `.dt-bar-track`, `.dt-bar-fill`, `.dt-bar-fill--orange`, `.dt-bar-val` |
| Streak | `.dt-streak`, `.dt-streak-dot` + `--w` / `--l` |
| Lábléc | `.dt-foot`, `.dt-foot-pager`, `.dt-foot-btn` (+ `[data-active="true"]`) |

Sor-interakció: hover → `--bg-surface-2` + `inset 2px 0 0 0 var(--accent-cyan)`; `[data-active="true"]` → ugyanez + `0 0 24px -4px var(--glow-cyan)`.

> **Mobil korlát**: a `.dt-th` és `.dt-td` `white-space: nowrap` + `padding: 14px` – a tábla telefonon mindig kilóg, és nincs kártyás fallback. A mobil megoldás két külön minta (StackedRow / StatMatrix) (az ASEStats mobil appjában; itt nincs mobil kliens).

---

## 9. Layout: AppShell

A korábbi `container mx-auto` + `bg-slate-900` header minta **megszűnt** (AppShell sprint, 2026-07-19). A jelenlegi szerkezet:

```
.app-shell  (CSS grid: var(--sb-w-expanded) 1fr)
├── AppSidebar   (.sidebar – sticky, height 100vh, surface-1, z-40)
└── main         (px-4 sm:px-8 lg:px-9 py-6 sm:py-7 pb-24 md:pb-7)
    ├── AppTopbar
    ├── SeasonTeamSelector   (szezon + csapat; `flex flex-wrap gap-4`, mezőnként `w-full sm:w-64`)
    └── tartalom
```

A `SeasonTeamSelector` (NBAStats, 2026-10-10) minden tabon látszik: két shadcn `Select` `.uppercase-label` címkével, a követett csapat mellett narancs Lucide `Star`. Betöltéskor mezőnként `.skeleton-shimmer h-9`, hibánál inline panel (`AlertCircle` + üzenet + ghost „Újrapróbálás” gomb) és `toast.error`. Új token nincs.

Layout-konstansok (nem design tokenek, komponens-lokális méretek):
`--sb-w-expanded: 240px` · `--sb-w-collapsed: 64px` · `--sb-transition: 220ms cubic-bezier(.4,0,.2,1)`

Az `.app-shell.is-collapsed` `64px 1fr`-re vált.

### Két overflow-fix – ne töröld őket

```css
.app-shell > main { min-width: 0; }
.grid > * { min-width: 0; }
```
A második globális: a Recharts `ResponsiveContainer` egyébként szétfeszíti a teljes oldalszélességet. A grid mindenhol elrendezésre szolgál, nem tartalom-alapú méretezésre; a tényleges görgetést a belső `overflow-x-auto` konténerek kezelik.

### Sidebar osztályok

`.sb-header` (64px) · `.sb-logo` (28px, radiális cián glow) · `.sb-brand` / `.sb-wordmark` (display 700) / `.sb-sub` (mono `0.62rem`, `0.18em`) · `.sb-toggle` (28px kör, `right: -14px`) · `.sb-nav` · `.sb-group` / `.sb-group-label` · `.nav-item` (38px magas, `--radius-md`) + `.nav-item-icon` (20px) / `.nav-item-label` / `.nav-item-meta` (numerikus badge) / `.nav-item-tip` (tooltip összecsukott módban) · `.sb-footer` · `.sb-avatar` (32px, `linear-gradient(135deg, cyan-dim, ai)`, `::after` zöld jelenlét-pont) / `.sb-user` / `.sb-user-email` / `.sb-user-role`

Aktív nav-item: `inset 3px 0 0 0 var(--accent-cyan)` bal sín.
Tónus-variánsok: `[data-tone="ai"].active` → lila sín + `#C4B5FD` ikon + `drop-shadow(0 0 10px var(--glow-ai))`; `[data-tone="negative"]` → negatív szín.
Fókusz: `.nav-item:focus-visible`, `.sb-toggle:focus-visible` → `outline: 2px solid var(--accent-cyan); outline-offset: 2px`.

### Navigáció modellje

**Igazolások (2026-09-21):** a Csapat csoport 13. nav itemje (`movements`,
`ArrowLeftRight`). Öt meglévő `StatCard` + csapatonként két `DataTable`
(érkezők/távozók); nincs új token vagy alapkomponens. Ezen a tabon a globális
csapatszűrő az „Összes követett csapat” opcióval liganézetet is ad. Betöltéskor
skeleton, hibánál újrapróbálás, adathiánynál magyarázó üres állapot jelenik meg.
A sidebar localStorage állapotát hidratálásbiztos `useSyncExternalStore`
feliratkozás követi; a gomb, Cmd/Ctrl+B és perzisztencia viselkedése megmarad.

A `NAV_GROUPS` konstans a `components/AppSidebar.tsx`-ben él, és az `AppTopbar.tsx` is innen importálja a breadcrumb-hoz. **A tab-váltás state-alapú** (`useState('overview')` az `app/page.tsx`-ben), nem URL-alapú – nincs router, nincs deep link, frissítés után mindig az `overview` tab töltődik.

A sidebar összecsukott állapota `localStorage`-ban perzisztál (`ase.sidebar.collapsed`), a **Cmd/Ctrl+B** billentyű kapcsolja.

---

## 10. Mobil viselkedés (web)

Egyetlen media query, `@media (max-width: 768px)`:

- `.app-shell` egyoszlopossá válik
- `.sidebar` **alsó fix navsávvá** alakul (`position: fixed; bottom: 0`, `flex-direction: row`, felül `--border-active` keret, `0 -12px 32px rgba(0,0,0,.5)` árnyék)
- `.sb-header`, `.sb-footer`, `.sb-toggle`, `.sb-group-label` elrejtve
- `.sb-nav` vízszintesen görgethető, `space-around` igazítással; a csoportok közt `::before` elválasztó vonal
- `.nav-item` 56px széles oszlopelrendezés, a címke `0.62rem`-re zsugorodik és `!important`-tal láthatóvá válik
- `.nav-item-tip` és `.nav-item-meta` elrejtve
- Aktív elem: `--bg-surface-2` háttér + `::after` 24×3px cián indikátor csík felül, tónus-variánsokkal

A `main` `pb-24 md:pb-7` padding biztosít helyet az alsó sávnak.

> Ez **csak a navigációt** oldja meg. A tartalom (DataTable, StatCard, chartok, prefixeletlen `grid-cols-3/4`) nincs mobilra tervezve – mobil kliens ebben a projektben nincs.

---

## 11. Animációk

| Utility | Keyframe | Időzítés |
|---|---|---|
| `.animate-count-up` | opacity + `translateY(8px)` + `blur(4px)` → tiszta | 1.2s `--ease-snap` both |
| `.animate-fade-slide-up` | opacity + `translateY(12px)` → 0 | 400ms `--ease-snap` both |
| `.animate-trend-in` | opacity + `translateX(-4px)` → 0 | 480ms `--ease-snap`, **280ms késleltetés** |
| `.animate-pulse-glow` | glow gyűrű pulzálás | 1.8s ease-in-out ∞ |
| `.animate-blink` | opacity 1 ↔ 0.25 | 1.1s steps(2, end) ∞ |
| `.animate-scan` | `translateY(-100%)` → `100%` | 3s linear ∞ |
| `.skeleton-shimmer` | `::after` gradiens sáv, `background-position -200% → 200%` | 1.6s linear ∞ |

Easingek: `--ease-snap: cubic-bezier(.2,.8,.2,1)` · `--ease-glide: cubic-bezier(.4,0,.2,1)`

**Stagger minta** – a szülő kap `.stagger`-t, a gyerekek inline `--i` indexet; a lépésköz **60ms**:

```tsx
<div className="stagger">
  {items.map((item, i) => (
    <div key={item.id} className="animate-fade-slide-up" style={{ ['--i' as string]: i }}>
      …
    </div>
  ))}
</div>
```

> **Hiányosság**: a rendszer sehol nem kezeli a `prefers-reduced-motion`-t, három végtelen animáció mellett. Backlog-tétel.

---

## 12. Egyedi utility osztályok

| Osztály | Mit csinál |
|---|---|
| `.ai-marker` | Bal oldali 2px függőleges lila gradiens sáv (`::before`, `top/bottom: 10%`) + `0 0 12px var(--glow-ai)`. AI generált tartalom jelölésére. |
| `.live-dot` | 8px piros kör, `pulse-glow` 1.6s ∞. Élő jelzés. |
| `.bar-track` / `.bar-fill` | 6px magas pill sáv `--bg-surface-3` alapon, cián gradiens kitöltéssel (`cyan-dim → cyan`) és glow-val. |
| `.hairline` | 1px magas, két végén elhalványuló vízszintes elválasztó. |
| `.cmd-input` | Terminál-stílusú input: surface-1, `--border-active`, mono font, cián fókusz-gyűrű. |
| `.grid-overlay` / `.dot-overlay` | Rács- és pont-textúra egyedi felületre. |

---

## 13. Ikonok

**Lucide React**, kizárólag stroke-alapú.

- Stroke-width: `1.5` finomabb · `1.6–1.8` standard · `2` erős
- Inline szöveg mellett: `h-3.5 w-3.5` vagy `h-4 w-4`
- Gombokban: `h-4 w-4` (`gap-2`-vel a felirat mellé)
- Header / nagy elem: `h-5 w-5` vagy `h-6 w-6`
- Sidebar nav-item: `.nav-item-icon` = 20px

---

## 14. Chartok

Két könyvtár él egymás mellett – egyik sem váltja ki a másikat:

- **Chart.js + react-chartjs-2** – shot chart és komplex canvas vizualizáció (`PostgameShotScatterChart`, `PostgameZoneHeatmapChart`)
- **Recharts** – trendek és összehasonlítók (`PlayerTrends`, `SeasonComparison`, `GamePbpCharts`)

Minden chart komponens `'use client'` – soha nem Server Component.

**A chart-színek forrása `lib/chart-theme.ts`** (`CHART_COLORS`, `CHART_GRID`, `CHART_AXIS`, `RECHARTS_TOOLTIP_STYLE`, `RECHARTS_LEGEND_STYLE`) – ez tükrözi a design tokeneket JS oldalra. **Hardcoded hex tilos a chartokban is.**

Recharts override a `globals.css`-ben:
```css
.recharts-tooltip-cursor          { fill:   rgba(71, 85, 105, 0.28) !important; }
.recharts-tooltip-cursor[stroke]  { stroke: rgba(148, 163, 184, 0.35) !important; }
```

---

## 15. Toast

**Sonner** – a `<Toaster />` az `app/layout.tsx`-ben, az `AuthProvider`-en belül.

```ts
import { toast } from 'sonner'
toast.success('Sikeres import')
toast.error('Nem sikerült betölteni az adatokat')
```

Adatbetöltési hibánál a minta **kettős**: inline hibapanel újrapróbálás gombbal **és** `toast.error` (lásd `app/page.tsx`).

---

## 16. Szabályok

**Kötelező:**
- Minden szín, font, radius CSS változón vagy Tailwind utility-n keresztül
- Minden numerikus érték `font-mono` + `tabular-nums` (vagy `.stat` / `data-stat`)
- Minden label ALL CAPS + `0.12em` tracking, display fonttal
- Osztály-kombináláshoz `cn()`

**Tilos:**
- Hardcoded hex szín a komponensekben. Egyetlen kivétel: inline SVG `stroke` attribútum – de ott is `currentColor`, ha lehet.
- `style={{ color: ... }}` literál. Kivétel a dinamikus CSS változó: `style={{ ['--i']: index }}`, `--accent-color`, `--accent-glow`.
- Kézzel írni `components/ui/`-ba (kivéve `stat-card.tsx`, `data-table.tsx`)
- A `:root` vagy `@theme inline` blokk bővítése design döntés nélkül

---

## 17. Ami NEM létezik – gyakori félreértések

| Feltételezés | Valóság |
|---|---|
| `tailwind.config.ts` | **Nem létezik a repóban.** A konfiguráció CSS-first, a `@theme inline` blokkban. A `CLAUDE.md` által említett `3xl`/`4xl` breakpointok sem léteznek. |
| `.card` osztály | **Nincs ilyen osztály.** A `CLAUDE.md` animációs példája (`className="card animate-fade-slide-up"`) félrevezető – kártyához shadcn `Card` (`data-slot="card"`) vagy a StatCard inline utility-i kellenek. |
| `--font-geist-sans` / `--font-geist-mono` | Nincsenek. A rendszer Barlow Condensed / DM Sans / JetBrains Mono. |
| OKLCH shadcn változók | A tokenek kézzel írt **hex** értékek. `color-mix(in oklab, …)` csak az áttetsző variánsoknál szerepel. |
| Light mode / téma-váltó | Nincs. Dark-only. |
| `container mx-auto` + `bg-slate-900` header | Megszűnt az AppShell sprinttel. |
| `export const viewport` / `themeColor` / PWA manifest | Nincs. Tudatos döntés (`BACKLOG.md`). |
