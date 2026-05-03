import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import {
  palantirMissionDetections,
  palantirMissionFusedTracks,
  palantirMissionMetadata,
  palantirMissionOperatorActions,
} from './data/palantirMissionSnapshot'
import { palantirPlatforms, palantirSensors, palantirSnapshotMetadata } from './data/palantirSnapshot'

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
  is_stale?: boolean
  stale_reason?: string
  notes?: string
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
  created_at?: string
  updated_at?: string
}

type OperatorAction = {
  action_id: string
  track_id: string
  action_type: string
  label: string
  timestamp: string
  operator_id?: string
  notes?: string
  resulting_status?: string
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

type DataMode = 'local' | 'palantirSnapshot' | 'palantirMission'
type EventFilter = 'all' | 'radar' | 'acousticRf' | 'eo' | 'selected'
type LayerKey = 'sensors' | 'rawDetections' | 'fusedTracks' | 'protectedZones' | 'probablePath' | 'trackHistory'

type GeoJsonGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] }

type GeoJsonFeature = {
  type: 'Feature'
  geometry: GeoJsonGeometry
  properties: Record<string, string | number | boolean | null>
}

type GeoJsonCollection = {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

type MapData = {
  center: [number, number]
  zoom: number
  missionZone: GeoJsonCollection
  missionLabel: GeoJsonCollection
  restrictedZone: GeoJsonCollection
  restrictedHatch: GeoJsonCollection
  assetLabels: GeoJsonCollection
  probablePath: GeoJsonCollection
  trackHistoryLine: GeoJsonCollection
  trackHistoryPoints: GeoJsonCollection
  bearingLines: GeoJsonCollection
  bearingCones: GeoJsonCollection
  platforms: GeoJsonCollection
  sensors: GeoJsonCollection
  detections: GeoJsonCollection
  fusedTracks: GeoJsonCollection
}

type TrackQueueItem = {
  id: string
  kind: 'track' | 'detection'
  label: string
  classification: string
  confidence: number
  threatScore: number
  custodyStatus: string
  sourceSummary: string
  sourceTypes: string[]
  lastSeen: string
  freshness: string
  status: string
  trackId: string
  detection?: Detection
  track?: FusedTrack
}

const dataModeLabels: Record<DataMode, string> = {
  local: 'Local Ontology Mock',
  palantirSnapshot: 'Palantir Ontology Snapshot + Local Fusion Demo',
  palantirMission: 'Palantir Mission Data',
}

const eventFilters: Array<{ key: EventFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'radar', label: 'Radar' },
  { key: 'acousticRf', label: 'Acoustic/RF' },
  { key: 'eo', label: 'EO' },
  { key: 'selected', label: 'Selected Track' },
]

const layerControls: Array<{ key: LayerKey; label: string }> = [
  { key: 'sensors', label: 'Sensors' },
  { key: 'rawDetections', label: 'Raw detections' },
  { key: 'fusedTracks', label: 'Fused tracks' },
  { key: 'protectedZones', label: 'Protected zones' },
  { key: 'probablePath', label: 'Probable path' },
  { key: 'trackHistory', label: 'Track history' },
]

const defaultLayerState: Record<LayerKey, boolean> = {
  sensors: true,
  rawDetections: true,
  fusedTracks: true,
  protectedZones: true,
  probablePath: true,
  trackHistory: true,
}

const localPlatforms: Platform[] = [
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

const localSensors: Sensor[] = [
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
  { action_type: 'reacquire', label: 'Slew Camera' },
  { action_type: 'confirm_track', label: 'Confirm' },
  { action_type: 'review_open', label: 'Monitor' },
  { action_type: 'dispatch', label: 'Dispatch' },
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

const palantirMissionDemoSteps: DemoStep[] = [
  {
    title: 'Palantir radar and RF detections seed the track.',
    mapStatus: 'Palantir mission data: radar and RF seed TRK-SM-001.',
    activeDetectionIds: ['DET-SM-0001', 'DET-SM-0002'],
    staleDetectionIds: [],
    custody_status: 'Building',
    confidence: 0.58,
    source_summary: 'Radar + RF',
    recommended_next_action: 'Continue cross-sensor correlation.',
    explanation: 'The Palantir branch snapshot starts with radar and RF evidence against the same fused track.',
    emphasizeAction: false,
  },
  {
    title: 'EO and radar cues strengthen custody.',
    mapStatus: 'EO and follow-on radar detections agree with the fused track estimate.',
    activeDetectionIds: ['DET-SM-0003', 'DET-SM-0004', 'DET-SM-0005'],
    staleDetectionIds: [],
    custody_status: 'Correlating',
    confidence: 0.7,
    source_summary: 'Radar + RF + EO',
    recommended_next_action: 'Keep custody with independent modalities.',
    explanation: 'The synthetic mission data links multiple sensor detections into the same Palantir FusedTrack.',
    emphasizeAction: false,
  },
  {
    title: 'IR becomes the strongest current custody cue.',
    mapStatus: 'IR and RF detections improve confidence on TRK-SM-001.',
    activeDetectionIds: ['DET-SM-0006', 'DET-SM-0007', 'DET-SM-0008'],
    staleDetectionIds: [],
    custody_status: 'Maintained',
    confidence: 0.78,
    source_summary: 'Radar + RF + EO + IR',
    recommended_next_action: 'Maintain radar custody and prepare EO reacquire.',
    explanation: 'The fused track reaches maintained custody with the IR detection as the strongest current cue.',
    emphasizeAction: false,
  },
  {
    title: 'Weak RF is retained as stale supporting context.',
    mapStatus: 'One weak RF detection is stale while later RF still supports custody.',
    activeDetectionIds: ['DET-SM-0010'],
    staleDetectionIds: ['DET-SM-0009'],
    custody_status: 'Maintained',
    confidence: 0.74,
    source_summary: 'Radar + RF + EO + IR, weak RF stale',
    recommended_next_action: 'Do not drop track.',
    explanation: 'The Palantir mission snapshot preserves stale context without letting it dominate the track state.',
    emphasizeAction: false,
  },
  {
    title: 'Operator action recommends EO reacquire.',
    mapStatus: 'Palantir operator action history includes EO retask.',
    activeDetectionIds: ['DET-SM-0004', 'DET-SM-0007', 'DET-SM-0010'],
    staleDetectionIds: ['DET-SM-0009'],
    custody_status: 'Maintained',
    confidence: 0.78,
    source_summary: 'Radar + RF + EO + IR',
    recommended_next_action: 'Reacquire with EO and keep radar custody',
    explanation:
      'The Palantir-backed OperatorAction history matches the fused track recommendation and remains read-only in this app mode.',
    emphasizeAction: true,
  },
]

const emptyCollection = (): GeoJsonCollection => ({ type: 'FeatureCollection', features: [] })

const mapStyle: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    imageryTiles: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#070b10',
      },
    },
    {
      id: 'imagery-tiles',
      type: 'raster',
      source: 'imageryTiles',
      paint: {
        'raster-opacity': 0.92,
        'raster-saturation': -0.28,
        'raster-contrast': 0.1,
        'raster-brightness-max': 0.82,
      },
    },
  ],
}

const sourceIds = [
  'mission-zone-source',
  'mission-label-source',
  'restricted-zone-source',
  'restricted-hatch-source',
  'asset-labels-source',
  'probable-path-source',
  'track-history-line-source',
  'track-history-points-source',
  'bearing-lines-source',
  'bearing-cones-source',
  'platforms-source',
  'sensors-source',
  'detections-source',
  'fused-tracks-source',
]

