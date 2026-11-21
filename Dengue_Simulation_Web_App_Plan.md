# Dengue Simulation Web App: Build Plan (v3)

A hosted web app where the PHO and LGU staff test dengue cleaning and fogging policies on the Camarines Norte model and see what happens, before spending real resources.

It compares strategies. It does not forecast case counts.

---

## 1. Objective

Build a proper, hosted web app (a real project, not a single file) that:

1. Lets staff set a policy: how often cleaning happens, how many households take part, when fogging starts, and (optionally) a different policy per municipality.
2. Runs the dengue simulation for 2019-2025 in the browser, in a background worker, so the page never freezes.
3. Shows what happens over time: infections, mosquito numbers, and households (healthy or infected), on a map of the municipalities.
4. Shows one headline number: the percentage reduction in infections compared with no cleaning.
5. Lets staff compare policies, save their own presets, share a policy as a link, and export results.
6. Always states that results compare strategies and are not predictions.

## 2. What "done" looks like

- The app is live at a public link (GitHub Pages, Netlify or Vercel). Staff open the link; they install nothing, and nobody has to keep a server running.
- A full 2019-2025 run finishes in seconds, with a progress bar, and the page stays responsive while it runs.
- The engine passes the automated checks in section 7, and they run on every change.
- A staff member with no technical background can pick a policy, adjust the sliders and read the outcome without help.
- Every assumption (biological rates, fogging strength) is visible in the app and labelled as an assumption.

---

## 3. Architecture and tech stack

### Decision: browser only, no server

The simulation (about 19,000 simulated people, 2,557 days) is small enough to run in the user's browser. Running it client-side means there is no server to host, secure or maintain after the study ends, and every user gets instant results. Hosting is static files only.

The engine is written as a standalone module with no interface code in it. The app, the automated tests and the fitting script all use this same engine, so there is only one model and the results cannot drift apart. If the model ever outgrows the browser, the engine can be moved to a server without a rewrite.

Options that were considered and rejected: a Python engine behind a server (needs hosting and upkeep), a Python dashboard such as Streamlit (also needs a server and has a weaker map and time slider), Python in the browser through Pyodide (large first download and slower than TypeScript), and Rust or C++ compiled to WebAssembly (more effort than a model this size needs).

### Tech stack

| Part | Choice | Why |
|---|---|---|
| Language | TypeScript | It is JavaScript with type checking. The browser runs the compiled JavaScript. Types catch variable and unit mix-ups in a model with many interacting rules |
| Build tool | Vite | Fast, simple static output |
| Interface | React | Many chart and map libraries; easy to build sliders and panels |
| Simulation | Plain TypeScript module in a Web Worker | Keeps the page responsive; posts progress messages |
| Data structures | Typed arrays inside the engine | Fast for tens of thousands of simulated people |
| Random numbers | Small seeded generator written for the project | Same seed gives the same result, required by the checks |
| Map | D3-geo drawing the GeoJSON as SVG | No online map tiles needed |
| Charts | A charting library (for example Recharts or uPlot) | Infection curve, mosquito counts |
| Tests | Vitest | Runs the section 7 checks automatically |
| Fitting | Node script that imports the same engine | One model for the app, the tests and the fitting |
| Hosting | Static host (GitHub Pages, Netlify or Vercel) with automatic deploy from the repository | Free, nothing to keep running |

The one weakness of this stack is statistics and fitting, which are clumsier than in Python. Only four settings are fitted (biting rate, carrying capacity, reporting fraction, surge size), so a simple search script in Node is enough.

### Project layout

