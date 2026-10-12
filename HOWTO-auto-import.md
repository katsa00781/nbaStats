# HOWTO – Automatikus napi adatimport (GitHub Actions)

Az ütemezett import a `.github/workflows/ingest.yml` workflow. Naponta 09:00 UTC-kor
(10:00 CET, nyári időszámításkor 11:00 CEST) fut, és kézzel is indítható.

Két lépést futtat, mindkettő idempotens (upsert ESPN ID-re):

1. `npm run ingest:games -- --season <év>`: a lezárt meccsek box score-ja és dobásai.
   A szezon elejétől a mai napig minden napot megnéz, a már mentett meccset kihagyja.
   Egy kimaradt nap vagy egy elhalasztott meccs így a következő futáskor magától pótlódik.
2. `npm run ingest:schedule -- --season <év>`: a jövőbeli meccsek (`scheduled` /
   `postponed` / `canceled`). A lezárt meccshez nem nyúl. Ez veszi fel az NBA Cup-függő
   alapszakasz-meccseket és a rájátszás párosításait, amikor az ESPN közzéteszi őket.
3. `npm run ingest:standings -- --season <év>`: a konferencia- és divízióbesorolás
   (`nba.teams`) és a tabella pillanatképe (`nba.standings`: W-L, kiemelés, GB, mérlegek,
   sorozat). A tabella minden futáskor felülíródik az ESPN aktuális állásával.

Futásidő: a szezon elején 2–3 perc, a végén kb. 8 perc (naponként egy scoreboard-kérés,
1 mp-es throttle-lel).

---

## 1. Egyszeri beállítás

1. **Secretek** a GitHub repóban: **Settings → Secrets and variables → Actions → Secrets →
   New repository secret**.

   | Név | Honnan | Megjegyzés |
   |-----|--------|-----------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → Data API → Project URL | az `ugkettlebell` projekt URL-je |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API Keys → `service_role` | **titkos**, teljes jogú kulcs |

   Ugyanaz a két érték, ami a helyi `.env.local`-ban van. A runner a `.env.local`-t nem
   látja, csak a secreteket.
2. **Push** a `master` ágra. A workflow csak azután él, hogy a fájl az `origin`-on van (T7).
3. **Első próba kézzel:** Actions → *Adatimport (ESPN)* → **Run workflow**, `dry_run`
   bepipálva. Ha zöld, mehet élesben is.

### Ellenőrzés elgépelés ellen

- A secret neve pontosan `NEXT_PUBLIC_SUPABASE_URL` (nem `SUPABASE_URL`).
- Az érték elején és végén ne legyen szóköz vagy idézőjel.
- A `service_role` kulcs a hosszú, `eyJ…` kezdetű JWT, nem az anon kulcs.
- A secret értéke nem olvasható vissza. Ha kétség van, hozd létre újra ugyanazzal a névvel.

---

## 2. Kézi futtatás

Actions → *Adatimport (ESPN)* → **Run workflow**. Minden mező opcionális:

| Mező | Üresen | Mire jó |
|------|--------|---------|
| `season` | `NBA_SEASON_YEAR` repo variable, annak híján `2027` | másik szezon (ESPN szezonév = záró év) |
| `from` | a szezon eleje | a meccs-import kezdőnapja (`YYYY-MM-DD`) |
| `to` | a mai nap | a meccs-import zárónapja (`YYYY-MM-DD`) |
| `dry_run` | kikapcsolva | csak validál és kiír, nincs DB írás |

Egy már mentett meccs újraírásához (pl. az ESPN utólag javított egy box score-t) a
szezon mód nem jó, mert a mentett meccset kihagyja. Ilyenkor helyben:

```bash
npm run ingest:games -- --date 2026-11-03   # az adott nap minden meccsét újraírja
```

---

## 3. A futás eredménye

| Kilépési kód | Jelentés | A run színe |
|--------------|----------|-------------|
| 0 | minden rendben | zöld |
| 1 | legalább egy meccs vagy nap elbukott | piros |
| 2 | minden lefutott, de volt konzisztencia-figyelmeztetés (`⚠`) | piros |