const layerGroups: Record<LayerKey, string[]> = {
  sensors: ['bearing-cones-fill', 'bearing-cones-line', 'bearing-lines', 'platforms', 'sensors', 'sensor-labels'],
  rawDetections: ['detections-halo', 'detections'],
  fusedTracks: ['fused-track-ring', 'fused-track-core', 'fused-track-label'],
  protectedZones: [
    'mission-zone-fill',
    'mission-zone-outline',
    'restricted-zone-fill',
    'restricted-zone-outline',
    'restricted-zone-hatch',
    'mission-label',
    'asset-labels',
  ],
  probablePath: ['probable-path'],
  trackHistory: ['track-history-line', 'track-history-points'],
}

const interactiveLayerIds = ['fused-track-core', 'fused-track-ring', 'detections', 'sensors', 'platforms']

function normalizeModality(modality: string) {
  return modality.trim().toUpperCase()
}

function modalityGroup(modality: string) {
  const normalized = normalizeModality(modality)

  if (normalized.includes('RADAR')) {
    return 'Radar'
  }

  if (normalized.includes('RF') || normalized.includes('ACOUSTIC')) {
    return 'Acoustic/RF'
  }

  if (normalized.includes('EO') || normalized.includes('IR')) {
    return 'EO'
  }

  return 'Other'
}

function modalityClass(modality: string) {
  return modalityGroup(modality).toLowerCase().replace('/', '-')
}

function modalityShortLabel(modality: string) {
  const group = modalityGroup(modality)
  return group === 'EO' && normalizeModality(modality).includes('IR') ? 'IR' : group
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`
}

function formatTimestamp(timestamp: string) {
  if (timestamp.includes('T')) {
    return timestamp.slice(11, 19)
  }

  return timestamp.replace('Z', '')
}

function timestampValue(timestamp: string) {
  const normalized = timestamp.includes('T') ? timestamp : `2026-05-02T${timestamp.replace('Z', '')}.000Z`
  const value = Date.parse(normalized)
  return Number.isFinite(value) ? value : 0
}

function sourceTokens(sourceSummary: string) {
  return sourceSummary
    .split(/[+,]/)
    .map((source) => source.trim())
    .filter(Boolean)
    .map((source) => (source.toUpperCase() === 'IR' ? 'EO/IR' : source))
}

function riskLevel(score: number) {
  if (score >= 70) {
    return 'critical'
  }

  if (score >= 55) {
    return 'high'
  }

  if (score >= 35) {
    return 'watch'
  }

  return 'low'
}

function riskLabel(score: number) {
  const level = riskLevel(score)
  return level === 'critical' ? 'Critical' : level === 'high' ? 'High' : level === 'watch' ? 'Watch' : 'Low'
}

function freshnessLabel(timestamp: string) {
  const value = timestampValue(timestamp)

  if (!value) {
    return formatTimestamp(timestamp)
  }

  const latestReference = Date.parse('2026-05-02T17:43:30.000Z')
  const deltaSeconds = Math.max(0, Math.round((latestReference - value) / 1000))

  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`
  }

  return `${Math.round(deltaSeconds / 60)}m ago`
}

function custodyClass(status: string) {
  return status.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function getDetectionStatus(demoStep: DemoStep | null, detection: Detection, selectedDetectionId: string | null) {
  if (selectedDetectionId === detection.detection_id) {
    return 'Selected'
  }

  if (demoStep?.staleDetectionIds.includes(detection.detection_id) || detection.is_stale) {
    return 'Stale'
  }

  if (demoStep?.activeDetectionIds.includes(detection.detection_id)) {
    return 'Active'
  }

  return 'Supporting'
}

function isDetectionStale(demoStep: DemoStep | null, detection: Detection) {
  return Boolean(detection.is_stale || demoStep?.staleDetectionIds.includes(detection.detection_id))
}

function isDetectionActive(demoStep: DemoStep | null, detection: Detection) {
  return Boolean(demoStep?.activeDetectionIds.includes(detection.detection_id))
}

function destinationPoint(lat: number, lon: number, bearingDeg: number, distanceM: number): [number, number] {
  const radiusM = 6378137
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (lat * Math.PI) / 180
  const lon1 = (lon * Math.PI) / 180
  const angularDistance = distanceM / radiusM
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    )

  return [((lon2 * 180) / Math.PI + 540) % 360 - 180, (lat2 * 180) / Math.PI]
}

function offsetMeters(lat: number, lon: number, eastM: number, northM: number): [number, number] {
  const latOffset = northM / 111320
  const lonOffset = eastM / (111320 * Math.cos((lat * Math.PI) / 180))
  return [lon + lonOffset, lat + latOffset]
}

function buildSector(lat: number, lon: number, bearingDeg: number, distanceM: number, widthDeg: number) {
  const halfWidth = Math.max(8, Math.min(widthDeg || 36, 80)) / 2
  const steps = 8
  const coordinates: [number, number][] = [[lon, lat]]

  for (let index = 0; index <= steps; index += 1) {
    const bearing = bearingDeg - halfWidth + (index / steps) * halfWidth * 2
    coordinates.push(destinationPoint(lat, lon, bearing, distanceM))
  }

  coordinates.push([lon, lat])
  return coordinates
}

function uniqueById<T>(records: T[], getId: (record: T) => string) {
  const seen = new Set<string>()

  return records.filter((record) => {
    const id = getId(record)

    if (seen.has(id)) {
      return false
    }

    seen.add(id)
    return true
  })
}

function getSensor(sensorId: string, activeSensors: Sensor[]) {
  return [...activeSensors, ...localSensors, ...palantirSensors].find((sensor) => sensor.sensor_id === sensorId)
}

function getPlatform(platformId: string, activePlatforms: Platform[]) {
  return [...activePlatforms, ...localPlatforms, ...palantirPlatforms].find((platform) => platform.platform_id === platformId)
}

function buildDetectionCoordinates(track: FusedTrack, records: Detection[]) {
  const sortedRecords = [...records].sort((a, b) => timestampValue(a.timestamp) - timestampValue(b.timestamp))
  const start = destinationPoint(track.estimated_lat, track.estimated_lon, 235, 720)
  const stepDistance = sortedRecords.length > 1 ? 1240 / (sortedRecords.length - 1) : 0
  const coordinates = new Map<string, [number, number]>()

  sortedRecords.forEach((detection, index) => {
    const alongTrack = destinationPoint(start[1], start[0], 55, stepDistance * index)
    const lateralOffset = ((index % 3) - 1) * 44 + (modalityGroup(detection.modality) === 'Radar' ? -18 : 18)
    const point = destinationPoint(alongTrack[1], alongTrack[0], 145, lateralOffset)
    coordinates.set(detection.detection_id, point)
  })

  return coordinates
}

