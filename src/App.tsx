import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import { ontologySnapshotToUi } from './lib/dashboard/adapters/ontologyToUi'
import { simulationToUi } from './lib/dashboard/adapters/simulationToUi'
import { createScenarioEngine, type ScenarioEngine } from './lib/sim/scenarioEngine'
import { scenarioOptions } from './lib/sim/scenarioDefinitions'
import type {
  Detection,
  FusedTrack,
  GeoJsonCollection,
  GeoJsonFeature,
  OperatorAction,
  Platform,
  ProtectedAsset,
  ProtectedZone,
  ScenarioBriefing,
  Sensor,
} from './lib/types/mission'
import type { SimulationScenarioKey } from './lib/types/simulation'
import {
  palantirMissionDetections,
  palantirMissionFusedTracks,
  palantirMissionMetadata,
  palantirMissionOperatorActions,
} from './data/palantirMissionSnapshot'
import { palantirPlatforms, palantirSensors, palantirSnapshotMetadata } from './data/palantirSnapshot'

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
type SimulationSpeed = 1 | 2 | 5

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
  sensorCoverage: GeoJsonCollection
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
  priorityRank: number
  severity: string
  classification: string
  movementState: MovementState
  rangeLabel: string
  bearingLabel: string
  etaLabel: string
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

type MovementState = 'Inbound' | 'Outbound' | 'Loitering' | 'Crossing'

type ThreatSnapshot = {
  classification: string
  movementState: MovementState
  rangeLabel: string
  bearingLabel: string
  rangeBearingLabel: string
  headingLabel: string
  speedLabel: string
  etaLabel: string
  protectedAssetLabel: string
  recommendedAction: string
}

type OperatorFeedItem = {
  id: string
  timestamp: string
  title: string
  detail: string
  type: string
}

const dataModeLabels: Record<DataMode, string> = {
  local: 'Local Live Demo Ontology Simulation',
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
  rawDetections: false,
  fusedTracks: true,
  protectedZones: true,
  probablePath: true,
  trackHistory: false,
}

const emptyProtectedAssets: ProtectedAsset[] = []
const emptyProtectedZones: ProtectedZone[] = []

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
    recommended_next_action: 'Slew EO/IR to projected intercept.',
    explanation:
      'Four detections agree on a low-altitude UAV moving northeast inside the protected waterfront zone.',
    classification: 'Probable UAV',
    heading_deg: 58,
    speed_mps: 15.4,
    distance_to_asset_m: 1180,
    eta_seconds_to_asset: 190,
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
  { action_type: 'slew_eoir', label: 'Slew EO/IR' },
  { action_type: 'notify_response', label: 'Notify Team' },
  { action_type: 'monitor', label: 'Monitor' },
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
  'sensor-coverage-source',
  'bearing-lines-source',
  'bearing-cones-source',
  'platforms-source',
  'sensors-source',
  'detections-source',
  'fused-tracks-source',
]

const layerGroups: Record<LayerKey, string[]> = {
  sensors: [
    'sensor-coverage-fill',
    'sensor-coverage-line',
    'bearing-cones-fill',
    'bearing-cones-line',
    'bearing-lines',
    'platforms',
    'sensors',
    'sensor-labels',
  ],
  rawDetections: ['detections-halo', 'detections'],
  fusedTracks: ['fused-track-ring', 'fused-track-core', 'fused-track-label'],
  protectedZones: [
    'mission-zone-fill',
    'mission-zone-outline',
    'restricted-zone-fill',
    'restricted-zone-outline',
    'restricted-zone-hatch',
    'mission-label',
    'asset-points',
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

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `T+${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
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

function freshnessLabel(timestamp: string, referenceTimestamp?: string) {
  const value = timestampValue(timestamp)

  if (!value) {
    return formatTimestamp(timestamp)
  }

  const latestReference = referenceTimestamp ? timestampValue(referenceTimestamp) : Date.parse('2026-05-02T17:43:30.000Z')
  const deltaSeconds = Math.max(0, Math.round((latestReference - value) / 1000))

  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`
  }

  return `${Math.round(deltaSeconds / 60)}m ago`
}

function custodyClass(status: string) {
  return status.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function formatDistanceMeters(distanceM?: number) {
  if (typeof distanceM !== 'number' || !Number.isFinite(distanceM)) {
    return 'Unknown'
  }

  if (distanceM >= 1000) {
    return `${(distanceM / 1000).toFixed(distanceM >= 10000 ? 0 : 1)} km`
  }

  return `${Math.round(distanceM)} m`
}

function formatBearingLabel(bearingDeg?: number) {
  if (typeof bearingDeg !== 'number' || !Number.isFinite(bearingDeg)) {
    return 'Unknown'
  }

  return `${Math.round(((bearingDeg % 360) + 360) % 360).toString().padStart(3, '0')} deg`
}

function formatHeadingLabel(headingDeg?: number) {
  return formatBearingLabel(headingDeg)
}

function formatSpeed(speedMps?: number) {
  if (typeof speedMps !== 'number' || !Number.isFinite(speedMps)) {
    return 'Unknown'
  }

  return `${speedMps.toFixed(speedMps >= 10 ? 1 : 1)} m/s`
}

function formatEtaSeconds(etaSeconds: number | undefined, movementState: MovementState) {
  if (movementState === 'Loitering') {
    return 'loitering'
  }

  if (typeof etaSeconds !== 'number' || !Number.isFinite(etaSeconds)) {
    return movementState === 'Inbound' ? 'calculating' : 'no closure'
  }

  const minutes = Math.floor(etaSeconds / 60)
  const seconds = Math.max(0, Math.round(etaSeconds % 60))

  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  }

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

function distanceBetweenMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const radiusM = 6378137
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180
  const deltaLon = ((b.lon - a.lon) * Math.PI) / 180
  const hav =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)

  return radiusM * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav))
}

function bearingBetweenPoints(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180
  const deltaLon = ((to.lon - from.lon) * Math.PI) / 180
  const y = Math.sin(deltaLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)

  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

function nearestProtectedAsset(track: FusedTrack, protectedAssets: ProtectedAsset[]) {
  if (!protectedAssets.length) {
    return null
  }

  const trackPoint = { lat: track.estimated_lat, lon: track.estimated_lon }

  return protectedAssets
    .map((asset) => ({
      asset,
      distanceM: distanceBetweenMeters({ lat: asset.lat, lon: asset.lon }, trackPoint),
      bearingDeg: bearingBetweenPoints({ lat: asset.lat, lon: asset.lon }, trackPoint),
    }))
    .sort((a, b) => {
      const priorityWeight = { critical: 0, high: 1, standard: 2 }
      return priorityWeight[a.asset.priority] - priorityWeight[b.asset.priority] || a.distanceM - b.distanceM
    })[0]
}

function latestTrackDetection(track: FusedTrack, records: Detection[]) {
  return [...records]
    .filter((detection) => detection.contributes_to_track_id === track.track_id)
    .sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp))[0]
}

