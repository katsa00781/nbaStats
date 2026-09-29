export type TerminologyEntry = {
  term: string;
  definition: string;
  coverage?: string[];
  conditions?: string[];
  metrics?: string[];
  notes?: string[];
};

export type TerminologySection = {
  id: string;
  title: string;
  entries: TerminologyEntry[];
};

export const terminologySections: TerminologySection[] = [
  {
    id: 'stat-abbreviations-boxscore',
    title: 'Statisztikai roviditesek - Alap (boxscore)',
    entries: [
      {
        term: 'PTS',
        definition: 'Pontok osszesen. A jatekos vagy csapat altal szerzett teljes pontmennyiseg.',
      },
      {
        term: 'FGM / FGA / FG%',
        definition:
          'Field Goal Made / Attempted / Percentage. Bedobott es vallalt mezo dobaskiserletek, valamint ezek hatekonysaga.',
      },
      {
        term: '2PM / 2PA / 2P%',
        definition: 'Ketpontos dobaskiserletek bedobott, vallalt es szazalekos mutatoi.',
      },
      {
        term: '3PM / 3PA / 3P%',
        definition: 'Harompontos dobaskiserletek bedobott, vallalt es szazalekos mutatoi.',
      },
      {
        term: 'FTM / FTA / FT%',
        definition: 'Buntetok bedobott, vallalt es szazalekos mutatoi.',
      },
      {
        term: 'ORB / DRB / TRB (REB)',
        definition: 'Tamado lepattano / vedo lepattano / osszes lepattano.',
      },
      {
        term: 'AST',
        definition: 'Assziszt. Kozvetlen passz, amelybol azonnal kosar szuletik.',
      },
      {
        term: 'TOV (TO)',
        definition: 'Eladott labda. A tamadas labdabirtoklasanak elvesztese dobas nelkul vagy hiba miatt.',
      },
      {
        term: 'STL',
        definition: 'Labdaszerzes. Vedekezesben megszerzett ellenfel-labdabirtoklas.',
      },
      {
        term: 'BLK',
        definition: 'Blokk. Ellenfel dobaskiserletenek ervenyes megakadalyozasa.',
      },
      {
        term: 'PF',
        definition: 'Szemelyi hiba. A jatekos altal elkovetett faultok szama.',
      },
      {
        term: '+/-',
        definition:
          'Plusz/minusz. Az adott jatekos palyan toltott idejeben a csapat pontkulonbsege (csapat pont - ellenfel pont).',
      },
      {
        term: 'MIN',
        definition: 'Jatekido percben.',
      },
    ],
  },
  {
    id: 'stat-abbreviations-advanced',
    title: 'Statisztikai roviditesek - Halado mutatok',
    entries: [
      {
        term: 'POSS',
        definition: 'Labdabirtoklasok becsult szama. A tamadasok volumenenek alap mutatoja.',
      },
      {
        term: 'PACE',
        definition: 'Tempo. Merkozesenkenti becsult labdabirtoklas 40 vagy 48 percre normalizalva.',
      },
      {
        term: 'ORtg',
        definition: 'Offensive Rating. Szerzett pontok 100 labdabirtoklasra vetitve.',
      },
      {
        term: 'DRtg',
        definition: 'Defensive Rating. Kapott pontok 100 labdabirtoklasra vetitve.',
      },
      {
        term: 'NetRtg',
        definition: 'Net Rating. ORtg - DRtg, vagyis netto pontkulonbseg 100 labdabirtoklasonkent.',
      },
      {
        term: 'PPP',
        definition: 'Points Per Possession. Egy labdabirtoklasra juto ponttermeles.',
      },
      {
        term: 'eFG%',
        definition:
          'Effective Field Goal Percentage. A mezo dobashatekonysag, ahol a tripla 1.5 dobott kosarkent szamit. Formula: (FGM + 0.5 * 3PM) / FGA.',
      },
      {
        term: 'TS%',
        definition:
          'True Shooting Percentage. Osszetett dobashatekonysag, amely figyelembe veszi a ketpontost, triplat es buntetot is. Formula: PTS / (2 * (FGA + 0.44 * FTA)).',
      },
      {
        term: 'USG%',
        definition:
          'Usage Rate. A csapat tamadasainak mekkora resze fejezodik be az adott jatekos dobasaval, buntetojekkel vagy eladott labdajaval, amig palyan van.',
      },
      {
        term: 'AST%',
        definition: 'Assziszt rata. A csapattarsak dobott kosarainak becsult hanyada, amelyhez a jatekos asszisztot adott.',
      },
      {
        term: 'TOV%',
        definition: 'Eladott labda rata. A labdabirtoklasokhoz viszonyitott labdaeladasi arany.',
      },
      {
        term: 'AST/TO',
        definition: 'Assziszt per eladott labda arany. Donteshozatali hatekonysagot jelzo mutato.',
      },
      {
        term: 'REB% / ORB% / DRB%',
        definition: 'Lepattano-ratak. Az elerheto lepattanok mekkora reszet szerzi meg a jatekos vagy csapat osszesen, tamadasban vagy vedekezesben.',
      },
      {
        term: 'FTr',
        definition: 'Free Throw Rate. Bunteto-vonalig jutas gyakorisaga, jellemzoen FTA / FGA alakban.',
      },
      {
        term: '3PAr',
        definition: 'Three-Point Attempt Rate. A mezo dobaskiserleteken belul a triplak aranya. Formula: 3PA / FGA.',
      },
    ],
  },
  {
    id: 'spatial-offense',
    title: 'Térbeli / támadási orientációk',
    entries: [
      {
        term: 'Periméter',
        definition:
          'A hárompontos vonalon kívüli dobásokhoz és az ezekhez kapcsolódó labdakezelési, döntéshozatali szituációkhoz kötődő támadó és védekező tevékenységek összessége.',
        coverage: ['3PA, 3P%', '3PA / FGA', 'Guard + Wing usage', 'Engedett 3PA, engedett 3P%'],
        notes: ['A periméter funkcionális fogalom, nem geometriai terület.'],
      },
      {
        term: 'Festék',
        definition:
          'A gyűrűhöz közeli befejezésekre, posztjátékra és belső penetrációkra épülő támadási fókusz.',
        conditions: ['2P arány ≥ ligaátlag', 'Pontok ≥ 55%-a 2P-ből'],
      },
      {
        term: 'Periméter-fókuszú támadás',
        definition:
          'A scoring elsődlegesen hárompontos dobásokból és periméter-döntésekből származik.',
      },
      {
        term: 'Belső fókuszú támadás',
        definition:
          'A támadás elsődlegesen a kosár körül generál előnyt, a periméter kiegészítő szerepet tölt be.',
      },
    ],
  },
  {
    id: 'tempo-dynamics',
    title: 'Tempó és támadásdinamika',
    entries: [
      {
        term: 'Magas tempó',
        definition:
          'A támadások gyors lefolyásúak, kevés másodperces döntéshozatallal.',
        metrics: ['Possessions / game', 'Early offense arány'],
      },
      {
        term: 'Alacsony tempó',
        definition: 'Tudatosan lassított támadások, set play dominancia.',
      },
      {
        term: 'Variancia-alapú támadás',
        definition:
          'Magas triplavolumenre épülő játék, amely nagy kilengéseket eredményezhet mérkőzésről mérkőzésre.',
      },
    ],
  },
  {
    id: 'efficiency',
    title: 'Hatékonysági fogalmak',
    entries: [
      {
        term: 'Dobáshatékonyság',
        definition: 'A dobások értékéhez viszonyított sikeresség.',
        metrics: ['FG%', 'eFG%', 'TS% (ha elérhető)'],
      },
      {
        term: 'Gyenge periméter-hatékonyság',
        definition:
          'A hárompontos dobások hatékonysága a ligaátlag alatt marad, különösen nyomás alatt.',
      },
      {
        term: 'Tudatos spacing',
        definition:
          'Alacsonyabb triplavolumen, de magas 3P%, ami szelektált dobásminőséget jelez.',
      },
    ],
  },
  {
    id: 'roles',
    title: 'Roster és szerepkörök (Role-alapú elemzés)',
    entries: [
      {
        term: 'Offensive Hub',
        definition: 'A támadás elsődleges szervezője, magas usage és assziszt arány.',
      },
      {
        term: 'Scoring Wing',
        definition: 'Periméterről és betörésekből is pontszerző wing játékos.',
      },
      {
        term: 'Primary Ball Handler',
        definition: 'A támadások első számú labdahozója.',
      },
      {
        term: 'Secondary Creator',
        definition: 'Másodlagos kezdeményező, aki nem elsődleges irányítóként is képes előnyt teremteni.',
      },
      {
        term: 'Secondary Playmaker',
        definition: 'Nem elsődleges irányító, de rendszeresen hoz döntéseket periméteren.',
      },
      {
        term: 'Floor Spacer',
        definition: 'A pálya széthúzásáért felelős játékos, magas 3P% vagy gravity.',
      },
      {
        term: 'Glue Guy',
        definition: 'Kapcsoló szerepű játékos, aki a csapatjátékot, rotációt és extra erőfeszítést stabilizálja.',
      },
      {
        term: 'Slasher',
        definition: 'Betörésekkel és gyűrűtámadással pontot szerző játékos, aki nyomást helyez a festékre.',
      },
      {
        term: '3&D Wing',
        definition: 'Periméter-védekezésben és triplázásban is értéket hozó wing.',
      },
      {
        term: 'Defensive Guard',
        definition: 'Elsődlegesen védekezési szerepkörű guard, labdanyomás és closeout fókusz.',
      },
      {
        term: 'Stretch 4',
        definition: 'Négyes poszton játszó, perimétert nyitó magas, aki triplával széthúzza a védelmet.',
      },
      {
        term: 'Physical 4',
        definition: 'Fizikális erőcsatár, aki test a test elleni játékban, lepattanózásban és kontaktban erős.',
      },
      {
        term: 'Rim Protector',
        definition: 'A gyűrű körüli védekezésért felelős játékos, blokkokkal és festékvédelemmel.',
      },
      {
        term: 'Roll Man',
        definition: 'Pick and roll játékban a gyűrű felé guruló befejező, aki vertikális fenyegetés.',
      },
      {
        term: 'Stretch 5',
        definition: 'Ötös poszton játszó, perimétert nyitó center, aki triplával húzza ki a védőt.',
      },
      {
        term: 'Energy Big',
        definition: 'Magas poszton energikus, lepattanózó és hustle-alapú szerepkör, rövid intenzív percekkel.',
      },
      {
        term: 'Irányító (PG)',
        definition: 'A támadás elsődleges szervezője, labdafelhozatal és játéképítés fókusz.',
      },
      {
        term: 'Dobóhátvéd (SG)',
        definition: 'Periméter-scoring fókuszú hátvéd, aki képes labdával és labda nélkül is pontot szerezni.',
      },
      {
        term: 'Bedobó / Kiscsatár (SF)',
        definition: 'Wing poszt, kiegyensúlyozott támadó- és védekező feladatokkal, több szerepkör összehangolása.',
      },
      {
        term: 'Erőcsatár (PF)',
        definition: 'Fizikális belső poszt, lepattanózás és festékjáték fókusz, modern szerepben spacinget is adhat.',
      },
      {
        term: 'Center (C)',
        definition: 'A gyűrű körüli játék felelőse: rim protection, befejezések és lepattanózás.',
      },
    ],
  },
  {
    id: 'defense-profiles',
    title: 'Védekezési profilok',
    entries: [
      {
        term: 'Kiegyensúlyozott védekezés',
        definition: 'Nincs kiemelkedő gyenge pont sem periméteren, sem a festékben.',
      },
      {
        term: 'Korlátozott védőprofil adat',
        definition: 'A közvetlen ellenfél-dobóprofil hiánya miatt a védekezési címkék csak részben értelmezhetők.',
      },
      {
        term: 'Periméter-sérülékeny védekezés',
        definition: 'Az ellenfél hatékonyan vagy nagy volumenben dob kintről.',
      },
      {
        term: 'Festék-sérülékeny védekezés',
        definition: 'Magas 2P hatékonyság vagy ponttermelés engedése a gyűrű közelében.',
      },
    ],
  },
  {
    id: 'usage',
    title: 'Usage és eloszlás',
    entries: [
      {
        term: 'Usage koncentráció',
        definition: 'A támadó terhelés eloszlása a játékosok között.',
      },
      {
        term: 'Magas usage koncentráció',
        definition: 'A támadás 1–2 játékostól erősen függ.',
      },
      {
        term: 'Kiegyensúlyozott usage',
        definition: 'A scoring több forrásból érkezik, nincs túlterhelt első opció.',
      },
    ],
  },
  {
    id: 'pregame-postgame',
    title: 'Pre-game / Post-game fogalmak',
    entries: [
      {
        term: 'Fő veszély',
        definition: 'Az ellenfél azon játékeleme, amely meccsdöntő futást okozhat.',
      },
      {
        term: 'Sebezhetőség',
        definition: 'Statisztikailag azonosítható gyenge pont, amely célzott game plan-nel támadható.',
      },
      {
        term: 'Mismatch',
        definition: 'Poszt-, méret- vagy szerepkörbeli előny, amely egyéni támadással kihasználható.',
      },
    ],
  },
  {
    id: 'notes',
    title: 'Elemzési megjegyzés',
    entries: [
      {
        term: 'Szótár célja',
        definition:
          'Egységes nyelvezetet biztosít az app teljes kimenetében, csökkenti a szubjektív megfogalmazást, és lehetővé teszi a későbbi automatizált report-generálást.',
        notes: ['NBI/A-hoz optimalizált nyelvezet és küszöbök (tempó, volumenelemzés, szerepkörök).', 'Verziózás javasolt a későbbi változások követéséhez.'],
      },
    ],
  },
];