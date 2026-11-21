// Turns the weather file (public/data/weather.json) into the arrays the engine reads.
// rain14 is the rain over the last 14 days for every day of the record.

import { rolling14 } from './breeding'

// Shape of public/data/weather.json (rh is in the file but the model does not use it).
export interface WeatherFile {
  start: string
  days: number
  t2m: number[]
  rain: number[]
  rh?: number[]
}

export interface Weather {
  start: string
  days: number
  t2m: Float64Array
  rain: Float64Array
  rain14: Float64Array
}

export function buildWeather(file: WeatherFile): Weather {
  if (file.t2m.length !== file.days || file.rain.length !== file.days) {
    throw new Error(
      `weather file says ${file.days} days but has ${file.t2m.length} temperatures and ${file.rain.length} rain values`,
    )
  }
  const t2m = Float64Array.from(file.t2m)
  const rain = Float64Array.from(file.rain)
  return { start: file.start, days: file.days, t2m, rain, rain14: rolling14(rain) }
}