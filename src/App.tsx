import './App.css'

const sensorGroups = [
  {
    title: 'Radar detections',
    detections: [
      { id: 'RDR-21', detail: 'Bearing 052 deg', time: '17:41:12Z', signal: 'Strong' },
      { id: 'RDR-22', detail: 'Range 1.8 km', time: '17:41:54Z', signal: 'Stable' },
    ],
  },
  {
    title: 'Acoustic/RF detections',
    detections: [
      { id: 'ACR-09', detail: 'Low motor tone', time: '17:41:38Z', signal: 'Matched' },
      { id: 'RF-14', detail: 'Short burst', time: '17:42:02Z', signal: 'Weak' },
    ],
  },
  {
    title: 'EO camera detections',
    detections: [
      { id: 'EO-03', detail: 'Small surface wake', time: '17:42:11Z', signal: 'Visual' },
      { id: 'EO-04', detail: 'Sector 060 deg', time: '17:42:20Z', signal: 'Confirmed' },
    ],
  },
]

const timelineEvents = [
  { time: '17:40:40Z', label: 'Radar seed', confidence: 42 },
  { time: '17:41:12Z', label: 'Radar repeat', confidence: 55 },
  { time: '17:41:38Z', label: 'Acoustic match', confidence: 64 },
  { time: '17:42:02Z', label: 'RF burst', confidence: 71 },
  { time: '17:42:20Z', label: 'EO confirm', confidence: 78 },
]

function SensorFeed() {
  return (
    <section className="panel sensor-feed" aria-labelledby="sensor-feed-title">
      <div className="panel-header">
        <p className="eyebrow">Live Sensor Feed</p>
        <h2 id="sensor-feed-title">Active inputs</h2>
      </div>

      <div className="sensor-groups">
        {sensorGroups.map((group) => (
          <div className="sensor-group" key={group.title}>
            <h3>{group.title}</h3>
            <div className="detection-list">
              {group.detections.map((detection) => (
                <div className="detection-row" key={detection.id}>
                  <div>
                    <strong>{detection.id}</strong>
                    <span>{detection.detail}</span>
                  </div>
                  <div className="detection-meta">
                    <span>{detection.signal}</span>
                    <span>{detection.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TrackMap() {
  return (
    <section className="panel map-panel" aria-labelledby="map-title">
      <div className="panel-header">
        <p className="eyebrow">Simple Map / Track View</p>
        <h2 id="map-title">Protected Waterfront Zone</h2>
      </div>

      <div className="map-frame">
        <svg viewBox="0 0 620 390" role="img" aria-label="Sensor map with target track">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" className="grid-line" />
            </pattern>
          </defs>

          <rect width="620" height="390" className="water" />
          <rect x="0" y="0" width="620" height="390" fill="url(#grid)" />
          <path d="M 20 305 C 130 270, 240 294, 355 248 S 520 204, 600 155" className="shoreline" />
          <path d="M 115 285 C 210 250, 285 232, 375 205 S 492 162, 548 116" className="probable-path" />

          <g className="zone-label">
            <rect x="34" y="31" width="221" height="34" rx="6" />
            <text x="49" y="53">Protected Waterfront Zone</text>
          </g>

          <g className="sensor-point radar">
            <circle cx="118" cy="286" r="13" />
            <text x="96" y="321">Radar</text>
          </g>
          <g className="sensor-point acoustic">
            <circle cx="246" cy="246" r="13" />
            <text x="211" y="281">Acoustic/RF</text>
          </g>
          <g className="sensor-point eo">
            <circle cx="401" cy="203" r="13" />
            <text x="378" y="238">EO Cam</text>
          </g>
          <g className="target-point">
            <circle cx="548" cy="116" r="16" />
            <circle cx="548" cy="116" r="30" />
            <text x="511" y="83">TRK-001</text>
          </g>
        </svg>
      </div>
    </section>
  )
}

function FusedTrack() {
  return (
    <section className="panel fused-track" aria-labelledby="fused-track-title">
      <div className="panel-header">
        <p className="eyebrow">Fused Track</p>
        <h2 id="fused-track-title">TRK-001</h2>
      </div>

      <dl className="track-details">
        <div>
          <dt>Track ID</dt>
          <dd>TRK-001</dd>
        </div>
        <div>
          <dt>Custody Status</dt>
          <dd className="status-good">Maintained</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>0.78</dd>
        </div>
        <div>
          <dt>Threat Score</dt>
          <dd className="status-medium">Medium</dd>
        </div>
        <div>
          <dt>Last Seen</dt>
          <dd>17:42:20Z</dd>
        </div>
        <div>
          <dt>Source Summary</dt>
          <dd>Radar + Acoustic/RF + EO</dd>
        </div>
      </dl>

      <div className="next-action">
        <span>Recommended Next Action</span>
        <strong>Retask EO camera to sector 045-070 deg</strong>
      </div>
    </section>
  )
}

function Timeline() {
  return (
    <section className="panel timeline-panel" aria-labelledby="timeline-title">
      <div className="panel-header">
        <p className="eyebrow">Timeline</p>
        <h2 id="timeline-title">Detection confidence</h2>
      </div>

      <div className="timeline-events">
        {timelineEvents.map((event) => (
          <div className="timeline-event" key={event.time}>
            <div className="event-copy">
              <span>{event.time}</span>
              <strong>{event.label}</strong>
            </div>
            <div className="confidence-bar" aria-label={`${event.confidence}% confidence`}>
              <span style={{ width: `${event.confidence}%` }} />
            </div>
            <b>{event.confidence}%</b>
          </div>
        ))}
      </div>
    </section>
  )
}

function App() {
  return (
    <main className="app-shell">
      <header className="top-header">
        <div>
          <h1>SmokenMirrorsOS</h1>
          <p>Operator dashboard demo</p>
        </div>
        <div className="system-status">
          <span />
          Demo feed live
        </div>
      </header>

      <div className="dashboard-grid">
        <SensorFeed />
        <TrackMap />
        <FusedTrack />
        <Timeline />
      </div>
    </main>
  )
}

export default App