function buildMapData({
  activePlatforms,
  activeSensors,
  allTracks,
  detections: records,
  demoStep,
  selectedDetectionId,
  selectedTrack,
}: {
  activePlatforms: Platform[]
  activeSensors: Sensor[]
  allTracks: FusedTrack[]
  detections: Detection[]
  demoStep: DemoStep | null
  selectedDetectionId: string | null
  selectedTrack: FusedTrack
}): MapData {
  const relatedSensorIds = new Set(records.map((detection) => detection.sensor_id))
  const displaySensors = uniqueById(
    [
      ...activeSensors,
      ...localSensors.filter((sensor) => relatedSensorIds.has(sensor.sensor_id)),
      ...palantirSensors.filter((sensor) => relatedSensorIds.has(sensor.sensor_id)),
    ],
    (sensor) => sensor.sensor_id,
  )
  const relatedPlatformIds = new Set(displaySensors.map((sensor) => sensor.platform_id))
  const displayPlatforms = uniqueById(
    [
      ...activePlatforms,
      ...localPlatforms.filter((platform) => relatedPlatformIds.has(platform.platform_id)),
      ...palantirPlatforms.filter((platform) => relatedPlatformIds.has(platform.platform_id)),
    ],
    (platform) => platform.platform_id,
  )
  const detectionCoordinates = buildDetectionCoordinates(selectedTrack, records)
  const selectedDetection = records.find((detection) => detection.detection_id === selectedDetectionId)
  const zoneCoordinates: [number, number][] = [
    offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, -1600, -980),
    offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 1750, -780),
    offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 2150, 940),
    offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, -1350, 1180),
    offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, -1600, -980),
  ]
  const sortedCoordinates = [...records]
    .sort((a, b) => timestampValue(a.timestamp) - timestampValue(b.timestamp))
    .map((detection) => detectionCoordinates.get(detection.detection_id))
    .filter((coordinate): coordinate is [number, number] => Boolean(coordinate))
  const trackCoordinate: [number, number] = [selectedTrack.estimated_lon, selectedTrack.estimated_lat]
  const historyCoordinates = [...sortedCoordinates, trackCoordinate]
  const probablePathCoordinates = [
    sortedCoordinates[0] ?? destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 235, 700),
    trackCoordinate,
    destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 55, 920),
  ]
  const restrictedZoneCoordinates: [number, number][] = [
    destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 42, 410),
    destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 72, 890),
    destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 118, 760),
    destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 163, 360),
    destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 42, 410),
  ]
  const restrictedHatchFeatures: GeoJsonFeature[] = [0, 1, 2, 3].map((index) => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 42 + index * 26, 380 + index * 52),
        destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 146 + index * 10, 760 + index * 42),
      ],
    },
    properties: {
      id: `${selectedTrack.track_id}-restricted-hatch-${index}`,
    },
  }))

  const missionZone: GeoJsonCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [zoneCoordinates] },
        properties: {
          id: selectedTrack.mission_area,
          label: selectedTrack.mission_area,
          tooltip: `${selectedTrack.mission_area} protected zone`,
        },
      },
    ],
  }
  const missionLabel: GeoJsonCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, -1160, 1110) },
        properties: {
          label: selectedTrack.mission_area,
        },
      },
    ],
  }
  const restrictedZone: GeoJsonCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [restrictedZoneCoordinates] },
        properties: {
          id: `${selectedTrack.track_id}-threat-zone`,
          label: 'Restricted Review Zone',
          tooltip: `Threat zone projected from ${selectedTrack.track_id}`,
        },
      },
    ],
  }
  const assetLabels: GeoJsonCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, -520, -620) },
        properties: {
          label: 'Protected Waterfront',
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 940, 360) },
        properties: {
          label: 'Probable Intercept',
        },
      },
    ],
  }
  const probablePath: GeoJsonCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: probablePathCoordinates },
        properties: {
          id: `${selectedTrack.track_id}-probable-path`,
          tooltip: `Probable path for ${selectedTrack.track_id}`,
        },
      },
    ],
  }
  const trackHistoryLine: GeoJsonCollection = {
    type: 'FeatureCollection',
    features:
      historyCoordinates.length > 1
        ? [
            {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: historyCoordinates },
              properties: {
                id: `${selectedTrack.track_id}-history`,
                tooltip: `Track history for ${selectedTrack.track_id}`,
              },
            },
          ]
        : [],
  }
  const trackHistoryPoints: GeoJsonCollection = {
    type: 'FeatureCollection',
    features: sortedCoordinates.map((coordinate, index) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coordinate },
      properties: {
        id: `breadcrumb-${index + 1}`,
        sequence: index + 1,
      },
    })),
  }
  const detectionFeatures: GeoJsonFeature[] = records.map((detection) => {
    const coordinate = detectionCoordinates.get(detection.detection_id) ?? trackCoordinate
    const status = getDetectionStatus(demoStep, detection, selectedDetectionId)

    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coordinate },
      properties: {
        id: detection.detection_id,
        trackId: detection.contributes_to_track_id,
        sensorId: detection.sensor_id,
        modality: modalityShortLabel(detection.modality),
        modalityGroup: modalityGroup(detection.modality),
        status,
        selected: detection.detection_id === selectedDetectionId,
        active: isDetectionActive(demoStep, detection),
        stale: isDetectionStale(demoStep, detection),
        confidence: detection.confidence,
        tooltip: `${detection.detection_id} | ${modalityShortLabel(detection.modality)} | ${detection.classification} | ${formatConfidence(
          detection.confidence,
        )}`,
      },
    }
  })
  const platformFeatures: GeoJsonFeature[] = displayPlatforms.map((platform) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [platform.lon, platform.lat] },
    properties: {
      id: platform.platform_id,
      callsign: platform.callsign,
      selected: selectedDetection
        ? getSensor(selectedDetection.sensor_id, displaySensors)?.platform_id === platform.platform_id
        : false,
      tooltip: `${platform.callsign} | ${platform.platform_type} | ${platform.platform_id}`,
    },
  }))
  const sensorFeatures: GeoJsonFeature[] = displaySensors.flatMap((sensor, index) => {
      const platform = getPlatform(sensor.platform_id, displayPlatforms)

      if (!platform) {
        return []
      }

      const offset = destinationPoint(platform.lat, platform.lon, 45 + (index % 6) * 48, 58 + (index % 3) * 34)

      const feature: GeoJsonFeature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: offset },
        properties: {
          id: sensor.sensor_id,
          platformId: sensor.platform_id,
          modality: modalityShortLabel(sensor.modality),
          modalityGroup: modalityGroup(sensor.modality),
          selected: selectedDetection?.sensor_id === sensor.sensor_id,
          tooltip: `${sensor.sensor_id} | ${modalityShortLabel(sensor.modality)} | ${sensor.measurement_kind}`,
        },
      }

      return [feature]
    })
  const bearingLineFeatures: GeoJsonFeature[] = records.flatMap((detection) => {
      const sensor = getSensor(detection.sensor_id, displaySensors)
      const platform = sensor ? getPlatform(sensor.platform_id, displayPlatforms) : null
      const detectionCoordinate = detectionCoordinates.get(detection.detection_id)

      if (!platform || !detectionCoordinate) {
        return []
      }

      const feature: GeoJsonFeature = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[platform.lon, platform.lat], detectionCoordinate] },
        properties: {
          id: `${detection.detection_id}-bearing`,
          modalityGroup: modalityGroup(detection.modality),
          selected: detection.detection_id === selectedDetectionId,
          active: isDetectionActive(demoStep, detection),
          tooltip: `${detection.sensor_id} bearing to ${detection.detection_id}`,
        },
      }

      return [feature]
    })
  const bearingConeFeatures: GeoJsonFeature[] = records
    .filter((detection) => ['Acoustic/RF', 'EO'].includes(modalityGroup(detection.modality)))
    .flatMap((detection) => {
      const sensor = getSensor(detection.sensor_id, displaySensors)
      const platform = sensor ? getPlatform(sensor.platform_id, displayPlatforms) : null

      if (!platform || !sensor) {
        return []
      }

      const rangeM = Math.min(Math.max(detection.range_m || sensor.range_max_m || 1200, 850), 4200)

      const feature: GeoJsonFeature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [buildSector(platform.lat, platform.lon, detection.bearing_deg, rangeM, sensor.fov_h_deg || 42)],
        },
        properties: {
          id: `${detection.detection_id}-cone`,
          modalityGroup: modalityGroup(detection.modality),
          selected: detection.detection_id === selectedDetectionId,
        },
      }

      return [feature]
    })

  return {
    center: trackCoordinate,
    zoom: activePlatforms.length > 3 ? 10.6 : 12.8,
    missionZone,
    missionLabel,
    restrictedZone,
    restrictedHatch: { type: 'FeatureCollection', features: restrictedHatchFeatures },
    assetLabels,
    probablePath,
    trackHistoryLine,
    trackHistoryPoints,
    bearingLines: { type: 'FeatureCollection', features: bearingLineFeatures },
    bearingCones: { type: 'FeatureCollection', features: bearingConeFeatures },
    platforms: { type: 'FeatureCollection', features: platformFeatures },
    sensors: { type: 'FeatureCollection', features: sensorFeatures },
    detections: { type: 'FeatureCollection', features: detectionFeatures },
    fusedTracks: {
      type: 'FeatureCollection',
      features: uniqueById([selectedTrack, ...allTracks], (track) => track.track_id).map((track) => {
        const isSelected = track.track_id === selectedTrack.track_id

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: isSelected ? trackCoordinate : [track.estimated_lon, track.estimated_lat],
          },
          properties: {
            id: track.track_id,
            label: track.track_id,
            confidence: isSelected ? selectedTrack.confidence : track.confidence,
            threatScore: track.threat_score,
            selected: isSelected,
            tooltip: `${track.track_id} | confidence ${formatConfidence(
              isSelected ? selectedTrack.confidence : track.confidence,
            )} | threat ${track.threat_score}`,
          },
        }
      }),
    },
  }
}