function inferMovementState(track: FusedTrack, protectedAssets: ProtectedAsset[]): MovementState {
  if ((track.classification ?? '').toLowerCase().includes('loiter') || (track.speed_mps ?? 0) > 0 && (track.speed_mps ?? 0) < 2.2) {
    return 'Loitering'
  }

  if (typeof track.eta_seconds_to_asset === 'number' && Number.isFinite(track.eta_seconds_to_asset)) {
    return 'Inbound'
  }

  const assetAtRisk = nearestProtectedAsset(track, protectedAssets)

  if (!assetAtRisk || typeof track.heading_deg !== 'number' || typeof track.speed_mps !== 'number') {
    if ((track.classification ?? '').toLowerCase().includes('outbound')) {
      return 'Outbound'
    }

    return 'Crossing'
  }

  const currentDistance = track.distance_to_asset_m ?? assetAtRisk.distanceM
  const projected = destinationPoint(track.estimated_lat, track.estimated_lon, track.heading_deg, Math.max(track.speed_mps, 0) * 45)
  const projectedDistance = distanceBetweenMeters(
    { lat: assetAtRisk.asset.lat, lon: assetAtRisk.asset.lon },
    { lat: projected[1], lon: projected[0] },
  )

  if (projectedDistance < currentDistance - 35) {
    return 'Inbound'
  }

  if (projectedDistance > currentDistance + 35) {
    return 'Outbound'
  }

  return 'Crossing'
}

function recommendedActionForTrack(track: FusedTrack, movementState: MovementState, sourceTypes: string[]) {
  const custody = track.custody_status.toLowerCase()
  const hasVisual = sourceTypes.some((source) => modalityGroup(source) === 'EO' || source.toUpperCase().includes('IR'))

  if (custody.includes('lost') || custody.includes('reacquiring') || custody.includes('eo lost')) {
    return 'Reacquire track'
  }

  if (movementState === 'Inbound' && !hasVisual) {
    return 'Slew EO/IR to projected intercept'
  }

  if (track.threat_score >= 70) {
    return 'Notify response team'
  }

  if (track.threat_score < 35) {
    return 'Continue monitor'
  }

  return track.recommended_next_action.replace(/\.$/, '')
}

function buildThreatSnapshot(track: FusedTrack, records: Detection[], protectedAssets: ProtectedAsset[]): ThreatSnapshot {
  const latestDetection = latestTrackDetection(track, records)
  const assetAtRisk = nearestProtectedAsset(track, protectedAssets)
  const movementState = inferMovementState(track, protectedAssets)
  const rangeM = assetAtRisk ? track.distance_to_asset_m ?? assetAtRisk.distanceM : latestDetection?.range_m
  const bearingDeg = assetAtRisk ? assetAtRisk.bearingDeg : latestDetection?.bearing_deg
  const sourceTypes = sourceTokens(track.source_summary)

  return {
    classification: track.classification ?? latestDetection?.classification ?? 'Fused contact',
    movementState,
    rangeLabel: formatDistanceMeters(rangeM),
    bearingLabel: formatBearingLabel(bearingDeg),
    rangeBearingLabel: `${formatDistanceMeters(rangeM)} / ${formatBearingLabel(bearingDeg)}`,
    headingLabel: formatHeadingLabel(track.heading_deg ?? latestDetection?.bearing_deg),
    speedLabel: formatSpeed(track.speed_mps),
    etaLabel: formatEtaSeconds(track.eta_seconds_to_asset, movementState),
    protectedAssetLabel: assetAtRisk?.asset.label ?? track.mission_area.replace('MissionArea-', '').replace(/-/g, ' '),
    recommendedAction: recommendedActionForTrack(track, movementState, sourceTypes),
  }
}

function strongestDetectionConfidence(records: Detection[], groups: string[]) {
  const matching = records.filter((detection) => groups.includes(modalityGroup(detection.modality)))

  if (!matching.length) {
    return undefined
  }

  return Math.max(...matching.map((detection) => detection.confidence))
}

function explainabilityRows(track: FusedTrack, records: Detection[]) {
  const relatedDetections = records.filter((detection) => detection.contributes_to_track_id === track.track_id)
  const contributionByGroup = new Map<string, { confidence: number; status: string }>()

  track.fusion_contributions?.forEach((contribution) => {
    const group = modalityGroup(contribution.modality)
    const current = contributionByGroup.get(group)

    if (!current || contribution.confidence > current.confidence) {
      contributionByGroup.set(group, {
        confidence: contribution.confidence,
        status: contributionStatusLabel(contribution.status),
      })
    }
  })

  const radarConfidence = contributionByGroup.get('Radar')?.confidence ?? strongestDetectionConfidence(relatedDetections, ['Radar'])
  const passiveConfidence = contributionByGroup.get('Acoustic/RF')?.confidence ?? strongestDetectionConfidence(relatedDetections, ['Acoustic/RF'])
  const visualConfidence = contributionByGroup.get('EO')?.confidence ?? strongestDetectionConfidence(relatedDetections, ['EO'])
  const currentGroups = new Set(relatedDetections.filter((detection) => !detection.is_stale).map((detection) => modalityGroup(detection.modality)))
  const timingAgreement = currentGroups.size >= 2 || track.confidence >= 0.72

  return [
    {
      label: 'Radar detection',
      status: radarConfidence ? contributionByGroup.get('Radar')?.status ?? 'Detected' : 'No current cue',
      confidence: radarConfidence,
      active: Boolean(radarConfidence),
    },
    {
      label: 'RF/acoustic correlation',
      status: passiveConfidence ? contributionByGroup.get('Acoustic/RF')?.status ?? 'Correlated' : 'No current cue',
      confidence: passiveConfidence,
      active: Boolean(passiveConfidence),
    },
    {
      label: 'EO/IR visual confirmation',
      status: visualConfidence ? contributionByGroup.get('EO')?.status ?? 'Visual' : 'Pending visual',
      confidence: visualConfidence,
      active: Boolean(visualConfidence),
    },
    {
      label: 'Timing/bearing agreement',
      status: timingAgreement ? 'Aligned' : 'Weak agreement',
      confidence: timingAgreement ? track.confidence : undefined,
      active: timingAgreement,
    },
  ]
}