A 2-es kód szándékosan piros (T6): a figyelmeztetés adathibát jelez (pontösszeg,
FGA-összeg, dobásszám), amit ellenőrizni kell, nem elnémítani. A figyelmeztetett meccs
ettől még bekerül, ezért a következő napi futás már zöld lesz. A piros run tehát az
egyetlen jelzés, ne maradjon megnézetlenül.

Az `ℹ` sorok tájékoztatások (kihagyott előszezon, All-Star, heave, legfeljebb ±3
dobás/FGA eltérés), nem rontanak a kódon.

### Hol nézd meg

GitHub → **Actions** → *Adatimport (ESPN)* → a run → `ingest` job → a piros lépés.
A lépés logjának végén összesítő áll: `Kész: N meccs feldolgozva …`, alatta a
`Figyelmeztetés:` és a `Hiba:` lista meccsenként. A run összefoglaló oldalán ugyanez
rövid annotációként is megjelenik.

A menetrend- és a tabella-lépés a meccs-import hibája után is lefut. Hiányzó secret vagy sikertelen
`npm ci` után egyik import sem indul el.

---

## 4. Gyakori hibaokok

| Tünet a logban | Ok | Megoldás |
|----------------|-----|----------|
| `A '…' repo secret hiányzik vagy üres` | hiányzó vagy elgépelt secret | 1. pont |
| `Szezon-kapu: a 2028-es szezon nincs felvéve az nba.seasons-ben` | a szezonsor migrációja kimaradt | 5. pont |
| `Szezon-kapu: … a szezon vége (…) után van` | a `seasons.end_date` korábbi, mint az utolsó meccs | a szezonsor határainak javítása migrációval |
| `EspnSchemaError: …` (pontos útvonallal) | az ESPN megváltoztatta a JSON formátumát | `lib/espn/schemas.ts` igazítása, majd push; a kimaradt meccsek a következő futáskor pótlódnak |
| `ESPN HTTP 429` / `5xx` | az ESPN lassít vagy nem elérhető (3 újrapróbálás után) | **Re-run failed jobs**, vagy megvárni a másnapi futást |
| `ESPN HTTP 403` | az ESPN blokkolja a runner IP-címét | újrafuttatás; ha tartós, az import helyben futtatandó |
| Supabase `project is paused` | a free tier projekt inaktivitás miatt szünetel | Supabase dashboard → Restore project |
| `permission denied for schema nba` | nem a `service_role` kulcs van a secretben | 1. pont |

**Újrafuttatás:** a run oldalán jobbra fent **Re-run jobs → Re-run failed jobs**. A dupla
futás nem termel duplikátumot.

---

## 5. Szezonváltás

Az import nem hoz létre szezont (T4): a közös tárhelykeret miatt tudatos döntés, melyik
szezon kerül be. Új szezon előtt, ebben a sorrendben:

1. Tárhely-döntés (lásd `BACKLOG.md`): a 2027/28-as szezon előtt újra dönteni kell.
2. Új migráció a szezonsorral (`migrations/002-season-2027.sql` mintájára), kézi futtatás
   a Supabase SQL Editorban.
3. `NBA_SEASON_YEAR` repo variable átírása (**Settings → Secrets and variables → Actions →
   Variables**), pl. `2028`. Amíg nincs beállítva, a workflow `2027`-tel fut.
4. A következő napi futás a besorolást és a tabellát is felveszi; helyben is futtatható: `npm run ingest:standings -- --season 2028`.

A holtszezonban a futás zöld marad: a meccs-import a szezon `end_date`-jéig néz, és nem
talál új meccset.

---

## 6. Tudnivalók

- **Push nélkül a régi kód fut (T7).** Az import-író változás (`lib/espn/*`, `ingest-*.ts`)
  csak push után hat az ütemezett futásra.
- **A GitHub ütemezése nem pontos:** terhelés alatt a futás 10–30 percet késhet.
- **Nyilvános repóban** a GitHub 60 nap repó-inaktivitás után letiltja az ütemezett
  workflow-kat. Újraengedélyezés: Actions → a workflow → **Enable workflow**.
- **Mellékhatás:** a napi írás ébren tartja a közös Supabase projektet, így az ASEStats
  holtszezonjában sem szünetel.
- **Tárhely-figyelés még nincs** a futásban (450 MB-os küszöb, lásd `BACKLOG.md`): a
  projektméret lekérdezéséhez SQL-függvény kell, ami külön döntés.
