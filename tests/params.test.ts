import { describe, it, expect } from 'vitest'
import { DEFAULT_PARAMS, paramsFromSettings } from '../src/engine/params'
import type { SettingsFile } from '../src/engine/params'

describe('DEFAULT_PARAMS', () => {
  it('has the starting positions from model-rules.md', () => {
    expect(DEFAULT_PARAMS.compliance).toBe(0.5)
    expect(DEFAULT_PARAMS.cleanKill).toBe(0.7)
    expect(DEFAULT_PARAMS.fogKill).toBe(0.5)
    expect(DEFAULT_PARAMS.fogCoverage).toBe(0.6)
    expect(DEFAULT_PARAMS.fogCooldown).toBe(7)
    expect(DEFAULT_PARAMS.spinupDays).toBe(150)
  })

  it('has the human and mosquito values copied from the Python engine', () => {
    expect(DEFAULT_PARAMS.incubationDays).toBe(5)
    expect(DEFAULT_PARAMS.infectiousDays).toBe(6)
    expect(DEFAULT_PARAMS.pAway).toBe(0.3)
    expect(DEFAULT_PARAMS.pOtherMuni).toBe(0.1)
    expect(DEFAULT_PARAMS.seedInfected).toBe(3)
    expect(DEFAULT_PARAMS.kPerPerson).toBe(2.4)
    expect(DEFAULT_PARAMS.reportFrac).toBe(0.25)
    expect(DEFAULT_PARAMS.biteRate).toBe(0.3)
  })

  it('keeps every share between 0 and 1', () => {
    const shares = [
      DEFAULT_PARAMS.pAway,
      DEFAULT_PARAMS.pOtherMuni,
      DEFAULT_PARAMS.initialImmune,
      DEFAULT_PARAMS.popTurnoverPerYear,
      DEFAULT_PARAMS.reportFrac,
      DEFAULT_PARAMS.larvaSurv0,
      DEFAULT_PARAMS.rainBase,
      DEFAULT_PARAMS.pH2m,
      DEFAULT_PARAMS.pM2h,
      DEFAULT_PARAMS.compliance,
      DEFAULT_PARAMS.cleanKill,
      DEFAULT_PARAMS.cleanSiteCut,
      DEFAULT_PARAMS.siteRecovery,
      DEFAULT_PARAMS.fogCoverage,
      DEFAULT_PARAMS.fogKill,
    ]
    for (const s of shares) {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
})

describe('paramsFromSettings', () => {
  const settings: SettingsFile = {
    fitted: false,
    bitingRate: 0.3,
    carryingCapacityPerPerson: 3,
    reportingFraction: 0.1,
    importedSurgeSize: 20,
  }

  it('lays the three settings over the starting positions', () => {
    const p = paramsFromSettings(settings)
    expect(p.biteRate).toBe(0.3)
    expect(p.kPerPerson).toBe(3)
    expect(p.reportFrac).toBe(0.1)
  })

  it('leaves every other value unchanged', () => {
    const p = paramsFromSettings(settings)
    expect(p.compliance).toBe(DEFAULT_PARAMS.compliance)
    expect(p.fogKill).toBe(DEFAULT_PARAMS.fogKill)
    expect(p.spinupDays).toBe(DEFAULT_PARAMS.spinupDays)
  })

  it('does not change DEFAULT_PARAMS', () => {
    paramsFromSettings({ ...settings, bitingRate: 0.9 })
    expect(DEFAULT_PARAMS.biteRate).toBe(0.3)
  })
})