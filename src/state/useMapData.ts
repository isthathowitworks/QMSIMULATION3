// Loads the map file and the population file once when the page opens, for the two maps.
// A failed load gives a message and nothing else: it must not stop the charts and the headline number.

import { useEffect, useState } from 'react'
import { loadMapFiles } from './mapData'
import type { MapFiles } from './mapData'

export type MapDataState =
  | { status: 'loading' }
  | { status: 'ready'; files: MapFiles }
  | { status: 'failed'; message: string }

// Never throws: a problem with either file gives a failed state with the reason.
// `baseUrl` is import.meta.env.BASE_URL in the page. `fetchFn` is only given in tests.
export async function loadMapState(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<MapDataState> {
  try {
    return { status: 'ready', files: await loadMapFiles(baseUrl, fetchFn) }
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : 'could not load the map files' }
  }
}

// `baseUrl` is import.meta.env.BASE_URL, given in by App.tsx.
export function useMapData(baseUrl: string): MapDataState {
  const [state, setState] = useState<MapDataState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void loadMapState(baseUrl).then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  return state
}