// What the page shows after a run: the headline number (how much lower the infections
// are than with "do nothing"), the infection curve, the two maps of bite infections per municipality,
// the household dots with the week slider, the adult and immature mosquitoes per person,
// and the note about how to read the size of the reduction.
// It shows nothing until there is a comparison. If the map files are still loading or could not be
// loaded, only the map spot shows a short note: the headline number and the charts are not affected.
// The household dots need the same files, so they show nothing while the files load or if they fail.

import { useEffect, useMemo, useState } from 'react'
import type { Comparison } from '../../state/curve'
import { mapColumns } from '../../state/mapData'
import type { MapFiles } from '../../state/mapData'
import type { MapDataState } from '../../state/useMapData'
import { dotPositions } from '../map/dotPositions'
import HouseholdDots from '../map/HouseholdDots'
import MapPair from '../map/MapPair'
import WeekSlider from '../map/WeekSlider'
import { clampWeek, pressPlayPause, tick } from '../map/weekPlayback'
import type { Playback } from '../map/weekPlayback'
import HeadlineNumber from './HeadlineNumber'
import InfectionChart from './InfectionChart'
import MosquitoChart from './MosquitoChart'
import ResultsNote from './ResultsNote'

interface Props {
  comparison: Comparison | null
  mapState: MapDataState
}

// The same box as the maps (400 x 360); the dots must use the same numbers as dotPositions
const DOTS_WIDTH = 400
const DOTS_HEIGHT = 360

// Play moves one week every 100 ms (speed is added in 7.3)
const PLAY_MS = 100

function MapArea({ comparison, mapState }: { comparison: Comparison; mapState: MapDataState }) {
  if (mapState.status === 'loading') return <p className="chart-note">Loading the map.</p>
  if (mapState.status === 'failed') {
    return (
      <p className="chart-note">
        The map could not be loaded ({mapState.message}). The numbers and charts are not affected.
      </p>
    )
  }
  const columns = mapColumns(comparison, mapState.files.population)
  if (columns === null) {
    return <p className="chart-note">The map does not match the number of municipalities in this run, so it is not shown.</p>
  }
  return <MapPair map={mapState.files.map} columns={columns} />
}

function HouseholdView({ comparison, files }: { comparison: Comparison; files: MapFiles }) {
  const { householdCount, baselineHouseholdStates, policyHouseholdStates } = comparison
  const [playback, setPlayback] = useState<Playback>({ week: 0, playing: false })

  // worked out once for these files, so the dots never move
  const positions = useMemo(
    () => dotPositions(files, householdCount, DOTS_WIDTH, DOTS_HEIGHT),
    [files, householdCount],
  )

  // one row of household states per week
  const weeks = householdCount > 0 ? Math.floor(baselineHouseholdStates.length / householdCount) : 0

  useEffect(() => {
    if (!playback.playing) return undefined
    const timer = setInterval(() => {
      setPlayback((current) => tick(current.week, weeks))
    }, PLAY_MS)
    return () => clearInterval(timer)
  }, [playback.playing, weeks])

  if (positions === null) {
    return <p className="chart-note">The household dots do not match this run, so they are not shown.</p>
  }

  const week = clampWeek(playback.week, weeks)

  return (
    <>
      <HouseholdDots
        map={files.map}
        positions={positions}
        householdCount={householdCount}
        baselineStates={baselineHouseholdStates}
        policyStates={policyHouseholdStates}
        snapshot={week}
        width={DOTS_WIDTH}
        height={DOTS_HEIGHT}
      />
      <WeekSlider
        week={week}
        weeks={weeks}
        playing={playback.playing}
        onWeekChange={(next) => setPlayback({ week: clampWeek(next, weeks), playing: false })}
        onPlayPause={() => setPlayback((current) => pressPlayPause(current.week, weeks, current.playing))}
      />
    </>
  )
}

function HouseholdArea({ comparison, mapState }: { comparison: Comparison; mapState: MapDataState }) {
  // while the files load or if they fail, the map spot already says so
  if (mapState.status !== 'ready') return null
  return <HouseholdView comparison={comparison} files={mapState.files} />
}

export default function ResultsPanel({ comparison, mapState }: Props) {
  if (comparison === null) return null

  return (
    <section className="results" aria-label="Results">
      <HeadlineNumber percentReduction={comparison.percentReduction} />
      <InfectionChart baselineWeekly={comparison.baselineWeekly} policyWeekly={comparison.policyWeekly} />
      <MapArea comparison={comparison} mapState={mapState} />
      <HouseholdArea comparison={comparison} mapState={mapState} />
      <MosquitoChart
        kind="adults"
        baselineWeekly={comparison.baselineAdultsPerPerson}
        policyWeekly={comparison.policyAdultsPerPerson}
      />
      <MosquitoChart
        kind="immatures"
        baselineWeekly={comparison.baselineImmaturesPerPerson}
        policyWeekly={comparison.policyImmaturesPerPerson}
      />
      <ResultsNote kind="afterRun" />
    </section>
  )
}