function ensureSource(map: maplibregl.Map, sourceId: string, data: GeoJsonCollection) {
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined

  if (source) {
    source.setData(data)
    return
  }

  map.addSource(sourceId, {
    type: 'geojson',
    data,
  })
}

function addMapLayers(map: maplibregl.Map) {
  if (map.getLayer('mission-zone-fill')) {
    return
  }

  sourceIds.forEach((sourceId) => ensureSource(map, sourceId, emptyCollection()))

  map.addLayer({
    id: 'mission-zone-fill',
    type: 'fill',
    source: 'mission-zone-source',
    paint: {
      'fill-color': '#315d74',
      'fill-opacity': 0.16,
    },
  })
  map.addLayer({
    id: 'mission-zone-outline',
    type: 'line',
    source: 'mission-zone-source',
    paint: {
      'line-color': '#77d5ff',
      'line-opacity': 0.72,
      'line-width': 1.5,
      'line-dasharray': [2, 2],
    },
  })
  map.addLayer({
    id: 'restricted-zone-fill',
    type: 'fill',
    source: 'restricted-zone-source',
    paint: {
      'fill-color': '#ff3f35',
      'fill-opacity': 0.08,
    },
  })
  map.addLayer({
    id: 'restricted-zone-outline',
    type: 'line',
    source: 'restricted-zone-source',
    paint: {
      'line-color': '#ff5748',
      'line-opacity': 0.78,
      'line-width': 1.4,
      'line-dasharray': [1, 1.2],
    },
  })
  map.addLayer({
    id: 'restricted-zone-hatch',
    type: 'line',
    source: 'restricted-hatch-source',
    paint: {
      'line-color': '#ff5748',
      'line-opacity': 0.35,
      'line-width': 1,
    },
  })
  map.addLayer({
    id: 'mission-label',
    type: 'symbol',
    source: 'mission-label-source',
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 12,
      'text-offset': [0, 0],
      'text-anchor': 'center',
    },
    paint: {
      'text-color': '#dceefa',
      'text-halo-color': '#06101b',
      'text-halo-width': 1.5,
    },
  })
  map.addLayer({
    id: 'asset-labels',
    type: 'symbol',
    source: 'asset-labels-source',
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 11,
      'text-letter-spacing': 0.02,
      'text-anchor': 'center',
    },
    paint: {
      'text-color': '#b9eaff',
      'text-halo-color': '#06101b',
      'text-halo-width': 1.2,
    },
  })
  map.addLayer({
    id: 'probable-path',
    type: 'line',
    source: 'probable-path-source',
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#f1b84b',
      'line-opacity': 0.9,
      'line-width': 2.4,
      'line-dasharray': [1.3, 1.4],
    },
  })
  map.addLayer({
    id: 'track-history-line',
    type: 'line',
    source: 'track-history-line-source',
    paint: {
      'line-color': '#ff8d3b',
      'line-opacity': 0.56,
      'line-width': 2,
    },
  })
  map.addLayer({
    id: 'track-history-points',
    type: 'circle',
    source: 'track-history-points-source',
    paint: {
      'circle-radius': 3.4,
      'circle-color': '#ffb26b',
      'circle-opacity': 0.84,
      'circle-stroke-color': '#24130b',
      'circle-stroke-width': 1,
    },
  })
  map.addLayer({
    id: 'bearing-cones-fill',
    type: 'fill',
    source: 'bearing-cones-source',
    paint: {
      'fill-color': [
        'match',
        ['get', 'modalityGroup'],
        'Acoustic/RF',
        '#f1b84b',
        'EO',
        '#67e8a3',
        '#77d5ff',
      ],
      'fill-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.18, 0.08],
    },
  })
  map.addLayer({
    id: 'bearing-cones-line',
    type: 'line',
    source: 'bearing-cones-source',
    paint: {
      'line-color': [
        'match',
        ['get', 'modalityGroup'],
        'Acoustic/RF',
        '#f1b84b',
        'EO',
        '#67e8a3',
        '#77d5ff',
      ],
      'line-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.55, 0.24],
      'line-width': 1,
    },
  })
  map.addLayer({
    id: 'bearing-lines',
    type: 'line',
    source: 'bearing-lines-source',
    paint: {
      'line-color': [
        'match',
        ['get', 'modalityGroup'],
        'Radar',
        '#36d8ef',
        'Acoustic/RF',
        '#f1b84b',
        'EO',
        '#67e8a3',
        '#7ac6cb',
      ],
      'line-opacity': [
        'case',
        ['boolean', ['get', 'selected'], false],
        0.72,
        ['boolean', ['get', 'active'], false],
        0.48,
        0.22,
      ],
      'line-width': ['case', ['boolean', ['get', 'selected'], false], 2.2, 1.1],
    },
  })
  map.addLayer({
    id: 'platforms',
    type: 'circle',
    source: 'platforms-source',
    paint: {
      'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 5.5, 3.4],
      'circle-color': '#8fa4b8',
      'circle-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.72, 0.36],
      'circle-stroke-color': '#e7eef5',
      'circle-stroke-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.45, 0.2],
      'circle-stroke-width': 1,
    },
  })
  map.addLayer({
    id: 'sensors',
    type: 'circle',
    source: 'sensors-source',
    paint: {
      'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 6.2, 3.8],
      'circle-color': [
        'match',
        ['get', 'modalityGroup'],
        'Radar',
        '#36d8ef',
        'Acoustic/RF',
        '#f1b84b',
        'EO',
        '#67e8a3',
        '#7ac6cb',
      ],
      'circle-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.95, 0.46],
      'circle-stroke-color': '#06101b',
      'circle-stroke-width': 1.4,
    },
  })
  map.addLayer({
    id: 'sensor-labels',
    type: 'symbol',
    source: 'sensors-source',
    filter: ['==', ['get', 'selected'], true],
    layout: {
      'text-field': ['get', 'id'],
      'text-size': 11,
      'text-offset': [0, 1.15],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': '#dceefa',
      'text-halo-color': '#06101b',
      'text-halo-width': 1.2,
    },
  })
  map.addLayer({
    id: 'detections-halo',
    type: 'circle',
    source: 'detections-source',
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['get', 'selected'], false],
        13,
        ['boolean', ['get', 'active'], false],
        8,
        6.5,
      ],
      'circle-color': [
        'match',
        ['get', 'modalityGroup'],
        'Radar',
        '#36d8ef',
        'Acoustic/RF',
        '#f1b84b',
        'EO',
        '#67e8a3',
        '#7ac6cb',
      ],
      'circle-opacity': [
        'case',
        ['boolean', ['get', 'selected'], false],
        0.24,
        ['boolean', ['get', 'stale'], false],
        0.08,
        0.1,
      ],
    },
  })
  map.addLayer({
    id: 'detections',
    type: 'circle',
    source: 'detections-source',
    paint: {
      'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 5.5, ['boolean', ['get', 'active'], false], 4.5, 3.5],
      'circle-color': [
        'match',
        ['get', 'modalityGroup'],
        'Radar',
        '#36d8ef',
        'Acoustic/RF',
        '#f1b84b',
        'EO',
        '#67e8a3',
        '#7ac6cb',
      ],
      'circle-opacity': ['case', ['boolean', ['get', 'stale'], false], 0.38, 0.72],
      'circle-stroke-color': ['case', ['boolean', ['get', 'selected'], false], '#ffffff', '#06101b'],
      'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 2, 1.3],
    },
  })
  map.addLayer({
    id: 'fused-track-ring',
    type: 'circle',
    source: 'fused-tracks-source',
    paint: {
      'circle-radius': 22,
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-stroke-color': '#ff643a',
      'circle-stroke-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.95, 0.26],
      'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 4.5, 2.4],
    },
  })
  map.addLayer({
    id: 'fused-track-core',
    type: 'circle',
    source: 'fused-tracks-source',
    paint: {
      'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 8.5, 5.5],
      'circle-color': '#ff6a2d',
      'circle-stroke-color': '#fff0df',
      'circle-opacity': ['case', ['boolean', ['get', 'selected'], false], 1, 0.42],
      'circle-stroke-opacity': ['case', ['boolean', ['get', 'selected'], false], 1, 0.35],
      'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 2, 1],
    },
  })
  map.addLayer({
    id: 'fused-track-label',
    type: 'symbol',
    source: 'fused-tracks-source',
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 13,
      'text-offset': [0, -1.8],
      'text-anchor': 'bottom',
    },
    paint: {
      'text-color': '#fff4eb',
      'text-halo-color': '#110905',
      'text-halo-width': 1.6,
    },
  })
}