function decisionFeedItems({
  actions,
  latestDetection,
  selectedTrack,
  snapshot,
}: {
  actions: OperatorAction[]
  latestDetection?: Detection
  selectedTrack: FusedTrack
  snapshot: ThreatSnapshot
}) {
  const decisionActionTypes = new Set([
    'threat_increased',
    'custody_changed',
    'reacquired',
    'entered_protected_zone',
    'confidence_increased',
    'recommended_action_updated',
    'response_dispatched',
    'dispatch',
    'notify_response',
    'slew_eoir',
    'reacquire',
    'sensor_drop',
    'eo_camera_tasked',
    'task_eo',
  ])
  const feed: OperatorFeedItem[] = actions
    .filter((action) => action.track_id === selectedTrack.track_id && decisionActionTypes.has(action.action_type))
    .map((action) => ({
      id: action.action_id,
      timestamp: action.timestamp,
      title: action.label,
      detail: action.resulting_status ?? action.notes ?? action.action_type.replace(/_/g, ' '),
      type: action.action_type,
    }))

  if (selectedTrack.threat_score >= 70) {
    feed.push({
      id: `${selectedTrack.track_id}-high-threat`,
      timestamp: selectedTrack.last_seen,
      title: 'New high threat',
      detail: `${selectedTrack.track_id} ranked ${riskLabel(selectedTrack.threat_score)} near ${snapshot.protectedAssetLabel}`,
      type: 'threat_increased',
    })
  }

  if (selectedTrack.custody_status === 'Lost' || selectedTrack.custody_status === 'Reacquiring') {
    feed.push({
      id: `${selectedTrack.track_id}-custody`,
      timestamp: selectedTrack.last_seen,
      title: 'Custody lost',
      detail: `${selectedTrack.custody_status}; ${snapshot.recommendedAction}`,
      type: 'custody_changed',
    })
  }

  if (selectedTrack.confidence >= 0.75) {
    feed.push({
      id: `${selectedTrack.track_id}-confidence`,
      timestamp: latestDetection?.timestamp ?? selectedTrack.last_seen,
      title: 'Confidence crossed threshold',
      detail: `${formatConfidence(selectedTrack.confidence)} from ${selectedTrack.source_summary}`,
      type: 'confidence_increased',
    })
  }

  feed.push({
    id: `${selectedTrack.track_id}-recommendation`,
    timestamp: selectedTrack.updated_at ?? selectedTrack.last_seen,
    title: 'Recommended action changed',
    detail: snapshot.recommendedAction,
    type: 'recommended_action_updated',
  })

  return feed
    .sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 6)
}

function contributionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pending',
    tentative: 'Tentative',
    correlated: 'Correlated',
    confirmed: 'Confirmed',
    visual: 'Visual',
    stale: 'Stale',
    lost: 'Lost',
    reacquiring: 'Reacquiring',
  }

  return labels[status] ?? status
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

  if (!demoStep) {
    return 'Active'
  }

  return 'Supporting'
}

function isDetectionStale(demoStep: DemoStep | null, detection: Detection) {
  return Boolean(detection.is_stale || demoStep?.staleDetectionIds.includes(detection.detection_id))
}

function isDetectionActive(demoStep: DemoStep | null, detection: Detection) {
  if (!demoStep) {
    return !detection.is_stale
  }

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

function buildCircle(lat: number, lon: number, radiusM: number, steps = 64) {
  const coordinates: [number, number][] = []

  for (let index = 0; index <= steps; index += 1) {
    coordinates.push(destinationPoint(lat, lon, (index / steps) * 360, radiusM))
  }

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
    if (typeof detection.estimated_lat === 'number' && typeof detection.estimated_lon === 'number') {
      coordinates.set(detection.detection_id, [detection.estimated_lon, detection.estimated_lat])
      return
    }

    const alongTrack = destinationPoint(start[1], start[0], 55, stepDistance * index)
    const lateralOffset = ((index % 3) - 1) * 44 + (modalityGroup(detection.modality) === 'Radar' ? -18 : 18)
    const point = destinationPoint(alongTrack[1], alongTrack[0], 145, lateralOffset)
    coordinates.set(detection.detection_id, point)
  })

  return coordinates
}

function closePolygon(coordinates: [number, number][]) {
  const first = coordinates[0]
  const last = coordinates[coordinates.length - 1]

  if (!first || !last) {
    return coordinates
  }

  if (first[0] === last[0] && first[1] === last[1]) {
    return coordinates
  }

  return [...coordinates, first]
}

function polygonBounds(coordinates: [number, number][]) {
  return coordinates.reduce(
    (bounds, coordinate) => ({
      minLon: Math.min(bounds.minLon, coordinate[0]),
      maxLon: Math.max(bounds.maxLon, coordinate[0]),
      minLat: Math.min(bounds.minLat, coordinate[1]),
      maxLat: Math.max(bounds.maxLat, coordinate[1]),
    }),
    {
      minLon: coordinates[0]?.[0] ?? 0,
      maxLon: coordinates[0]?.[0] ?? 0,
      minLat: coordinates[0]?.[1] ?? 0,
      maxLat: coordinates[0]?.[1] ?? 0,
    },
  )
}

function polygonLabelPoint(coordinates: [number, number][]): [number, number] {
  const bounds = polygonBounds(coordinates)
  return [(bounds.minLon + bounds.maxLon) / 2, (bounds.minLat + bounds.maxLat) / 2]
}

function isRecentlySeen(timestamp: string, referenceTimestamp: string, seconds: number) {
  const referenceValue = timestampValue(referenceTimestamp)
  const timestampMs = timestampValue(timestamp)

  if (!referenceValue || !timestampMs) {
    return true
  }

  return referenceValue - timestampMs <= seconds * 1000
}

