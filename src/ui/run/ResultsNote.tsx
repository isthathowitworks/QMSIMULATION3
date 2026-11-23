// The two notes about how to read the results.
// "always" is shown on the page all the time, also before the first run.
// "afterRun" is shown with the results: "do nothing" is outside what the fit saw.

import './ResultsNote.css'

type Kind = 'always' | 'afterRun'

interface Props {
  kind: Kind
}

const TEXT: Record<Kind, string> = {
  always:
    'This tool compares strategies. It does not forecast case counts. The biological rates are assumptions.',
  afterRun:
    'The settings were fitted to real cases while the real policy (weekly cleaning, fogging at 1 case) was running. Doing nothing is outside what the fit saw, so read the size of the reduction with care.',
}

const CLASS: Record<Kind, string> = {
  always: 'results-note results-note-always',
  afterRun: 'results-note results-note-after-run',
}

export default function ResultsNote({ kind }: Props) {
  return (
    <p className={CLASS[kind]} role="note">
      {TEXT[kind]}
    </p>
  )
}