function updateMapSources(map: maplibregl.Map, data: MapData) {
  const sourceData: Record<string, GeoJsonCollection> = {
    'mission-zone-source': data.missionZone,
    'mission-label-source': data.missionLabel,
    'restricted-zone-source': data.restrictedZone,
    'restricted-hatch-source': data.restrictedHatch,
    'asset-labels-source': data.assetLabels,
    'probable-path-source': data.probablePath,
    'track-history-line-source': data.trackHistoryLine,
    'track-history-points-source': data.trackHistoryPoints,
    'bearing-lines-source': data.bearingLines,
    'bearing-cones-source': data.bearingCones,
    'platforms-source': data.platforms,
    'sensors-source': data.sensors,
    'detections-source': data.detections,
    'fused-tracks-source': data.fusedTracks,
  }

  Object.entries(sourceData).forEach(([sourceId, collection]) => ensureSource(map, sourceId, collection))
}

function setLayerVisibility(map: maplibregl.Map, layers: Record<LayerKey, boolean>) {
  Object.entries(layerGroups).forEach(([layerKey, layerIds]) => {
    const visibility = layers[layerKey as LayerKey] ? 'visible' : 'none'

    layerIds.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility)
      }
    })
  })
}

function buildTrackQueueItems({
  detections: records,
  demoStep,
  selectedDetectionId,
  tracks,
}: {
  detections: Detection[]
  demoStep: DemoStep | null
  selectedDetectionId: string | null
  tracks: FusedTrack[]
}) {
  const items: TrackQueueItem[] = tracks.map((track) => {
    const relatedDetections = records.filter((detection) => detection.contributes_to_track_id === track.track_id)
    const latestDetection = [...relatedDetections].sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp))[0]
    const sourceTypes = sourceTokens(track.source_summary)

    return {
      id: track.track_id,
      kind: 'track',
      label: 'Fused track',
      classification: latestDetection?.classification ?? 'Fused contact',
      confidence: track.confidence,
      threatScore: track.threat_score,
      custodyStatus: track.custody_status,
      sourceSummary: track.source_summary,
      sourceTypes,
      lastSeen: track.last_seen,
      freshness: freshnessLabel(track.last_seen),
      status: track.custody_status,
      trackId: track.track_id,
      track,
    }
  })

  records.forEach((detection) => {
    const parentTrack = tracks.find((track) => track.track_id === detection.contributes_to_track_id)
    const status = getDetectionStatus(demoStep, detection, selectedDetectionId)

    items.push({
      id: detection.detection_id,
      kind: 'detection',
      label: modalityShortLabel(detection.modality),
      classification: detection.classification,
      confidence: detection.confidence,
      threatScore: parentTrack ? Math.round(parentTrack.threat_score * detection.confidence) : Math.round(detection.confidence * 100),
      custodyStatus: parentTrack?.custody_status ?? status,
      sourceSummary: detection.sensor_id,
      sourceTypes: [modalityShortLabel(detection.modality)],
      lastSeen: detection.timestamp,
      freshness: freshnessLabel(detection.timestamp),
      status,
      trackId: detection.contributes_to_track_id,
      detection,
    })
  })

  return items.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'track' ? -1 : 1
    }

    return timestampValue(b.lastSeen) - timestampValue(a.lastSeen)
  })
}

function filterQueueItems(items: TrackQueueItem[], eventFilter: EventFilter, selectedTrackId: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  return items.filter((item) => {
    if (eventFilter === 'selected' && item.trackId !== selectedTrackId) {
      return false
    }

    if (item.kind === 'detection') {
      const group = modalityGroup(item.detection?.modality ?? '')

      if (eventFilter === 'radar' && group !== 'Radar') {
        return false
      }

      if (eventFilter === 'acousticRf' && group !== 'Acoustic/RF') {
        return false
      }

      if (eventFilter === 'eo' && group !== 'EO') {
        return false
      }
    } else if (eventFilter !== 'all' && eventFilter !== 'selected') {
      return item.sourceTypes.some((source) => {
        const group = modalityGroup(source)
        return (
          (eventFilter === 'radar' && group === 'Radar') ||
          (eventFilter === 'acousticRf' && group === 'Acoustic/RF') ||
          (eventFilter === 'eo' && group === 'EO')
        )
      })
    }

    if (!normalizedQuery) {
      return true
    }

    return [item.id, item.trackId, item.classification, item.sourceSummary, item.custodyStatus]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  })
}

