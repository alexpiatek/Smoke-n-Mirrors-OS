import { useMemo, useState } from 'react'
import './App.css'

type Platform = {
  platform_id: string
  callsign: string
  platform_type: string
  owner_unit: string
  lat: number
  lon: number
}

type Sensor = {
  sensor_id: string
  platform_id: string
  modality: string
  measurement_kind: string
  range_max_m: number
  fov_type: string
  fov_h_deg: number
  latency_ms_p50: number
}

type Detection = {
  detection_id: string
  sensor_id: string
  timestamp: string
  modality: string
  bearing_deg: number
  range_m: number
  confidence: number
  classification: string
  contributes_to_track_id: string
}

type FusedTrack = {
  track_id: string
  mission_area: string
  custody_status: string
  confidence: number
  threat_score: number
  last_seen: string
  estimated_lat: number
  estimated_lon: number
  source_summary: string
  recommended_next_action: string
  explanation: string
}

type OperatorAction = {
  action_id: string
  track_id: string
  action_type: string
  label: string
  timestamp: string
}

type DemoStep = {
  title: string
  mapStatus: string
  activeDetectionIds: string[]
  staleDetectionIds: string[]
  custody_status: string
  confidence: number
  source_summary: string
  recommended_next_action: string
  explanation: string
  emphasizeAction: boolean
}

const platforms: Platform[] = [
  {
    platform_id: 'PLAT-HARBOR-01',
    callsign: 'Harbor Watch',
    platform_type: 'Fixed tower',
    owner_unit: 'Blue Cell',
    lat: 37.8107,
    lon: -122.3786,
  },
  {
    platform_id: 'PLAT-PIER-03',
    callsign: 'Pier Scout',
    platform_type: 'Mobile tripod',
    owner_unit: 'Blue Cell',
    lat: 37.8069,
    lon: -122.3924,
  },
  {
    platform_id: 'PLAT-BUOY-07',
    callsign: 'Buoy Seven',
    platform_type: 'Smart buoy',
    owner_unit: 'Maritime Ops',
    lat: 37.8029,
    lon: -122.3679,
  },
]

const sensors: Sensor[] = [
  {
    sensor_id: 'SENS-RDR-21',
    platform_id: 'PLAT-HARBOR-01',
    modality: 'Radar',
    measurement_kind: 'Bearing and range',
    range_max_m: 4200,
    fov_type: 'Sector',
    fov_h_deg: 92,
    latency_ms_p50: 84,
  },
  {
    sensor_id: 'SENS-RF-14',
    platform_id: 'PLAT-PIER-03',
    modality: 'RF',
    measurement_kind: 'Emitter burst',
    range_max_m: 2200,
    fov_type: 'Omni',
    fov_h_deg: 360,
    latency_ms_p50: 126,
  },
  {
    sensor_id: 'SENS-EO-03',
    platform_id: 'PLAT-HARBOR-01',
    modality: 'EO',
    measurement_kind: 'Visual cue',
    range_max_m: 1800,
    fov_type: 'Narrow',
    fov_h_deg: 28,
    latency_ms_p50: 210,
  },
  {
    sensor_id: 'SENS-AC-09',
    platform_id: 'PLAT-BUOY-07',
    modality: 'Acoustic',
    measurement_kind: 'Motor tone',
    range_max_m: 950,
    fov_type: 'Omni',
    fov_h_deg: 360,
    latency_ms_p50: 340,
  },
]

const detections: Detection[] = [
  {
    detection_id: 'DET-RDR-001',
    sensor_id: 'SENS-RDR-21',
    timestamp: '17:41:12Z',
    modality: 'Radar',
    bearing_deg: 52,
    range_m: 1850,
    confidence: 0.52,
    classification: 'Small surface contact',
    contributes_to_track_id: 'TRK-SM-001',
  },
  {
    detection_id: 'DET-AC-002',
    sensor_id: 'SENS-AC-09',
    timestamp: '17:41:38Z',
    modality: 'Acoustic',
    bearing_deg: 48,
    range_m: 920,
    confidence: 0.64,
    classification: 'Low motor tone',
    contributes_to_track_id: 'TRK-SM-001',
  },
  {
    detection_id: 'DET-RF-003',
    sensor_id: 'SENS-RF-14',
    timestamp: '17:42:02Z',
    modality: 'RF',
    bearing_deg: 57,
    range_m: 1310,
    confidence: 0.71,
    classification: 'Short command burst',
    contributes_to_track_id: 'TRK-SM-001',
  },
  {
    detection_id: 'DET-EO-004',
    sensor_id: 'SENS-EO-03',
    timestamp: '17:42:20Z',
    modality: 'EO',
    bearing_deg: 61,
    range_m: 1180,
    confidence: 0.78,
    classification: 'Wake and dark hull',
    contributes_to_track_id: 'TRK-SM-001',
  },
]

