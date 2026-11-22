import { useState } from 'react'
import { DEFAULT_CONTROLS } from './state/policyControls'
import type { PolicyControls } from './state/policyControls'
import ControlPanel from './ui/controls/ControlPanel.tsx'

function App() {
  const [controls, setControls] = useState<PolicyControls>(DEFAULT_CONTROLS)

  return (
    <main className="app">
      <h1>Dengue policy simulator</h1>
      <ControlPanel controls={controls} onChange={setControls} />
    </main>
  )
}

export default App