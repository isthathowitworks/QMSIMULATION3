// The big number: how much lower the infections are than with "do nothing".

import { headlineFor } from '../../state/headline'
import './HeadlineNumber.css'

interface Props {
  percentReduction: number | null
}

export default function HeadlineNumber({ percentReduction }: Props) {
  const headline = headlineFor(percentReduction)

  return (
    <div className={`headline headline-${headline.kind}`}>
      <p className="headline-number">{headline.big}</p>
      <p className="headline-sentence">{headline.sentence}</p>
    </div>
  )
}