```
QMSIMULATION3/                   <- project root (no extra folder)
  Datasets/                      <- original raw data, read directly, never copied
    Dengue Cases csv/            <- 4 case csvs
    camarines_norte_map.json
    Master_Dataset.csv
    policy_data.csv
    population.csv
    weather.csv
    Questions with answers.docx
  data-raw/
    barangay-name-map.csv        <- links population names to case-record names
  public/
    data/                        <- written by prepare-data, loaded by the app at start
      weather.json
      population.json
      policy.json
      camarines_norte_map.json
      settings.json              <- fitted settings (single place to change them)
      cases/                     <- (not created; case data unpublished, privacy undecided)
  scripts/
    tsconfig.json                <- settings for the scripts only
    prepare-lib.ts               <- shared helpers for the scripts
    prepare-data.ts              <- cleans Datasets into public/data and runs checks
    fit-settings.ts              <- (planned, M4) fitting script, uses the same engine
  src/
    engine/                      <- the model: no UI code in here
      rng.ts                     <- seeded random numbers (next, int, binomial by inversion, poisson by PTRS)
      population.ts              <- builds people and households from population.json
      biology.ts                 <- temperature rules: development, incubation, death, egg laying
      breeding.ts                <- rain and breeding sites, larvae crowding
      mosquitoes.ts              <- mosquito life stages per household (immatures, adults)
      lifecycle.ts               <- cleaning effect, adult development, adult death, egg laying
      params.ts                  <- all slider starting positions (DEFAULT_PARAMS) and settings.json overrides
      schedule.ts                <- staggered cleaning days and who cleans each scheduled day
      daily.ts                   <- one day of mosquitoes, in three parts (dayStart, dayAdultDeath, dayEggs) so fogging, movement and infection can sit between them
      spinup.ts                  <- 150-day mosquito-only warm-up before the record starts
      weather.ts                 <- turns weather.json into temperature, rain and 14-day rain arrays
      mosquitoRun.ts             <- mosquito-only run: warm-up, then every day of the record
      policyData.ts              <- turns policy.json into cleaning intervals and fogging triggers
      fogging.ts                 <- fogging: case trigger, 7-day wait, share of households reached, adults killed
      infection.ts               <- mosquito side of infection (step 4c)
      humans.ts                  <- people side of infection: mosquitoes infect people, E -> I -> R, yearly return of immunity, seeding
      imports.ts                 <- imported infections: background rate plus the 2019 surge (weeks 30-44), on/off
      movement.ts                <- where everybody spends the day: away trips, travel by population and distance
      run.ts                     <- the full run: warm-up, then every day with cleaning, fogging, movement, infection, imports and humans; records adults, infections, onsets per municipality, S/E/I/R totals and fogging rounds
      runJob.ts                  <- one run request, same code in the worker and in tests: checks the request, sets cleaning interval, fogging on/off and trigger, runs, sends progress messages, hands the 12 result arrays over
    worker/
      sim.worker.ts              <- thin shell: loads the three data files once with fetch, receives run messages, calls runJob and posts the replies (checked by tsc and lint; first real run comes in M5)
    ui/
      controls/ views/ map/ charts/
    state/                       <- policy state, URL sharing, saved presets
  tests/
    tsconfig.json                <- settings for the tests only
    data.test.ts                 <- checks the files in public/data
    rng.test.ts                  <- same seed gives same numbers; values stay in range
    population.test.ts           <- 18,986 people, 3,797 households, everyone starts susceptible
    biology.test.ts              <- temperature rules for development, incubation, death, eggs
    breeding.test.ts             <- rain window, breeding capacity, larvae crowding (engine checks from section 7 come later)
    rng-counts.test.ts           <- binomial and poisson counts behave as expected
    rng-poisson.test.ts          <- poisson mean, variance and exact small-count chances
    rng-binomial.test.ts         <- binomial mean, variance, exact chances, stays between 0 and n
    mosquitoes.test.ts           <- starting mosquito numbers per household
    lifecycle.test.ts            <- cleaning effect and egg laying
    lifecycle-adults.test.ts     <- adult development and adult death
    params.test.ts               <- starting positions and settings.json overrides
    schedule.test.ts             <- staggered cleaning days, compliance, negative days
    daily.test.ts                <- one mosquito day: counts stay whole and never negative, same seed same result
    dailyParts.test.ts           <- the three parts together give exactly the same result as one mosquito-only day
    spinup.test.ts               <- warm-up runs days -150 to -1 and reads weather from the end of the record
    weather.test.ts              <- 14-day rain sums, day-count check, real weather.json
    mosquitoRun.test.ts          <- mosquito-only run: same seed same result, cleaning lowers adults
    mosquitoRunReal.test.ts      <- one mosquito-only run on the real data (2019-2025), prints time and adults per person
    policyData.test.ts           <- each household gets its municipality's interval, matched by name
    fogging.test.ts              <- trigger, last-7-days window, cooldown, coverage, kill share
    infection.test.ts            <- mosquito side of infection: incubation, catching the virus
    humans.test.ts               <- people side: infection, E -> I -> R, turnover, seeding
    imports.test.ts              <- surge window, 2019 only, on/off, expected counts
    movement.test.ts             <- travel table, away and other-municipality shares, counts add up
    run.test.ts                  <- states add up, same seed same result, world not changed, no disease without seeds or imports, imports start infections, fogging flags add up
    runRecording.test.ts         <- recorded adult mosquitoes: never rise in cold weather, infectious never exceed all adults, states add up
    runJob.test.ts               <- progress then one done message, result arrays handed over, same request same result, interval 0 means no cleaning, fogging on/off and trigger, bad requests and a missing municipality give an error message
    runFullTiming.test.ts        <- temporary: times one full run on the real data (2019-2025), prints time and cases per year; only runs when TIMING is set
    runPhases.test.ts            <- temporary: times each step of the day separately; only runs when TIMING is set
  docs/
    model-rules.md               <- the one-page rules from M1
    _2nd QM-research.docx        <- research document
  package.json                   <- scripts: prepare-data, test
```

