import { useState } from 'react'
import { DEFAULT_CONTROLS } from './state/policyControls'
import type { PolicyControls } from './state/policyControls'
import { useRunController } from './state/useRunController'
import ControlPanel from './ui/controls/ControlPanel.tsx'
import RunPanel from './ui/run/RunPanel.tsx'

function App() {
  const [controls, setControls] = useState<PolicyControls>(DEFAULT_CONTROLS)
  const { state, start, cancel } = useRunController(import.meta.env.BASE_URL)

  return (
    <main className="app">
      <h1>Dengue policy simulator</h1>
      <ControlPanel controls={controls} onChange={setControls} />
      <RunPanel
        status={state.status}
        daysDone={state.daysDone}
        totalDays={state.totalDays}
        message={state.message}
        onRun={() => start(controls)}
        onCancel={cancel}
      />
    </main>
  )
}

export default App