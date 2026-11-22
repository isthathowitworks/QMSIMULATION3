// Every setting the engine uses, with its starting position.
// Values are copied from the earlier Python engine and from docs/model-rules.md.
// Sliders only change a copy of these; Reset goes back to DEFAULT_PARAMS.

export interface Params {
  // people
  incubationDays: number // exposed -> infectious
  infectiousDays: number // infectious -> recovered
  pAway: number // share of people away from home on a given day
  pOtherMuni: number // share of those who go to another municipality
  gravityBeta: number // how fast the chance of travelling falls with distance
  initialImmune: number // share starting recovered
  popTurnoverPerYear: number // share of recovered people replaced by susceptibles each year
  seedInfected: number // infectious people on the first day
  importPerDayPer100k: number // background imported infections
  importedSurgeSize: number // EXTRA imported infections per day per 100,000 people in weeks 30-44 of 2019 (NEW)
  importSurgeOn: boolean // surge on or off (NEW)
  reportFrac: number // share of true infections that show up as reported cases
  scale: number // real people that one simulated person stands for
  // mosquitoes
  adultsPerPerson: number // starting adult density
  kPerPerson: number // immature carrying capacity per person at full breeding sites
  eggRateMax: number // eggs per adult per day at the best temperature
  larvaSurv0: number // survival to emergence when uncrowded
  rainBase: number // breeding-site level in a dry spell
  rainSatMm: number // 14-day rain at which breeding sites are full
  biteRate: number // bites per mosquito per day
  pH2m: number // infection chance, infectious human -> mosquito, per bite
  pM2h: number // infection chance, infectious mosquito -> human, per bite
  // cleaning
  compliance: number // share of households that clean on a scheduled day
  cleanKill: number // share of immatures removed in a cleaned household
  cleanSiteCut: number // share of breeding sites removed by cleaning
  siteRecovery: number // share of the gap that comes back each day
  // fogging
  fogCooldown: number // minimum days between rounds in one municipality
  fogCoverage: number // share of households reached in a round
  fogKill: number // share of adults killed in a fogged household
  // run
  spinupDays: number // mosquito-only warm-up before 2019
}

export const DEFAULT_PARAMS: Params = {
  incubationDays: 5,
  infectiousDays: 6,
  pAway: 0.3,
  pOtherMuni: 0.1,
  gravityBeta: 1.5,
  initialImmune: 0,
  popTurnoverPerYear: 0.02,
  seedInfected: 3,
  importPerDayPer100k: 0.05,
  importedSurgeSize: 20, // starting position; settings.json overrides it
  importSurgeOn: true,
  reportFrac: 0.25,
  scale: 10,
  adultsPerPerson: 1.5,
  kPerPerson: 2.4,
  eggRateMax: 0.8,
  larvaSurv0: 0.9,
  rainBase: 0.3,
  rainSatMm: 100,
  biteRate: 0.3,
  pH2m: 0.5,
  pM2h: 0.4,
  compliance: 0.5,
  cleanKill: 0.7,
  cleanSiteCut: 0.5,
  siteRecovery: 0.1,
  fogCooldown: 7,
  fogCoverage: 0.6,
  fogKill: 0.5,
  spinupDays: 150,
}

// The shape of public/data/settings.json.
export interface SettingsFile {
  fitted: boolean
  note?: string
  bitingRate: number
  carryingCapacityPerPerson: number
  reportingFraction: number
  importedSurgeSize: number
}

// Starting positions with the values from settings.json laid over them.
export function paramsFromSettings(settings: SettingsFile, base: Params = DEFAULT_PARAMS): Params {
  return {
    ...base,
    biteRate: settings.bitingRate,
    kPerPerson: settings.carryingCapacityPerPerson,
    reportFrac: settings.reportingFraction,
    importedSurgeSize: settings.importedSurgeSize,
  }
}