function TrackQueueCard({
  item,
  selected,
  onSelect,
}: {
  item: TrackQueueItem
  selected: boolean
  onSelect: () => void
}) {
  const symbol =
    item.kind === 'track'
      ? '⌁'
      : modalityGroup(item.detection?.modality ?? '') === 'Radar'
        ? '⌖'
        : modalityGroup(item.detection?.modality ?? '') === 'EO'
          ? '◉'
          : '⌁'

  return (
    <button
      className={[
        'queue-card',
        `is-${item.kind}`,
        `risk-${riskLevel(item.threatScore)}`,
        `custody-${custodyClass(item.custodyStatus)}`,
        selected ? 'is-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      type="button"
      onClick={onSelect}
    >
      <span className="queue-card-accent" aria-hidden="true" />
      <span className="track-symbol" aria-hidden="true">{symbol}</span>
      <span className="queue-meta">
        <span>{item.label}</span>
        <strong>{item.id}</strong>
      </span>
      <span className={`risk-badge risk-${riskLevel(item.threatScore)}`}>{riskLabel(item.threatScore)}</span>
      <strong className="queue-title">{item.classification}</strong>
      <span className="queue-status">{item.status}</span>
      <span className="queue-freshness">{item.freshness}</span>
      <dl className="queue-metrics">
        <div>
          <dt>Conf</dt>
          <dd>{formatConfidence(item.confidence)}</dd>
        </div>
        <div>
          <dt>Threat</dt>
          <dd>{item.threatScore}</dd>
        </div>
        <div>
          <dt>Custody</dt>
          <dd>{item.custodyStatus}</dd>
        </div>
      </dl>
      <span className="source-token-row">
        {item.sourceTypes.slice(0, 4).map((source) => (
          <span className={`source-token ${modalityClass(source)}`} key={`${item.id}-${source}`}>
            {source}
          </span>
        ))}
      </span>
    </button>
  )
}

function LeftTrackRail({
  dataMode,
  demoStep,
  detections: records,
  eventFilter,
  queueQuery,
  selectedDetectionId,
  selectedTrack,
  selectedTrackId,
  tracks,
  usingFallbackData,
  onFilterChange,
  onNextDemoStep,
  onQueryChange,
  onResetDemo,
  onSelectDetection,
  onSelectTrack,
  onStartDemo,
}: {
  dataMode: DataMode
  demoStep: DemoStep | null
  detections: Detection[]
  eventFilter: EventFilter
  queueQuery: string
  selectedDetectionId: string | null
  selectedTrack: FusedTrack
  selectedTrackId: string
  tracks: FusedTrack[]
  usingFallbackData: boolean
  onFilterChange: (filter: EventFilter) => void
  onNextDemoStep: () => void
  onQueryChange: (query: string) => void
  onResetDemo: () => void
  onSelectDetection: (detection: Detection) => void
  onSelectTrack: (trackId: string) => void
  onStartDemo: () => void
}) {
  const queueItems = useMemo(
    () => buildTrackQueueItems({ detections: records, demoStep, selectedDetectionId, tracks }),
    [demoStep, records, selectedDetectionId, tracks],
  )
  const filteredItems = useMemo(
    () => filterQueueItems(queueItems, eventFilter, selectedTrackId, queueQuery),
    [eventFilter, queueItems, queueQuery, selectedTrackId],
  )
  const detectionCount = records.filter((record) => record.contributes_to_track_id === selectedTrackId).length

  return (
    <aside className="left-rail" aria-labelledby="queue-title">
      <section className="queue-toolbar">
        <div>
          <span>Operator Queue</span>
          <strong id="queue-title">{filteredItems.length} contacts</strong>
        </div>
        <em>{usingFallbackData ? 'Fallback' : dataMode === 'palantirMission' ? 'Mission' : 'Live Demo'}</em>
      </section>

      <label className="rail-search">
        <span>Search</span>
        <input
          aria-label="Search tracks and detections"
          placeholder="Track, source, classification"
          type="search"
          value={queueQuery}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <div className="filter-chips" aria-label="Event filters">
        {eventFilters.map((filter) => (
          <button
            className={eventFilter === filter.key ? 'is-selected' : ''}
            key={filter.key}
            type="button"
            onClick={() => onFilterChange(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="queue-summary-strip">
        <span>{tracks.length} fused</span>
        <span>{records.length} detections</span>
        <span>{detectionCount} selected</span>
      </div>

      <div className="track-result-list">
        {filteredItems.map((item) => (
          <TrackQueueCard
            item={item}
            key={item.id}
            selected={selectedDetectionId ? selectedDetectionId === item.id : selectedTrackId === item.trackId && item.kind === 'track'}
            onSelect={() => {
              if (item.detection) {
                onSelectDetection(item.detection)
                return
              }

              onSelectTrack(item.trackId)
            }}
          />
        ))}
      </div>

      <section className="track-details-card">
        <div className="track-details-title">
          <h2>Fusion Review</h2>
          <span>{formatConfidence(selectedTrack.confidence)}</span>
        </div>
        <div className="track-identity">
          <span>{dataModeLabels[dataMode]}</span>
          <strong>{selectedTrack.track_id}</strong>
          <em>{riskLabel(selectedTrack.threat_score)} risk / threat {selectedTrack.threat_score}</em>
        </div>
        <div className="track-playback">
          <span>{demoStep?.title ?? 'Current fused state'}</span>
          <div className="playback-buttons" aria-label="Demo Mode controls">
            <button type="button" onClick={onStartDemo}>Start</button>
            <button type="button" onClick={onNextDemoStep}>Next</button>
            <button type="button" onClick={onResetDemo}>Reset</button>
          </div>
        </div>
      </section>
    </aside>
  )
}

function SensorLegend() {
  const legendItems = [
    { className: 'radar', label: 'Radar', detail: 'range / bearing' },
    { className: 'acoustic-rf', label: 'RF / Acoustic', detail: 'bearing arc' },
    { className: 'eo', label: 'EO / IR', detail: 'line of sight' },
    { className: 'fused', label: 'Fused Track', detail: 'review target' },
  ]

  return (
    <div className="sensor-legend" aria-label="Sensor fusion legend">
      {legendItems.map((item) => (
        <span className={`legend-item ${item.className}`} key={item.label}>
          <i aria-hidden="true" />
          <span>
            <strong>{item.label}</strong>
            <em>{item.detail}</em>
          </span>
        </span>
      ))}
    </div>
  )
}

function LayerControls({
  visibleLayers,
  onLayerToggle,
}: {
  visibleLayers: Record<LayerKey, boolean>
  onLayerToggle: (layer: LayerKey) => void
}) {
  return (
    <div className="layer-toggles" aria-label="Map layer toggles">
      {layerControls.map((layer) => (
        <button
          className={visibleLayers[layer.key] ? 'is-active' : ''}
          key={layer.key}
          type="button"
          onClick={() => onLayerToggle(layer.key)}
        >
          <span aria-hidden="true" />
          {layer.label}
        </button>
      ))}
    </div>
  )
}

function MissionMap({
  mapData,
  readyStatus,
  selectedTrack,
  visibleLayers,
  onLayerToggle,
  onSelectDetectionId,
  onSelectTrackId,
}: {
  mapData: MapData
  readyStatus: string
  selectedTrack: FusedTrack
  visibleLayers: Record<LayerKey, boolean>
  onLayerToggle: (layer: LayerKey) => void
  onSelectDetectionId: (detectionId: string | null) => void
  onSelectTrackId: (trackId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const initialMapDataRef = useRef(mapData)
  const initialVisibleLayersRef = useRef(visibleLayers)
  const latestSelectDetection = useRef(onSelectDetectionId)
  const latestSelectTrack = useRef(onSelectTrackId)
  const [mapReady, setMapReady] = useState(false)
  const [tileFallback, setTileFallback] = useState(false)

  useEffect(() => {
    latestSelectDetection.current = onSelectDetectionId
    latestSelectTrack.current = onSelectTrackId
  }, [onSelectDetectionId, onSelectTrackId])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: initialMapDataRef.current.center,
      zoom: initialMapDataRef.current.zoom,
      attributionControl: false,
      pitch: 0,
    })
    mapRef.current = map
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    map.on('load', () => {
      addMapLayers(map)
      updateMapSources(map, initialMapDataRef.current)
      setLayerVisibility(map, initialVisibleLayersRef.current)
      setMapReady(true)
    })
    map.on('error', (event) => {
      const message = event.error?.message ?? ''

      if (message.toLowerCase().includes('tile') || message.toLowerCase().includes('dark_all')) {
        setTileFallback(true)
      }
    })
    map.on('click', (event) => {
      const layers = interactiveLayerIds.filter((layerId) => Boolean(map.getLayer(layerId)))
      const features = map.queryRenderedFeatures(event.point, { layers })
      const feature = features[0]

      if (!feature) {
        latestSelectDetection.current(null)
        return
      }

      const id = feature.properties?.id

      if (feature.layer.id.includes('fused-track') && typeof id === 'string') {
        latestSelectTrack.current(id)
        latestSelectDetection.current(null)
        return
      }

      if (feature.layer.id === 'detections' && typeof id === 'string') {
        const trackId = feature.properties?.trackId

        if (typeof trackId === 'string') {
          latestSelectTrack.current(trackId)
        }

        latestSelectDetection.current(id)
      }
    })
    map.on('mousemove', (event) => {
      const layers = interactiveLayerIds.filter((layerId) => Boolean(map.getLayer(layerId)))
      const features = map.queryRenderedFeatures(event.point, { layers })
      const feature = features[0]

      map.getCanvas().style.cursor = feature ? 'pointer' : ''

      if (!feature) {
        popupRef.current?.remove()
        return
      }

      const tooltip = feature.properties?.tooltip

      if (typeof tooltip === 'string') {
        popupRef.current?.setLngLat(event.lngLat).setHTML(`<span>${tooltip}</span>`).addTo(map)
      }
    })
    map.on('mouseout', () => {
      map.getCanvas().style.cursor = ''
      popupRef.current?.remove()
    })

    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !mapReady) {
      return
    }

    addMapLayers(map)
    updateMapSources(map, mapData)
    map.easeTo({
      center: mapData.center,
      zoom: mapData.zoom,
      duration: 450,
      essential: true,
    })
  }, [mapData, mapReady])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !mapReady) {
      return
    }

    setLayerVisibility(map, visibleLayers)
  }, [mapReady, visibleLayers])

  return (
    <section className="map-panel" aria-labelledby="map-title">
      <div className="map-stage">
        <div className="map-grid-fallback" aria-hidden="true" />
        <div className="mission-map" ref={containerRef} />

        <div className="map-mode-tabs" aria-label="Map view controls">
          <button className="is-selected" type="button">Map</button>
          <button type="button">3D View</button>
          <button type="button">Sensor Layers</button>
        </div>

        <div className="map-status-strip">
          <span>Tactical Map</span>
          <strong id="map-title">{selectedTrack.track_id}</strong>
          <em>{readyStatus}</em>
        </div>

        <div className="map-track-chip">
          <span>{selectedTrack.custody_status}</span>
          <strong>{riskLabel(selectedTrack.threat_score)} / {formatConfidence(selectedTrack.confidence)}</strong>
          <em>{selectedTrack.source_summary}</em>
        </div>

        <div className="map-jump-control">
          <input value={`${selectedTrack.estimated_lat.toFixed(4)}, ${selectedTrack.estimated_lon.toFixed(4)}`} readOnly />
          <button type="button">Center</button>
        </div>

        {tileFallback ? <div className="tile-fallback-badge">Grid fallback active</div> : null}

        <SensorLegend />
        <LayerControls visibleLayers={visibleLayers} onLayerToggle={onLayerToggle} />
      </div>
    </section>
  )
}

function RightWorkflowRail({
  actions,
  demoStep,
  detections: records,
  selectedTrack,
  onCreateAction,
}: {
  actions: OperatorAction[]
  demoStep: DemoStep | null
  detections: Detection[]
  selectedTrack: FusedTrack
  onCreateAction: (actionType: string, label: string) => void
}) {
  const latestAction = actions[actions.length - 1]
  const sourceTypes = sourceTokens(selectedTrack.source_summary)
  const relatedDetections = records.filter((detection) => detection.contributes_to_track_id === selectedTrack.track_id)
  const latestDetection = [...relatedDetections].sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp))[0]

  return (
    <aside className="right-rail" aria-labelledby="workflow-title">
      <section className={`decision-panel risk-${riskLevel(selectedTrack.threat_score)}`}>
        <div className="decision-header">
          <div>
            <span>Selected Track</span>
            <strong id="workflow-title">{selectedTrack.track_id}</strong>
          </div>
          <em>{riskLabel(selectedTrack.threat_score)}</em>
        </div>
        <p className="track-classification">{latestDetection?.classification ?? 'Fused surface contact'}</p>
        <dl className="summary-grid">
          <div>
            <dt>Confidence</dt>
            <dd>{formatConfidence(selectedTrack.confidence)}</dd>
          </div>
          <div>
            <dt>Custody</dt>
            <dd>{selectedTrack.custody_status}</dd>
          </div>
          <div>
            <dt>Threat</dt>
            <dd>{selectedTrack.threat_score}</dd>
          </div>
          <div>
            <dt>Last Seen</dt>
            <dd>{formatTimestamp(selectedTrack.last_seen)}</dd>
          </div>
        </dl>
        <div className="source-block">
          <span>Sensor Fusion</span>
          <div className="fusion-list">
            {sourceTypes.map((source) => (
              <div className={`fusion-row ${modalityClass(source)}`} key={source}>
                <strong>{source}</strong>
                <span>{source.includes('EO') ? 'Visual' : source.includes('Acoustic') ? 'Correlated' : 'Confirmed'}</span>
                <i aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
        <div className="evidence-block">
          <div className="evidence-heading">
            <span>Evidence</span>
            <strong>{relatedDetections.length} items</strong>
          </div>
          <div className="evidence-strip">
            {relatedDetections.slice(-4).map((detection) => (
              <button className={`evidence-thumb ${modalityClass(detection.modality)}`} key={detection.detection_id} type="button">
                <span>{modalityShortLabel(detection.modality)}</span>
                <strong>{formatConfidence(detection.confidence)}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`recommendation-panel ${demoStep?.emphasizeAction ? 'is-emphasized' : ''}`}>
        <span>Recommended Next Action</span>
        <strong>{selectedTrack.recommended_next_action}</strong>
        <p>{selectedTrack.explanation}</p>
        <div className="workflow-actions" aria-label="Operator actions">
          {actionButtons.map((action) => (
            <button
              className={action.action_type === 'reacquire' || action.action_type === 'dispatch' ? 'is-primary' : ''}
              key={action.action_type}
              type="button"
              onClick={() => onCreateAction(action.action_type, action.label)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <section className="audit-panel" aria-live="polite">
        <div className="rail-section-header">
          <span>Action Feed</span>
          <strong>{actions.length} events</strong>
        </div>
        <div className="feed-context">
          <span>Latest detection</span>
          <strong>{latestDetection ? `${latestDetection.detection_id} / ${modalityShortLabel(latestDetection.modality)}` : 'None'}</strong>
        </div>
        <div className="audit-list">
          {[...actions].reverse().slice(0, 5).map((action) => (
            <article className="audit-item" key={action.action_id}>
              <span>{formatTimestamp(action.timestamp)}</span>
              <strong>{action.label}</strong>
              <small>{action.resulting_status ?? action.action_type}</small>
            </article>
          ))}
        </div>
        <div className="latest-action">
          <span>Latest</span>
          <strong>{latestAction.label}</strong>
        </div>
      </section>
    </aside>
  )
}
function App() {
  const [localOperatorActions, setLocalOperatorActions] = useState<OperatorAction[]>([])
  const [demoStepIndex, setDemoStepIndex] = useState<number | null>(null)
  const [dataMode, setDataMode] = useState<DataMode>('palantirSnapshot')
  const [eventFilter, setEventFilter] = useState<EventFilter>('all')
  const [queueQuery, setQueueQuery] = useState('')
  const [selectedTrackId, setSelectedTrackId] = useState('TRK-SM-001')
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null)
  const [visibleLayers, setVisibleLayers] = useState<Record<LayerKey, boolean>>(defaultLayerState)

  const activeDemoSteps = dataMode === 'palantirMission' ? palantirMissionDemoSteps : demoSteps
  const currentDemoStep = demoStepIndex === null ? null : activeDemoSteps[demoStepIndex] ?? null
  const hasPalantirSnapshot = palantirPlatforms.length > 0 && palantirSensors.length > 0
  const hasPalantirMissionData = palantirMissionDetections.length > 0 && palantirMissionFusedTracks.length > 0
  const usesPalantirSensors = dataMode === 'palantirSnapshot' || dataMode === 'palantirMission'
  const activePlatforms: Platform[] =
    usesPalantirSensors && palantirPlatforms.length > 0 ? palantirPlatforms : localPlatforms
  const activeSensors: Sensor[] =
    usesPalantirSensors && palantirSensors.length > 0 ? palantirSensors : localSensors
  const activeDetections: Detection[] =
    dataMode === 'palantirMission' && palantirMissionDetections.length > 0 ? palantirMissionDetections : detections
  const activeFusedTracks: FusedTrack[] =
    dataMode === 'palantirMission' && palantirMissionFusedTracks.length > 0 ? palantirMissionFusedTracks : fusedTracks
  const baseOperatorActions: OperatorAction[] =
    dataMode === 'palantirMission' && palantirMissionOperatorActions.length > 0
      ? palantirMissionOperatorActions
      : initialActions
  const usingFallbackData =
    (dataMode === 'palantirSnapshot' && !hasPalantirSnapshot) ||
    (dataMode === 'palantirMission' && (!hasPalantirSnapshot || !hasPalantirMissionData))
  const modeStatusText =
    dataMode === 'palantirMission'
      ? `Proposal OPEN ${palantirMissionMetadata.proposalRid.slice(-8)} / branch ${palantirMissionMetadata.branchRid.slice(-8)} active`
      : dataMode === 'palantirSnapshot'
        ? `${palantirSnapshotMetadata.objectTypesUsed.length} Palantir object types`
        : 'Local ontology mock'
  const mapReadyStatus =
    dataMode === 'palantirMission'
      ? 'Palantir mission data active'
      : dataMode === 'palantirSnapshot'
        ? 'Palantir platform/sensor snapshot with local fusion'
        : 'Local ontology mock active'
  const selectedBaseTrack = useMemo(
    () => activeFusedTracks.find((track) => track.track_id === selectedTrackId) ?? activeFusedTracks[0] ?? fusedTracks[0],
    [activeFusedTracks, selectedTrackId],
  )
  const selectedTrack: FusedTrack = useMemo(
    () => ({
      ...selectedBaseTrack,
      ...(currentDemoStep
        ? {
            custody_status: currentDemoStep.custody_status,
            confidence: currentDemoStep.confidence,
            source_summary: currentDemoStep.source_summary,
            recommended_next_action: currentDemoStep.recommended_next_action,
            explanation: currentDemoStep.explanation,
          }
        : {}),
    }),
    [currentDemoStep, selectedBaseTrack],
  )
  const operatorActions = [
    ...baseOperatorActions,
    ...localOperatorActions.filter((action) => action.track_id === selectedTrack.track_id),
  ]
  const selectedDetection =
    activeDetections.find((detectionRecord) => detectionRecord.detection_id === selectedDetectionId) ?? null
  const mapData = useMemo(
    () =>
      buildMapData({
        activePlatforms,
        activeSensors,
        allTracks: activeFusedTracks,
        detections: activeDetections,
        demoStep: currentDemoStep,
        selectedDetectionId,
        selectedTrack,
      }),
    [activeDetections, activeFusedTracks, activePlatforms, activeSensors, currentDemoStep, selectedDetectionId, selectedTrack],
  )

  function createOperatorAction(actionType: string, label: string) {
    const timestamp = new Date().toISOString().slice(11, 19) + 'Z'

    setLocalOperatorActions((currentActions) => {
      const nextAction: OperatorAction = {
        action_id: `ACT-LOCAL-${String(currentActions.length + 1).padStart(4, '0')}`,
        track_id: selectedTrack.track_id,
        action_type: actionType,
        label,
        timestamp,
      }

      return [...currentActions, nextAction]
    })
  }

  function selectDetection(detectionRecord: Detection) {
    setSelectedDetectionId(detectionRecord.detection_id)
    setSelectedTrackId(detectionRecord.contributes_to_track_id)
  }

  function selectTrack(trackId: string) {
    setSelectedTrackId(trackId)
    setSelectedDetectionId(null)
  }

  function startDemo() {
    setDemoStepIndex(0)
  }

  function nextDemoStep() {
    setDemoStepIndex((currentIndex) => {
      if (currentIndex === null) {
        return 0
      }

      return Math.min(currentIndex + 1, activeDemoSteps.length - 1)
    })
  }

  function resetDemo() {
    setDemoStepIndex(null)
  }

  function toggleLayer(layer: LayerKey) {
    setVisibleLayers((currentLayers) => ({
      ...currentLayers,
      [layer]: !currentLayers[layer],
    }))
  }

  return (
    <main className="app-shell">
      <header className="top-header">
        <div className="brand-block">
          <span className="product-mark">SM</span>
          <div>
            <strong>SmokenMirrorsOS</strong>
            <span>Operation Shieldwall</span>
          </div>
          <em>Live</em>
        </div>
        <div className="ops-readouts" aria-label="Mission status readouts">
          <span>UTC <strong>{formatTimestamp(selectedTrack.last_seen)}</strong></span>
          <span>Mission <strong>{selectedTrack.mission_area.replace('MissionArea-', '')}</strong></span>
          <span>Conditions <strong>Clear</strong></span>
          <span>Wind <strong>6 km/h NW</strong></span>
        </div>
        <div className="header-controls">
          <div className="system-pips" aria-label="System health">
            {['Link', 'Sensors', 'Comms', 'GPS'].map((status) => (
              <span key={status}><i aria-hidden="true" />{status}</span>
            ))}
          </div>
          <div className="source-controls" aria-label="Data source controls">
            <button
              className={dataMode === 'local' ? 'is-selected' : ''}
              type="button"
              onClick={() => {
                setDataMode('local')
                setSelectedDetectionId(null)
              }}
            >
              Local Mock
            </button>
            <button
              className={dataMode === 'palantirSnapshot' ? 'is-selected' : ''}
              type="button"
              onClick={() => {
                setDataMode('palantirSnapshot')
                setSelectedDetectionId(null)
              }}
            >
              Palantir Snapshot
            </button>
            <button
              className={dataMode === 'palantirMission' ? 'is-selected is-mission' : ''}
              type="button"
              onClick={() => {
                setDataMode('palantirMission')
                setSelectedDetectionId(null)
              }}
            >
              Mission Data
            </button>
          </div>
          <button className="systems-button" type="button">Systems</button>
          <div className="header-status">
            <span>{usingFallbackData ? `Fallback / ${modeStatusText}` : modeStatusText}</span>
            <strong>
              {dataMode === 'palantirMission'
                ? 'Queryable on branch / merge to Main not required'
                : selectedDetection
                  ? selectedDetection.detection_id
                  : selectedTrack.track_id}
            </strong>
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        <LeftTrackRail
          dataMode={dataMode}
          demoStep={currentDemoStep}
          detections={activeDetections}
          eventFilter={eventFilter}
          queueQuery={queueQuery}
          selectedTrack={selectedTrack}
          selectedDetectionId={selectedDetectionId}
          selectedTrackId={selectedTrack.track_id}
          tracks={activeFusedTracks}
          usingFallbackData={usingFallbackData}
          onFilterChange={setEventFilter}
          onNextDemoStep={nextDemoStep}
          onQueryChange={setQueueQuery}
          onResetDemo={resetDemo}
          onSelectDetection={selectDetection}
          onSelectTrack={selectTrack}
          onStartDemo={startDemo}
        />
        <MissionMap
          mapData={mapData}
          readyStatus={currentDemoStep?.mapStatus ?? mapReadyStatus}
          selectedTrack={selectedTrack}
          visibleLayers={visibleLayers}
          onLayerToggle={toggleLayer}
          onSelectDetectionId={setSelectedDetectionId}
          onSelectTrackId={setSelectedTrackId}
        />
        <RightWorkflowRail
          actions={operatorActions}
          demoStep={currentDemoStep}
          detections={activeDetections}
          selectedTrack={selectedTrack}
          onCreateAction={createOperatorAction}
        />
      </div>
    </main>
  )
}

export default App