const fusedTracks: FusedTrack[] = [
  {
    track_id: 'TRK-SM-001',
    mission_area: 'MissionArea-Harbor-North',
    custody_status: 'Maintained',
    confidence: 0.78,
    threat_score: 67,
    last_seen: '17:42:20Z',
    estimated_lat: 37.8078,
    estimated_lon: -122.3749,
    source_summary: 'Radar + Acoustic + RF + EO',
    recommended_next_action: 'Reacquire with EO and keep radar custody.',
    explanation:
      'Four detections agree on a slow small craft moving northeast inside the protected waterfront zone.',
  },
]

const initialActions: OperatorAction[] = [
  {
    action_id: 'ACT-0001',
    track_id: 'TRK-SM-001',
    action_type: 'review',
    label: 'Track opened for operator review',
    timestamp: '17:42:23Z',
  },
]

const actionButtons = [
  { action_type: 'confirm_track', label: 'Confirm Track' },
  { action_type: 'false_alarm', label: 'False Alarm' },
  { action_type: 'reacquire', label: 'Reacquire' },
]

const demoSteps: DemoStep[] = [
  {
    title: 'Radar detects unknown surface contact.',
    mapStatus: 'Radar seed: unknown surface contact at bearing 052.',
    activeDetectionIds: ['DET-RDR-001'],
    staleDetectionIds: [],
    custody_status: 'Building',
    confidence: 0.52,
    source_summary: 'Radar',
    recommended_next_action: 'Continue correlation.',
    explanation: 'The first radar return creates a tentative track candidate, but custody is not mature yet.',
    emphasizeAction: false,
  },
  {
    title: 'Acoustic/RF supports the same bearing.',
    mapStatus: 'Acoustic and RF detections align with the radar bearing.',
    activeDetectionIds: ['DET-AC-002', 'DET-RF-003'],
    staleDetectionIds: [],
    custody_status: 'Correlating',
    confidence: 0.71,
    source_summary: 'Radar + Acoustic/RF',
    recommended_next_action: 'Keep passive sensors collecting.',
    explanation: 'The acoustic tone and RF burst are consistent with the radar bearing and increase confidence.',
    emphasizeAction: false,
  },
  {
    title: 'EO camera briefly confirms weak visual contact.',
    mapStatus: 'EO camera sees a weak visual cue near the fused track estimate.',
    activeDetectionIds: ['DET-EO-004'],
    staleDetectionIds: [],
    custody_status: 'Maintained',
    confidence: 0.78,
    source_summary: 'Radar + Acoustic + RF + EO',
    recommended_next_action: 'Hold EO on sector.',
    explanation: 'The EO camera briefly confirms a wake and dark hull, giving the system a stronger fused track.',
    emphasizeAction: false,
  },
  {
    title: 'EO contact is lost.',
    mapStatus: 'EO stale: visual contact lost in clutter.',
    activeDetectionIds: [],
    staleDetectionIds: ['DET-EO-004'],
    custody_status: 'EO Lost',
    confidence: 0.69,
    source_summary: 'Radar + Acoustic/RF, EO stale',
    recommended_next_action: 'Do not drop track.',
    explanation: 'The EO cue is stale now. The system should avoid over-weighting visual confirmation.',
    emphasizeAction: false,
  },
  {
    title: 'System maintains custody using Radar + Acoustic/RF.',
    mapStatus: 'Custody maintained using non-visual sensors.',
    activeDetectionIds: ['DET-RDR-001', 'DET-AC-002', 'DET-RF-003'],
    staleDetectionIds: ['DET-EO-004'],
    custody_status: 'Maintained',
    confidence: 0.73,
    source_summary: 'Radar + Acoustic/RF',
    recommended_next_action: 'Prepare EO retask.',
    explanation: 'Radar and acoustic/RF remain consistent, so custody stays maintained without fresh EO.',
    emphasizeAction: false,
  },
  {
    title: 'Recommended action appears: Reacquire with EO camera and keep radar custody.',
    mapStatus: 'Recommended action ready for operator decision.',
    activeDetectionIds: ['DET-RDR-001', 'DET-AC-002', 'DET-RF-003'],
    staleDetectionIds: ['DET-EO-004'],
    custody_status: 'Maintained',
    confidence: 0.73,
    source_summary: 'Radar + Acoustic/RF, EO retask needed',
    recommended_next_action: 'Reacquire with EO camera and keep radar custody.',
    explanation:
      'Visual contact was lost, but radar and acoustic/RF remain consistent. Custody is maintained and EO should be retasked to reacquire.',
    emphasizeAction: true,
  },
]