function buildMapData({
  activePlatforms,
  activeSensors,
  allTracks,
  detections: records,
  demoStep,
  protectedAssets = [],
  protectedZones = [],
  selectedDetectionId,
  selectedTrack,
}: {
  activePlatforms: Platform[]
  activeSensors: Sensor[]
  allTracks: FusedTrack[]
  detections: Detection[]
  demoStep: DemoStep | null
  protectedAssets?: ProtectedAsset[]
  protectedZones?: ProtectedZone[]
  selectedDetectionId: string | null
  selectedTrack: FusedTrack
}): MapData {
  const selectedTrackRecords = records.filter((detection) => detection.contributes_to_track_id === selectedTrack.track_id)
  const selectedSensorIds = new Set([
    ...selectedTrackRecords.map((detection) => detection.sensor_id),
    ...(selectedTrack.fusion_contributions?.map((contribution) => contribution.sensor_id) ?? []),
  ])
  const relatedSensorIds = new Set([...records.map((detection) => detection.sensor_id), ...selectedSensorIds])
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
  const latestTimestamp =
    [...records.map((detection) => detection.timestamp), selectedTrack.last_seen].sort((a, b) => timestampValue(b) - timestampValue(a))[0] ??
    selectedTrack.last_seen
  const trackCoordinate: [number, number] = [selectedTrack.estimated_lon, selectedTrack.estimated_lat]
  const contributionStatusBySensor = new Map(
    selectedTrack.fusion_contributions?.map((contribution) => [contribution.sensor_id, contribution.status]) ?? [],
  )
  const missionZoneRecord = protectedZones.find((zone) => zone.kind === 'mission')
  const restrictedZoneRecord = protectedZones.find((zone) => zone.kind === 'restricted') ?? protectedZones.find((zone) => zone.kind === 'asset_buffer')
  const zoneCoordinates: [number, number][] = missionZoneRecord
    ? closePolygon(missionZoneRecord.coordinates.map((coordinate) => [coordinate.lon, coordinate.lat]))
    : [
        offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, -1600, -980),
        offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 1750, -780),
        offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 2150, 940),
        offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, -1350, 1180),
        offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, -1600, -980),
      ]
  const detectionHistoryCoordinates = selectedTrackRecords
    .sort((a, b) => timestampValue(a.timestamp) - timestampValue(b.timestamp))
    .map((detection) => detectionCoordinates.get(detection.detection_id))
    .filter((coordinate): coordinate is [number, number] => Boolean(coordinate))
  const trackHistoryCoordinates =
    selectedTrack.track_history?.map((point) => [point.lon, point.lat] as [number, number]).filter(Boolean) ?? []
  const sortedCoordinates = trackHistoryCoordinates.length > 0 ? trackHistoryCoordinates : detectionHistoryCoordinates
  const historyCoordinates = [...sortedCoordinates, trackCoordinate]
  const probablePathCoordinates =
    selectedTrack.probable_path && selectedTrack.probable_path.length > 0
      ? [trackCoordinate, ...selectedTrack.probable_path.map((point) => [point.lon, point.lat] as [number, number])]
      : [
          sortedCoordinates[0] ?? destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 235, 700),
          trackCoordinate,
          destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, selectedTrack.heading_deg ?? 55, 920),
        ]
  const restrictedZoneCoordinates: [number, number][] = restrictedZoneRecord
    ? closePolygon(restrictedZoneRecord.coordinates.map((coordinate) => [coordinate.lon, coordinate.lat]))
    : [
        destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 42, 410),
        destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 72, 890),
        destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 118, 760),
        destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 163, 360),
        destinationPoint(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 42, 410),
      ]
  const restrictedBounds = polygonBounds(restrictedZoneCoordinates)
  const restrictedHatchFeatures: GeoJsonFeature[] = [0, 1, 2, 3, 4].map((index) => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [
          restrictedBounds.minLon + (restrictedBounds.maxLon - restrictedBounds.minLon) * (index / 5),
          restrictedBounds.minLat,
        ],
        [
          restrictedBounds.minLon + (restrictedBounds.maxLon - restrictedBounds.minLon) * ((index + 1) / 5),
          restrictedBounds.maxLat,
        ],
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
          id: missionZoneRecord?.zone_id ?? selectedTrack.mission_area,
          label: missionZoneRecord?.label ?? selectedTrack.mission_area,
          tooltip: `${missionZoneRecord?.label ?? selectedTrack.mission_area} protected zone`,
        },
      },
    ],
  }
  const missionLabel: GeoJsonCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: polygonLabelPoint(zoneCoordinates) },
        properties: {
          label: missionZoneRecord?.label ?? selectedTrack.mission_area,
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
          id: restrictedZoneRecord?.zone_id ?? `${selectedTrack.track_id}-threat-zone`,
          label: restrictedZoneRecord?.label ?? 'Restricted Review Zone',
          tooltip: restrictedZoneRecord?.label ?? `Threat zone projected from ${selectedTrack.track_id}`,
        },
      },
    ],
  }
  const assetLabels: GeoJsonCollection = {
    type: 'FeatureCollection',
    features:
      protectedAssets.length > 0
        ? protectedAssets.map((asset) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [asset.lon, asset.lat] },
            properties: {
              label: asset.label,
              priority: asset.priority,
            },
          }))
        : [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, -520, -620) },
              properties: {
                label: 'Protected Waterfront',
                priority: 'critical',
              },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: offsetMeters(selectedTrack.estimated_lat, selectedTrack.estimated_lon, 940, 360) },
              properties: {
                label: 'Probable Intercept',
                priority: 'high',
              },
            },
          ],
  }
  const mapCenter =
    protectedAssets[0]
      ? ([protectedAssets[0].lon, protectedAssets[0].lat] as [number, number])
      : missionZoneRecord
        ? polygonLabelPoint(zoneCoordinates)
        : trackCoordinate
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
        trackSelected: detection.contributes_to_track_id === selectedTrack.track_id,
        active: isDetectionActive(demoStep, detection),
        stale: isDetectionStale(demoStep, detection),
        contributionStatus: contributionStatusBySensor.get(detection.sensor_id) ?? status.toLowerCase(),
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
      relevant: displaySensors.some((sensor) => sensor.platform_id === platform.platform_id && selectedSensorIds.has(sensor.sensor_id)),
      tooltip: `${platform.callsign} | ${platform.platform_type} | ${platform.platform_id}`,
    },
  }))
  const sensorFeatures: GeoJsonFeature[] = displaySensors.flatMap((sensor) => {
      const platform = getPlatform(sensor.platform_id, displayPlatforms)

      if (!platform) {
        return []
      }

      const colocatedSensorIndex = displaySensors.filter((candidate) => candidate.platform_id === sensor.platform_id).findIndex((candidate) => candidate.sensor_id === sensor.sensor_id)
      const offset =
        colocatedSensorIndex <= 0
          ? ([platform.lon, platform.lat] as [number, number])
          : destinationPoint(platform.lat, platform.lon, 45 + (colocatedSensorIndex % 6) * 58, 42)

      const feature: GeoJsonFeature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: offset },
        properties: {
          id: sensor.sensor_id,
          platformId: sensor.platform_id,
          modality: modalityShortLabel(sensor.modality),
          modalityGroup: modalityGroup(sensor.modality),
          selected: selectedDetection?.sensor_id === sensor.sensor_id,
          relevant: selectedSensorIds.has(sensor.sensor_id),
          tooltip: `${sensor.sensor_id} | ${modalityShortLabel(sensor.modality)} | ${sensor.measurement_kind}`,
        },
      }

      return [feature]
    })
  const sensorCoverageFeatures: GeoJsonFeature[] = displaySensors.flatMap((sensor) => {
    const platform = getPlatform(sensor.platform_id, displayPlatforms)

    if (!platform) {
      return []
    }

    const normalizedModality = normalizeModality(sensor.modality)
    const maxRange = sensor.range_max_m > 0 ? sensor.range_max_m : normalizedModality.includes('RF') ? 3200 : 1800
    const coverageRange =
      normalizedModality.includes('RADAR') ? Math.min(maxRange, 5600) : normalizedModality.includes('RF') ? Math.min(maxRange, 3600) : Math.min(maxRange, 2400)

    if (coverageRange < 250) {
      return []
    }

    return [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [buildCircle(platform.lat, platform.lon, coverageRange)],
        },
        properties: {
          id: `${sensor.sensor_id}-coverage`,
          sensorId: sensor.sensor_id,
          modalityGroup: modalityGroup(sensor.modality),
          label: `${modalityShortLabel(sensor.modality)} coverage`,
          relevant: selectedSensorIds.has(sensor.sensor_id),
          tooltip: `${sensor.sensor_id} fixed coverage / ${Math.round(coverageRange)} m`,
        },
      },
    ]
  })
  const detailRecords = records.filter(
    (detection) =>
      detection.detection_id === selectedDetectionId ||
      (detection.contributes_to_track_id === selectedTrack.track_id &&
        !isDetectionStale(demoStep, detection) &&
        isRecentlySeen(detection.timestamp, latestTimestamp, 42)) ||
      (!isDetectionStale(demoStep, detection) && isRecentlySeen(detection.timestamp, latestTimestamp, 12) && detection.confidence >= 0.62),
  )
  const bearingLineFeatures: GeoJsonFeature[] = detailRecords.flatMap((detection) => {
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
          trackSelected: detection.contributes_to_track_id === selectedTrack.track_id,
          active: isDetectionActive(demoStep, detection),
          stale: isDetectionStale(demoStep, detection),
          contributionStatus: contributionStatusBySensor.get(detection.sensor_id) ?? 'supporting',
          tooltip: `${detection.sensor_id} bearing to ${detection.detection_id}`,
        },
      }

      return [feature]
    })
  const bearingConeFeatures: GeoJsonFeature[] = detailRecords
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
          trackSelected: detection.contributes_to_track_id === selectedTrack.track_id,
          active: isDetectionActive(demoStep, detection),
          stale: isDetectionStale(demoStep, detection),
          contributionStatus: contributionStatusBySensor.get(detection.sensor_id) ?? 'supporting',
        },
      }

      return [feature]
    })

  return {
    center: mapCenter,
    zoom: protectedAssets.length > 0 ? 12.9 : activePlatforms.length > 3 ? 10.6 : 12.8,
    missionZone,
    missionLabel,
    restrictedZone,
    restrictedHatch: { type: 'FeatureCollection', features: restrictedHatchFeatures },
    assetLabels,
    probablePath,
    trackHistoryLine,
    trackHistoryPoints,
    sensorCoverage: { type: 'FeatureCollection', features: sensorCoverageFeatures },
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
    id: 'asset-points',
    type: 'circle',
    source: 'asset-labels-source',
    paint: {
      'circle-radius': [
        'match',
        ['get', 'priority'],
        'critical',
        8,
        'high',
        6.5,
        5.5,
      ],
      'circle-color': '#d7f4ff',
      'circle-opacity': 0.92,
      'circle-stroke-color': '#2aa7d8',
      'circle-stroke-opacity': 0.9,
      'circle-stroke-width': 2,
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
    id: 'sensor-coverage-fill',
    type: 'fill',
    source: 'sensor-coverage-source',
    paint: {
      'fill-color': [
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
      'fill-opacity': [
        'case',
        ['boolean', ['get', 'relevant'], false],
        [
          'match',
          ['get', 'modalityGroup'],
          'Radar',
          0.026,
          'Acoustic/RF',
          0.02,
          'EO',
          0.018,
          0.014,
        ],
        0.004,
      ],
    },
  })
  map.addLayer({
    id: 'sensor-coverage-line',
    type: 'line',
    source: 'sensor-coverage-source',
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
        ['boolean', ['get', 'relevant'], false],
        [
          'match',
          ['get', 'modalityGroup'],
          'Radar',
          0.28,
          'Acoustic/RF',
          0.2,
          'EO',
          0.18,
          0.14,
        ],
        0.035,
      ],
      'line-width': 1,
      'line-dasharray': [2, 3],
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
      'fill-opacity': [
        'case',
        ['boolean', ['get', 'selected'], false],
        0.2,
        ['in', ['get', 'contributionStatus'], ['literal', ['stale', 'lost', 'pending']]],
        ['case', ['boolean', ['get', 'trackSelected'], false], 0.045, 0.025],
        ['==', ['get', 'contributionStatus'], 'reacquiring'],
        ['case', ['boolean', ['get', 'trackSelected'], false], 0.14, 0.07],
        ['boolean', ['get', 'trackSelected'], false],
        0.095,
        0.035,
      ],
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
      'line-opacity': [
        'case',
        ['boolean', ['get', 'selected'], false],
        0.62,
        ['in', ['get', 'contributionStatus'], ['literal', ['stale', 'lost', 'pending']]],
        ['case', ['boolean', ['get', 'trackSelected'], false], 0.16, 0.08],
        ['==', ['get', 'contributionStatus'], 'reacquiring'],
        ['case', ['boolean', ['get', 'trackSelected'], false], 0.48, 0.22],
        ['boolean', ['get', 'trackSelected'], false],
        0.34,
        0.14,
      ],
      'line-width': [
        'case',
        ['boolean', ['get', 'selected'], false],
        2,
        ['==', ['get', 'contributionStatus'], 'reacquiring'],
        1.8,
        ['boolean', ['get', 'trackSelected'], false],
        1.2,
        0.85,
      ],
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
        ['in', ['get', 'contributionStatus'], ['literal', ['stale', 'lost', 'pending']]],
        ['case', ['boolean', ['get', 'trackSelected'], false], 0.18, 0.08],
        ['==', ['get', 'contributionStatus'], 'reacquiring'],
        ['case', ['boolean', ['get', 'trackSelected'], false], 0.58, 0.28],
        ['all', ['boolean', ['get', 'active'], false], ['boolean', ['get', 'trackSelected'], false]],
        0.42,
        ['boolean', ['get', 'active'], false],
        0.18,
        ['boolean', ['get', 'trackSelected'], false],
        0.28,
        0.12,
      ],
      'line-width': [
        'case',
        ['boolean', ['get', 'selected'], false],
        2.2,
        ['==', ['get', 'contributionStatus'], 'reacquiring'],
        1.8,
        ['boolean', ['get', 'trackSelected'], false],
        1.15,
        0.8,
      ],
    },
  })
  map.addLayer({
    id: 'platforms',
    type: 'circle',
    source: 'platforms-source',
    paint: {
      'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 5.5, ['boolean', ['get', 'relevant'], false], 4.2, 2.7],
      'circle-color': '#8fa4b8',
      'circle-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.72, ['boolean', ['get', 'relevant'], false], 0.42, 0.12],
      'circle-stroke-color': '#e7eef5',
      'circle-stroke-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.45, ['boolean', ['get', 'relevant'], false], 0.22, 0.08],
      'circle-stroke-width': 1,
    },
  })
  map.addLayer({
    id: 'sensors',
    type: 'circle',
    source: 'sensors-source',
    paint: {
      'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 6.2, ['boolean', ['get', 'relevant'], false], 4.6, 2.8],
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
      'circle-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.95, ['boolean', ['get', 'relevant'], false], 0.62, 0.16],
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
        ['all', ['boolean', ['get', 'active'], false], ['boolean', ['get', 'trackSelected'], false]],
        7.4,
        ['boolean', ['get', 'active'], false],
        5.5,
        4.2,
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
        ['all', ['boolean', ['get', 'active'], false], ['boolean', ['get', 'trackSelected'], false]],
        0.09,
        ['boolean', ['get', 'stale'], false],
        0.025,
        ['boolean', ['get', 'active'], false],
        0.04,
        0.025,
      ],
    },
  })
  map.addLayer({
    id: 'detections',
    type: 'circle',
    source: 'detections-source',
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['get', 'selected'], false],
        5.5,
        ['all', ['boolean', ['get', 'active'], false], ['boolean', ['get', 'trackSelected'], false]],
        4.5,
        ['boolean', ['get', 'active'], false],
        3.4,
        2.8,
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
        0.95,
        ['boolean', ['get', 'stale'], false],
        ['case', ['boolean', ['get', 'trackSelected'], false], 0.22, 0.12],
        ['==', ['get', 'contributionStatus'], 'pending'],
        ['case', ['boolean', ['get', 'trackSelected'], false], 0.3, 0.16],
        ['==', ['get', 'contributionStatus'], 'reacquiring'],
        ['case', ['boolean', ['get', 'trackSelected'], false], 0.78, 0.36],
        ['all', ['boolean', ['get', 'active'], false], ['boolean', ['get', 'trackSelected'], false]],
        0.56,
        ['boolean', ['get', 'active'], false],
        0.28,
        ['boolean', ['get', 'trackSelected'], false],
        0.42,
        0.18,
      ],
      'circle-stroke-color': ['case', ['boolean', ['get', 'selected'], false], '#ffffff', '#06101b'],
      'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 2, ['boolean', ['get', 'trackSelected'], false], 1.2, 0.8],
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
      'circle-stroke-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.95, 0.08],
      'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 4.5, 1.4],
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
      'circle-opacity': ['case', ['boolean', ['get', 'selected'], false], 1, 0.2],
      'circle-stroke-opacity': ['case', ['boolean', ['get', 'selected'], false], 1, 0.16],
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
      'text-opacity': ['case', ['boolean', ['get', 'selected'], false], 1, 0.18],
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
    'sensor-coverage-source': data.sensorCoverage,
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
  protectedAssets,
  tracks,
}: {
  detections: Detection[]
  protectedAssets: ProtectedAsset[]
  tracks: FusedTrack[]
}) {
  const referenceTimestamp =
    [...tracks.map((track) => track.last_seen), ...records.map((detection) => detection.timestamp)]
      .sort((a, b) => timestampValue(b) - timestampValue(a))[0] ?? '2026-05-02T17:43:30.000Z'
  const items: TrackQueueItem[] = tracks.map((track) => {
    const relatedDetections = records.filter((detection) => detection.contributes_to_track_id === track.track_id)
    const sourceTypes = sourceTokens(track.source_summary)
    const snapshot = buildThreatSnapshot(track, relatedDetections, protectedAssets)

    return {
      id: track.track_id,
      kind: 'track',
      label: 'Fused track',
      priorityRank: 0,
      severity: riskLabel(track.threat_score),
      classification: snapshot.classification,
      movementState: snapshot.movementState,
      rangeLabel: snapshot.rangeLabel,
      bearingLabel: snapshot.bearingLabel,
      etaLabel: snapshot.etaLabel,
      confidence: track.confidence,
      threatScore: track.threat_score,
      custodyStatus: track.custody_status,
      sourceSummary: track.source_summary,
      sourceTypes,
      lastSeen: track.last_seen,
      freshness: freshnessLabel(track.last_seen, referenceTimestamp),
      status: track.custody_status,
      trackId: track.track_id,
      track,
    }
  })

  return items.sort((a, b) => {
    const aRisk = riskPriority(a.threatScore)
    const bRisk = riskPriority(b.threatScore)

    return (
      bRisk - aRisk ||
      b.threatScore - a.threatScore ||
      b.confidence - a.confidence ||
      timestampValue(b.lastSeen) - timestampValue(a.lastSeen) ||
      (b.kind === 'track' ? 1 : 0) - (a.kind === 'track' ? 1 : 0)
    )
  }).map((item, index) => ({ ...item, priorityRank: index + 1 }))
}

