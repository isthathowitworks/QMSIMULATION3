# Dengue Simulation Web App: Build Plan (v3)

A hosted web app where the PHO and LGU staff test dengue cleaning and fogging policies on the Camarines Norte model and see what happens, before spending real resources.

It compares strategies. It does not forecast case counts.

---

## 1. Objective

Build a proper, hosted web app (a real project, not a single file) that:

1. Lets staff set a policy: how often cleaning happens, how many households take part, when fogging starts, and (optionally) a different policy per municipality.
2. Runs the dengue simulation for 2019-2025 in the browser, in a background worker, so the page never freezes.
3. Shows what happens over time: infections, mosquito numbers, and households (healthy or infected), on a map of the municipalities.
4. Shows one headline number: the percentage reduction in infections compared with doing nothing (no cleaning and no fogging).
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
| Charts | Plain SVG drawn by the project's own components | No chart library; infection curve and mosquito counts (done in M5) |
| Tests | Vitest | Runs the section 7 checks automatically |
| Fitting | Node script that imports the same engine | One model for the app, the tests and the fitting |
| Hosting | Static host (GitHub Pages, Netlify or Vercel) with automatic deploy from the repository | Free, nothing to keep running |

The one weakness of this stack is statistics and fitting, which are clumsier than in Python. Only four settings are fitted (biting rate, carrying capacity, reporting fraction, surge size), so a simple search script in Node is enough.

### Project layout