function groupDetectionsByModality(records: Detection[]) {
  return records.reduce<Record<string, Detection[]>>((groups, detection) => {
    groups[detection.modality] = [...(groups[detection.modality] ?? []), detection]
    return groups
  }, {})
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`
}

function projectPoint(lat: number, lon: number) {
  const minLat = 37.801
  const maxLat = 37.813
  const minLon = -122.397
  const maxLon = -122.364
  const x = 70 + ((lon - minLon) / (maxLon - minLon)) * 480
  const y = 325 - ((lat - minLat) / (maxLat - minLat)) * 245

  return { x, y }
}

function SensorFeed({ demoStep }: { demoStep: DemoStep | null }) {
  const groupedDetections = useMemo(() => groupDetectionsByModality(detections), [])

  return (
    <section className="panel sensor-feed" aria-labelledby="sensor-feed-title">
      <div className="panel-header">
        <p className="eyebrow">Detection</p>
        <h2 id="sensor-feed-title">Grouped by modality</h2>
      </div>

      <div className="sensor-groups">
        {Object.entries(groupedDetections).map(([modality, records]) => (
          <div className="sensor-group" key={modality}>
            <h3>{modality}</h3>
            <div className="detection-list">
              {records.map((detection) => (
                <article
                  className={[
                    'detection-row',
                    demoStep?.activeDetectionIds.includes(detection.detection_id) ? 'is-active' : '',
                    demoStep?.staleDetectionIds.includes(detection.detection_id) ? 'is-stale' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={detection.detection_id}
                >
                  <div>
                    <strong>{detection.detection_id}</strong>
                    <span>{detection.classification}</span>
                  </div>
                  <dl className="mini-fields">
                    <div>
                      <dt>sensor_id</dt>
                      <dd>{detection.sensor_id}</dd>
                    </div>
                    <div>
                      <dt>bearing/range</dt>
                      <dd>
                        {detection.bearing_deg} deg / {detection.range_m} m
                      </dd>
                    </div>
                    <div>
                      <dt>confidence</dt>
                      <dd>{detection.confidence.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt>track</dt>
                      <dd>{detection.contributes_to_track_id}</dd>
                    </div>
                  </dl>
                  <div className="detection-meta">
                    <span>
                      {detection.timestamp}
                      {demoStep?.staleDetectionIds.includes(detection.detection_id) ? ' / lost' : ''}
                    </span>
                    <span>{detection.modality}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TrackMap({ selectedTrack, demoStep }: { selectedTrack: FusedTrack; demoStep: DemoStep | null }) {
  const trackPoint = projectPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon)

  return (
    <section className="panel map-panel" aria-labelledby="map-title">
      <div className="panel-header map-title-row">
        <div>
          <p className="eyebrow">Platform / Sensor / FusedTrack</p>
          <h2 id="map-title">{selectedTrack.mission_area}</h2>
        </div>
        <span className="track-chip">{selectedTrack.track_id}</span>
      </div>

      <div className="map-frame">
        <svg viewBox="0 0 620 390" role="img" aria-label="Local ontology mock map">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" className="grid-line" />
            </pattern>
          </defs>

          <rect width="620" height="390" className="water" />
          <rect x="0" y="0" width="620" height="390" fill="url(#grid)" />
          <path d="M 18 314 C 128 272, 242 303, 352 252 S 514 202, 602 150" className="shoreline" />
          <path d="M 100 291 C 184 263, 260 245, 344 224 S 450 178, 548 118" className="probable-path" />

          <g className="zone-label">
            <rect x="34" y="31" width="245" height="34" rx="6" />
            <text x="49" y="53">MissionArea-Harbor-North</text>
          </g>

          <g className="map-status">
            <rect x="34" y="74" width="392" height="36" rx="6" />
            <text x="49" y="97">{demoStep?.mapStatus ?? 'Local ontology mock ready.'}</text>
          </g>

          {platforms.map((platform) => {
            const point = projectPoint(platform.lat, platform.lon)
            const platformSensors = sensors.filter((sensor) => sensor.platform_id === platform.platform_id)

            return (
              <g className="platform-cluster" key={platform.platform_id}>
                <circle className="platform-point" cx={point.x} cy={point.y} r="15" />
                <text x={point.x - 36} y={point.y + 38}>
                  {platform.callsign}
                </text>
                {platformSensors.map((sensor, index) => {
                  const sensorX = point.x + 24 + index * 18
                  const sensorY = point.y - 18 - index * 4

                  return (
                    <g className="sensor-point" key={sensor.sensor_id}>
                      <line x1={point.x} y1={point.y} x2={sensorX} y2={sensorY} />
                      <circle cx={sensorX} cy={sensorY} r="8" />
                      <text x={sensorX + 9} y={sensorY - 8}>
                        {sensor.modality}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}

          <g className="target-point">
            <circle cx={trackPoint.x} cy={trackPoint.y} r="16" />
            <circle cx={trackPoint.x} cy={trackPoint.y} r="32" />
            <text x={trackPoint.x - 42} y={trackPoint.y - 36}>
              {selectedTrack.track_id}
            </text>
          </g>
        </svg>
      </div>
    </section>
  )
}

function SelectedFusedTrack({
  selectedTrack,
  actions,
  demoStep,
  onCreateAction,
}: {
  selectedTrack: FusedTrack
  actions: OperatorAction[]
  demoStep: DemoStep | null
  onCreateAction: (actionType: string, label: string) => void
}) {
  const latestAction = actions[actions.length - 1]

  return (
    <section className="panel fused-track" aria-labelledby="fused-track-title">
      <div className="panel-header">
        <p className="eyebrow">Selected FusedTrack</p>
        <h2 id="fused-track-title">{selectedTrack.track_id}</h2>
      </div>

      <dl className="track-details">
        <div>
          <dt>mission_area</dt>
          <dd>{selectedTrack.mission_area}</dd>
        </div>
        <div>
          <dt>custody_status</dt>
          <dd className="status-good">{selectedTrack.custody_status}</dd>
        </div>
        <div>
          <dt>confidence</dt>
          <dd>{selectedTrack.confidence.toFixed(2)}</dd>
        </div>
        <div>
          <dt>threat_score</dt>
          <dd className="status-medium">{selectedTrack.threat_score}</dd>
        </div>
        <div>
          <dt>last_seen</dt>
          <dd>{selectedTrack.last_seen}</dd>
        </div>
        <div>
          <dt>estimated_lat/lon</dt>
          <dd>
            {selectedTrack.estimated_lat.toFixed(4)}, {selectedTrack.estimated_lon.toFixed(4)}
          </dd>
        </div>
        <div>
          <dt>source_summary</dt>
          <dd>{selectedTrack.source_summary}</dd>
        </div>
      </dl>

      <div className={`next-action ${demoStep?.emphasizeAction ? 'is-emphasized' : ''}`}>
        <span>recommended_next_action</span>
        <strong>{selectedTrack.recommended_next_action}</strong>
        <p>{selectedTrack.explanation}</p>
      </div>

      <div className="operator-actions">
        <div className="action-buttons" aria-label="Create OperatorAction">
          {actionButtons.map((action) => (
            <button
              key={action.action_type}
              type="button"
              onClick={() => onCreateAction(action.action_type, action.label)}
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="audit-log" aria-live="polite">
          <span>Latest OperatorAction</span>
          <strong>{latestAction.label}</strong>
          <small>
            {latestAction.action_id} / {latestAction.action_type} / {latestAction.timestamp}
          </small>
        </div>
      </div>
    </section>
  )
}

function Timeline({ demoStep }: { demoStep: DemoStep | null }) {
  return (
    <section className="panel timeline-panel" aria-labelledby="timeline-title">
      <div className="panel-header">
        <p className="eyebrow">Detection Timeline</p>
        <h2 id="timeline-title">Confidence over time</h2>
      </div>

      <div className="timeline-events">
        {detections.map((detection) => (
          <article
            className={[
              'timeline-event',
              demoStep?.activeDetectionIds.includes(detection.detection_id) ? 'is-active' : '',
              demoStep?.staleDetectionIds.includes(detection.detection_id) ? 'is-stale' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            key={detection.detection_id}
          >
            <div className="event-copy">
              <span>{detection.timestamp}</span>
              <strong>{detection.detection_id}</strong>
              <em>{detection.classification}</em>
            </div>
            <div className="confidence-bar" aria-label={`${formatConfidence(detection.confidence)} confidence`}>
              <span style={{ width: formatConfidence(detection.confidence) }} />
            </div>
            <b>{formatConfidence(detection.confidence)}</b>
          </article>
        ))}
      </div>
    </section>
  )
}

function App() {
  const [operatorActions, setOperatorActions] = useState<OperatorAction[]>(initialActions)
  const [demoStepIndex, setDemoStepIndex] = useState<number | null>(null)
  const currentDemoStep = demoStepIndex === null ? null : demoSteps[demoStepIndex]
  const selectedTrack: FusedTrack = {
    ...fusedTracks[0],
    ...(currentDemoStep
      ? {
          custody_status: currentDemoStep.custody_status,
          confidence: currentDemoStep.confidence,
          source_summary: currentDemoStep.source_summary,
          recommended_next_action: currentDemoStep.recommended_next_action,
          explanation: currentDemoStep.explanation,
        }
      : {}),
  }

  function createOperatorAction(actionType: string, label: string) {
    const timestamp = new Date().toISOString().slice(11, 19) + 'Z'
    const nextAction: OperatorAction = {
      action_id: `ACT-${String(operatorActions.length + 1).padStart(4, '0')}`,
      track_id: selectedTrack.track_id,
      action_type: actionType,
      label,
      timestamp,
    }

    setOperatorActions((currentActions) => [...currentActions, nextAction])
  }

  function startDemo() {
    setDemoStepIndex(0)
  }

  function nextDemoStep() {
    setDemoStepIndex((currentIndex) => {
      if (currentIndex === null) {
        return 0
      }

      return Math.min(currentIndex + 1, demoSteps.length - 1)
    })
  }

  function resetDemo() {
    setDemoStepIndex(null)
  }

  return (
    <main className="app-shell">
      <header className="top-header">
        <div>
          <h1>SmokenMirrorsOS</h1>
          <p>Operator dashboard demo</p>
        </div>
        <div className="header-badges">
          <div className="data-mode">Data Mode: Local Ontology Mock</div>
          <div className="system-status">
            <span />
            Demo feed live
          </div>
          <div className="demo-controls" aria-label="Demo Mode controls">
            <button type="button" onClick={startDemo}>
              Start Demo
            </button>
            <button type="button" onClick={nextDemoStep}>
              Next Step
            </button>
            <button type="button" onClick={resetDemo}>
              Reset Demo
            </button>
          </div>
        </div>
      </header>

      <section className="demo-banner" aria-live="polite">
        <span>Current Demo Step</span>
        <strong>
          {currentDemoStep ? `${demoStepIndex! + 1}. ${currentDemoStep.title}` : 'Ready. Press Start Demo.'}
        </strong>
      </section>

      <div className="dashboard-grid">
        <SensorFeed demoStep={currentDemoStep} />
        <TrackMap selectedTrack={selectedTrack} demoStep={currentDemoStep} />
        <SelectedFusedTrack
          actions={operatorActions}
          demoStep={currentDemoStep}
          selectedTrack={selectedTrack}
          onCreateAction={createOperatorAction}
        />
        <Timeline demoStep={currentDemoStep} />
      </div>
    </main>
  )
}

export default App