function riskPriority(score: number) {
  if (score >= 70) {
    return 4
  }

  if (score >= 55) {
    return 3
  }

  if (score >= 35) {
    return 2
  }

  return 1
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

    return [item.id, item.trackId, item.classification, item.sourceSummary, item.custodyStatus, item.movementState, item.severity]
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
  const symbol = String(item.priorityRank)

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
      <span className="queue-rank" aria-label={`Priority ${item.priorityRank}`}>{symbol}</span>
      <span className="queue-meta">
        <span>{item.severity}</span>
        <strong>{item.id}</strong>
      </span>
      <span className={`risk-badge risk-${riskLevel(item.threatScore)}`}>{riskLabel(item.threatScore)}</span>
      <strong className="queue-title">{item.classification}</strong>
      <span className="queue-status">{item.movementState}</span>
      <span className="queue-freshness">{item.freshness}</span>
      <dl className="queue-metrics">
        <div>
          <dt>Range</dt>
          <dd>{item.rangeLabel}</dd>
        </div>
        <div>
          <dt>ETA</dt>
          <dd>{item.etaLabel}</dd>
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
  protectedAssets,
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
  protectedAssets: ProtectedAsset[]
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
    () => buildTrackQueueItems({ detections: records, protectedAssets, tracks }),
    [protectedAssets, records, tracks],
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
    { className: 'probable', label: 'Probable Path', detail: 'projected vector' },
    { className: 'mission', label: 'Mission Area', detail: 'protected zone' },
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
  briefing,
  mapData,
  readyStatus,
  selectedTrack,
  visibleLayers,
  onLayerToggle,
  onSelectDetectionId,
  onSelectTrackId,
}: {
  briefing: ScenarioBriefing
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

        <section className="scenario-briefing-chip" aria-label="Scenario briefing">
          <div>
            <span>{briefing.scenario_name}</span>
            <strong>{briefing.phase_label}</strong>
            <p>{briefing.phase_description}</p>
          </div>
          <dl>
            <div>
              <dt>Time</dt>
              <dd>{formatElapsed(briefing.elapsed_seconds)}</dd>
            </div>
            <div>
              <dt>Tracks</dt>
              <dd>{briefing.active_tracks}</dd>
            </div>
            <div>
              <dt>High</dt>
              <dd>{briefing.highest_threat}</dd>
            </div>
          </dl>
          {briefing.next_event ? <em>{briefing.next_event}</em> : null}
        </section>

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
  protectedAssets,
  selectedTrack,
  onCreateAction,
}: {
  actions: OperatorAction[]
  demoStep: DemoStep | null
  detections: Detection[]
  protectedAssets: ProtectedAsset[]
  selectedTrack: FusedTrack
  onCreateAction: (actionType: string, label: string) => void
}) {
  const relatedDetections = records.filter((detection) => detection.contributes_to_track_id === selectedTrack.track_id)
  const latestDetection = [...relatedDetections].sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp))[0]
  const threatSnapshot = buildThreatSnapshot(selectedTrack, relatedDetections, protectedAssets)
  const commandRows = [
    { label: 'Track ID', value: selectedTrack.track_id },
    { label: 'Severity', value: riskLabel(selectedTrack.threat_score) },
    { label: 'Classification', value: threatSnapshot.classification },
    { label: 'Custody', value: selectedTrack.custody_status },
    { label: 'Confidence', value: formatConfidence(selectedTrack.confidence) },
    { label: 'Range / bearing', value: threatSnapshot.rangeBearingLabel },
    { label: 'Heading / movement', value: `${threatSnapshot.headingLabel} / ${threatSnapshot.movementState}` },
    { label: 'Speed', value: threatSnapshot.speedLabel },
    { label: 'ETA to zone', value: threatSnapshot.etaLabel },
    { label: 'Asset at risk', value: threatSnapshot.protectedAssetLabel },
  ]
  const evidenceItems =
    selectedTrack.evidence && selectedTrack.evidence.length > 0
      ? selectedTrack.evidence.slice(-4).map((artifact) => ({
          id: artifact.artifact_id,
          modality: artifact.modality,
          label: modalityShortLabel(artifact.modality),
          confidence: artifact.confidence,
          timestamp: artifact.timestamp,
          isNew: artifact.is_new,
        }))
      : relatedDetections.slice(-4).map((detection) => ({
          id: detection.detection_id,
          modality: detection.modality,
          label: modalityShortLabel(detection.modality),
          confidence: detection.confidence,
          timestamp: detection.timestamp,
          isNew: !detection.is_stale,
        }))
  const whyDroneRows = explainabilityRows(selectedTrack, records)
  const operatorFeed = decisionFeedItems({
    actions,
    latestDetection,
    selectedTrack,
    snapshot: threatSnapshot,
  })

  return (
    <aside className="right-rail" aria-labelledby="workflow-title">
      <section className={`decision-panel risk-${riskLevel(selectedTrack.threat_score)}`}>
        <div className="decision-header">
          <div>
            <span>Selected Threat</span>
            <strong id="workflow-title">{selectedTrack.track_id}</strong>
          </div>
          <em>{riskLabel(selectedTrack.threat_score)}</em>
        </div>

        <div className={`command-action ${demoStep?.emphasizeAction || selectedTrack.threat_score >= 70 ? 'is-emphasized' : ''}`}>
          <span>Recommended Action</span>
          <strong>{threatSnapshot.recommendedAction}</strong>
          <p>{selectedTrack.explanation}</p>
        </div>

        <dl className="command-grid">
          {commandRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="source-block">
          <span>Why the system believes this is a drone</span>
          <div className="explain-list">
            {whyDroneRows.map((row) => (
              <div className={row.active ? 'explain-row is-active' : 'explain-row'} key={row.label}>
                <strong>{row.label}</strong>
                <span>
                  {row.status}
                  {typeof row.confidence === 'number' ? ` / ${formatConfidence(row.confidence)}` : ''}
                </span>
                <i aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
        <div className="evidence-block">
          <div className="evidence-heading">
            <span>Evidence</span>
            <strong>{selectedTrack.evidence?.length ?? relatedDetections.length} items</strong>
          </div>
          <div className="evidence-strip">
            {evidenceItems.map((evidence) => (
              <button
                className={`evidence-thumb ${modalityClass(evidence.modality)} ${evidence.isNew ? 'is-new' : ''}`}
                key={evidence.id}
                type="button"
              >
                <span>{evidence.label}</span>
                <em>{formatTimestamp(evidence.timestamp)}</em>
                <strong>{formatConfidence(evidence.confidence)}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="recommendation-panel">
        <span>Operator Commands</span>
        <div className="workflow-actions" aria-label="Operator actions">
          {actionButtons.map((action) => (
            <button
              className={action.label === threatSnapshot.recommendedAction || action.action_type === 'slew_eoir' ? 'is-primary' : ''}
              key={action.action_type}
              type="button"
              onClick={() => onCreateAction(action.action_type, action.label)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <section className="audit-panel operator-feed-panel" aria-live="polite">
        <div className="rail-section-header">
          <span>Operator Feed</span>
          <strong>{operatorFeed.length} items</strong>
        </div>
        <div className="audit-list">
          {operatorFeed.map((item) => (
            <article className={`audit-item feed-${custodyClass(item.type)}`} key={item.id}>
              <span>{formatTimestamp(item.timestamp)}</span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
        <div className="latest-action">
          <span>Current action</span>
          <strong>{threatSnapshot.recommendedAction}</strong>
        </div>
      </section>
    </aside>
  )
}

const defaultScenarioKey: SimulationScenarioKey = 'harborIntrusion'

function staticBriefing(dataMode: DataMode, tracks: FusedTrack[]): ScenarioBriefing {
  const highestThreat = Math.max(0, ...tracks.map((track) => track.threat_score))

  return {
    scenario_key: dataMode,
    scenario_name: dataMode === 'palantirMission' ? 'Palantir mission data' : 'Palantir snapshot',
    objective: dataMode === 'palantirMission' ? 'Review read-only mission objects on the active branch.' : 'Inspect ontology-backed platform and sensor data.',
    phase_label: dataMode === 'palantirMission' ? 'Mission snapshot' : 'Ontology snapshot',
    phase_description:
      dataMode === 'palantirMission'
        ? 'Detection, fused track, and operator action records are loaded from the mission dataset snapshot.'
        : 'Platform and sensor objects are loaded from Palantir while local fusion data remains static.',
    elapsed_seconds: 0,
    next_event: undefined,
    active_tracks: tracks.length,
    highest_threat: highestThreat,
  }
}

function createSimulationRuntime(scenarioKey: SimulationScenarioKey): {
  engine: ScenarioEngine
  heroTrackId: string
  ui: ReturnType<typeof simulationToUi>
} {
  const engine = createScenarioEngine(scenarioKey)
  const snapshot = engine.getSnapshot()

  return {
    engine,
    heroTrackId: snapshot.heroTrackId,
    ui: simulationToUi(snapshot),
  }
}

function App() {
  const [localOperatorActions, setLocalOperatorActions] = useState<OperatorAction[]>([])
  const [demoStepIndex, setDemoStepIndex] = useState<number | null>(null)
  const [dataMode, setDataMode] = useState<DataMode>('local')
  const [eventFilter, setEventFilter] = useState<EventFilter>('all')
  const [queueQuery, setQueueQuery] = useState('')
  const [selectedTrackId, setSelectedTrackId] = useState('TRK-SM-001')
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null)
  const [visibleLayers, setVisibleLayers] = useState<Record<LayerKey, boolean>>(defaultLayerState)
  const [simulationScenario, setSimulationScenario] = useState<SimulationScenarioKey>(defaultScenarioKey)
  const [simulationPlaying, setSimulationPlaying] = useState(true)
  const [simulationSpeed, setSimulationSpeed] = useState<SimulationSpeed>(1)
  const [simulationRuntime, setSimulationRuntime] = useState(() => createSimulationRuntime(defaultScenarioKey))

  const simulationUi = simulationRuntime.ui
  const palantirSnapshotUi = useMemo(
    () =>
      ontologySnapshotToUi({
        platforms: palantirPlatforms,
        sensors: palantirSensors,
        detections,
        fusedTracks,
        operatorActions: initialActions,
      }),
    [],
  )
  const palantirMissionUi = useMemo(
    () =>
      ontologySnapshotToUi({
        platforms: palantirPlatforms,
        sensors: palantirSensors,
        detections: palantirMissionDetections,
        fusedTracks: palantirMissionFusedTracks,
        operatorActions: palantirMissionOperatorActions,
      }),
    [],
  )

  useEffect(() => {
    if (dataMode !== 'local' || !simulationPlaying) {
      return
    }

    const intervalId = window.setInterval(() => {
      setSimulationRuntime((currentRuntime) => {
        currentRuntime.engine.advance(simulationSpeed)
        return {
          engine: currentRuntime.engine,
          heroTrackId: currentRuntime.heroTrackId,
          ui: simulationToUi(currentRuntime.engine.getSnapshot()),
        }
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [dataMode, simulationPlaying, simulationSpeed])

  const activeDemoSteps = dataMode === 'palantirMission' ? palantirMissionDemoSteps : demoSteps
  const currentDemoStep = dataMode === 'local' || demoStepIndex === null ? null : activeDemoSteps[demoStepIndex] ?? null
  const hasPalantirSnapshot = palantirPlatforms.length > 0 && palantirSensors.length > 0
  const hasPalantirMissionData = palantirMissionDetections.length > 0 && palantirMissionFusedTracks.length > 0
  const usesPalantirSensors = dataMode === 'palantirSnapshot' || dataMode === 'palantirMission'
  const activePlatforms: Platform[] =
    dataMode === 'local' ? simulationUi.platforms : usesPalantirSensors && palantirPlatforms.length > 0 ? palantirSnapshotUi.platforms : localPlatforms
  const activeSensors: Sensor[] =
    dataMode === 'local' ? simulationUi.sensors : usesPalantirSensors && palantirSensors.length > 0 ? palantirSnapshotUi.sensors : localSensors
  const activeDetections: Detection[] =
    dataMode === 'local'
      ? simulationUi.detections
      : dataMode === 'palantirMission' && palantirMissionDetections.length > 0
        ? palantirMissionUi.detections
        : palantirSnapshotUi.detections
  const activeFusedTracks: FusedTrack[] =
    dataMode === 'local'
      ? simulationUi.fusedTracks
      : dataMode === 'palantirMission' && palantirMissionFusedTracks.length > 0
        ? palantirMissionUi.fusedTracks
        : palantirSnapshotUi.fusedTracks
  const baseOperatorActions: OperatorAction[] =
    dataMode === 'palantirMission' && palantirMissionOperatorActions.length > 0
      ? palantirMissionUi.operatorActions
      : dataMode === 'local'
        ? simulationUi.operatorActions
        : palantirSnapshotUi.operatorActions
  const activeProtectedAssets = dataMode === 'local' ? simulationUi.protectedAssets : emptyProtectedAssets
  const activeProtectedZones = dataMode === 'local' ? simulationUi.protectedZones : emptyProtectedZones
  const activeBriefing =
    dataMode === 'local'
      ? simulationUi.briefing ?? {
          scenario_key: simulationScenario,
          scenario_name: scenarioOptions.find((scenario) => scenario.key === simulationScenario)?.label ?? 'Live Demo',
          objective: 'Run the deterministic local mission simulation.',
          phase_label: 'Live simulation',
          phase_description: simulationUi.statusText,
          elapsed_seconds: 0,
          next_event: undefined,
          active_tracks: activeFusedTracks.length,
          highest_threat: Math.max(0, ...activeFusedTracks.map((track) => track.threat_score)),
        }
      : staticBriefing(dataMode, activeFusedTracks)
  const usingFallbackData =
    (dataMode === 'palantirSnapshot' && !hasPalantirSnapshot) ||
    (dataMode === 'palantirMission' && (!hasPalantirSnapshot || !hasPalantirMissionData))
  const modeStatusText =
    dataMode === 'local'
      ? `${scenarioOptions.find((scenario) => scenario.key === simulationScenario)?.label ?? 'Live Demo'} / ${simulationUi.statusText}`
      : dataMode === 'palantirMission'
      ? `Proposal OPEN ${palantirMissionMetadata.proposalRid.slice(-8)} / branch ${palantirMissionMetadata.branchRid.slice(-8)} active`
      : dataMode === 'palantirSnapshot'
        ? `${palantirSnapshotMetadata.objectTypesUsed.length} Palantir object types`
        : 'Local ontology mock'
  const mapReadyStatus =
    dataMode === 'local'
      ? simulationUi.statusText
      : dataMode === 'palantirMission'
      ? 'Palantir mission data active'
      : dataMode === 'palantirSnapshot'
        ? 'Palantir platform/sensor snapshot with local fusion'
        : 'Local ontology mock active'
  const selectedBaseTrack = useMemo(
    () =>
      activeFusedTracks.find((track) => track.track_id === selectedTrackId) ??
      [...activeFusedTracks].sort((a, b) => b.threat_score - a.threat_score)[0] ??
      fusedTracks[0],
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
        protectedAssets: activeProtectedAssets,
        protectedZones: activeProtectedZones,
        selectedDetectionId,
        selectedTrack,
      }),
    [
      activeDetections,
      activeFusedTracks,
      activePlatforms,
      activeProtectedAssets,
      activeProtectedZones,
      activeSensors,
      currentDemoStep,
      selectedDetectionId,
      selectedTrack,
    ],
  )

  function createOperatorAction(actionType: string, label: string) {
    const timestamp = dataMode === 'local' ? selectedTrack.updated_at ?? selectedTrack.last_seen : new Date().toISOString().slice(11, 19) + 'Z'

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

  function restartSimulation() {
    const nextRuntime = createSimulationRuntime(simulationScenario)
    setSimulationRuntime(nextRuntime)
    setSelectedTrackId(nextRuntime.heroTrackId)
    setSelectedDetectionId(null)
  }

  function changeSimulationScenario(scenarioKey: SimulationScenarioKey) {
    const nextRuntime = createSimulationRuntime(scenarioKey)
    setSimulationScenario(scenarioKey)
    setSimulationRuntime(nextRuntime)
    setSelectedTrackId(nextRuntime.heroTrackId)
    setSelectedDetectionId(null)
    setLocalOperatorActions([])
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
          <span>Phase <strong>{activeBriefing.phase_label}</strong></span>
          <span>Elapsed <strong>{formatElapsed(activeBriefing.elapsed_seconds)}</strong></span>
          <span>Conditions <strong>Clear</strong></span>
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
                setDemoStepIndex(null)
                setSelectedTrackId(simulationRuntime.heroTrackId)
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
                setSelectedTrackId('TRK-SM-001')
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
                setSelectedTrackId('TRK-SM-001')
                setSelectedDetectionId(null)
              }}
            >
              Mission Data
            </button>
          </div>
          {dataMode === 'local' ? (
            <div className="simulation-controls" aria-label="Live demo controls">
              <span>{formatElapsed(activeBriefing.elapsed_seconds)}</span>
              <select
                aria-label="Scenario"
                value={simulationScenario}
                onChange={(event) => changeSimulationScenario(event.target.value as SimulationScenarioKey)}
              >
                {scenarioOptions.map((scenario) => (
                  <option key={scenario.key} value={scenario.key}>
                    {scenario.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setSimulationPlaying((isPlaying) => !isPlaying)}>
                {simulationPlaying ? 'Pause' : 'Play'}
              </button>
              {[1, 2, 5].map((speed) => (
                <button
                  className={simulationSpeed === speed ? 'is-selected' : ''}
                  key={speed}
                  type="button"
                  onClick={() => setSimulationSpeed(speed as SimulationSpeed)}
                >
                  {speed}x
                </button>
              ))}
              <button type="button" onClick={restartSimulation}>Restart</button>
            </div>
          ) : null}
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
          protectedAssets={activeProtectedAssets}
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
          briefing={activeBriefing}
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
          protectedAssets={activeProtectedAssets}
          selectedTrack={selectedTrack}
          onCreateAction={createOperatorAction}
        />
      </div>
    </main>
  )
}

export default App