```
QMSIMULATION3/                   <- project root (no extra folder)
  .github/
    workflows/
      test.yml                   <- M3 3.4: runs all tests on every push and pull request
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
  data-private/                  <- M4: cases-weekly.json from prepare-data (4.2a), fit results from the fit scripts (4.2b); never published (not under public/)
    cases-weekly.json            <- real weekly cases for the 39 modelled barangays, used by the fit (gaps for 2022, 2024, 2025)
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
    fit-lib.ts                   <- M4 4.2b: fit helpers: search ranges (custom ranges allowed), Latin hypercube sampling, weekly reported cases from a run, score (RMSE x (2 - correlation)) and scoreV2 (used to rank trials)
    fit-settings.ts              <- M4 4.2b: fitting script, uses the same engine: random search with Latin hypercube sampling under the real policy, custom ranges with --range, saves results to data-private (npm run fit)
    rescore-fit.ts               <- M4 4.2b: re-ranks the saved trials of a fit with scoreV2, no engine run
    check-fit.ts                 <- M4 4.2b: re-runs the best trials of a fit with several engine seeds to see whether a good score holds up
    check-settings.ts            <- M4 4.3: runs the simulation once from settings.json (engine seed 1) and compares with the real cases
    settings-lib.ts              <- M4 4.3: turns one trial of a fit results file into settings.json contents, and back into the fit's setting names
    write-settings.ts            <- M4 4.3: copies one chosen trial into public/data/settings.json at full precision
    compare-imports.ts           <- M4 4.4: runs trial 52 once per background import rate and prints real against simulated cases by block (2019 weeks 1-29, surge, weeks 45-52, 2020, 2021, 2023)
    compare-lib.ts               <- M4 4.4: helpers for comparing real and simulated weekly cases: yearly totals and peak weeks (a year with no real records is a gap), sum over a range of weeks
    compare-real.ts              <- M4 4.4: runs the simulation once from settings.json (engine seed 1) and prints yearly totals, peak weeks and the 2019 weekly table, real against simulated
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
      run.ts                     <- the full run: warm-up, then every day with cleaning, fogging, movement, infection, imports and humans; records adults, immatures, infections, bite infections per municipality, onsets per municipality, S/E/I/R totals and fogging rounds
      runJob.ts                  <- one run request, same code in the worker and in tests: checks the request, sets cleaning interval, fogging on/off and trigger, runs, sends progress messages, hands the 14 result arrays over
    worker/
      sim.worker.ts              <- thin shell: loads the three data files once with fetch, receives run messages, calls runJob and posts the replies (checked by tsc and lint; first real run comes in M5)
      runClient.ts               <- M5 5.2a: talks to the worker for the page: numbers each run, passes on progress, resolves with the result, rejects on an error, Cancel stops the worker and the next run starts a fresh one; takes a worker factory so tests can use a fake worker (no browser code)
      workerFactory.ts           <- M5 5.2b-1: creates the real Web Worker from sim.worker.ts for the run client (browser code: not tested by Vitest, checked by tsc, used for real in 5.2b-2 and tested in 5.2c)
    ui/
      controls/
        ControlPanel.tsx         <- M5 5.1: preset buttons, cleaning interval, compliance (hint above 50%), fogging on/off and trigger, number of runs
        ControlPanel.css         <- M5 5.1: page width and control styles
      views/ charts/
      map/
        colorScale.ts            <- M6 6.1b-3: one color scale for the maps (light for few bite infections per 1,000 people, dark for many, three steps) and the shared top value for several maps; no React
        mapGeometry.ts           <- M6 6.1b-4: turns the 12 municipality shapes into SVG paths that fit a box with D3-geo (Mercator); reverses the rings first because the map file has them counterclockwise and D3-geo wants the outer ring clockwise; no React
        MunicipalityMap.tsx      <- M6 6.1b-5: draws one map of the 12 municipalities as a plain SVG, colored by one value per municipality, with a legend bar; a municipality that is not in the names list is gray, so a name mismatch shows on screen
        MunicipalityMap.css      <- M6 6.1b-5: map and legend styles
      run/
        RunPanel.tsx             <- M5 5.2b-2, changed in 5.3c-1: Run and Cancel buttons, a note saying which run is going while a run is going (the do-nothing baseline or your policy, from the optional phase prop), progress bar with the day, notes for finished, cancelled and failed runs
        RunPanel.css             <- M5 5.2b-2: run panel styles
        InfectionChart.tsx       <- M5 5.3c-2: the weekly infection curves (do nothing and your policy); since 5.5c a thin wrapper that gives WeeklyChart the infection labels; shown on the page by ResultsPanel since 5.3c-3
        InfectionChart.css       <- M5 5.3c-2: chart styles (used by WeeklyChart since 5.5c)
        WeeklyChart.tsx          <- M5 5.5c: draws two weekly curves (do nothing and your policy) as a plain SVG with axes, a legend and a text label for screen readers; the labels come in as props so it serves both infections and mosquitoes; tick labels keep decimals (three significant digits); shows a note when there is nothing to draw
        MosquitoChart.tsx        <- M5 5.5c: gives WeeklyChart the labels for adults or immatures per person (prop kind); put on the page in 5.5d
        ResultsPanel.tsx         <- M5 5.3c-3: what the page shows after a run (for now the infection chart, nothing until there is a comparison); the headline number above the chart since 5.4c; since 5.5d the adult and immature mosquito charts under the infection chart
        ResultsNote.tsx          <- M5 5.6a: the short notes about what the tool does and does not show (prop kind: always or afterRun); the always-visible one is on the page in App.tsx, the after-a-run one is at the end of ResultsPanel.tsx
        ResultsNote.css          <- M5 5.6a: look of the notes (small text, thin line above the after-a-run note)
        HeadlineNumber.tsx       <- M5 5.4b: the big number (percentage reduction) with the sentence under it; accent colour when the policy helps, red when it is worse
        HeadlineNumber.css       <- M5 5.4b: headline styles
    state/
      policyControls.ts          <- M5 5.1: the main controls as one object, starting position, six cleaning presets, clamping to the allowed ranges
      runInput.ts                <- M5 5.2b-1: turns the control values into one run request (compliance slider replaces the base compliance; interval, fogging on/off and trigger passed on; "runs" not used yet)
      loadParams.ts              <- M5 5.2b-1: loads public/data/settings.json in the page and lays it over the starting positions (the worker takes its settings from each run request)
      runController.ts           <- M5 5.2b-2, changed in 5.3b: holds the state of one run (idle, running, done, cancelled, error), loads the settings once, builds the requests, calls the run client; a run is two engine runs with the same seed, the "do nothing" baseline (kept and reused while the controls change) and the policy run, which are then compared with compareRuns; the state also has phase (baseline or policy) and comparison; no React (also defines RunStatus and RunPhase)
      useRunController.ts        <- M5 5.2b-2: React hook that gives the page one run controller and starts the real worker only when a run starts
      curve.ts                   <- M5 5.3a: turns the policy run and the "do nothing" baseline run into weekly infection curves, totals and the percentage reduction (mosquito-bite infections only, imports left out), and, since 5.5b, weekly adults and immatures per person (week averages divided by the people in the run), and, since 6.1a-4, the bite infections per municipality added up over each run; no React
      headline.ts                <- M5 5.4a: turns the percentage reduction into the big number and the sentence under it (whole percents, 99.6 shows as 99%, "No clear difference" near zero, "more infections" when the policy is worse, "n/a" when the baseline has no infections)
      municipalities.ts          <- M6 6.1a-2: bite infections per municipality summed over a run, names and simulated people per municipality from the population file, bite infections per 1,000 simulated people; no React, no fetching
      loadPopulation.ts          <- M6 6.1a-3: loads public/data/population.json in the page the same way loadParams.ts loads settings.json
      loadMap.ts                 <- M6 6.1b-2: loads public/data/camarines_norte_map.json in the page the same way loadPopulation.ts loads population.json; checks that it is a FeatureCollection of Polygon and MultiPolygon shapes that each have a municipality name in adm3_en
  tests/
    tsconfig.json                <- settings for the tests only
    policyControls.test.ts       <- M5 5.1: starting position, six presets, a preset changes interval and compliance only, clamping, rounding, matching preset (7 tests)
    controlPanel.test.ts         <- M5 5.1: panel renders all presets and the starting position, one active preset, "No cleaning" label, hypothetical hint above 50%, trigger slider off when fogging is off, "case" or "cases" (7 tests)
    runClient.test.ts            <- M5 5.2a: request gets a type and a numbered id, progress passed on, error reply rejects, ignores replies of another run, second run refused while busy, same worker reused, cancel rejects and next run uses a fresh worker, a broken worker rejects, a late failure of a cancelled worker is ignored (10 tests)
    runInput.test.ts             <- M5 5.2b-1: policy controls passed on, compliance replaces the base, no cleaning is interval 0, the base settings are not changed (4 tests)
    loadParams.test.ts           <- M5 5.2b-1: asks for data/settings.json under the base url, lays the four fitted settings over the starting positions, error with the status when the file cannot be loaded, error when a setting is missing or not a number (4 tests)
    runPanel.test.ts             <- M5 5.2b-2, changed in 5.3c-1: Run enabled and Cancel disabled when idle, Run disabled and Cancel enabled with the progress bar when running, baseline phase text, policy phase text, no phase text when there is no phase yet or no run is going, finished, cancelled and error notes (9 tests)
    runController.test.ts        <- M5 5.2b-2, changed in 5.3b: idle start, done with the policy result, baseline first then policy run with the phase shown, baseline has no cleaning and no fogging and shares the seed, policy request built from controls and seed, comparison with the baseline, mosquitoes per person compared, baseline and seed reused on the next start, progress, error, failed baseline not kept, settings load failure and retry, settings loaded once, second start ignored, cancel (also during the baseline, during the policy run, and while loading), listeners (20 tests); changed in 5.5b: the fake results now have adults, immatures and people counts; changed in 6.1a-4: the fake results now have municipalityCount and biteInfections, and one test checks the bite infections per municipality for both runs (21 tests)
    useRunController.test.ts     <- M5 5.2b-2: the hook starts idle with no result and starts no worker on load (1 test)
    curve.test.ts                <- M5 5.3a: imports taken off the new infections, daily totals added up into weeks (short last week kept), percentage reduction (zero, negative when the policy is worse, null when the baseline has no infections), weekly curves and totals, weekly averages (a short last week is averaged over its days), people in a run, mosquitoes per person (zero when there are no people), adults and immatures per person for both runs, refuses runs with a different number of days, bite infections per municipality for both runs adding up to the totals, refuses runs with a different number of municipalities (19 tests, 8 added in 5.5b, 2 added in 6.1a-4)
    infectionChart.test.ts       <- M5 5.3c-2: note and no chart when there is nothing to draw, one point per week on both lines, axis top rounded up to an easy number, lower curve drawn lower, all zeros, a single week, values that are not numbers treated as zero, week labels every 52 weeks, screen reader label and legend (9 tests); unchanged in 5.5c, it now runs through WeeklyChart
    weeklyChart.test.ts          <- M5 5.5c: uses the labels it is given, note when there is nothing to draw, decimals on the top label when the axis top is below 1, only 0 and the top when the axis top is below 2, no floating point noise, whole numbers without a decimal point, mosquito-sized numbers, all zeros (8 tests)
    mosquitoChart.test.ts        <- M5 5.5c: labels for adults, labels for immatures, the two kinds not mixed up, both lines and the legend, note when there are no weeks (5 tests)
    resultsPanel.test.ts         <- M5 5.3c-3: shows nothing when there is no comparison, shows the chart when there is one, draws a baseline and a policy curve in each of the three charts, shows the headline number above the charts, shows n/a instead of a number when there is nothing to compare with, shows the adult and immature mosquito charts after the infection chart, gives each mosquito chart its own numbers, shows the after-a-run note under the charts and not the always-visible note (9 tests, 2 added in 5.6b; changed in 6.1a-4: the fake comparison has the two new bite lists)
    resultsNote.test.ts          <- M5 5.6a: the always-visible note and the after-a-run note each show their wording, with the right class and role (4 tests)
    headline.test.ts             <- M5 5.4a: the number and sentence for a reduction, for exactly 100, for 99.6 and 99.4, for values that round to zero, for a worse policy, for null and for values that are not numbers (8 tests)
    headlineNumber.test.ts       <- M5 5.4b: the four cases on the page: fewer, more, no clear difference, n/a (4 tests)
    municipalities.test.ts       <- M6 6.1a-2: totals per municipality by hand, order of names and people, per 1,000 by hand, a municipality with no people gives 0
    loadPopulation.test.ts       <- M6 6.1a-3: asks for data/population.json under the base url, returns the file contents, error with the status when it cannot be loaded, error when the file has no barangays, error when a barangay has no municipality name or simPeople is not a number
    loadMap.test.ts              <- M6 6.1b-2: asks for data/camarines_norte_map.json under the base url, returns the file contents, error with the status when it cannot be loaded, error when there are no shapes, error when a shape has no name or is not a Polygon or MultiPolygon, accepts the real file with 12 named shapes (6 tests)
    colorScale.test.ts           <- M6 6.1b-3: lightest color for 0 and darkest for the top value, middle color halfway, darkest above the top, lightest for negative, NaN, Infinity and a top value of 0, six digit hex colors, gets darker as the value goes up, shared top value over several lists (11 tests)
    mapGeometry.test.ts          <- M6 6.1b-4: outer ring clockwise and holes counterclockwise after rewinding, no points lost, input not changed, MultiPolygon parts all wound, one path per shape in file order with the names, no NaN, every point of the real map inside the box (9 tests)
    municipalityMap.test.ts      <- M6 6.1b-5: title and picture label, 12 shapes with their names, colors on one scale, gray shape for a name that is not in the list, legend shows 0 and the top value with three digits, note and no map when there is nothing to draw, no NaN for all zeros (7 tests)
    data.test.ts                 <- checks the files in public/data (settings.json must be marked fitted, with a note and values inside the ranges the fit searched)
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
    run.test.ts                  <- states add up, same seed same result, world not changed, no disease without seeds or imports, imports start infections, fogging flags add up, immature mosquitoes are recorded every day, bite infections per municipality add up to new infections minus imports (12 tests)
    engineChecks.test.ts         <- M3 3.1: warm and wet gives more than twice the adults of cool and dry, adults fall when the weather turns cool and dry, a different seed gives a different run
    policyChecks.test.ts         <- M3 3.2: on a small world with shared seeds and averaged runs, no cleaning is worst, higher compliance, more frequent cleaning and an easier fogging trigger never raise infections (tolerance 5 people); takes about 22 s
    consistency.test.ts          <- M3 3.3: 0% compliance with fogging off vs the no-cleaning preset (interval 0), both through runJob; nothing cleaned or fogged in either, averages over 20 shared seeds agree (infections within 5 people, adult mosquitoes within 1%); takes about 6 s
    spread.test.ts               <- M3 3.5: same policy, 20 seeds, standard deviation within 6% of the mean and no run more than 15% away (two policies, bite infections on the small world); takes about 5 s
    weeklyCases.test.ts          <- M4 4.2a: weekly real cases from small examples (slots, sums, gaps, skipped rows) and the real files (2019, 2020, 2021, 2023 have data; totals match)
    casesFile.test.ts            <- M4 4.2a: data-private/cases-weekly.json exists, right shape, gaps for 2022, 2024, 2025, and is up to date with the case file
    fitSettings.test.ts          <- M4 4.2b: command line options (--trials, --seed, --out, --range), range parsing, the four fitted settings laid over the starting positions
    latinHypercubeRanges.test.ts <- M4 4.2b: Latin hypercube with custom ranges: values stay inside the ranges, every slice used once, same result as before without ranges
    scoreV2.test.ts              <- M4 4.2b: scoreV2 by hand: perfect match is 0, too high and too low count the same, no cases gives Infinity, a flat series loses
    rescoreFit.test.ts           <- M4 4.2b: re-ranking saved trials with scoreV2, a null correlation counts as 0, the input order is not changed
    checkFit.test.ts             <- M4 4.2b: check-fit command line options and the summary of the runs of one trial
    checkSettings.test.ts        <- M4 4.3: the app's params from settings.json equal the params the fit used, renaming of the four values
    writeSettings.test.ts        <- M4 4.3: copying one trial into the settings file names, full precision kept, errors for a missing trial or value
    compareReal.test.ts          <- M4 4.4: yearly comparison by hand (totals, peak weeks, ties, a year with no real records is a gap, no peak week for a year with no cases, length mismatch throws) and sum over a range of weeks
    fitRunTrial.test.ts          <- temporary: M4 4.2b: one trial on the real data run twice, same seed gives the same result, prints total cases and fogging rounds; only runs when TIMING is set (about 90 s)
    runRecording.test.ts         <- recorded adult mosquitoes: never rise in cold weather, infectious never exceed all adults, states add up
    runJob.test.ts               <- progress then one done message, the 14 result arrays handed over (immatures and bite infections included), same request same result, interval 0 means no cleaning, fogging on/off and trigger, bad requests and a missing municipality give an error message
    runFullTiming.test.ts        <- temporary: times one full run on the real data (2019-2025), prints time and cases per year; only runs when TIMING is set
    runPhases.test.ts            <- temporary: times each step of the day separately; only runs when TIMING is set
  docs/
    model-rules.md               <- the one-page rules from M1
    _2nd QM-research.docx        <- research document
  package.json                   <- scripts: dev, build, lint, preview, prepare-data, fit (runs the settings fit), test
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

1. **Infection curve:** chosen policy vs. do nothing (no cleaning and no fogging), with the percentage reduction as the big number. With several runs, the average and the spread.
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

`data-raw/barangay-name-map.csv` records these matches. All 39 were checked (the Matacong and San Jose matches each have only one candidate in the case records), so the fit uses all 39. The scope decision is recorded in section 8.

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
- **2.8 Worker and speed test.** Wrap the engine in a Web Worker that posts progress. Time a full 2,557-day run. If it is too slow, optimize the data structures before changing the model. *Result so far:* the full engine takes about 29 s on my laptop (35.8 s before the recording was tidied), two thirds of it in the mosquito steps (egg laying is the biggest at about a third). Decision: no more speed work for now; build the worker with a progress bar and revisit the speed after M3. Done so far: `runJob.ts` (request checks, progress messages, result hand-over) with 13 passing tests. The worker file `src/worker/sim.worker.ts` is written and compiles. Full npm test: 237 passed, 2 timing files skipped. The first real run through the worker happens in M5.
- *Reached when:* a full run completes inside the worker with no interface, with a progress bar, and takes well under a minute (seconds is the later goal).

### M3: Engine checked
- **3.1 Basic checks.** Same seed gives the same result; population stays constant; seasons show in mosquito numbers. *Done:* same seed and constant population were already in `run.test.ts`; `engineChecks.test.ts` adds the seasons check (warm and wet beats cool and dry by more than 2 times, adults fall when the weather turns) and a different-seed check. 3 tests pass.
- **3.2 Policy checks.** No cleaning is worst; more compliance or more frequent cleaning never raises infections; an easier fogging trigger never raises infections. These are tested on averaged runs with shared seeds (see section 7). *Done:* `policyChecks.test.ts` runs 20 shared seeds per policy on a small stand-in world (320 people, 200 days, warm and wet weather) and counts people infected by mosquito bites, leaving imports out. A check fails only if the "better" policy is worse by more than 5 people on average. 5 tests pass in about 22 s.
- **3.3 Consistency check.** 0% compliance with fogging off equals the no-cleaning preset. *Done:* `consistency.test.ts` runs both through `runJob`. With 0% compliance the engine still rolls a random number for each household that is due, so the two are not identical run for run. The test therefore checks that nothing is cleaned or fogged in either, and that averages over 20 shared seeds agree (infections within 5 people, adult mosquitoes within 1%). A third test confirms real cleaning is clearly lower, so the comparison can tell a difference. 3 tests pass in about 6 s.
- **3.4 Automate.** All checks run as Vitest tests and on every change in the repository. *Done:* the workflow file `.github/workflows/test.yml` runs `npm ci` and `npm test` on every push and pull request (Node 24, 15-minute limit). The first run on GitHub passed in 55 s. Full `npm test`: 237 passed, 2 timing files skipped.
- **3.5 Run-to-run spread check.** Repeated runs of the same policy give similar totals. *Done:* `spread.test.ts` runs two policies (no cleaning, and weekly at 50% compliance) with 20 different seeds each on the small stand-in world from 3.2, and checks the people infected by mosquito bites. The first run gave a standard deviation of 1.9% of the mean for no cleaning (mean 273.8, range 263 to 280) and 2.8% for weekly at 50% (mean 236.6, range 224 to 251). The test fails if the standard deviation is more than 6% of the mean, or if any single run is more than 15% away from the mean (about twice the worst values seen). It also checks that there are enough infections and that different seeds give different runs. 8 tests pass in about 5 s. This backs up the averaged comparisons in 3.2 and 3.3 and the "average of several runs, with the spread shown" control in the app.
- *Reached when:* every check in section 7 passes automatically. No interface work before this.

### M4: Settings fitted
- **4.1 Choose what to fit.** Four settings, same as the earlier Python fit, by random search with the same ranges: `biteRate` 0.10 to 0.35, `kPerPerson` 0.3 to 3.0, `reportFrac` 0.03 to 0.40, `importedSurgeSize` 0 to 40 (extra imported infections per day per 100,000 people, weeks 30 to 44 of 2019 only). All four are searched together. `reportFrac` cannot be solved separately afterwards, because `fogging.ts` uses it to count reported cases for the fogging trigger, so it changes how the epidemic runs whenever fogging is on. The fit script (not the engine) turns infections into reported cases: infections x `scale` x `reportFrac`. Score = RMSE on the mean weekly series x (2 minus correlation), as in the Python fit. The old Python surge covered weeks 28 to 34; the engine surge covers weeks 30 to 44, so the surge range is a guess until the fit shows how it behaves. `paramsFromSettings` now applies `importedSurgeSize` (done in step 4.3). *Update after fitting:* trials are ranked with `scoreV2` (2 x (1 minus correlation) plus the absolute log of simulated total over real total), not with the score above, because that score picked a flat series that did not follow the weekly pattern. Round 2 used narrower ranges: `reportFrac` 0.005 to 0.15, `biteRate` 0.10 to 0.30, `kPerPerson` 0.5 to 3.0, `importedSurgeSize` 0 to 40 (unchanged).
- **4.2a Real weekly cases.** `prepare-data.ts` writes `data-private/cases-weekly.json`: weekly cases for the 39 modelled barangays (matched with `barangay-name-map.csv`), 52 weeks per year. Years with no barangay-level records (2022, 2024, 2025) are gaps (null), not zeros. In a year with records, a week with no record counts as 0. "Not Encoded" weeks are left out. Not under `public/` because the data privacy question (section 8) is still open. A test checks the totals against the case file *Done:* `buildWeeklyCases` in `prepare-lib.ts`, written to `data-private/cases-weekly.json` by `prepare-data.ts`. Real cases in the 39 barangays per year: 2019 337, 2020 86, 2021 38, 2023 9 (2019 will dominate the fit). Full `npm test`: 34 files passed, 2 skipped; 261 tests passed, 2 skipped.
- **4.2b Fit against real cases.** Use the weeks with barangay-level records (2019, 2020, 2021, 2023), restricted to the scope decided in M1.4. Run `fit-settings.ts` in Node with the same engine the app uses. One run per trial (the M3.5 spread check showed only 2 to 3% run-to-run difference), with Latin hypercube sampling so the random picks cover the ranges evenly. *Done so far:* `fit-settings.ts` runs under the real policy (`policy.json`) with compliance at its starting position (0.5, not fitted), engine seed 1 for every trial, and saves results to `data-private/` after every trial (`npm run fit`). Round 1: 30 trials, seed 1, the ranges in 4.1. The shape was good (correlation about 0.89) but the totals were about 3 times too high (best by `scoreV2`: trial 25, 1,536 simulated against 470 real). Round 2: 60 trials, seed 2, the narrower ranges above; several trials came close to the real total with correlation about 0.9. Seed check (`check-fit.ts`, top 3 trials, engine seeds 1 to 3): trial 52 gave 434 to 459 simulated cases (mean `scoreV2` 0.258), trial 39 gave 422 to 426 (0.328), trial 29 gave 837 to 861 (0.815); fogging triggered 158 to 192 rounds per run. Chosen for `settings.json`: trial 52 (`biteRate` 0.2353, `kPerPerson` 1.1488, `reportFrac` 0.0076, `importedSurgeSize` 23.1133). Main alternative: trial 39 (`biteRate` 0.1067, `kPerPerson` 2.8343, `reportFrac` 0.0102, `importedSurgeSize` 17.4472). Settings must be read at full precision from the results file: the rounded values from the printout gave 521 cases for trial 52 instead of 459. Still open: correlation is 0.86 to 0.92 in almost every trial, so the fit mostly judges size; trials 52 and 39 fit equally well with very different `biteRate` and `kPerPerson`, and how each responds to cleaning and fogging is not compared yet; the surge window (weeks 30 to 44 of 2019) is not checked against the weekly data.
- **4.3 Save `settings.json`.** The app reads it; it is the single place to change settings later. *Done:* `public/data/settings.json` now holds trial 52 at full precision (`fitted: true`, with a note). It was copied by `scripts/write-settings.ts` (`npx tsx scripts/write-settings.ts data-private/fit-round2.json 52`), so no value is typed by hand. `paramsFromSettings` now applies `importedSurgeSize`. The app's path (`settings.json`, then `paramsFromSettings`) builds the same params as the fit used (test `checkSettings`), and `scripts/check-settings.ts` with engine seed 1 gave 459 simulated cases against 470 real (correlation 0.904, 159 fogging rounds). `prepare-data.ts` does not overwrite `settings.json` once it exists. Comparing with the real cases (2019 surge weeks, yearly totals) is step 4.4.
- **4.4 Compare with real data.** 2019 surge near the right weeks; yearly totals the right order of magnitude; 2022, 2024 and 2025 shown as gaps. *Done:* `scripts/compare-real.ts` runs once from `settings.json` (engine seed 1) and prints yearly totals, peak weeks and the 2019 weekly table, real against simulated (helpers in `compare-lib.ts`, test `compareReal`). Result for trial 52: 2019 real 337, simulated 420; 2020 real 86, simulated 21; 2021 real 38, simulated 10; 2023 real 9, simulated 8; total 470 against 459 (the high 2019 cancels the low 2020 and 2021). The 2019 surge starts at weeks 30 to 31 and ends at weeks 45 to 46, so the window fits, but the simulated surge is a flat plateau of about 25 to 29 cases a week while the real weeks build up (3, 6, 12, 12, 24 in weeks 30 to 34) and then vary between about 13 and 25. Weeks 1 to 29 of 2019 have 36 real and 5 simulated cases. 2022, 2024 and 2025 show as gaps for real cases (simulated 16, 4 and 6). `reportFrac` 0.0076 means about 1 in 130 infections is reported and is close to the bottom of the round 2 range (0.005). Background import rate test (`scripts/compare-imports.ts`, trial 52, engine seed 1, `importPerDayPer100k` 0.05, 0.2, 0.5, 1 and 2): a higher rate lifts the quiet years (at 0.5: 2019 weeks 1 to 29 23, 2020 78, 2021 79, 2023 48, against real 36, 86, 38, 9) and keeps the correlation at 0.88 to 0.90, but no single rate fits every year, because the real cases fall from 86 to 38 to 9 while the simulated years stay level. The total and `scoreV2` get worse with every higher rate (0.216 at 0.05, 1.062 at 2), because the 2019 surge weeks are already too high (374 simulated against 242 real). Decision: keep trial 52 and record the limits (see the open problem below). The refit stays available as a later option.
- *Open problem after 4.4 (decision: Option B, trial 52 kept; Option A stays available for later):* in the simulation the quiet years are too low (2020 and 2021 about 4 times, 2019 weeks 1 to 29 about 7 times) and the 2019 surge is a flat plateau, so 2019 is the only year the model gets right. Most simulated cases come from the imported surge, not from spread inside the province. Two options. **Option A, refit (later option):** (1) add `importPerDayPer100k` as a fifth fitted setting in `fit-lib.ts` (`FitSettings`, `FIT_RANGES`, range about 0.05 to 1.0); (2) add a per-year size term to `scoreV2` so that 2020, 2021 and 2023 count and 2019 does not dominate; (3) carry the fifth value through `SettingsFile`, `paramsFromSettings`, `settingsFromTrial`, `fitSettingsFromFile`, `paramsForTrial` and `settings.json`; (4) update the tests that list the four settings (`fitSettings`, `fitLib`, `latinHypercubeRanges`, `scoreV2`, `rescoreFit`, `checkFit`, `writeSettings`, `checkSettings`, `params`, `data`); (5) run round 3 (60 trials, a new seed, `npm run fit -- --trials 60 --seed 3 --out data-private/fit-round3.json`), rank with the new score, seed-check the top 3, write the best trial with `write-settings.ts`, rerun `compare-real.ts` and `compare-imports.ts`. The surge size will probably need to come down, because the surge weeks are already too high (374 simulated against 242 real). **Option B, accept trial 52:** record the limits in this plan and in the "How this is estimated" note (the 2020 and 2021 province estimates come out about 4 times too low), change 4.4 to *Done* and move on to M5. Files a new chat needs to see before Option A: `scripts/check-fit.ts`, `scripts/rescore-fit.ts` and the ten tests listed in (4) (the code files `fit-lib.ts`, `fit-settings.ts`, `settings-lib.ts` and `params.ts` were already shared in this chat, but a new chat has not seen them).
- *Reached when:* `settings.json` is saved and the comparison with real cases looks reasonable.

### M5: First usable app
- **5.1 Controls.** Cleaning interval, compliance, fogging on/off and trigger, number of runs.  *Done:* `src/state/policyControls.ts` (starting position: every 7 days, 50% compliance, fogging on at 1 case, 1 run; maximum 10 runs; six cleaning presets; a preset changes interval and compliance only; interval 0 means no cleaning) and the control panel in `src/ui/controls/ControlPanel.tsx`, shown by `App.tsx`. Compliance above 50% shows a "hypothetical value" hint. The controls do not run anything yet (5.2). 7 + 7 new tests; full npm test: 357 passed, 3 skipped; lint 0 errors; build passes.
- **5.2 Worker connection.** Send the policy to the worker, show a progress bar, allow cancel. *Split into four steps.* **5.2a (done, 10 tests pass):** `src/worker/runClient.ts` with `tests/runClient.test.ts`, plain TypeScript with no buttons yet. **5.2b-1 (done, 8 tests pass):** `src/state/runInput.ts`, `src/state/loadParams.ts` and `src/worker/workerFactory.ts` (the real worker factory), still no buttons. **5.2b-2 (done, 18 tests pass):** the Run button, progress bar and Cancel button in the page: `src/ui/run/RunPanel.tsx` and `RunPanel.css` (show the state they are given), `src/state/runController.ts` (holds the run state: idle, running, done, cancelled, error; loads the settings once; ignores a late result after Cancel), `src/state/useRunController.ts` (React hook that starts the real worker only when a run starts) and the new `src/App.tsx`. **5.2c (done):** first real run in the browser: Run ends with "Run finished.", Cancel ends with "Run cancelled." and the Run button works again. The result is not shown yet (5.3 to 5.5).
- **5.3 Infection curve.** Chosen policy vs. the baseline "do nothing" (no cleaning and no fogging). *Decided:* the baseline is one extra run with the same seed and settings, run once and reused while the controls change. The "No cleaning" preset with fogging on shows what fogging does alone. A later option is to split the headline into "cleaning only" and "fogging only". *Split into three steps.* **5.3a (done, 9 tests pass):** `src/state/curve.ts` with `tests/curve.test.ts`, plain TypeScript with no chart yet: weekly curves for the policy and the baseline, the totals and the percentage reduction. Only infections from mosquito bites are counted (new infections minus imported), because imports come from outside and the policy cannot reach them. **5.3b (done, 19 tests pass in runController.test.ts):** `src/state/runController.ts` runs the "do nothing" baseline once per seed, reuses it while the controls change, and compares it with the policy run using `compareRuns`. The controller makes one seed on the first Run and keeps it, so the baseline stays valid; a side effect is that pressing Run twice with the same controls gives the same result (a "new seed" button can come later). A failed or cancelled baseline is not kept, but a cancel during the policy run keeps it. `RunState` has two new fields, `phase` and `comparison`. Full npm test: 409 passed, 3 skipped; lint 0 errors; build passes. **5.3c:** the chart on the page, *split into three steps.* **5.3c-1 (done, 9 tests pass in runPanel.test.ts):** `RunPanel` shows which run is going while a run is going, "Running the do-nothing baseline (no cleaning, no fogging)" or "Running your policy" (new optional `phase` prop; `App.tsx` passes `state.phase`); checked in the browser: the baseline text shows first, then the policy text with the bar starting again, then "Run finished."; a second Run with the same controls shows only the policy text because the baseline is reused. **5.3c-2 (done, 9 tests pass in infectionChart.test.ts):** `src/ui/run/InfectionChart.tsx` and `InfectionChart.css`, the chart component, plain SVG with no chart library: two weekly lines (do nothing dashed, your policy solid), a y axis from 0 with the top rounded up to an easy number, a week label every 52 weeks, a legend, a text label for screen readers, and a note when there is nothing to draw; with `tests/infectionChart.test.ts`. On the page since 5.3c-3. Whether the weeks include the 150 spin-up days is checked in the browser in 5.3c-3. **5.3c-3 (done, 3 tests pass in resultsPanel.test.ts):** `src/ui/run/ResultsPanel.tsx` shows the infection chart after a run (nothing until there is a comparison) and `App.tsx` shows it below the Run panel, with `tests/resultsPanel.test.ts`; the headline number (5.4) and the mosquito counts (5.5) go into the same panel. Checked in the browser: after the first Run the chart shows a dashed "Do nothing" line and a solid "Your policy" line, the y axis starts at 0 with whole numbers, the week labels run every 52 weeks up to 364, so the curve covers 2019 to 2025 (2557 days) and the 150 spin-up days are not in it. The 2019 peak is about 1,800 infections a week for "do nothing" and about 60 for the weekly 50% policy. Full npm test: 425 passed, 3 skipped; lint 0 errors; build passes.
- **5.4 Headline number.** Percentage reduction in infections, big and clear. The comparison is with "do nothing" (no cleaning and no fogging), so every control changes the number.  *Done, split into three steps.* **5.4a (8 tests pass):** `src/state/headline.ts` with `tests/headline.test.ts`, plain TypeScript that turns the percentage reduction into the big number and the sentence under it: whole percents only, 99.6 shows as 99% so it never claims that every infection was prevented, a change that rounds to zero shows "0%" with "No clear difference", a worse policy shows a positive number with "more infections than doing nothing", and "n/a" with a reason when the do-nothing run had no infections. **5.4b (4 tests pass):** `src/ui/run/HeadlineNumber.tsx` and `HeadlineNumber.css` show it big (accent colour when the policy helps, red when it is worse), with `tests/headlineNumber.test.ts`. **5.4c (done, 5 tests pass in resultsPanel.test.ts):** `ResultsPanel` shows the headline above the chart. Checked in the browser: the starting position (every 7 days, 50% compliance, fogging on at 1 case) gave 89% fewer infections than doing nothing; the number covers all seven years, so it is lower than the reduction at the 2019 peak. Full npm test: 439 passed, 3 skipped; lint 0 errors; build passes.
- **5.5 Mosquito counts.** Adults and immatures per person over time. *Split into four steps.* **5.5a (done, 24 tests pass in run.test.ts and runJob.test.ts):** `RunResult` has a new `immatures` array (all immature mosquitoes in the study area, one number per day, recorded in `src/engine/run.ts`; no random numbers used, so the infections stay the same for the same seed) and the worker hands over 13 arrays instead of 12 in `src/engine/runJob.ts`. **5.5b (done, 17 tests pass in curve.test.ts):** `src/state/curve.ts` adds weekly adults and immatures per person for the policy and the do-nothing run to `Comparison`: the week average of the daily count divided by the people in the run (susceptible plus exposed plus infectious plus recovered, which never changes). Averaged, not added up like infections, because a mosquito count is how many exist, not a number of events. `tests/runController.test.ts` needed its fake results filled in (20 tests), and `tests/resultsPanel.test.ts` has the four new fields. **5.5c (done, 22 tests pass in infectionChart.test.ts, weeklyChart.test.ts and mosquitoChart.test.ts):** the chart drawing moved out of `InfectionChart.tsx` into a new `WeeklyChart.tsx` that takes its labels as props (section label, picture label, y axis title), so there is one drawing and no copy. `InfectionChart.tsx` is now a thin wrapper and its 9 tests did not change. A new `MosquitoChart.tsx` (prop `kind`: adults or immatures) is the second wrapper. Tick labels now keep decimals (three significant digits, no floating point noise); an axis with a top below 2 still has only 0 and the top. **5.5d (done, 7 tests pass in resultsPanel.test.ts, 2 added):** `ResultsPanel.tsx` now shows the headline number, the infection chart, the adult mosquito chart and the immature mosquito chart, in that order. Checked in the browser: all three charts draw with a dashed do-nothing line and a solid policy line; adults per person are about 5 to 22 for do nothing and about 1 to 4 with the starting position; immatures about 5 to 17 and about 2 to 4. *Noticed, not changed:* the do-nothing immatures per person are lower than the adults per person (immatures are usually the larger group), and both mosquito curves drop over roughly the first 20 weeks before settling (the mosquito population may still be settling after the warm-up); to look at when the mosquito part of the model is revisited. Full npm test after 5.5d: 464 passed, 3 skipped; lint 0 errors; build passes.
- **5.6 Results note.** *Done, split into two steps.* **5.6a (done, 4 tests pass in resultsNote.test.ts):** `src/ui/run/ResultsNote.tsx` and `ResultsNote.css` (prop `kind`: always or afterRun; a short paragraph with `role="note"`), with `tests/resultsNote.test.ts`. The always-visible note reads: "This tool compares strategies. It does not forecast case counts. The biological rates are assumptions." The after-a-run note reads: "The settings were fitted to real cases while the real policy (weekly cleaning, fogging at 1 case) was running. Doing nothing is outside what the fit saw, so read the size of the reduction with care." **5.6b (done, 9 tests pass in resultsPanel.test.ts, 2 added):** `App.tsx` shows the always-visible note under the heading and above the controls, so it shows before the first run (`ResultsPanel` shows nothing until there is a comparison); `ResultsPanel.tsx` ends with the after-a-run note under the charts. Checked in the browser: the first note shows under the heading, small and in line with the heading and controls (not centred); after a run the headline and three charts show as before and the second note shows under the immature mosquitoes chart with a thin line above it, with the first note still at the top. Full npm test after 5.6: 59 files passed, 3 skipped; 470 tests passed, 3 skipped; lint 0 errors, 20 old warnings (115 files); build passes. Checked in the browser after 5.6: after changing a control and pressing Run again, only the policy run happens, and the baseline is reused within a page session. The starting position (every 7 days, 50% compliance) gave 90% fewer infections; "Weekly, low compliance" (26%) gave 39%. The solid "Your policy" lines and the headline changed, and the dashed "Do nothing" lines stayed the same in all three charts.
- *Reached when:* a user can change a control, run it, and read the % reduction, with the page staying responsive during the run. *Reached (M5 done).*

### M6: Map and households
- **6.1 Municipality map.** The 12 municipalities colored by infections after a run. *Planned, split into three steps.* **6.1a:** (engine part done: `biteInfections` recorded in `run.ts`, 14 arrays handed over in `runJob.ts`, 12 tests in run.test.ts and 13 in runJob.test.ts pass, including a check that the per-municipality sums equal new infections minus imports every day; full npm test: 59 files passed, 3 skipped; 471 tests passed, 3 skipped; build passes; lint 0 errors, 20 old warnings; the state part is split into 6.1a-2, 6.1a-3 and 6.1a-4 below) the engine records people infected by mosquito bites per municipality (new array `biteInfections` in `RunResult`, flat like `onsets`, row = day, column = municipality; counted right after `infectPeople`, before imports, so it matches the headline number; no random numbers, so results for the same seed stay the same; `runJob.ts` hands over 14 arrays instead of 13). Reading `run.ts` showed that `onsets` is not enough: it includes imported infections, and imports are only recorded as a total per day. Then three small steps. **6.1a-2:** `src/state/municipalities.ts` with `tests/municipalities.test.ts`, plain TypeScript with no fetching and no drawing: bite infections per municipality summed over the whole run, names and simulated people per municipality from the population file contents (same first-appearance order as `World.municipalities`), and bite infections per 1,000 simulated people. *Done:* three functions (`biteTotalsPerMunicipality`, `municipalityPeople`, `perThousand`), 10 tests in `municipalities.test.ts`; full npm test: 60 files passed, 3 skipped; 481 tests passed, 3 skipped; build passes; lint 0 errors, 20 old warnings. **6.1a-3:** `src/state/loadPopulation.ts` with `tests/loadPopulation.test.ts`, loads `data/population.json` the same way `loadParams.ts` loads `settings.json`. *Done:* `loadPopulation(baseUrl, fetchFn)` returns the file contents, errors with the status when it cannot be loaded, errors when the file has no barangays or a barangay has no municipality name or simPeople that is not a number; 5 tests in `loadPopulation.test.ts`; full npm test: 61 files passed, 3 skipped; 486 tests passed, 3 skipped; build passes; lint 0 errors, 20 old warnings. **6.1a-4:** `curve.ts` adds the per-municipality totals for the policy and the do-nothing run to `Comparison` (the page does not see the do-nothing result otherwise), and the fake results in the tests get the new fields. *Done:* `Comparison` has two new lists, `baselineBitesByMunicipality` and `policyBitesByMunicipality` (bite infections added up over the whole run, in the same order as `World.municipalities`, each list adds up to its run total; the per 1,000 numbers are not stored, the page works them out with `perThousand`); `compareRuns` also refuses runs with a different number of municipalities; 2 tests added in `curve.test.ts`, 1 in `runController.test.ts`, the fake `Comparison` in `resultsPanel.test.ts` has the new fields; full npm test: 61 files passed, 3 skipped; 489 tests passed, 3 skipped; build passes (bundle index-BLMBKZBE.js 233.83 kB, 40 modules, because `curve.ts` now imports `municipalities.ts`); lint 0 errors, 20 old warnings. **6.1b:** a map component in `src/ui/map/` that draws the 12 shapes from `camarines_norte_map.json` as plain SVG with D3-geo (no map tiles), colored on one scale with a legend, with its tests; the map file is already in public/data (written by prepare-data.ts), so the page loads it the same way as settings.json.  *Done:* installed `d3-geo` and `@types/d3-geo`; four small steps. **6.1b-2:** `src/state/loadMap.ts` loads `data/camarines_norte_map.json` the same way as `loadPopulation.ts` and errors when there are no shapes, a shape has no name or a shape is not a Polygon or MultiPolygon (6 tests). **6.1b-3:** `src/ui/map/colorScale.ts`, one three-step color scale and a shared top value for both maps (11 tests). **6.1b-4:** `src/ui/map/mapGeometry.ts`, the 12 shapes as SVG paths with D3-geo; reading the real file showed that every outer ring runs counterclockwise, so the rings are reversed first, and a test checks that every point of the real map lands inside the box (9 tests). **6.1b-5:** `src/ui/map/MunicipalityMap.tsx` and `MunicipalityMap.css`, one map with a title, the 12 shapes colored on the shared scale and a legend bar; it gets the names and values from the page and shows a municipality that is not in the names list in gray (7 tests). Full npm test: 65 files passed, 3 skipped; 522 tests passed, 3 skipped; build passes (bundle index-BLMBKZBE.js 233.83 kB, 40 modules, unchanged because nothing on the page imports the map yet); lint 0 errors, 20 old warnings, 127 files. **6.1c:** put the map in `ResultsPanel.tsx` and check it in the browser: 12 shapes, colors change after a different policy is run, the do-nothing map stays the same. Decided: the map shows bite infections per 1,000 simulated people, because a plain count makes large towns look worse only because they are bigger; the do-nothing and policy maps are shown side by side (do nothing on the left, your policy on the right) on one shared color scale, so the same color means the same number on both and the effect of the policy shows as lighter colors; on a narrow screen they stack, which is checked in 6.4.
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
- **Data scope:** fit and run on the barangays that have population data in the model (all 39 barangays in the population file, which all match a barangay in the case records). Results are then scaled up to the whole province as a display step and shown as "Estimated cases for Camarines Norte". The headline never says how many barangays are modelled. The method goes in a "How this is estimated" note behind an info button, saying the model is fitted to the barangays with population data and scaled to the province. Later options, after the fit works: (1) scale-up by municipality population, (2) a hold-out check that compares the scaled estimate with recorded cases in the other 208 barangays, (3) "rest of municipality" blocks if the check shows a problem. Adding populations for all 242 barangays is a separate later milestone.

**Still open**
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