### How the pieces talk

1. The page loads the data files from `public/data`.
2. The user sets a policy. The page sends the policy and settings to the worker.
3. The worker runs the engine and posts back progress updates and the daily results.
4. The page draws the curve, map, dots and mosquito charts from those results.

Policy settings are also written into the page link, so a policy can be shared by sending the URL.

---

## 4. What the app does

### Controls

The audience is PHO and LGU staff, so the app exposes more controls than a basic demo. The main controls are always visible. Assumptions sit in an "Advanced" panel, each with its default and a reset button.

**Main controls**

| Control | Options |
|---|---|
| Cleaning interval | slider, 1 to 30 days, plus "no cleaning" |
| Household compliance | slider, 0-100% (the PHO's estimate is 26-50%; higher values are hypothetical and marked as such) |
| Fogging | on / off |
| Fogging trigger | reported cases in 7 days, slider 1 to 20 |
| Presets | one click each (list below) |
| Number of runs | 1 (default) or an average of several, with the spread shown |

**Per-municipality policy**

A table of the 12 municipalities, starting from the defaults in `policy_data.csv` (waste collection every 7 days, fogging at 1 case, the same for all 12). Staff can override cleaning interval, compliance and fogging trigger for any municipality, or apply one value to all. This lets LGUs test their own area.

**Advanced assumptions**

| Setting | Notes |
|---|---|
| Fogging strength (share of adult mosquitoes killed) | Placeholder: the PHO left this blank (Q6). Shown with a "not provided by PHO" label |
| Share of immatures removed per cleaning | Assumption |
| Simulation seed | Same seed gives the same result |
| Imported-case surge (2019 wave) | On / off |
| Time range | 2019-2025, or a chosen sub-range |

Biological rates (development, survival, biting) are shown read-only with a note that they are assumptions.

**Policy presets**

| Preset | Cleaning interval | Compliance |
|---|---|---|
| No cleaning | none | 0% |
| Weekly, low compliance | every 7 days | 26% |
| Weekly, moderate compliance | every 7 days | 50% |
| Weekly, high compliance | every 7 days | 75% |
| Frequent | every 3 days | 50% |
| Infrequent | every 14 days | 50% |

Fogging presets (different triggers) are added after the cleaning presets work. Staff can also save their own presets in the browser and delete them again.

### Views

1. **Infection curve:** chosen policy vs. no cleaning, with the percentage reduction as the big number. With several runs, the average and the spread.
2. **Municipality map:** each of the 12 municipalities colored by infections, with hover details (name, population, infections).
3. **Household dots:** colored by state (susceptible, exposed, infectious, recovered).
4. **Mosquito counts:** adults and immatures per person over time.
5. **Time slider:** play, pause, speed, and jump to any day or year.
6. **Compare view:** two policies side by side, with the difference shown.
7. **Real vs. simulated overlay (optional):** real weekly cases for 2019, 2020, 2021 and 2023; gaps for the other years.
8. **Export:** results as CSV, charts as images.
9. **Always-visible note:** "Compares strategies; does not forecast case counts. Biological rates are assumptions."

---

## 5. The model the app runs

The model rules are unchanged from v1 and v2. The app runs a household-level simulation, one day at a time, over 2019-2025 as one continuous run (2,557 days).

**Population**
- 39 barangays across 12 municipalities, 189,837 people (2024 figures). This is a subset of the province; see the data scope note in the datasets section.
- 1 simulated person stands for 10 real people. 5 simulated people per household. About 19,000 people in about 3,800 households.
- Each person is susceptible, exposed, infectious or recovered. Each household holds counts of mosquitoes by life stage.

**Each day, in this order**
1. Check which households are scheduled to clean today, and which of them take part (compliance).
2. In participating households, remove a share of immature mosquitoes and breeding sites.
3. Surviving immatures become adults after a delay that depends on temperature.
4. Fogging: if a municipality's reported cases in the last 7 days reach the trigger (and at least 7 days have passed since the last round), kill a share of adult mosquitoes in the households reached. Then adult mosquitoes die, bite, pick up the virus from infectious people, infect susceptible people, and lay eggs (limited by crowding and by rainfall-driven breeding sites).
5. Update people: exposed to infectious after 5 days, infectious to recovered after 6 days; add imported cases; a small share of recovered people become susceptible again each year (2% per year, an assumption).
6. Record new infections, new reported cases, and mosquito numbers.

**Other rules**
- 150-day mosquito-only warm-up before the record starts, then 3 infectious people are seeded.
- People spend 30% of days away from home; 10% of those trips go to another municipality, chosen by population and distance.
- An optional imported-case surge represents the 2019 epidemic wave (weeks 30-44, 2019 only, on/off). Its size is a setting to be fitted. This window has not yet been checked against the weekly case data.
- Weekly totals use 52 weeks per year, scaled by the reporting fraction.

**Settings still to be fitted**

Kept in one file, `public/data/settings.json`, which the app reads:
- biting rate
- mosquito carrying capacity per person
- reporting fraction
- imported-case surge size

### Datasets

The datasets were checked against the uploaded files. What follows is what the files actually contain.

**Raw folder layout (input to the data preparation script)**

```
QM Version 2/
  Datasets/
    Dengue Cases csv/
      Dengue_CamarinesNorte_FOI_By_Age_Group.csv
      Dengue_CamarinesNorte_FOI_bymunicipality.csv
      Dengue_CamarinesNorte_FOI_Weekly_Trends.csv
      Dengue_CamarinesNorte_FOIBy_Municipality.csv
    camarines_norte_map.json
    Master_Dataset.csv
    policy_data.csv
    population.csv
    Questions with answers.docx
    weather.csv
  _2nd QM-research.docx
```

The raw files stay in the study folder. `scripts/prepare-data.ts` reads them and writes clean, small files into `public/data`. The app never reads the raw files.

| Item | What it contains (verified) | Used by the app? |
|---|---|---|
| `weather.csv` | NASA POWER daily weather, 1 Jan 2019 to 31 Dec 2025: 2,557 days with temperature (23.8 to 31.6 C), rainfall and humidity. 11 header lines come first. **No -999 gaps found.** One day has 382.6 mm of rain, plausible for a typhoon but worth checking | Yes. Drives mosquito development, survival, egg laying and breeding sites. Humidity is not used |
| `population.csv` | 39 barangays in 12 municipalities, 189,837 people (2024) | Yes. Builds the households and people |
| `policy_data.csv` | 12 rows, one per municipality, all with waste collection every 7 days and fogging at 1 case | Yes. Default policy per municipality, overridden by the app's controls |
| `camarines_norte_map.json` | 12 municipality shapes (Polygon and MultiPolygon), 88 KB. Names in `adm3_en` match the population and policy files exactly | Yes. Draws the map and gives each town's center for travel distances. Simplifying it is optional |
| `Dengue_CamarinesNorte_FOIBy_Municipality.csv` | 1,215 barangay-week records: cases and deaths, for 2019, 2020, 2021 and 2023 only. Covers 242 barangays. Includes one row with epi week "Not Encoded" (Capalonga, Ubang, 2023) | Fitting, and the real-vs-simulated overlay |
| `Master_Dataset.csv` | The same records with population and date columns added, 1,214 rows (the "Not Encoded" row is dropped). Its `Population` column is a municipality average, not the barangay's population | Optional. Do not use its population column |
| `Dengue_CamarinesNorte_FOI_By_Age_Group.csv` | Despite the name, province-wide cases per epi week (1 to 52, plus a "Not Encoded" row) for 2019-2025. The file names are swapped with `FOI_Weekly_Trends` | Optional province totals |
| `Dengue_CamarinesNorte_FOI_Weekly_Trends.csv` | Despite the name, cases by age group (8 groups) for 2019-2025 | No. The model does not use age |
| `Dengue_CamarinesNorte_FOI_bymunicipality.csv` | Yearly cases and deaths for each of the 12 municipalities. Shows zeros for 2022, 2024 and 2025, which are missing records, not zero cases (the weekly province file shows 24, 90 and 430 cases for those years) | Optional municipality yearly totals |
| `Questions with answers.docx` | PHO survey answers: peak in July-September (Q1), top-risk municipalities Daet, Labo and Jose Panganiban (Q2), fogging at 1 case in 7 days (Q5), compliance 26-50% (Q7). Q3 is missing and Q6 (fogging strength) is blank. In the part reviewed, Q4 has no boxes ticked, so the source of the 7-day waste collection default is unclear | No. Source for the policy defaults and the fogging placeholder |
| `_2nd QM-research.docx` | The research proposal | No |

**Case totals by year**

| Year | Barangay records | Municipality and weekly files | Notes |
|---|---|---|---|
| 2019 | 1,042 | 1,048 | Small difference between files |
| 2020 | 243 | 244 | |
| 2021 | 123 | 125 | |
| 2022 | none | 24 | Province total only |
| 2023 | 23 (24 with the "Not Encoded" row) | 24 | |
| 2024 | none | 90 | 24 of these have no epi week |
| 2025 | none | 430 | 416 of these have no epi week, so no weekly curve is possible |

**Data scope note (important)**

The population file covers 39 barangays, but the case records cover 242 barangays. The simulated population is a subset of the province, while province-wide cases are what is available to fit against. Of the 39 modelled barangays, 34 match a barangay in the case records by name. The other 5 differ only in spelling:
- Daet: Barangay III (Pob.), Barangay IV (Pob.) (the case file writes "Iii", "Iv")
- Mercedes: Barangay II (Pob.)
- San Lorenzo Ruiz: Matacong (the case file has "Matacong (Pob.)")
- San Vicente: San Jose (the case file has "San Jose (Iraya Norte)")

`data-raw/barangay-name-map.csv` records these matches. This scope question has to be settled before fitting (section 8).

**Other things to know**
- Two case files have swapped names (By_Age_Group is weekly, Weekly_Trends is by age). Rename them or keep this note.
- Years 2022, 2024 and 2025 have no barangay-level records, so the overlay shows gaps for them.
- Keep one barangay-level file for fitting. The FOI file is preferred, because it is the original; `Master_Dataset.csv` adds only the unreliable population column and a date column.
- The case data is published with the app if it is placed in `public/data/cases`. See the data privacy risk in section 10.

Earlier results (scenario outputs, sensitivity tables, baseline charts and old fitted values) are not used while the study is being reset.

---

## 6. Milestones

The build goes in order. Each milestone is reached only when its "reached when" line is true, and the next one does not start before that. No dates; the order and the checks are what matter.

### Overview

| Milestone | Topic | What it gives you |
|---|---|---|
| M1 | Setup and decisions | Rules written down, data prepared, project created, open questions answered |
| M2 | Engine runs | The engine completes a full 2019-2025 run with no interface |
| M3 | Engine checked | The engine passes the automated checks in section 7 |
| M4 | Settings fitted | A saved `settings.json` that matches the real cases reasonably |
| M5 | First usable app | Pick a policy, run it in the worker, read the infection curve and % reduction |
| M6 | Map and households | Municipality map and household view working |
| M7 | Full tool | Per-municipality policy, time slider, presets, fogging scenarios, compare view, export |
| M8 | Released | Deployed, tried by real staff, fixed, shared |

### M1: Setup and decisions
- **1.1 Write down the model rules.** One page (`docs/model-rules.md`) listing every daily rule and formula, so the engine and the plan agree.
- **1.2 Prepare the data.** Write `prepare-data.ts`: parse `weather.csv` (skip the 11 header lines) and check that no -999 values appear, check `population.csv` and `policy_data.csv`, optionally simplify the map, and write clean files to `public/data`.
- **1.3 Match barangay names.** Build `barangay-name-map.csv` linking the 39 modelled barangays to the case records, and handle the "Not Encoded" weeks (kept in yearly totals, excluded from weekly curves).
- **1.4 Settle the data scope.** Decide how the 39-barangay population is fitted against the case records (section 8).
- **1.5 Answer the other open questions.** Fogging preset values, hosting choice, data privacy.
- **1.6 Set up the project.** Repository, Vite + React + TypeScript, Vitest, and an automatic deploy to a static host (an empty page is enough at this stage).
- *Reached when:* the rules page exists, the prepared data loads in a test, the name map is complete, the empty app deploys to a public link, and the open questions have answers.

### M2: Engine runs
- **2.1 People and households.** Build 39 barangays into about 3,800 households and 19,000 people, each in one of four states.
- **2.2 Mosquitoes.** Life stages per household; temperature-driven development, survival and egg laying; rainfall-driven breeding sites.
- **2.3 Cleaning.** Schedules, compliance, removal of immatures and breeding sites, per municipality.
- **2.4 Fogging.** Case trigger, 7-day wait between rounds, share of households reached.
- **2.5 Infection.** Done in three small parts:
  - **2.5a Mosquito side.** Exposed mosquitoes finish their incubation and become infectious; mosquitoes pick up the virus from infectious people present in the household.
  - **2.5b Human side.** Infectious mosquitoes infect susceptible people; people move from exposed to infectious to recovered; yearly return of immunity.
  - **2.5c Imports.** Background imported infections, plus the extra imports in weeks 30 to 44 of 2019 only (on/off).
- **2.6 Movement.** Trips away from home, trips to other municipalities by population and distance.
- **2.7 Recording.** Daily adults and infectious adults, cleanings, new and imported infections, onsets per municipality (reported cases come from these), S/E/I/R totals, and fogging rounds per municipality.
- **2.8 Worker and speed test.** Wrap the engine in a Web Worker that posts progress. Time a full 2,557-day run. If it is too slow, optimize the data structures before changing the model. *Result so far:* the full engine takes about 29 s on my laptop (35.8 s before the recording was tidied), two thirds of it in the mosquito steps (egg laying is the biggest at about a third). Decision: no more speed work for now; build the worker with a progress bar and revisit the speed after M3. Done so far: `runJob.ts` (request checks, progress messages, result hand-over) with 13 passing tests. The worker file `src/worker/sim.worker.ts` is written and compiles. Full `npm test`: 226 passed, 2 timing files skipped. The first real run through the worker happens in M5.
- *Reached when:* a full run completes inside the worker with no interface, with a progress bar, and takes well under a minute (seconds is the later goal).

### M3: Engine checked
- **3.1 Basic checks.** Same seed gives the same result; population stays constant; seasons show in mosquito numbers.
- **3.2 Policy checks.** No cleaning is worst; more compliance or more frequent cleaning never raises infections; an easier fogging trigger never raises infections. These are tested on averaged runs with shared seeds (see section 7).
- **3.3 Consistency check.** 0% compliance with fogging off equals the no-cleaning preset.
- **3.4 Automate.** All checks run as Vitest tests and on every change in the repository.
- *Reached when:* every check in section 7 passes automatically. No interface work before this.

### M4: Settings fitted
- **4.1 Choose what to fit.** Biting rate, mosquito carrying capacity, reporting fraction, imported-case surge.
- **4.2 Fit against real cases.** Use the weeks with barangay-level records (2019, 2020, 2021, 2023), restricted to the scope decided in M1.4. Run `fit-settings.ts` in Node with the same engine the app uses.
- **4.3 Save `settings.json`.** The app reads it; it is the single place to change settings later.
- **4.4 Compare with real data.** 2019 surge near the right weeks; yearly totals the right order of magnitude; 2022, 2024 and 2025 shown as gaps.
- *Reached when:* `settings.json` is saved and the comparison with real cases looks reasonable.

### M5: First usable app
- **5.1 Controls.** Cleaning interval, compliance, fogging on/off and trigger, number of runs.
- **5.2 Worker connection.** Send the policy to the worker, show a progress bar, allow cancel.
- **5.3 Infection curve.** Chosen policy vs. no cleaning.
- **5.4 Headline number.** Percentage reduction in infections, big and clear.
- **5.5 Mosquito counts.** Adults and immatures per person over time.
- **5.6 Results note.** "Compares strategies, does not forecast" always visible.
- *Reached when:* a user can change a control, run it, and read the % reduction, with the page staying responsive during the run.

### M6: Map and households
- **6.1 Municipality map.** 12 municipalities colored by infections.
- **6.2 Household dots.** Colored susceptible, exposed, infectious, recovered.
- **6.3 Hover details.** Municipality name, population, infections.
- **6.4 Mobile layout.** Check that the map and dots work on a phone and a tablet.
- *Reached when:* map and dots update correctly as the run plays.

### M7: Full tool
- **7.1 Per-municipality policy table.** Override cleaning and fogging for any municipality.
- **7.2 Advanced assumptions panel.** Fogging strength placeholder, immature removal share, seed, surge on/off, with defaults and reset.
- **7.3 Time slider.** Play, pause, speed, jump to a day or year.
- **7.4 Cleaning presets and saved presets.** The six policies in section 4, plus staff-saved ones.
- **7.5 Fogging presets.** Different case triggers; this also completes research objective 3.
- **7.6 Compare view.** Two policies side by side.
- **7.7 Share and export.** Policy in the page link; results as CSV; charts as images.
- **7.8 Real-vs-simulated overlay.** Optional, shown only if the privacy decision allows the case data to be published.
- *Reached when:* every preset runs, per-municipality overrides change the results as expected, and the fogging presets give sensible results.

### M8: Released
- **8.1 Try it with real staff.** At least one person from the PHO or an LGU, with no help.
- **8.2 Fix what they get stuck on.**
- **8.3 Re-run all checks.** Section 7, once more on the final build.
- **8.4 Browser check.** Current Chrome, Edge, Firefox and Safari, and a mid-range phone.
- **8.5 Share.** The public link, plus a short how-to page.
- *Reached when:* a first-time staff member can pick a policy, change the sliders and explain the result.

---

## 7. How we know it works

No earlier results are used as a target. The engine has to behave sensibly, and once the reset is finished its first fitted runs become the reference. These checks are automated tests, run on every change.

**Basic checks**
- The same seed gives the same result every time.
- The number of people stays constant; nobody appears or disappears from the four states.
- Mosquito numbers follow the seasons: more in warm, wet periods, fewer in cool, dry ones.
- With no cleaning, infections are the highest of any policy.
- Raising compliance, or cleaning more often, lowers infections (more cleaning never makes things worse).
- Fogging more easily (a lower trigger) lowers infections, or changes nothing.
- Setting compliance to 0% with fogging off gives the same result as the no-cleaning preset.
- Run-to-run spread is reasonable: repeated runs of the same policy give similar totals.

**Handling randomness in the policy checks**

Single runs of a random simulation can break "more cleaning never makes things worse" by chance. The tests therefore compare policies using the same set of seeds for each policy and compare the average over several runs, with a small tolerance for noise. A check fails only when the averaged result moves the wrong way by more than that tolerance.

**Data checks (run by `prepare-data.ts`)**
- The weather file has 2,557 daily rows and no -999 values.
- The population file totals 189,837 across 39 barangays and 12 municipalities.
- Every municipality name in the population, policy and map files matches.
- Every modelled barangay is either matched in the case records through the name map, or listed as unmatched.

**App checks**
- The worker result matches the same run made directly through the engine.
- A policy copied from a shared link reproduces the same result.
- The page stays responsive while a run is in progress.

**Checks against real data (after fitting)**
- The simulated weekly curve shows the 2019 surge at about the right weeks.
- Yearly simulated cases are the same order of magnitude as the real counts for years with barangay-level records (2019, 2020, 2021, 2023), within the scope decided in M1.4.
- Years with no barangay-level records (2022, 2024, 2025) are shown as gaps, not compared.

---

## 8. Decisions and open questions

**Decided**
- **Audience:** PHO and LGU staff, so more sliders, a per-municipality policy table and an Advanced panel.
- **Stack:** TypeScript, Vite and React, with the engine in a Web Worker. Browser only, no server.
- **Speed:** the simulation always runs in a Web Worker, with a progress bar.
- **Sharing:** a public link on a static host, and policies shareable through the page link.
- **Fitting:** a Node script that uses the same engine as the app, run before the app is finished (M4). Not done in the page.

**Still open**
- **Data scope (most important):** the model has 39 barangays, but the case records cover 242. Options: (a) fit only to cases from the 34 matched barangays, which keeps the scope consistent and is the proposed default; (b) add populations for the other barangays so the model covers the province. Also confirm why these 39 barangays were chosen.
- **Fogging presets:** which trigger values to offer?
- **Hosting choice:** GitHub Pages, Netlify or Vercel? Any restrictions from the PHO or the school?
- **Data privacy:** may the barangay-level case data be published with the app? If not, the overlay is dropped or limited to municipality totals.
- **Fogging strength in the Advanced panel:** keep it editable with the "not provided by PHO" label, or fix it until the PHO answers?
- **Waste collection source:** where does the 7-day default in `policy_data.csv` come from, given that Q4 shows no ticked boxes?

---

## 9. Out of scope here

These belong to the research plan (`RESEARCH_PLAN.md`), not this app:
- Fogging-strength calibration
- Holdout validation
- Decision-support write-up
- Citations for biological rates
- Requesting barangay-level cases for 2022, 2024, 2025

---

## 10. Risks

| Risk | What we do |
|---|---|
| The fitted reporting fraction is meaningless because the modelled population is a subset of the province | Settle the data scope in M1.4 before any fitting; fit only against matching barangays |
| Engine has a mistake that changes the outcome | Automated checks in section 7 before any interface work, and again on every model change |
| Browser too slow | Worker, typed arrays, progress bar, fewer runs by default |
| People read counts as forecasts | Headline is percentage reduction; the note is always visible |
| Case data published on a public site | Decide in M1; ship only aggregated data or leave the overlay out |
| Staff change assumptions and misread the results | Assumptions in an Advanced panel with defaults, labels and a reset button |
| Random noise in checks causes false failures | Shared seeds, averaged runs and a stated tolerance |
| Barangay names fail to match between files | Explicit name map and a data check that lists any unmatched names |
| "Not Encoded" weeks distort weekly curves | Keep them in yearly totals, exclude them from weekly curves, and say so in the app |
| Hosting link breaks or changes | Keep the project in a repository with automatic deploy; document how to redeploy |
| Old browsers or phones struggle | Browser and device check in M8 |
| Model changes later in the research | Re-run the section 7 checks and update the app |