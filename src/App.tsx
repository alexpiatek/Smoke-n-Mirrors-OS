import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import { ontologySnapshotToUi } from './lib/dashboard/adapters/ontologyToUi'
import { simulationToUi } from './lib/dashboard/adapters/simulationToUi'
import { createScenarioEngine, type ScenarioEngine } from './lib/sim/scenarioEngine'
import { scenarioOptions } from './lib/sim/scenarioDefinitions'
import {
  acousticEvidenceAssetForTrack,
  eoirCompassFolderRid,
  eoirEvidenceAssetsForTrack,
  type EvidenceAudioAsset,
  type EvidenceImageAsset,
} from './data/evidenceAssets'
import { getPalantirDemoScenario, palantirDemoDatasetMetadata } from './data/palantirDemoScenarios'
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
type LayerKey = 'sensors' | 'rawDetections' | 'fusedTracks' | 'protectedZones' | 'probablePath' | 'trackHistory'
type SimulationSpeed = 1 | 2 | 5
type TacticalMapFocusMode = 'selected' | 'swarm'
type TargetVerificationTab = 'verified' | 'unverified'
type SourceEvidenceGroup = 'Radar' | 'EO' | 'Acoustic/RF'
type SwarmBehaviorLabel = 'Lead approach' | 'Boundary crossing' | 'Loitering' | 'Split formation' | 'Converging' | 'Outbound'
type RecommendationSeverity = 'critical' | 'high' | 'watch' | 'low'
type SensorPreviewMode = 'hover' | 'pinned'
type SensorPreviewPlacement = 'right' | 'left' | 'bottom' | 'top'

type OperatorCommand = {
  actionType: string
  label: string
  reason: string
  priority: number
}

type OperatorRecommendation = {
  primaryAction: string
  reason: string
  severity: RecommendationSeverity
  confidence: number
  suggestedCommands: OperatorCommand[]
  why: string[]
}

type LiveIntelCard = {
  id: string
  trackId: string
  modality: string
  label: string
  confidence: number
  timestamp: string
  isNew: boolean
}

type SwarmTriageItem = {
  trackId: string
  behavior: SwarmBehaviorLabel
  recommendedAction: string
  reason: string
  severity: RecommendationSeverity
}

type SensorQuickLookPreview = {
  sensorId: string
  platformId: string
  platformCallsign: string
  modality: string
  modalityGroup: SourceEvidenceGroup
  measurementKind: string
  status: string
  timestamp: string
  confidence: number
  rangeM: number | null
  bearingDeg: number | null
  speedMps: number | null
  altitudeLabel: string
  trackId: string | null
  classification: string
  signalStrength: number
  coordinate: [number, number]
  screenPoint: { x: number; y: number }
  mode: SensorPreviewMode
}

type SensorPreviewPosition = {
  left: number
  top: number
  caretLeft: number
  caretTop: number
  placement: SensorPreviewPlacement
}

type SensorMarkerOverlayItem = {
  id: string
  label: string
  modalityGroup: SourceEvidenceGroup
  status: string
  coordinate: [number, number]
  screenPoint: { x: number; y: number }
  feature: GeoJsonFeature
}

type MapData = {
  center: [number, number]
  zoom: number
  bounds?: [[number, number], [number, number]]
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
  behaviorLabel?: SwarmBehaviorLabel
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

const defaultLayerState: Record<LayerKey, boolean> = {
  sensors: true,
  rawDetections: false,
  fusedTracks: true,
  protectedZones: true,
  probablePath: true,
  trackHistory: false,
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

const actionButtons = [
  { action_type: 'slew_eoir', label: 'Slew EO/IR' },
  { action_type: 'notify_response', label: 'Notify Team' },
  { action_type: 'dispatch', label: 'Dispatch' },
  { action_type: 'monitor', label: 'Monitor' },
  { action_type: 'reacquire', label: 'Reacquire' },
  { action_type: 'false_alarm', label: 'Mark False Alarm' },
]

const demoSteps: DemoStep[] = [
  {
    title: 'Radar detects a probable UAV approach.',
    mapStatus: 'Radar seed: TRK-SD-001 outside the harbor standoff.',
    activeDetectionIds: ['DET-SD-RDR-001'],
    staleDetectionIds: [],
    custody_status: 'Building',
    confidence: 0.56,
    source_summary: 'Radar',
    recommended_next_action: 'Continue correlation.',
    explanation: 'The first simulated radar return creates a tentative UAV track outside the protected waterfront.',
    emphasizeAction: false,
  },
  {
    title: 'RF and acoustic cues correlate.',
    mapStatus: 'RF and acoustic bearings align with TRK-SD-001.',
    activeDetectionIds: ['DET-SD-RF-002', 'DET-SD-AC-003'],
    staleDetectionIds: [],
    custody_status: 'Correlating',
    confidence: 0.72,
    source_summary: 'Radar + Acoustic/RF',
    recommended_next_action: 'Keep passive sensors collecting.',
    explanation: 'Simulated RF control energy and acoustic tone are consistent with the radar bearing.',
    emphasizeAction: false,
  },
  {
    title: 'Fused track is established.',
    mapStatus: 'Radar refresh tightens the fused track near the restricted zone.',
    activeDetectionIds: ['DET-SD-RDR-004'],
    staleDetectionIds: [],
    custody_status: 'Maintained',
    confidence: 0.8,
    source_summary: 'Radar + Acoustic + RF',
    recommended_next_action: 'Task EO/IR to confirm.',
    explanation: 'The fused track is now maintained and projected toward the protected waterfront.',
    emphasizeAction: false,
  },
  {
    title: 'EO/IR confirms probable UAV.',
    mapStatus: 'EO/IR visual confirmation raises TRK-SD-001 to critical.',
    activeDetectionIds: ['DET-SD-EOIR-005'],
    staleDetectionIds: [],
    custody_status: 'Maintained',
    confidence: 0.84,
    source_summary: 'Radar + RF + Acoustic + EO/IR',
    recommended_next_action: 'Notify response team and maintain custody.',
    explanation:
      'The simulated track is close to the restricted zone with independent sensor confirmation and a short ETA.',
    emphasizeAction: true,
  },
]

const palantirMissionDemoSteps: DemoStep[] = [
  {
    title: 'Multiple UAV tracks appear.',
    mapStatus: 'Palantir demo data: radar detections seed TRK-SW-001 through TRK-SW-008.',
    activeDetectionIds: ['DET-SW-001-RDR', 'DET-SW-002-RDR', 'DET-SW-003-RDR'],
    staleDetectionIds: [],
    custody_status: 'Building',
    confidence: 0.64,
    source_summary: 'Radar',
    recommended_next_action: 'Confirm whether tracks are coordinated.',
    explanation: 'Simulated radar detections establish multiple probable UAVs outside the harbor mission box.',
    emphasizeAction: false,
  },
  {
    title: 'RF correlation supports coordinated control.',
    mapStatus: 'RF detections align with the lead and secondary swarm tracks.',
    activeDetectionIds: ['DET-SW-001-RF', 'DET-SW-002-RF', 'DET-SW-003-RF'],
    staleDetectionIds: [],
    custody_status: 'Correlating',
    confidence: 0.74,
    source_summary: 'Radar + RF',
    recommended_next_action: 'Prioritize the lead track.',
    explanation: 'Simulated RF bearings correlate with the radar tracks and support a coordinated pattern assessment.',
    emphasizeAction: false,
  },
  {
    title: 'Swarm pattern suspected.',
    mapStatus: 'Lead and secondary tracks show a converging approach toward the protected island.',
    activeDetectionIds: ['DET-SW-001-RDR', 'DET-SW-006-RDR', 'DET-SW-007-RDR'],
    staleDetectionIds: [],
    custody_status: 'Maintained',
    confidence: 0.82,
    source_summary: 'Radar + RF + pattern analysis',
    recommended_next_action: 'Notify response team and monitor secondary tracks.',
    explanation: 'The lead simulated track is critical while secondary tracks form converging and split patterns.',
    emphasizeAction: false,
  },
  {
    title: 'EO/IR confirms lead track.',
    mapStatus: 'EO/IR confirmation makes TRK-SW-001 the top operator threat.',
    activeDetectionIds: ['DET-SW-001-EOIR'],
    staleDetectionIds: [],
    custody_status: 'Maintained',
    confidence: 0.88,
    source_summary: 'Radar + RF + EO/IR',
    recommended_next_action: 'Dispatch response team and keep swarm custody.',
    explanation:
      'The simulated lead UAV has visual confirmation and the remaining tracks stay muted as secondary threats.',
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
  'sensor-preview-source',
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
    'sensor-preview-halo',
    'sensor-preview-core',
    'platforms',
    'sensor-halos',
    'sensor-hitbox',
    'sensors',
    'sensor-icons',
    'sensor-labels',
  ],
  rawDetections: ['detections-halo', 'detections'],
  fusedTracks: ['fused-track-ring', 'fused-track-icon', 'fused-track-label'],
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

const interactiveLayerIds = ['sensor-icons', 'sensor-hitbox', 'sensors', 'fused-track-icon', 'fused-track-ring', 'detections', 'platforms']
const sensorInteractiveLayerIds = ['sensor-icons', 'sensor-hitbox', 'sensors']

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
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

function focusModeForScenario(scenario: SimulationScenarioKey): TacticalMapFocusMode {
  return scenario === 'droneSwarmPattern' ? 'swarm' : 'selected'
}

function isSwarmScenario(scenario: SimulationScenarioKey) {
  return scenario === 'droneSwarmPattern'
}

function riskSeverity(score: number): RecommendationSeverity {
  return riskLevel(score) as RecommendationSeverity
}

function trackNumber(track: FusedTrack) {
  const match = track.track_id.match(/(\d+)$/)
  return match ? Number(match[1]) : 0
}

function isSwarmMember(track: FusedTrack, scenario: SimulationScenarioKey) {
  return isSwarmScenario(scenario) || track.track_id.includes('-SW-') || track.track_id.toLowerCase().includes('swarm')
}

function swarmBehaviorLabel(track: FusedTrack, allTracks: FusedTrack[], protectedAssets: ProtectedAsset[], scenario: SimulationScenarioKey): SwarmBehaviorLabel {
  const movementState = inferMovementState(track, protectedAssets)
  const number = trackNumber(track)
  const sortedByThreat = [...allTracks].sort((a, b) => b.threat_score - a.threat_score || b.confidence - a.confidence)
  const isLead = sortedByThreat[0]?.track_id === track.track_id || number === 1
  const labelSource = `${track.behavior_type ?? ''} ${track.classification ?? ''} ${track.status_reason ?? ''}`.toLowerCase()

  if (isLead && isSwarmMember(track, scenario)) {
    return 'Lead approach'
  }

  if (movementState === 'Outbound' || labelSource.includes('outbound')) {
    return 'Outbound'
  }

  if (labelSource.includes('loiter') || number === 4 || number === 5 || (track.speed_mps ?? 999) < 3) {
    return 'Loitering'
  }

  if ((track.eta_seconds_to_asset ?? 9999) <= 75 || (track.distance_to_asset_m ?? 9999) < 850 || number === 6 || number === 7) {
    return 'Boundary crossing'
  }

  if (number === 2 || number === 3 || labelSource.includes('split')) {
    return 'Split formation'
  }

  return movementState === 'Inbound' ? 'Converging' : 'Split formation'
}

function hasSourceGroup(fusionContributions: FusedTrack['fusion_contributions'], evidence: FusedTrack['evidence'], group: string) {
  return Boolean(
    fusionContributions?.some((contribution) => modalityGroup(contribution.modality) === group && !['lost', 'stale', 'pending'].includes(contribution.status)) ||
      evidence?.some((artifact) => modalityGroup(artifact.modality) === group),
  )
}

function shortRecommendationReason(track: FusedTrack, snapshot: ThreatSnapshot, behavior: SwarmBehaviorLabel) {
  if (snapshot.etaLabel !== 'N/A' && snapshot.etaLabel !== 'Unknown') {
    return `${snapshot.etaLabel} to protected zone`
  }

  if (track.custody_status.toLowerCase().includes('reacquiring') || track.custody_status.toLowerCase().includes('lost')) {
    return `${track.custody_status.toLowerCase()} custody`
  }

  if (behavior === 'Loitering') {
    return 'stationary pattern near mission area'
  }

  return `${formatConfidence(track.confidence)} confidence, ${snapshot.rangeLabel}`
}

function buildOperatorRecommendation({
  selectedTrack,
  allTracks,
  scenario,
  protectedAssets,
  zones,
  fusionContributions,
  evidence,
  currentPhase,
}: {
  selectedTrack: FusedTrack
  allTracks: FusedTrack[]
  scenario: SimulationScenarioKey
  protectedAssets: ProtectedAsset[]
  zones: ProtectedZone[]
  fusionContributions?: FusedTrack['fusion_contributions']
  evidence?: FusedTrack['evidence']
  currentPhase?: ScenarioBriefing
}): OperatorRecommendation {
  const snapshot = buildThreatSnapshot(selectedTrack, [], protectedAssets)
  const behavior = swarmBehaviorLabel(selectedTrack, allTracks, protectedAssets, scenario)
  const hasVisual = hasSourceGroup(fusionContributions, evidence, 'EO') || sourceTokens(selectedTrack.source_summary).some((source) => modalityGroup(source) === 'EO')
  const hasRadar = hasSourceGroup(fusionContributions, evidence, 'Radar') || selectedTrack.source_summary.toLowerCase().includes('radar')
  const hasPassive = hasSourceGroup(fusionContributions, evidence, 'Acoustic/RF') || /rf|acoustic/i.test(selectedTrack.source_summary)
  const coordinatedTracks = allTracks.filter((track) => isSwarmMember(track, scenario) && track.threat_score >= 35).length
  const restrictedZone = zones.find((zone) => zone.kind === 'restricted' || zone.kind === 'asset_buffer')
  const severity = riskSeverity(selectedTrack.threat_score)
  const commands: OperatorCommand[] = []

  if (selectedTrack.custody_status.toLowerCase().includes('lost') || selectedTrack.custody_status.toLowerCase().includes('reacquiring')) {
    commands.push({ actionType: 'reacquire', label: 'Reacquire', reason: 'custody is degraded', priority: 100 })
  }

  if (!hasVisual && snapshot.movementState !== 'Outbound') {
    commands.push({ actionType: 'slew_eoir', label: 'Slew EO/IR', reason: 'visual custody not established', priority: 88 })
  }

  if (selectedTrack.threat_score >= 70 || (snapshot.movementState === 'Inbound' && (selectedTrack.eta_seconds_to_asset ?? 9999) <= 75)) {
    commands.push({ actionType: 'notify_response', label: 'Notify Team', reason: 'high-threat inbound track', priority: 95 })
  }

  if (selectedTrack.threat_score >= 78 || (behavior === 'Boundary crossing' && selectedTrack.confidence >= 0.68)) {
    commands.push({ actionType: 'dispatch', label: 'Dispatch', reason: restrictedZone ? `${restrictedZone.label} at risk` : 'protected asset at risk', priority: 92 })
  }

  if (isSwarmScenario(scenario) && coordinatedTracks >= 4) {
    commands.push({
      actionType: 'notify_response',
      label: 'Notify Team',
      reason: 'coordinated swarm pattern suspected',
      priority: behavior === 'Lead approach' ? 98 : 82,
    })
  }

  if (selectedTrack.threat_score < 25 && selectedTrack.confidence < 0.45) {
    commands.push({ actionType: 'false_alarm', label: 'Mark False Alarm', reason: 'low-confidence low-threat contact', priority: 72 })
  }

  commands.push({ actionType: 'monitor', label: 'Monitor', reason: 'maintain custody without over-tasking', priority: behavior === 'Outbound' ? 80 : 62 })

  const suggestedCommands = commands
    .sort((a, b) => b.priority - a.priority)
    .filter((command, index, sorted) => sorted.findIndex((candidate) => candidate.actionType === command.actionType) === index)
  const primaryCommand = suggestedCommands[0]
  const phaseLabel = currentPhase?.phase_label ?? 'current phase'
  const reason =
    primaryCommand.reason === 'coordinated swarm pattern suspected'
      ? `Coordinated swarm suspected in ${phaseLabel.toLowerCase()}.`
      : `${behavior}; ${primaryCommand.reason}.`
  const why = [
    `${riskLabel(selectedTrack.threat_score)} threat / ${formatConfidence(selectedTrack.confidence)} confidence`,
    `${snapshot.movementState} / ${snapshot.etaLabel !== 'N/A' ? snapshot.etaLabel : snapshot.rangeLabel}`,
    [hasRadar ? 'radar' : '', hasPassive ? 'passive' : '', hasVisual ? 'EO/IR' : 'no EO/IR'].filter(Boolean).join(' + '),
  ]

  if (isSwarmScenario(scenario)) {
    why.push(`${coordinatedTracks} coordinated swarm tracks`)
  }

  return {
    primaryAction: primaryCommand.label,
    reason,
    severity,
    confidence: selectedTrack.confidence,
    suggestedCommands,
    why,
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
    'monitor',
    'false_alarm',
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

function buildSwarmTriageItems({
  allTracks,
  selectedTrack,
  scenario,
  protectedAssets,
  zones,
  briefing,
}: {
  allTracks: FusedTrack[]
  selectedTrack: FusedTrack
  scenario: SimulationScenarioKey
  protectedAssets: ProtectedAsset[]
  zones: ProtectedZone[]
  briefing: ScenarioBriefing
}): SwarmTriageItem[] {
  if (!isSwarmScenario(scenario)) {
    return []
  }

  return allTracks
    .filter((track) => isSwarmMember(track, scenario))
    .map((track) => {
      const recommendation = buildOperatorRecommendation({
        selectedTrack: track,
        allTracks,
        scenario,
        protectedAssets,
        zones,
        fusionContributions: track.fusion_contributions,
        evidence: track.evidence,
        currentPhase: briefing,
      })
      const behavior = swarmBehaviorLabel(track, allTracks, protectedAssets, scenario)
      const snapshot = buildThreatSnapshot(track, [], protectedAssets)

      return {
        trackId: track.track_id,
        behavior,
        recommendedAction: recommendation.primaryAction,
        reason: shortRecommendationReason(track, snapshot, behavior),
        severity: recommendation.severity,
      }
    })
    .sort((a, b) => {
      const aTrack = allTracks.find((track) => track.track_id === a.trackId)
      const bTrack = allTracks.find((track) => track.track_id === b.trackId)
      const selectedBoostA = a.trackId === selectedTrack.track_id ? 0.1 : 0
      const selectedBoostB = b.trackId === selectedTrack.track_id ? 0.1 : 0

      return (
        riskPriority((bTrack?.threat_score ?? 0) + selectedBoostB) -
          riskPriority((aTrack?.threat_score ?? 0) + selectedBoostA) ||
        (bTrack?.threat_score ?? 0) - (aTrack?.threat_score ?? 0) ||
        (aTrack?.eta_seconds_to_asset ?? 9999) - (bTrack?.eta_seconds_to_asset ?? 9999)
      )
    })
    .slice(0, 5)
}

function latestCardForGroup(cards: LiveIntelCard[], group: string) {
  return cards
    .filter((card) => modalityGroup(card.modality) === group)
    .sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp))[0]
}

function buildLiveIntelCards(selectedTrack: FusedTrack, relatedDetections: Detection[]): LiveIntelCard[] {
  const evidenceCards =
    selectedTrack.evidence?.map((artifact) => ({
      id: artifact.artifact_id,
      trackId: selectedTrack.track_id,
      modality: artifact.modality,
      label: artifact.label,
      confidence: artifact.confidence,
      timestamp: artifact.timestamp,
      isNew: Boolean(artifact.is_new),
    })) ?? []
  const detectionCards = relatedDetections.map((detection) => ({
    id: detection.detection_id,
    trackId: selectedTrack.track_id,
    modality: detection.modality,
    label: detection.classification,
    confidence: detection.confidence,
    timestamp: detection.timestamp,
    isNew: !detection.is_stale,
  }))
  const contributionCards =
    selectedTrack.fusion_contributions?.map((contribution) => ({
      id: `${selectedTrack.track_id}-${contribution.sensor_id}-${contribution.modality}`,
      trackId: selectedTrack.track_id,
      modality: contribution.modality,
      label: `${modalityShortLabel(contribution.modality)} ${contributionStatusLabel(contribution.status).toLowerCase()}`,
      confidence: contribution.confidence,
      timestamp: contribution.last_seen,
      isNew: (contribution.age_seconds ?? Number.POSITIVE_INFINITY) <= 12,
    })) ?? []
  const sourceCards = [...evidenceCards, ...detectionCards, ...contributionCards]
  const defaultConfidence = Math.max(0.28, Math.min(0.72, selectedTrack.confidence * 0.72))
  const groups = [
    { group: 'EO', modality: 'EO/IR', label: 'EO/IR visual cue' },
    { group: 'ACOUSTIC', modality: 'ACOUSTIC', label: 'Acoustic rotor tone' },
    { group: 'Radar', modality: 'RADAR', label: 'Radar track plot' },
    { group: 'RF', modality: 'RF', label: 'RF bearing sector' },
  ]

  return groups.map(({ group, modality, label }) => {
    const matching =
      group === 'RF'
        ? sourceCards
            .filter((card) => normalizeModality(card.modality).includes('RF'))
            .sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp))[0]
        : group === 'ACOUSTIC'
          ? sourceCards
              .filter((card) => normalizeModality(card.modality).includes('ACOUSTIC'))
              .sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp))[0]
        : latestCardForGroup(sourceCards, group)

    return (
      matching ?? {
        id: `${selectedTrack.track_id}-${modality}-derived`,
        trackId: selectedTrack.track_id,
        modality,
        label,
        confidence: defaultConfidence,
        timestamp: selectedTrack.updated_at ?? selectedTrack.last_seen,
        isNew: false,
      }
    )
  })
}

function localMediaExists(localPath: string) {
  return fetch(localPath, { method: 'HEAD', cache: 'no-store' })
    .then((response) => {
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
      return response.ok && !contentType.includes('text/html')
    })
    .catch(() => false)
}

let activeAcousticAudio: HTMLAudioElement | null = null
let activeAcousticStopHandler: (() => void) | null = null
let acousticStopVersion = 0

function stopAcousticCue() {
  acousticStopVersion += 1

  if (!activeAcousticAudio) {
    activeAcousticStopHandler = null
    return
  }

  const stopHandler = activeAcousticStopHandler
  activeAcousticStopHandler = null
  activeAcousticAudio.pause()
  activeAcousticAudio.currentTime = 0
  activeAcousticAudio = null
  stopHandler?.()
}

function playAcousticCue(asset: EvidenceAudioAsset | null, onStop?: () => void) {
  if (!asset) {
    return Promise.resolve(false)
  }

  const requestStopVersion = acousticStopVersion

  return localMediaExists(asset.localPath).then((exists) => {
    if (!exists || requestStopVersion !== acousticStopVersion) {
      return false
    }

    stopAcousticCue()
    const audio = new Audio(asset.localPath)
    activeAcousticAudio = audio
    activeAcousticStopHandler = onStop ?? null
    audio.addEventListener(
      'ended',
      () => {
        if (activeAcousticAudio === audio) {
          stopAcousticCue()
        }
      },
      { once: true },
    )
    return audio
      .play()
      .then(() => true)
      .catch(() => {
        if (activeAcousticAudio === audio) {
          stopAcousticCue()
        }

        return false
      })
  })
}

function EvidenceAudioButton({ asset }: { asset: EvidenceAudioAsset | null }) {
  const [status, setStatus] = useState<'checking' | 'ready' | 'missing'>(asset ? 'checking' : 'missing')
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!asset) {
      setStatus('missing')
      setPlaying(false)
      return
    }

    setPlaying(false)
    setStatus('checking')
    localMediaExists(asset.localPath).then((exists) => {
      if (!cancelled) {
        setStatus(exists ? 'ready' : 'missing')
      }
    })

    return () => {
      cancelled = true
    }
  }, [asset])

  useEffect(() => stopAcousticCue, [])

  const disabled = !asset || status !== 'ready'
  const label =
    status === 'checking'
      ? 'Checking sound'
      : status === 'ready'
        ? playing
          ? 'Stop drone sound'
          : asset?.buttonLabel ?? 'Play sound'
        : 'Sound pending export'

  return (
    <button
      aria-pressed={playing}
      className={`evidence-audio-button is-${status} ${playing ? 'is-playing' : ''}`}
      disabled={disabled}
      type="button"
      onClick={() => {
        if (playing) {
          stopAcousticCue()
          setPlaying(false)
          return
        }

        playAcousticCue(asset, () => setPlaying(false)).then((started) => {
          if (started) {
            setPlaying(true)
          }
        })
      }}
    >
      {label}
    </button>
  )
}

function EoirEvidenceCarousel({ assets }: { assets: EvidenceImageAsset[] }) {
  const [imageStatus, setImageStatus] = useState<Record<string, 'loaded' | 'missing'>>({})

  if (assets.length === 0) {
    return null
  }

  return (
    <div className="eoir-carousel" aria-label="EO/IR evidence carousel">
      <div className="eoir-carousel-strip">
        {assets.map((asset, index) => {
          const status = imageStatus[asset.assetId]

          return (
            <figure className={`eoir-frame is-${status ?? 'checking'}`} key={asset.assetId}>
              <img
                alt={`${asset.frameLabel} from Foundry EO/IR evidence`}
                onError={() => setImageStatus((current) => ({ ...current, [asset.assetId]: 'missing' }))}
                onLoad={() => setImageStatus((current) => ({ ...current, [asset.assetId]: 'loaded' }))}
                src={asset.localPath}
              />
              {status !== 'loaded' ? (
                <span>
                  <strong>{String(index + 1).padStart(2, '0')}</strong>
                  Media pending export
                </span>
              ) : null}
              <figcaption>{asset.frameLabel}</figcaption>
            </figure>
          )
        })}
      </div>
      <small>Compass folder {eoirCompassFolderRid}</small>
    </div>
  )
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
  return [...activeSensors, ...localSensors].find((sensor) => sensor.sensor_id === sensorId)
}

function getPlatform(platformId: string, activePlatforms: Platform[]) {
  return [...activePlatforms, ...localPlatforms].find((platform) => platform.platform_id === platformId)
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

function trackPoint(track: FusedTrack): [number, number] {
  return [track.estimated_lon, track.estimated_lat]
}

function trackPathProperties(
  track: FusedTrack,
  selected: boolean,
  scenario: SimulationScenarioKey,
  pathType: 'history' | 'projected',
): Record<string, string | number | boolean | null> {
  return {
    id: `${track.track_id}-${pathType}`,
    trackId: track.track_id,
    selected,
    risk: riskLevel(track.threat_score),
    threatScore: track.threat_score,
    custody: track.custody_status,
    confidence: track.confidence,
    classification: track.classification ?? 'Fused contact',
    isSwarmMember: isSwarmMember(track, scenario),
    pathType,
    tooltip: `${track.track_id} ${pathType} | ${riskLabel(track.threat_score)} | ${formatConfidence(track.confidence)}`,
  }
}

function mapBoundsFromCoordinates(coordinates: [number, number][]): [[number, number], [number, number]] | undefined {
  const validCoordinates = coordinates.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))

  if (!validCoordinates.length) {
    return undefined
  }

  const bounds = polygonBounds(validCoordinates)
  return [
    [bounds.minLon, bounds.minLat],
    [bounds.maxLon, bounds.maxLat],
  ]
}

function buildMapData({
  activePlatforms,
  activeSensors,
  allTracks,
  detections: records,
  demoStep,
  focusMode,
  protectedAssets = [],
  protectedZones = [],
  scenario,
  selectedDetectionId,
  selectedTrack,
}: {
  activePlatforms: Platform[]
  activeSensors: Sensor[]
  allTracks: FusedTrack[]
  detections: Detection[]
  demoStep: DemoStep | null
  focusMode: TacticalMapFocusMode
  protectedAssets?: ProtectedAsset[]
  protectedZones?: ProtectedZone[]
  scenario: SimulationScenarioKey
  selectedDetectionId: string | null
  selectedTrack: FusedTrack
}): MapData {
  const displayTracks = uniqueById([selectedTrack, ...allTracks], (track) => track.track_id)
  const swarmMode = focusMode === 'swarm' && isSwarmScenario(scenario)
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
    ],
    (sensor) => sensor.sensor_id,
  )
  const relatedPlatformIds = new Set(displaySensors.map((sensor) => sensor.platform_id))
  const displayPlatforms = uniqueById(
    [
      ...activePlatforms,
      ...localPlatforms.filter((platform) => relatedPlatformIds.has(platform.platform_id)),
    ],
    (platform) => platform.platform_id,
  )
  const detectionCoordinates = new Map<string, [number, number]>()
  displayTracks.forEach((track) => {
    buildDetectionCoordinates(
      track,
      records.filter((detection) => detection.contributes_to_track_id === track.track_id),
    ).forEach((coordinate, detectionId) => detectionCoordinates.set(detectionId, coordinate))
  })
  const selectedDetection = records.find((detection) => detection.detection_id === selectedDetectionId)
  const latestTimestamp =
    [...records.map((detection) => detection.timestamp), selectedTrack.last_seen].sort((a, b) => timestampValue(b) - timestampValue(a))[0] ??
    selectedTrack.last_seen
  const trackCoordinate = trackPoint(selectedTrack)
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
  const sortedCoordinatesForTrack = (track: FusedTrack) => {
    const trackRecords = records
      .filter((detection) => detection.contributes_to_track_id === track.track_id)
      .sort((a, b) => timestampValue(a.timestamp) - timestampValue(b.timestamp))
      .map((detection) => detectionCoordinates.get(detection.detection_id))
      .filter((coordinate): coordinate is [number, number] => Boolean(coordinate))
    const trackHistoryCoordinates =
      track.track_history?.map((point) => [point.lon, point.lat] as [number, number]).filter(Boolean) ?? []

    return trackHistoryCoordinates.length > 0 ? trackHistoryCoordinates : trackRecords
  }
  const projectedCoordinatesForTrack = (track: FusedTrack, sortedCoordinates: [number, number][]) =>
    track.probable_path && track.probable_path.length > 0
      ? [trackPoint(track), ...track.probable_path.map((point) => [point.lon, point.lat] as [number, number])]
      : [
          sortedCoordinates[0] ?? destinationPoint(track.estimated_lat, track.estimated_lon, 235, 700),
          trackPoint(track),
          destinationPoint(track.estimated_lat, track.estimated_lon, track.heading_deg ?? 55, 920),
        ]
  const selectedSortedCoordinates = sortedCoordinatesForTrack(selectedTrack)
  const pathTracks = swarmMode ? displayTracks.filter((track) => isSwarmMember(track, scenario)) : [selectedTrack]
  const probablePathFeatures: GeoJsonFeature[] = pathTracks.flatMap((track) => {
    const sortedCoordinates = sortedCoordinatesForTrack(track)
    const coordinates = projectedCoordinatesForTrack(track, sortedCoordinates)

    return coordinates.length > 1
      ? [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates },
            properties: trackPathProperties(track, track.track_id === selectedTrack.track_id, scenario, 'projected'),
          },
        ]
      : []
  })
  const historyLineFeatures: GeoJsonFeature[] = pathTracks.flatMap((track) => {
    const historyCoordinates = [...sortedCoordinatesForTrack(track), trackPoint(track)]

    return historyCoordinates.length > 1
      ? [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: historyCoordinates },
            properties: trackPathProperties(track, track.track_id === selectedTrack.track_id, scenario, 'history'),
          },
        ]
      : []
  })
  const trackHistoryPointFeatures: GeoJsonFeature[] = selectedSortedCoordinates.map((coordinate, index) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coordinate },
    properties: {
      id: `breadcrumb-${selectedTrack.track_id}-${index + 1}`,
      trackId: selectedTrack.track_id,
      selected: true,
      sequence: index + 1,
    },
  }))
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
  const selectedSensorPlatformCoordinates = displayPlatforms
    .filter((platform) => displaySensors.some((sensor) => selectedSensorIds.has(sensor.sensor_id) && sensor.platform_id === platform.platform_id))
    .map((platform) => [platform.lon, platform.lat] as [number, number])
  const selectedAssetCoordinates = protectedAssets[0] ? ([[protectedAssets[0].lon, protectedAssets[0].lat]] as [number, number][]) : []
  const selectedPathCoordinates = probablePathFeatures.flatMap((feature) => (feature.geometry.type === 'LineString' ? feature.geometry.coordinates : []))
  const selectedModeCoordinates = [trackCoordinate, ...selectedAssetCoordinates, ...selectedPathCoordinates, ...selectedSensorPlatformCoordinates]
  const mapCenter =
    swarmMode && displayTracks.length > 0
      ? polygonLabelPoint(displayTracks.map(trackPoint))
      : selectedModeCoordinates.length > 1
        ? polygonLabelPoint(selectedModeCoordinates)
        : missionZoneRecord
          ? polygonLabelPoint(zoneCoordinates)
          : trackCoordinate
  const boundsCoordinates = swarmMode
    ? [
        ...displayTracks.map(trackPoint),
        ...probablePathFeatures.flatMap((feature) => (feature.geometry.type === 'LineString' ? feature.geometry.coordinates : [])),
        ...protectedAssets.map((asset) => [asset.lon, asset.lat] as [number, number]),
        ...restrictedZoneCoordinates,
      ]
    : selectedModeCoordinates
  const mapBounds = mapBoundsFromCoordinates(boundsCoordinates.length > 1 ? boundsCoordinates : [])
  const probablePath: GeoJsonCollection = {
    type: 'FeatureCollection',
    features: probablePathFeatures,
  }
  const trackHistoryLine: GeoJsonCollection = {
    type: 'FeatureCollection',
    features: historyLineFeatures,
  }
  const trackHistoryPoints: GeoJsonCollection = {
    type: 'FeatureCollection',
    features: trackHistoryPointFeatures,
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
  const latestDetectionBySensor = new Map<string, Detection>()
  records.forEach((detection) => {
    const current = latestDetectionBySensor.get(detection.sensor_id)

    if (!current || timestampValue(detection.timestamp) > timestampValue(current.timestamp)) {
      latestDetectionBySensor.set(detection.sensor_id, detection)
    }
  })
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
      const latestDetection = latestDetectionBySensor.get(sensor.sensor_id)
      const latestTrack = latestDetection
        ? displayTracks.find((track) => track.track_id === latestDetection.contributes_to_track_id)
        : selectedSensorIds.has(sensor.sensor_id)
          ? selectedTrack
          : null
      const group = modalityGroup(sensor.modality) as SourceEvidenceGroup
      const contributionStatus = contributionStatusBySensor.get(sensor.sensor_id)
      const previewStatus =
        contributionStatus ?? (latestDetection ? (isDetectionStale(demoStep, latestDetection) ? 'lost' : isDetectionActive(demoStep, latestDetection) ? 'active' : 'pending') : 'pending')
      const previewConfidence = latestDetection?.confidence ?? latestTrack?.confidence ?? 0
      const iconImage = group === 'Radar' ? 'sensor-radar' : group === 'EO' ? 'sensor-eoir' : 'sensor-acoustic-rf'

      const feature: GeoJsonFeature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: offset },
        properties: {
          id: sensor.sensor_id,
          platformId: sensor.platform_id,
          modality: modalityShortLabel(sensor.modality),
          modalityGroup: group,
          iconImage,
          platformCallsign: platform.callsign,
          measurementKind: sensor.measurement_kind,
          rangeMaxM: sensor.range_max_m,
          fovType: sensor.fov_type,
          previewStatus,
          previewTimestamp: latestDetection?.timestamp ?? latestTrack?.last_seen ?? '',
          previewConfidence,
          previewRangeM: latestDetection?.range_m ?? latestTrack?.distance_to_asset_m ?? null,
          previewBearingDeg: latestDetection?.bearing_deg ?? latestTrack?.heading_deg ?? null,
          previewSpeedMps: latestTrack?.speed_mps ?? null,
          previewTrackId: latestTrack?.track_id ?? null,
          previewClassification: latestDetection?.classification ?? latestTrack?.classification ?? 'Sensor watch',
          signalStrength: Math.round(Math.max(0.18, previewConfidence || 0.42) * 100),
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
    zoom: swarmMode ? 12.1 : protectedAssets.length > 0 ? 12.9 : activePlatforms.length > 3 ? 10.6 : 12.8,
    bounds: mapBounds,
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
      features: displayTracks.map((track) => {
        const isSelected = track.track_id === selectedTrack.track_id
        const risk = riskLevel(track.threat_score)
        const isSwarm = isSwarmMember(track, scenario)
        const iconState = isSelected ? 'selected' : risk === 'critical' || risk === 'high' ? 'critical' : swarmMode && isSwarm ? 'muted' : 'normal'

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: trackPoint(isSelected ? selectedTrack : track),
          },
          properties: {
            id: track.track_id,
            label: track.track_id,
            confidence: isSelected ? selectedTrack.confidence : track.confidence,
            threatScore: track.threat_score,
            risk,
            custody: track.custody_status,
            classification: track.classification ?? 'Fused contact',
            heading: track.heading_deg ?? 0,
            iconState,
            iconImage: `drone-${iconState}`,
            isSwarmMember: isSwarm,
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

function droneIconImage(color: string, stroke: string, alpha = 1) {
  const size = 48
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = size
  canvas.height = size

  if (!context) {
    return new ImageData(size, size)
  }

  context.clearRect(0, 0, size, size)
  context.globalAlpha = alpha
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = stroke
  context.fillStyle = color
  context.lineWidth = 3.2

  context.beginPath()
  context.moveTo(24, 7)
  context.lineTo(29, 23)
  context.lineTo(24, 27)
  context.lineTo(19, 23)
  context.closePath()
  context.fill()
  context.stroke()

  context.lineWidth = 3.8
  context.beginPath()
  context.moveTo(13, 18)
  context.lineTo(35, 18)
  context.moveTo(16, 30)
  context.lineTo(32, 30)
  context.moveTo(19, 23)
  context.lineTo(10, 15)
  context.moveTo(29, 23)
  context.lineTo(38, 15)
  context.moveTo(19, 25)
  context.lineTo(10, 34)
  context.moveTo(29, 25)
  context.lineTo(38, 34)
  context.stroke()

  context.lineWidth = 2.2
  ;[
    [10, 15],
    [38, 15],
    [10, 34],
    [38, 34],
  ].forEach(([x, y]) => {
    context.beginPath()
    context.arc(x, y, 4.4, 0, Math.PI * 2)
    context.stroke()
  })

  return context.getImageData(0, 0, size, size)
}

function sensorIconImage(kind: SourceEvidenceGroup) {
  const size = 48
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = size
  canvas.height = size

  if (!context) {
    return new ImageData(size, size)
  }

  const color = kind === 'Radar' ? '#36d8ef' : kind === 'EO' ? '#67e8a3' : '#f1b84b'
  context.clearRect(0, 0, size, size)
  context.strokeStyle = '#06101b'
  context.lineWidth = 7
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.fillStyle = color
  context.globalAlpha = 0.96

  if (kind === 'Radar') {
    context.beginPath()
    context.arc(24, 26, 13, Math.PI * 0.18, Math.PI * 0.82)
    context.stroke()
    context.beginPath()
    context.moveTo(24, 28)
    context.lineTo(15, 39)
    context.moveTo(24, 28)
    context.lineTo(33, 39)
    context.moveTo(13, 40)
    context.lineTo(35, 40)
    context.stroke()
    context.beginPath()
    context.arc(24, 25, 10, Math.PI * 1.04, Math.PI * 1.8)
    context.arc(24, 25, 16, Math.PI * 1.04, Math.PI * 1.8)
    context.stroke()
  } else if (kind === 'EO') {
    context.beginPath()
    context.roundRect(11, 15, 26, 19, 4)
    context.stroke()
    context.beginPath()
    context.arc(24, 24.5, 6, 0, Math.PI * 2)
    context.stroke()
    context.beginPath()
    context.moveTo(14, 36)
    context.lineTo(34, 36)
    context.moveTo(24, 34)
    context.lineTo(24, 40)
    context.stroke()
  } else {
    context.beginPath()
    context.moveTo(11, 27)
    context.quadraticCurveTo(15, 15, 19, 27)
    context.quadraticCurveTo(23, 39, 27, 27)
    context.quadraticCurveTo(31, 15, 35, 27)
    context.stroke()
    context.beginPath()
    context.moveTo(40, 16)
    context.lineTo(40, 36)
    context.moveTo(35, 20)
    context.quadraticCurveTo(43, 24, 35, 28)
    context.moveTo(32, 15)
    context.quadraticCurveTo(47, 24, 32, 33)
    context.stroke()
  }

  context.strokeStyle = color
  context.lineWidth = 3

  if (kind === 'Radar') {
    context.beginPath()
    context.arc(24, 26, 13, Math.PI * 0.18, Math.PI * 0.82)
    context.stroke()
    context.beginPath()
    context.moveTo(24, 28)
    context.lineTo(15, 39)
    context.moveTo(24, 28)
    context.lineTo(33, 39)
    context.moveTo(13, 40)
    context.lineTo(35, 40)
    context.stroke()
    context.beginPath()
    context.arc(24, 25, 10, Math.PI * 1.04, Math.PI * 1.8)
    context.arc(24, 25, 16, Math.PI * 1.04, Math.PI * 1.8)
    context.stroke()
  } else if (kind === 'EO') {
    context.beginPath()
    context.roundRect(11, 15, 26, 19, 4)
    context.stroke()
    context.beginPath()
    context.arc(24, 24.5, 6, 0, Math.PI * 2)
    context.stroke()
    context.beginPath()
    context.moveTo(14, 36)
    context.lineTo(34, 36)
    context.moveTo(24, 34)
    context.lineTo(24, 40)
    context.stroke()
  } else {
    context.beginPath()
    context.moveTo(11, 27)
    context.quadraticCurveTo(15, 15, 19, 27)
    context.quadraticCurveTo(23, 39, 27, 27)
    context.quadraticCurveTo(31, 15, 35, 27)
    context.stroke()
    context.beginPath()
    context.moveTo(40, 16)
    context.lineTo(40, 36)
    context.moveTo(35, 20)
    context.quadraticCurveTo(43, 24, 35, 28)
    context.moveTo(32, 15)
    context.quadraticCurveTo(47, 24, 32, 33)
    context.stroke()
  }

  return context.getImageData(0, 0, size, size)
}

function registerDroneIcons(map: maplibregl.Map) {
  const icons = [
    ['drone-normal', '#d9e7ee', '#273947', 0.9],
    ['drone-selected', '#fff2e8', '#ff6a3a', 1],
    ['drone-critical', '#ffd2bd', '#ef6048', 0.96],
    ['drone-muted', '#ffd076', '#4b3210', 0.9],
  ] as const

  icons.forEach(([id, color, stroke, alpha]) => {
    if (!map.hasImage(id)) {
      map.addImage(id, droneIconImage(color, stroke, alpha), { pixelRatio: 2 })
    }
  })
}

function registerSensorIcons(map: maplibregl.Map) {
  const icons: Array<[string, SourceEvidenceGroup]> = [
    ['sensor-radar', 'Radar'],
    ['sensor-eoir', 'EO'],
    ['sensor-acoustic-rf', 'Acoustic/RF'],
  ]

  icons.forEach(([id, group]) => {
    if (!map.hasImage(id)) {
      map.addImage(id, sensorIconImage(group), { pixelRatio: 2 })
    }
  })
}

function addMapLayers(map: maplibregl.Map) {
  if (map.getLayer('mission-zone-fill')) {
    return
  }

  registerDroneIcons(map)
  registerSensorIcons(map)
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
      'line-color': [
        'case',
        ['boolean', ['get', 'selected'], false],
        '#f1b84b',
        ['in', ['get', 'risk'], ['literal', ['critical', 'high']]],
        '#d89149',
        '#778491',
      ],
      'line-opacity': [
        'case',
        ['boolean', ['get', 'selected'], false],
        0.92,
        ['in', ['get', 'risk'], ['literal', ['critical', 'high']]],
        0.5,
        0.24,
      ],
      'line-width': ['case', ['boolean', ['get', 'selected'], false], 2.6, ['in', ['get', 'risk'], ['literal', ['critical', 'high']]], 1.8, 1.15],
      'line-dasharray': [1.3, 1.4],
    },
  })
  map.addLayer({
    id: 'track-history-line',
    type: 'line',
    source: 'track-history-line-source',
    paint: {
      'line-color': [
        'case',
        ['boolean', ['get', 'selected'], false],
        '#ff8d3b',
        ['in', ['get', 'risk'], ['literal', ['critical', 'high']]],
        '#a85e3a',
        '#64717d',
      ],
      'line-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.58, ['in', ['get', 'risk'], ['literal', ['critical', 'high']]], 0.32, 0.16],
      'line-width': ['case', ['boolean', ['get', 'selected'], false], 2, 1.1],
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
    id: 'sensor-preview-halo',
    type: 'circle',
    source: 'sensor-preview-source',
    paint: {
      'circle-radius': ['case', ['==', ['get', 'previewMode'], 'pinned'], 24, 20],
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
      'circle-opacity': ['case', ['==', ['get', 'previewMode'], 'pinned'], 0.24, 0.16],
      'circle-stroke-color': '#fff4e8',
      'circle-stroke-opacity': ['case', ['==', ['get', 'previewMode'], 'pinned'], 0.86, 0.58],
      'circle-stroke-width': ['case', ['==', ['get', 'previewMode'], 'pinned'], 2.2, 1.5],
    },
  })
  map.addLayer({
    id: 'sensor-preview-core',
    type: 'circle',
    source: 'sensor-preview-source',
    paint: {
      'circle-radius': 8.5,
      'circle-color': '#f7fbff',
      'circle-opacity': 0.86,
      'circle-stroke-color': '#06101b',
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: 'sensor-halos',
    type: 'circle',
    source: 'sensors-source',
    paint: {
      'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 17, ['boolean', ['get', 'relevant'], false], 14, 12],
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
      'circle-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.22, ['boolean', ['get', 'relevant'], false], 0.15, 0.08],
      'circle-stroke-color': '#d9eef8',
      'circle-stroke-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.48, ['boolean', ['get', 'relevant'], false], 0.24, 0.16],
      'circle-stroke-width': 1,
    },
  })
  map.addLayer({
    id: 'sensors',
    type: 'circle',
    source: 'sensors-source',
    paint: {
      'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 9.2, ['boolean', ['get', 'relevant'], false], 7.8, 6.8],
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
      'circle-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.98, ['boolean', ['get', 'relevant'], false], 0.88, 0.74],
      'circle-stroke-color': '#06101b',
      'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 2.6, 2],
    },
  })
  map.addLayer({
    id: 'sensor-icons',
    type: 'symbol',
    source: 'sensors-source',
    layout: {
      'icon-image': ['get', 'iconImage'],
      'icon-size': ['case', ['boolean', ['get', 'selected'], false], 0.54, ['boolean', ['get', 'relevant'], false], 0.48, 0.44],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-opacity': ['case', ['boolean', ['get', 'selected'], false], 1, ['boolean', ['get', 'relevant'], false], 0.94, 0.82],
    },
  })
  map.addLayer({
    id: 'sensor-hitbox',
    type: 'circle',
    source: 'sensors-source',
    paint: {
      'circle-radius': 18,
      'circle-color': '#ffffff',
      'circle-opacity': 0,
    },
  })
  map.addLayer({
    id: 'sensor-labels',
    type: 'symbol',
    source: 'sensors-source',
    filter: ['any', ['==', ['get', 'selected'], true], ['==', ['get', 'relevant'], true]],
    layout: {
      'text-field': ['get', 'modality'],
      'text-size': 10,
      'text-offset': [0, 1.45],
      'text-anchor': 'top',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#f2f9ff',
      'text-halo-color': '#06101b',
      'text-halo-width': 1.5,
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
      'circle-radius': [
        'case',
        ['boolean', ['get', 'selected'], false],
        24,
        ['in', ['get', 'risk'], ['literal', ['critical', 'high']]],
        18,
        ['boolean', ['get', 'isSwarmMember'], false],
        16,
        13,
      ],
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-stroke-color': [
        'case',
        ['boolean', ['get', 'selected'], false],
        '#ff643a',
        ['in', ['get', 'risk'], ['literal', ['critical', 'high']]],
        '#ef6048',
        ['boolean', ['get', 'isSwarmMember'], false],
        '#f5a542',
        '#7e8c98',
      ],
      'circle-stroke-opacity': [
        'case',
        ['boolean', ['get', 'selected'], false],
        0.95,
        ['in', ['get', 'risk'], ['literal', ['critical', 'high']]],
        0.72,
        ['boolean', ['get', 'isSwarmMember'], false],
        0.58,
        0.32,
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['get', 'selected'], false],
        4.5,
        ['in', ['get', 'risk'], ['literal', ['critical', 'high']]],
        2.4,
        ['boolean', ['get', 'isSwarmMember'], false],
        2,
        1.4,
      ],
    },
  })
  map.addLayer({
    id: 'fused-track-icon',
    type: 'symbol',
    source: 'fused-tracks-source',
    layout: {
      'icon-image': ['get', 'iconImage'],
      'icon-size': [
        'case',
        ['boolean', ['get', 'selected'], false],
        0.72,
        ['in', ['get', 'risk'], ['literal', ['critical', 'high']]],
        0.62,
        ['boolean', ['get', 'isSwarmMember'], false],
        0.58,
        0.5,
      ],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
    },
    paint: {
      'icon-opacity': [
        'case',
        ['boolean', ['get', 'selected'], false],
        1,
        ['in', ['get', 'risk'], ['literal', ['critical', 'high']]],
        0.95,
        ['boolean', ['get', 'isSwarmMember'], false],
        0.88,
        0.68,
      ],
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
      'text-opacity': ['case', ['boolean', ['get', 'selected'], false], 1, ['boolean', ['get', 'isSwarmMember'], false], 0.78, 0.5],
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
    'sensor-preview-source': emptyCollection(),
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
  scenario,
  tracks,
}: {
  detections: Detection[]
  protectedAssets: ProtectedAsset[]
  scenario: SimulationScenarioKey
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
      behaviorLabel: isSwarmScenario(scenario) ? swarmBehaviorLabel(track, tracks, protectedAssets, scenario) : undefined,
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

function isVerifiedTarget(item: TrackQueueItem) {
  return item.confidence >= 0.72 || /maintained|verified|confirmed/i.test(item.custodyStatus)
}

function sourceGroupsForTrack(sourceTypes: string[]): SourceEvidenceGroup[] {
  const groups = new Set(sourceTypes.map((source) => modalityGroup(source)))
  return (['Radar', 'EO', 'Acoustic/RF'] as const).filter((group) => groups.has(group))
}

function sourceGroupLabel(group: SourceEvidenceGroup) {
  return group === 'EO' ? 'EO/IR' : group
}

function sourceGroupClass(group: SourceEvidenceGroup) {
  return group.toLowerCase().replace('/', '-')
}

function sensorEvidenceState(track: FusedTrack, records: Detection[], group: SourceEvidenceGroup): 'active' | 'pending' | 'lost' {
  const relatedDetections = records.filter(
    (detection) => detection.contributes_to_track_id === track.track_id && modalityGroup(detection.modality) === group,
  )
  const relatedContributions = track.fusion_contributions?.filter((contribution) => modalityGroup(contribution.modality) === group) ?? []
  const hasActiveContribution = relatedContributions.some((contribution) => !/lost|stale|pending|degraded/i.test(contribution.status))
  const hasActiveDetection = relatedDetections.some((detection) => !detection.is_stale)

  if (hasActiveContribution || hasActiveDetection || sourceGroupsForTrack(sourceTokens(track.source_summary)).includes(group)) {
    return 'active'
  }

  const hasLostSignal =
    relatedContributions.some((contribution) => /lost|stale|degraded|reacquir/i.test(contribution.status)) ||
    relatedDetections.some((detection) => detection.is_stale)

  return hasLostSignal ? 'lost' : 'pending'
}

function trackAltitudeLabel(track: FusedTrack) {
  const altitudeM =
    (track as FusedTrack & { altitude_m?: number; altitude_meters?: number }).altitude_m ??
    (track as FusedTrack & { altitude_m?: number; altitude_meters?: number }).altitude_meters

  return typeof altitudeM === 'number' && Number.isFinite(altitudeM) ? `${Math.round(altitudeM)} m` : null
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
  const rangeOrEtaLabel = item.etaLabel !== 'Unknown' && item.etaLabel !== 'N/A' ? item.etaLabel : item.rangeLabel
  const sourceGroups = sourceGroupsForTrack(item.sourceTypes)

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
        <strong>{item.id}</strong>
        <span>{item.classification}</span>
      </span>
      <span className={`risk-badge risk-${riskLevel(item.threatScore)}`}>{riskLabel(item.threatScore)}</span>
      <span className="source-token-row compact-source-row">
        {sourceGroups.map((group) => (
          <i className={`source-token ${sourceGroupClass(group)}`} key={group}>
            {sourceGroupLabel(group)}
          </i>
        ))}
      </span>
      <strong className="queue-title">{rangeOrEtaLabel}</strong>
      <span className="queue-status">{item.movementState}</span>
    </button>
  )
}

function SensorEvidenceDetailCard({
  group,
  onDismiss,
  track,
}: {
  group: SourceEvidenceGroup
  onDismiss: () => void
  track: FusedTrack
}) {
  const preview: SensorQuickLookPreview = {
    sensorId: `${track.track_id}-${sourceGroupLabel(group)}`,
    platformId: 'LOCAL-DEMO',
    platformCallsign: 'Selected target evidence',
    modality: sourceGroupLabel(group),
    modalityGroup: group,
    measurementKind: group === 'Radar' ? 'Demo radar plot' : group === 'EO' ? 'EO/IR visual cue' : 'Acoustic/RF signature',
    status: group === 'EO' || group === 'Acoustic/RF' ? 'active' : track.custody_status,
    timestamp: track.updated_at ?? track.last_seen,
    confidence: track.confidence,
    rangeM: track.distance_to_asset_m ?? null,
    bearingDeg: track.heading_deg ?? null,
    speedMps: track.speed_mps ?? null,
    altitudeLabel: trackAltitudeLabel(track) ?? 'N/A',
    trackId: track.track_id,
    classification: track.classification ?? 'Sensor watch',
    signalStrength: Math.round(Math.max(0.18, track.confidence) * 100),
    coordinate: [track.estimated_lon, track.estimated_lat],
    screenPoint: { x: 0, y: 0 },
    mode: 'pinned',
  }
  const acousticAsset = group === 'Acoustic/RF' ? acousticEvidenceAssetForTrack(track.track_id, track.classification) : null
  const notes =
    group === 'EO'
      ? ['Compass folder linked', 'EO/IR carousel uses local exported frames', 'No runtime Foundry fetch']
      : group === 'Acoustic/RF'
        ? ['MIO media set linked', 'Click play for drone acoustic evidence', 'No autoplay']
        : ['Fused radar plot', 'Track confidence retained for operator review']

  function closePreview() {
    if (group === 'Acoustic/RF') {
      stopAcousticCue()
    }

    onDismiss()
  }

  return (
    <article className={`inline-evidence-popover ${sourceGroupClass(group)}`} onMouseLeave={group === 'Acoustic/RF' ? stopAcousticCue : undefined}>
      <header>
        <span>{track.track_id}</span>
        <strong>{group === 'EO' ? 'EO/IR evidence carousel' : group === 'Acoustic/RF' ? 'Acoustic/RF drone sound' : 'Radar evidence'}</strong>
        <button aria-label="Close evidence preview" type="button" onClick={closePreview}>
          X
        </button>
      </header>
      <SensorPreviewVisual preview={preview} />
      <ul>
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      {group === 'Acoustic/RF' ? <EvidenceAudioButton asset={acousticAsset} /> : null}
    </article>
  )
}

function LeftTrackRail({
  detections: records,
  protectedAssets,
  scenario,
  selectedTrack,
  selectedTrackId,
  tracks,
  onCreateAction,
  onSelectTrack,
}: {
  detections: Detection[]
  protectedAssets: ProtectedAsset[]
  scenario: SimulationScenarioKey
  selectedTrack: FusedTrack
  selectedTrackId: string
  tracks: FusedTrack[]
  onCreateAction: (actionType: string, label: string) => void
  onSelectTrack: (trackId: string) => void
}) {
  const [activeTab, setActiveTab] = useState<TargetVerificationTab>('verified')
  const [evidencePreviewGroup, setEvidencePreviewGroup] = useState<SourceEvidenceGroup | null>(null)
  const queueItems = useMemo(
    () => buildTrackQueueItems({ detections: records, protectedAssets, scenario, tracks }),
    [protectedAssets, records, scenario, tracks],
  )
  const verifiedItems = queueItems.filter(isVerifiedTarget)
  const unverifiedItems = queueItems.filter((item) => !isVerifiedTarget(item))
  const tabItems = activeTab === 'verified' ? verifiedItems : unverifiedItems
  const visibleQueueItems = (tabItems.length > 0 ? tabItems : queueItems).slice(0, 6)
  const selectedQueueItem = queueItems.find((item) => item.trackId === selectedTrackId && item.kind === 'track') ?? queueItems[0]
  const selectedDetections = records.filter((record) => record.contributes_to_track_id === selectedTrack.track_id)
  const threatSnapshot = buildThreatSnapshot(selectedTrack, selectedDetections, protectedAssets)
  const selectedAltitudeLabel = trackAltitudeLabel(selectedTrack)
  const detailRows = [
    { label: 'Range', value: threatSnapshot.rangeLabel },
    { label: 'Bearing', value: threatSnapshot.bearingLabel },
    { label: 'Speed', value: threatSnapshot.speedLabel },
    ...(selectedAltitudeLabel ? [{ label: 'Altitude', value: selectedAltitudeLabel }] : []),
    { label: 'Confidence', value: formatConfidence(selectedTrack.confidence) },
    { label: 'Custody', value: selectedTrack.custody_status },
  ]
  const evidenceGroups: SourceEvidenceGroup[] = ['Radar', 'EO', 'Acoustic/RF']
  const simpleActions = [
    { actionType: 'verify', label: 'Verify' },
    { actionType: 'friend', label: 'Friend' },
    { actionType: 'foe', label: 'Foe' },
    { actionType: 'track', label: 'Track' },
    { actionType: 'reacquire', label: 'Reacquire' },
    { actionType: 'dismiss', label: 'Dismiss' },
  ]

  useEffect(() => {
    stopAcousticCue()
    setEvidencePreviewGroup(null)
  }, [selectedTrack.track_id])

  function setEvidencePreview(nextGroup: SourceEvidenceGroup | null) {
    if (evidencePreviewGroup === 'Acoustic/RF' && nextGroup !== 'Acoustic/RF') {
      stopAcousticCue()
    }

    setEvidencePreviewGroup(nextGroup)
  }

  return (
    <aside className="left-rail simplified-monitoring" aria-labelledby="queue-title">
      <section className="queue-toolbar monitoring-header">
        <div>
          <span>Monitoring</span>
          <strong id="queue-title">{queueItems.length} targets</strong>
        </div>
        <em>{riskLabel(selectedTrack.threat_score)}</em>
      </section>

      <div className="target-tabs" aria-label="Target verification tabs">
        <button className={activeTab === 'verified' ? 'is-selected' : ''} type="button" onClick={() => setActiveTab('verified')}>
          Verified <span>{verifiedItems.length}</span>
        </button>
        <button className={activeTab === 'unverified' ? 'is-selected' : ''} type="button" onClick={() => setActiveTab('unverified')}>
          Unverified <span>{unverifiedItems.length}</span>
        </button>
      </div>

      <div className="track-result-list">
        {visibleQueueItems.map((item) => (
          <TrackQueueCard
            item={item}
            key={item.id}
            selected={selectedTrackId === item.trackId && item.kind === 'track'}
            onSelect={() => onSelectTrack(item.trackId)}
          />
        ))}
      </div>

      <section className="selected-target-panel" aria-label="Selected target details">
        <div className="selected-target-heading">
          <span>Details Target: {selectedQueueItem?.priorityRank ?? 1}</span>
          <strong>{selectedTrack.track_id}</strong>
          <em>{threatSnapshot.classification}</em>
        </div>
        <dl className="selected-target-grid">
          {detailRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="sensor-evidence-panel" aria-label="Sensor evidence states">
        <span>Sensor Evidence</span>
        <div className="sensor-evidence-row">
          {evidenceGroups.map((group) => {
            const state = sensorEvidenceState(selectedTrack, records, group)
            return (
              <button
                className={`sensor-evidence-pill ${sourceGroupClass(group)} is-${state} ${evidencePreviewGroup === group ? 'is-selected' : ''}`}
                key={group}
                type="button"
                onClick={() => setEvidencePreview(evidencePreviewGroup === group ? null : group)}
                onFocus={() => setEvidencePreview(group)}
                onMouseEnter={() => setEvidencePreview(group)}
                onMouseLeave={group === 'Acoustic/RF' ? stopAcousticCue : undefined}
              >
                <strong>{sourceGroupLabel(group)}</strong>
                <em>{state}</em>
              </button>
            )
          })}
        </div>
        {evidencePreviewGroup ? (
          <SensorEvidenceDetailCard
            group={evidencePreviewGroup}
            track={selectedTrack}
            onDismiss={() => setEvidencePreview(null)}
          />
        ) : null}
      </section>

      <section className="simple-action-panel" aria-label="Target actions">
        {simpleActions.map((action) => (
          <button key={action.actionType} type="button" onClick={() => onCreateAction(action.actionType, action.label)}>
            {action.label}
          </button>
        ))}
      </section>
    </aside>
  )
}

function MissionMap({
  mapData,
  readyStatus,
  selectedTrack,
  visibleLayers,
  onSelectDetectionId,
  onSelectTrackId,
}: {
  mapData: MapData
  readyStatus: string
  selectedTrack: FusedTrack
  visibleLayers: Record<LayerKey, boolean>
  onSelectDetectionId: (detectionId: string | null) => void
  onSelectTrackId: (trackId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const initialMapDataRef = useRef(mapData)
  const latestMapDataRef = useRef(mapData)
  const initialVisibleLayersRef = useRef(visibleLayers)
  const latestSelectDetection = useRef(onSelectDetectionId)
  const latestSelectTrack = useRef(onSelectTrackId)
  const sensorPreviewRef = useRef<SensorQuickLookPreview | null>(null)
  const pinnedSensorIdRef = useRef<string | null>(null)
  const hoverOpenTimerRef = useRef<number | null>(null)
  const hoverCloseTimerRef = useRef<number | null>(null)
  const [sensorPreview, setSensorPreview] = useState<SensorQuickLookPreview | null>(null)
  const [sensorMarkers, setSensorMarkers] = useState<SensorMarkerOverlayItem[]>([])
  const [mapViewportSize, setMapViewportSize] = useState({ width: 960, height: 640 })
  const [mapReady, setMapReady] = useState(false)
  const [tileFallback, setTileFallback] = useState(false)

  function clearSensorPreviewTimers() {
    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current)
      hoverOpenTimerRef.current = null
    }

    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current)
      hoverCloseTimerRef.current = null
    }
  }

  function setSensorPreviewState(preview: SensorQuickLookPreview | null) {
    sensorPreviewRef.current = preview
    setSensorPreview(preview)

    const source = mapRef.current?.getSource('sensor-preview-source') as maplibregl.GeoJSONSource | undefined
    source?.setData(sensorPreviewHighlight(preview))
  }

  function dismissSensorPreview() {
    clearSensorPreviewTimers()
    pinnedSensorIdRef.current = null
    stopAcousticCue()
    setSensorPreviewState(null)
  }

  function updateMapViewportSize() {
    const container = containerRef.current

    if (!container) {
      return
    }

    setMapViewportSize({ width: container.clientWidth, height: container.clientHeight })
  }

  function refreshSensorMarkerOverlay(data = latestMapDataRef.current) {
    const map = mapRef.current

    if (!map) {
      return
    }

    setSensorMarkers(sensorMarkerOverlayItems(data, map))
  }

  function updateCurrentSensorPreviewPosition() {
    const map = mapRef.current
    const currentPreview = sensorPreviewRef.current

    if (!map || !currentPreview) {
      return
    }

    const point = map.project(currentPreview.coordinate)
    const nextPreview = { ...currentPreview, screenPoint: { x: point.x, y: point.y } }
    sensorPreviewRef.current = nextPreview
    setSensorPreview(nextPreview)
  }

  function openOverlaySensorPreview(marker: SensorMarkerOverlayItem, mode: SensorPreviewMode) {
    const preview = sensorPreviewFromGeoJsonFeature(marker.feature, marker.screenPoint, mode)

    if (!preview) {
      return
    }

    if (mode === 'pinned') {
      clearSensorPreviewTimers()
      pinnedSensorIdRef.current = preview.sensorId
      setSensorPreviewState(preview)
      return
    }

    if (pinnedSensorIdRef.current) {
      return
    }

    if (sensorPreviewRef.current?.sensorId === preview.sensorId) {
      return
    }

    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current)
      hoverCloseTimerRef.current = null
    }

    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current)
    }

    hoverOpenTimerRef.current = window.setTimeout(() => setSensorPreviewState(preview), 120)
  }

  function scheduleHoverPreviewClose() {
    if (pinnedSensorIdRef.current) {
      return
    }

    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current)
      hoverOpenTimerRef.current = null
    }

    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current)
    }

    hoverCloseTimerRef.current = window.setTimeout(() => {
      stopAcousticCue()
      setSensorPreviewState(null)
    }, 180)
  }

  function holdHoverPreviewOpen() {
    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current)
      hoverCloseTimerRef.current = null
    }
  }

  useEffect(() => {
    latestSelectDetection.current = onSelectDetectionId
    latestSelectTrack.current = onSelectTrackId
  }, [onSelectDetectionId, onSelectTrackId])

  useEffect(() => {
    latestMapDataRef.current = mapData
  }, [mapData])

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
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
    updateMapViewportSize()

    map.on('load', () => {
      addMapLayers(map)
      updateMapSources(map, initialMapDataRef.current)
      setLayerVisibility(map, initialVisibleLayersRef.current)
      refreshSensorMarkerOverlay(initialMapDataRef.current)
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
      const sensorFeature = features.find((candidate) => sensorInteractiveLayerIds.includes(candidate.layer.id))
      const feature = sensorFeature ?? features[0]

      if (!feature) {
        latestSelectDetection.current(null)
        return
      }

      const id = feature.properties?.id

      if (sensorFeature) {
        const preview = sensorPreviewFromFeature(sensorFeature, map, 'pinned')

        if (preview) {
          clearSensorPreviewTimers()
          pinnedSensorIdRef.current = preview.sensorId
          setSensorPreviewState(preview)
        }

        return
      }

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
      const sensorFeature = features.find((candidate) => sensorInteractiveLayerIds.includes(candidate.layer.id))
      const feature = sensorFeature ?? features[0]

      map.getCanvas().style.cursor = feature ? 'pointer' : ''

      if (sensorFeature) {
        if (pinnedSensorIdRef.current) {
          return
        }

        const currentSensorId = propertyString(sensorFeature.properties?.id)

        if (sensorPreviewRef.current?.sensorId === currentSensorId) {
          return
        }

        if (hoverCloseTimerRef.current !== null) {
          window.clearTimeout(hoverCloseTimerRef.current)
          hoverCloseTimerRef.current = null
        }

        if (hoverOpenTimerRef.current !== null) {
          window.clearTimeout(hoverOpenTimerRef.current)
        }

        hoverOpenTimerRef.current = window.setTimeout(() => {
          const preview = sensorPreviewFromFeature(sensorFeature, map, 'hover')

          if (preview) {
            setSensorPreviewState(preview)
          }
        }, 120)
        return
      }

      if (!pinnedSensorIdRef.current && sensorPreviewRef.current) {
        if (hoverOpenTimerRef.current !== null) {
          window.clearTimeout(hoverOpenTimerRef.current)
          hoverOpenTimerRef.current = null
        }

        if (hoverCloseTimerRef.current !== null) {
          window.clearTimeout(hoverCloseTimerRef.current)
        }

        hoverCloseTimerRef.current = window.setTimeout(() => {
          stopAcousticCue()
          setSensorPreviewState(null)
        }, 180)
      }
    })
    const handleMapViewportChange = () => {
      refreshSensorMarkerOverlay()
      updateCurrentSensorPreviewPosition()
    }
    const handleResize = () => {
      updateMapViewportSize()
      handleMapViewportChange()
    }

    map.on('move', handleMapViewportChange)
    map.on('resize', handleResize)
    window.addEventListener('resize', handleResize)
    map.on('mouseout', () => {
      map.getCanvas().style.cursor = ''

      if (!pinnedSensorIdRef.current) {
        if (hoverOpenTimerRef.current !== null) {
          window.clearTimeout(hoverOpenTimerRef.current)
          hoverOpenTimerRef.current = null
        }

        hoverCloseTimerRef.current = window.setTimeout(() => {
          stopAcousticCue()
          setSensorPreviewState(null)
        }, 180)
      }
    })

    return () => {
      clearSensorPreviewTimers()
      window.removeEventListener('resize', handleResize)
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
    refreshSensorMarkerOverlay(mapData)
    const previewSource = map.getSource('sensor-preview-source') as maplibregl.GeoJSONSource | undefined
    previewSource?.setData(sensorPreviewHighlight(sensorPreviewRef.current))
    if (mapData.bounds) {
      map.fitBounds(mapData.bounds, {
        padding: { top: 86, right: 170, bottom: 72, left: 150 },
        maxZoom: 13.4,
        duration: 450,
        essential: true,
      })
    } else {
      map.easeTo({
        center: mapData.center,
        zoom: mapData.zoom,
        duration: 450,
        essential: true,
      })
    }
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

        <div className="sensor-marker-overlay" aria-label="Map sensor quick-look markers">
          {sensorMarkers.map((marker) => {
            const isSelected = sensorPreview?.sensorId === marker.id
            const markerStyle = {
              left: marker.screenPoint.x,
              top: marker.screenPoint.y,
            } as CSSProperties

            return (
              <button
                aria-label={`${sourceGroupLabel(marker.modalityGroup)} sensor ${marker.id}`}
                className={`sensor-map-marker ${sourceGroupClass(marker.modalityGroup)} is-${sensorPreviewStatusClass(marker.status)} ${isSelected ? 'is-selected' : ''} ${
                  isSelected && sensorPreview?.mode === 'pinned' ? 'is-pinned' : ''
                }`}
                key={marker.id}
                onBlur={scheduleHoverPreviewClose}
                onClick={(event) => {
                  event.stopPropagation()
                  openOverlaySensorPreview(marker, 'pinned')
                }}
                onFocus={() => openOverlaySensorPreview(marker, 'hover')}
                onMouseEnter={() => openOverlaySensorPreview(marker, 'hover')}
                onMouseLeave={scheduleHoverPreviewClose}
                style={markerStyle}
                type="button"
              >
                <SensorMarkerGlyph group={marker.modalityGroup} />
                <span>{sourceGroupLabel(marker.modalityGroup)}</span>
                <em>{marker.label}</em>
              </button>
            )
          })}
        </div>

        <div className="map-status-strip">
          <span>Tactical Map</span>
          <strong id="map-title">{selectedTrack.track_id}</strong>
          <em>{readyStatus}</em>
        </div>

        <div className="map-track-chip">
          <span>{riskLabel(selectedTrack.threat_score)} target</span>
          <strong>{selectedTrack.track_id}</strong>
          <em>{formatConfidence(selectedTrack.confidence)} / {selectedTrack.custody_status}</em>
        </div>

        {tileFallback ? <div className="tile-fallback-badge">Grid fallback active</div> : null}
        {sensorPreview ? (
          <SensorPreviewPopover
            viewportSize={mapViewportSize}
            preview={sensorPreview}
            onDismiss={dismissSensorPreview}
            onMouseEnter={holdHoverPreviewOpen}
            onMouseLeave={scheduleHoverPreviewClose}
          />
        ) : null}
      </div>
    </section>
  )
}

function LiveIntelCardView({ card }: { card: LiveIntelCard }) {
  const normalized = normalizeModality(card.modality)
  const group = normalized.includes('RF') ? 'RF' : modalityGroup(card.modality)
  const acoustic = normalized.includes('ACOUSTIC')
  const audioAsset = acoustic ? acousticEvidenceAssetForTrack(card.trackId, card.label) : null

  return (
    <article
      className={`live-intel-card ${modalityClass(card.modality)} ${normalized.includes('RF') ? 'rf' : ''} ${card.isNew ? 'is-new' : ''}`}
    >
      <span className="intel-thumb" aria-hidden="true">
        <i />
        <b />
        <em />
      </span>
      <span className="intel-meta">
        <strong>{group === 'EO' ? 'EO/IR' : group}</strong>
        <small>{formatConfidence(card.confidence)} / {formatTimestamp(card.timestamp)}</small>
        <em>{card.label}</em>
      </span>
      {acoustic ? <EvidenceAudioButton asset={audioAsset} /> : null}
    </article>
  )
}

function RightWorkflowRail({
  actions,
  allTracks,
  briefing,
  demoStep,
  detections: records,
  protectedAssets,
  protectedZones,
  scenario,
  selectedTrack,
  onCreateAction,
}: {
  actions: OperatorAction[]
  allTracks: FusedTrack[]
  briefing: ScenarioBriefing
  demoStep: DemoStep | null
  detections: Detection[]
  protectedAssets: ProtectedAsset[]
  protectedZones: ProtectedZone[]
  scenario: SimulationScenarioKey
  selectedTrack: FusedTrack
  onCreateAction: (actionType: string, label: string) => void
}) {
  const relatedDetections = records.filter((detection) => detection.contributes_to_track_id === selectedTrack.track_id)
  const latestDetection = [...relatedDetections].sort((a, b) => timestampValue(b.timestamp) - timestampValue(a.timestamp))[0]
  const threatSnapshot = buildThreatSnapshot(selectedTrack, relatedDetections, protectedAssets)
  const recommendation = buildOperatorRecommendation({
    selectedTrack,
    allTracks,
    scenario,
    protectedAssets,
    zones: protectedZones,
    fusionContributions: selectedTrack.fusion_contributions,
    evidence: selectedTrack.evidence,
    currentPhase: briefing,
  })
  const swarmTriageItems = buildSwarmTriageItems({
    allTracks,
    selectedTrack,
    scenario,
    protectedAssets,
    zones: protectedZones,
    briefing,
  })
  const liveIntelCards = buildLiveIntelCards(selectedTrack, relatedDetections)
  const commandRows = [
    { label: 'Confidence', value: formatConfidence(selectedTrack.confidence) },
    { label: 'Range', value: threatSnapshot.rangeLabel },
    { label: 'ETA', value: threatSnapshot.etaLabel },
    { label: 'Custody', value: selectedTrack.custody_status },
    { label: 'Asset at risk', value: threatSnapshot.protectedAssetLabel },
  ]
  const whyDroneRows = explainabilityRows(selectedTrack, records)
  const operatorFeed = decisionFeedItems({
    actions,
    latestDetection,
    selectedTrack,
    snapshot: threatSnapshot,
  })
  const primaryAction =
    actionButtons.find((action) => action.action_type === recommendation.suggestedCommands[0]?.actionType) ??
    actionButtons.find((action) => action.label === recommendation.primaryAction) ??
    actionButtons[0]
  const secondaryActions = actionButtons.filter((action) => action.action_type !== primaryAction.action_type)
  const compactFeed = operatorFeed.slice(0, 3)

  return (
    <aside className="right-rail" aria-labelledby="workflow-title">
      <section className={`decision-panel risk-${riskLevel(selectedTrack.threat_score)}`}>
        <div className="decision-header">
          <div>
            <span>Top Threat</span>
            <strong id="workflow-title">{selectedTrack.track_id}</strong>
            <b className="track-classification">{threatSnapshot.classification}</b>
          </div>
          <em>{riskLabel(selectedTrack.threat_score)}</em>
        </div>

        <button
          className={`command-action ${demoStep?.emphasizeAction || recommendation.severity === 'critical' || recommendation.severity === 'high' ? 'is-emphasized' : ''}`}
          type="button"
          onClick={() => onCreateAction(primaryAction.action_type, primaryAction.label)}
        >
          <span>Do now</span>
          <strong>{primaryAction.label}</strong>
          <p>{recommendation.reason}</p>
        </button>

        <div className="why-care-card">
          <span>Why we care</span>
          <p>{recommendation.why.slice(0, 3).join(' / ')}</p>
        </div>

        <dl className="command-grid">
          {commandRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        {swarmTriageItems.length > 0 ? (
          <section className="swarm-triage" aria-label="Swarm triage">
            <div className="mini-section-header">
              <span>Swarm Triage</span>
              <strong>{swarmTriageItems.length} priorities</strong>
            </div>
            <div className="triage-list">
              {swarmTriageItems.map((item) => (
                <article className={`triage-item risk-${item.severity}`} key={item.trackId}>
                  <span>{item.trackId} · {item.behavior}</span>
                  <strong>{item.recommendedAction}</strong>
                  <small>{item.reason}</small>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="live-intel" aria-label="Live intelligence evidence">
          <div className="mini-section-header">
            <span>Live Intel</span>
            <strong>{liveIntelCards.length} cards</strong>
          </div>
          <div className="live-intel-grid">
            {liveIntelCards.map((card) => (
              <LiveIntelCardView card={card} key={card.id} />
            ))}
          </div>
        </section>

        <details className="secondary-intel">
          <summary>Sensor rationale</summary>
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
        </details>
      </section>

      <section className="recommendation-panel">
        <span>Secondary actions</span>
        <div className="workflow-actions" aria-label="Operator actions">
          {secondaryActions.map((action) => (
            <button
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
          <span>Recent</span>
          <strong>{operatorFeed.length} events</strong>
        </div>
        <div className="audit-list">
          {compactFeed.map((item) => (
            <article className={`audit-item feed-${custodyClass(item.type)}`} key={item.id}>
              <span>{formatTimestamp(item.timestamp)}</span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
        <div className="latest-action">
          <span>Current action</span>
          <strong>{recommendation.primaryAction}</strong>
        </div>
      </section>
    </aside>
  )
}

const defaultScenarioKey: SimulationScenarioKey = 'singleDroneIntrusion'

function staticBriefing(dataMode: DataMode, tracks: FusedTrack[], scenario: ReturnType<typeof getPalantirDemoScenario>): ScenarioBriefing {
  const highestThreat = Math.max(0, ...tracks.map((track) => track.threat_score))

  return {
    scenario_key: scenario.scenarioId,
    scenario_name: scenario.scenarioName,
    objective: scenario.description,
    phase_label: dataMode === 'palantirMission' ? 'Mission data' : 'Snapshot data',
    phase_description:
      dataMode === 'palantirMission'
        ? 'Detection, fused track, evidence, and operator action records are loaded from Foundry demo datasets.'
        : 'Platform, sensor, zone, and track records are loaded from Foundry demo datasets.',
    elapsed_seconds: 0,
    next_event: undefined,
    active_tracks: tracks.length,
    highest_threat: highestThreat,
  }
}

function propertyString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function propertyNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function previewGroup(value: unknown): SourceEvidenceGroup {
  const group = propertyString(value)

  if (group === 'Radar' || group === 'EO' || group === 'Acoustic/RF') {
    return group
  }

  return modalityGroup(group) as SourceEvidenceGroup
}

function pointCoordinatesFromFeature(feature: Pick<GeoJsonFeature, 'geometry'> | maplibregl.MapGeoJSONFeature): [number, number] | null {
  if (feature.geometry.type !== 'Point') {
    return null
  }

  const coordinates = feature.geometry.coordinates

  if (coordinates.length < 2 || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
    return null
  }

  return [coordinates[0], coordinates[1]]
}

function sensorPreviewFromProperties(
  properties: Record<string, unknown>,
  coordinate: [number, number],
  screenPoint: { x: number; y: number },
  mode: SensorPreviewMode,
): SensorQuickLookPreview {
  const confidence = propertyNumber(properties.previewConfidence) ?? 0

  return {
    sensorId: propertyString(properties.id, 'SENSOR'),
    platformId: propertyString(properties.platformId, 'PLATFORM'),
    platformCallsign: propertyString(properties.platformCallsign, 'Sensor platform'),
    modality: propertyString(properties.modality, 'Sensor'),
    modalityGroup: previewGroup(properties.modalityGroup),
    measurementKind: propertyString(properties.measurementKind, 'Detection feed'),
    status: propertyString(properties.previewStatus, 'pending'),
    timestamp: propertyString(properties.previewTimestamp, 'Live'),
    confidence,
    rangeM: propertyNumber(properties.previewRangeM),
    bearingDeg: propertyNumber(properties.previewBearingDeg),
    speedMps: propertyNumber(properties.previewSpeedMps),
    altitudeLabel: propertyString(properties.previewAltitude, 'N/A'),
    trackId: propertyString(properties.previewTrackId) || null,
    classification: propertyString(properties.previewClassification, 'Sensor watch'),
    signalStrength: propertyNumber(properties.signalStrength) ?? Math.round(Math.max(0.18, confidence || 0.42) * 100),
    coordinate,
    screenPoint,
    mode,
  }
}

function sensorPreviewFromFeature(
  feature: maplibregl.MapGeoJSONFeature,
  map: maplibregl.Map,
  mode: SensorPreviewMode,
): SensorQuickLookPreview | null {
  const coordinate = pointCoordinatesFromFeature(feature)

  if (!coordinate) {
    return null
  }

  const screenPoint = map.project(coordinate)
  return sensorPreviewFromProperties(feature.properties ?? {}, coordinate, { x: screenPoint.x, y: screenPoint.y }, mode)
}

function sensorPreviewFromGeoJsonFeature(
  feature: GeoJsonFeature,
  screenPoint: { x: number; y: number },
  mode: SensorPreviewMode,
): SensorQuickLookPreview | null {
  const coordinate = pointCoordinatesFromFeature(feature)

  if (!coordinate) {
    return null
  }

  return sensorPreviewFromProperties(feature.properties, coordinate, screenPoint, mode)
}

function sensorMarkerOverlayItems(data: MapData, map: maplibregl.Map): SensorMarkerOverlayItem[] {
  return data.sensors.features.flatMap((feature) => {
    const coordinate = pointCoordinatesFromFeature(feature)

    if (!coordinate) {
      return []
    }

    const point = map.project(coordinate)
    const group = previewGroup(feature.properties.modalityGroup)
    const id = propertyString(feature.properties.id, 'SENSOR')
    const label =
      propertyString(feature.properties.platformCallsign) ||
      propertyString(feature.properties.platformId) ||
      propertyString(feature.properties.modality, sourceGroupLabel(group))

    return [
      {
        id,
        label,
        modalityGroup: group,
        status: propertyString(feature.properties.previewStatus, 'pending'),
        coordinate,
        screenPoint: { x: point.x, y: point.y },
        feature,
      },
    ]
  })
}

function sensorPreviewStatusClass(status: string) {
  const normalized = status.toLowerCase()

  if (normalized.includes('lost') || normalized.includes('stale') || normalized.includes('degrad')) {
    return 'lost'
  }

  if (normalized.includes('pending') || normalized.includes('reacquir')) {
    return 'pending'
  }

  return 'active'
}

function sensorPreviewPosition(
  preview: SensorQuickLookPreview,
  viewportSize: { width: number; height: number },
): SensorPreviewPosition {
  const width = viewportSize.width
  const height = viewportSize.height
  const cardWidth = 302
  const cardHeight = preview.modalityGroup === 'EO' ? 236 : 224
  const margin = 12
  const gap = 18
  const anchorX = preview.screenPoint.x
  const anchorY = preview.screenPoint.y
  const rightSpace = width - anchorX
  const leftSpace = anchorX
  const bottomSpace = height - anchorY
  const topSpace = anchorY
  let placement: SensorPreviewPlacement = 'right'

  if (rightSpace < cardWidth + gap + margin && leftSpace >= cardWidth + gap + margin) {
    placement = 'left'
  } else if (rightSpace < cardWidth + gap + margin && leftSpace < cardWidth + gap + margin) {
    placement = bottomSpace >= cardHeight + gap + margin || bottomSpace >= topSpace ? 'bottom' : 'top'
  }

  if (placement === 'right') {
    const top = clamp(anchorY - cardHeight / 2, margin, Math.max(margin, height - cardHeight - margin))
    return {
      left: clamp(anchorX + gap, margin, Math.max(margin, width - cardWidth - margin)),
      top,
      caretLeft: -7,
      caretTop: clamp(anchorY - top, 18, cardHeight - 18),
      placement,
    }
  }

  if (placement === 'left') {
    const top = clamp(anchorY - cardHeight / 2, margin, Math.max(margin, height - cardHeight - margin))
    return {
      left: clamp(anchorX - cardWidth - gap, margin, Math.max(margin, width - cardWidth - margin)),
      top,
      caretLeft: cardWidth - 1,
      caretTop: clamp(anchorY - top, 18, cardHeight - 18),
      placement,
    }
  }

  const left = clamp(anchorX - cardWidth / 2, margin, Math.max(margin, width - cardWidth - margin))
  const top =
    placement === 'bottom'
      ? clamp(anchorY + gap, margin, Math.max(margin, height - cardHeight - margin))
      : clamp(anchorY - cardHeight - gap, margin, Math.max(margin, height - cardHeight - margin))

  return {
    left,
    top,
    caretLeft: clamp(anchorX - left, 18, cardWidth - 18),
    caretTop: placement === 'bottom' ? -7 : cardHeight - 1,
    placement,
  }
}

function sensorPreviewStatusLabel(status: string) {
  const normalized = status.toLowerCase()

  if (normalized === 'active') {
    return 'Active'
  }

  return contributionStatusLabel(normalized)
}

function SensorMarkerGlyph({ group }: { group: SourceEvidenceGroup }) {
  if (group === 'Radar') {
    return (
      <span className="sensor-marker-glyph radar" aria-hidden="true">
        <i />
        <b />
      </span>
    )
  }

  if (group === 'EO') {
    return (
      <span className="sensor-marker-glyph eo" aria-hidden="true">
        <i />
        <b />
      </span>
    )
  }

  return (
    <span className="sensor-marker-glyph acoustic-rf" aria-hidden="true">
      <i />
      <b />
      <em />
    </span>
  )
}

function SensorPreviewVisual({ preview }: { preview: SensorQuickLookPreview }) {
  if (preview.modalityGroup === 'Radar') {
    return (
      <div className="sensor-preview-visual radar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span className="radar-sweep" />
        <b className="radar-blip" />
        <em />
      </div>
    )
  }

  if (preview.modalityGroup === 'EO') {
    const eoirAssets = eoirEvidenceAssetsForTrack(preview.trackId, preview.classification)

    return (
      <div className="sensor-preview-visual eoir">
        <span className="video-noise" />
        <i className="target-box" />
        <b />
        <em>{preview.trackId ?? 'TRACK'}</em>
        <EoirEvidenceCarousel assets={eoirAssets} />
      </div>
    )
  }

  return (
    <div className="sensor-preview-visual acoustic-rf" aria-hidden="true">
      <i />
      <i />
      <i />
      <span style={{ height: `${Math.max(24, Math.min(82, preview.signalStrength))}%` }} />
      <span style={{ height: `${Math.max(34, Math.min(88, preview.signalStrength + 8))}%` }} />
      <span style={{ height: `${Math.max(22, Math.min(72, preview.signalStrength - 12))}%` }} />
      <span style={{ height: `${Math.max(42, Math.min(94, preview.signalStrength + 16))}%` }} />
      <b />
    </div>
  )
}

function SensorPreviewPopover({
  viewportSize,
  onDismiss,
  onMouseEnter,
  onMouseLeave,
  preview,
}: {
  viewportSize: { width: number; height: number }
  onDismiss: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  preview: SensorQuickLookPreview
}) {
  const position = sensorPreviewPosition(preview, viewportSize)
  const style = {
    left: position.left,
    top: position.top,
    '--caret-left': `${position.caretLeft}px`,
    '--caret-top': `${position.caretTop}px`,
  } as CSSProperties
  const confidenceLabel = preview.confidence ? formatConfidence(preview.confidence) : 'Pending'
  const rangeLabel = preview.rangeM ? formatDistanceMeters(preview.rangeM) : 'N/A'
  const bearingLabel = preview.bearingDeg !== null ? `${Math.round(preview.bearingDeg).toString().padStart(3, '0')} deg` : 'N/A'
  const signalLabel = `${Math.round(preview.signalStrength)}%`
  const acousticAsset = preview.modalityGroup === 'Acoustic/RF' ? acousticEvidenceAssetForTrack(preview.trackId, preview.classification) : null

  return (
    <article
      className={`sensor-preview-card ${sourceGroupClass(preview.modalityGroup)} placement-${position.placement} is-${preview.mode}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      <span className="sensor-preview-caret" aria-hidden="true" />
      <header>
        <span>{preview.modalityGroup === 'EO' ? 'EO/IR' : preview.modalityGroup}</span>
        <strong>{preview.sensorId}</strong>
        <em>{sensorPreviewStatusLabel(preview.status)}</em>
        <button aria-label="Dismiss sensor preview" type="button" onClick={onDismiss}>
          X
        </button>
      </header>
      <SensorPreviewVisual preview={preview} />
      <dl>
        {preview.modalityGroup === 'Radar' ? (
          <>
            <div>
              <dt>Range</dt>
              <dd>{rangeLabel}</dd>
            </div>
            <div>
              <dt>Bearing</dt>
              <dd>{bearingLabel}</dd>
            </div>
            <div>
              <dt>Speed</dt>
              <dd>{preview.speedMps ? `${preview.speedMps.toFixed(1)} m/s` : 'N/A'}</dd>
            </div>
            <div>
              <dt>Altitude</dt>
              <dd>{preview.altitudeLabel}</dd>
            </div>
            <div>
              <dt>Track Conf.</dt>
              <dd>{confidenceLabel}</dd>
            </div>
          </>
        ) : preview.modalityGroup === 'EO' ? (
          <>
            <div>
              <dt>Timestamp</dt>
              <dd>{formatTimestamp(preview.timestamp)}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{confidenceLabel}</dd>
            </div>
            <div>
              <dt>Range</dt>
              <dd>{rangeLabel}</dd>
            </div>
            <div>
              <dt>Bearing</dt>
              <dd>{bearingLabel}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Bearing</dt>
              <dd>{bearingLabel}</dd>
            </div>
            <div>
              <dt>Signal</dt>
              <dd>{signalLabel}</dd>
            </div>
            <div>
              <dt>Match</dt>
              <dd>{confidenceLabel}</dd>
            </div>
            <div>
              <dt>Class</dt>
              <dd>{preview.classification}</dd>
            </div>
          </>
        )}
      </dl>
      <footer>
        <span>{preview.platformCallsign}</span>
        <strong>{preview.measurementKind}</strong>
        {preview.modalityGroup === 'Acoustic/RF' ? (
          <EvidenceAudioButton asset={acousticAsset} />
        ) : null}
      </footer>
    </article>
  )
}

function sensorPreviewHighlight(preview: SensorQuickLookPreview | null): GeoJsonCollection {
  if (!preview) {
    return emptyCollection()
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: preview.coordinate },
        properties: {
          id: `${preview.sensorId}-preview`,
          sensorId: preview.sensorId,
          modalityGroup: preview.modalityGroup,
          previewMode: preview.mode,
        },
      },
    ],
  }
}

function createSimulationRuntime(scenarioKey: SimulationScenarioKey): {
  engine: ScenarioEngine
  heroTrackId: string
  ui: ReturnType<typeof simulationToUi>
} {
  const engine = createScenarioEngine(scenarioKey)
  if (scenarioKey === 'droneSwarmPattern') {
    engine.advance(70)
  }
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
  const [selectedTrackId, setSelectedTrackId] = useState('TRK-SD-001')
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null)
  const [simulationScenario, setSimulationScenario] = useState<SimulationScenarioKey>(defaultScenarioKey)
  const [mapFocusMode, setMapFocusMode] = useState<TacticalMapFocusMode>(() => focusModeForScenario(defaultScenarioKey))
  const [simulationPlaying, setSimulationPlaying] = useState(true)
  const [simulationSpeed, setSimulationSpeed] = useState<SimulationSpeed>(1)
  const [simulationRuntime, setSimulationRuntime] = useState(() => createSimulationRuntime(defaultScenarioKey))
  const visibleLayers = defaultLayerState

  const simulationUi = simulationRuntime.ui
  const palantirDemoScenario = getPalantirDemoScenario(simulationScenario)
  const palantirDemoUi = useMemo(
    () =>
      ontologySnapshotToUi({
        platforms: palantirDemoScenario.platforms,
        sensors: palantirDemoScenario.sensors,
        detections: palantirDemoScenario.detections,
        fusedTracks: palantirDemoScenario.fusedTracks,
        operatorActions: palantirDemoScenario.operatorActions,
        protectedAssets: palantirDemoScenario.protectedAssets,
        protectedZones: palantirDemoScenario.protectedZones,
      }),
    [palantirDemoScenario],
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

  const activeDemoSteps = simulationScenario === 'droneSwarmPattern' ? palantirMissionDemoSteps : demoSteps
  const currentDemoStep = dataMode === 'local' || demoStepIndex === null ? null : activeDemoSteps[demoStepIndex] ?? null
  const activePlatforms: Platform[] = dataMode === 'local' ? simulationUi.platforms : palantirDemoUi.platforms
  const activeSensors: Sensor[] = dataMode === 'local' ? simulationUi.sensors : palantirDemoUi.sensors
  const activeDetections: Detection[] = dataMode === 'local' ? simulationUi.detections : palantirDemoUi.detections
  const activeFusedTracks: FusedTrack[] = dataMode === 'local' ? simulationUi.fusedTracks : palantirDemoUi.fusedTracks
  const baseOperatorActions: OperatorAction[] = dataMode === 'local' ? simulationUi.operatorActions : palantirDemoUi.operatorActions
  const activeProtectedAssets = dataMode === 'local' ? simulationUi.protectedAssets : palantirDemoUi.protectedAssets
  const activeProtectedZones = dataMode === 'local' ? simulationUi.protectedZones : palantirDemoUi.protectedZones
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
      : staticBriefing(dataMode, activeFusedTracks, palantirDemoScenario)
  const dataSourceBadge = dataMode === 'local' ? 'Local Simulation' : palantirDemoScenario.sourceLabel
  const mapReadyStatus =
    dataMode === 'local'
      ? simulationUi.statusText
      : dataMode === 'palantirMission'
      ? 'Foundry demo mission data active'
      : dataMode === 'palantirSnapshot'
        ? 'Foundry demo snapshot active'
        : 'Local simulation active'
  const selectedBaseTrack = useMemo(
    () =>
      activeFusedTracks.find((track) => track.track_id === selectedTrackId) ??
      [...activeFusedTracks].sort((a, b) => b.threat_score - a.threat_score)[0] ??
      palantirDemoScenario.fusedTracks[0],
    [activeFusedTracks, palantirDemoScenario.fusedTracks, selectedTrackId],
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
  const missionName = selectedTrack.mission_area.replace('MissionArea-', '').replace(/-/g, ' ')
  const modeLabel =
    dataMode === 'local' ? 'Operational' : dataMode === 'palantirMission' ? 'Mission Data' : `Snapshot ${palantirDemoDatasetMetadata.branch}`
  const alertState = riskLabel(selectedTrack.threat_score)
  const showLegacyWorkflowRail = import.meta.env.MODE === 'legacy-right-rail'
  const operatorActions = [
    ...baseOperatorActions,
    ...localOperatorActions.filter((action) => action.track_id === selectedTrack.track_id),
  ]
  const mapData = useMemo(
    () =>
      buildMapData({
        activePlatforms,
        activeSensors,
        allTracks: activeFusedTracks,
        detections: activeDetections,
        demoStep: currentDemoStep,
        focusMode: mapFocusMode,
        protectedAssets: activeProtectedAssets,
        protectedZones: activeProtectedZones,
        scenario: simulationScenario,
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
      mapFocusMode,
      selectedDetectionId,
      selectedTrack,
      simulationScenario,
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
    setMapFocusMode(focusModeForScenario(simulationScenario))
  }

  function changeSimulationScenario(scenarioKey: SimulationScenarioKey) {
    const nextRuntime = createSimulationRuntime(scenarioKey)
    setSimulationScenario(scenarioKey)
    setSimulationRuntime(nextRuntime)
    setSelectedTrackId(nextRuntime.heroTrackId)
    setSelectedDetectionId(null)
    setMapFocusMode(focusModeForScenario(scenarioKey))
    setLocalOperatorActions([])
  }

  return (
    <main className="app-shell">
      <header className="top-header simplified-top-header">
        <div className="brand-block">
          <span className="product-mark">SM</span>
          <div>
            <strong>SmokenMirrorsOS</strong>
            <span>Drone detection console</span>
          </div>
        </div>

        <div className="top-readouts" aria-label="Mission status readouts">
          <span>Site <strong>{missionName}</strong></span>
          <span className={`alert-state risk-${riskLevel(selectedTrack.threat_score)}`}>Alert <strong>{alertState}</strong></span>
          <span>Mode <strong>{modeLabel}</strong></span>
          <span className="offline-ontology-pill">
            <svg aria-hidden="true" viewBox="0 0 32 32">
              <path d="M9 11.5 16 7l7 4.5v9L16 25l-7-4.5z" />
              <circle cx="9" cy="11.5" r="2.4" />
              <circle cx="23" cy="11.5" r="2.4" />
              <circle cx="16" cy="25" r="2.4" />
              <circle cx="16" cy="7" r="2.4" />
            </svg>
            Offline <strong>Ontology operational</strong>
          </span>
          <span>Time <strong>{formatTimestamp(selectedTrack.last_seen)}</strong></span>
        </div>

        <details className="demo-control">
          <summary>Demo</summary>
          <div className="demo-control-menu">
          <div className="source-controls" aria-label="Data source controls">
            <button
              className={dataMode === 'local' ? 'is-selected' : ''}
              type="button"
              onClick={() => {
                setDataMode('local')
                setDemoStepIndex(null)
                setSelectedTrackId(simulationRuntime.heroTrackId)
                setSelectedDetectionId(null)
                setMapFocusMode(focusModeForScenario(simulationScenario))
              }}
            >
              Local Mock
            </button>
            <button
              className={dataMode === 'palantirSnapshot' ? 'is-selected' : ''}
              type="button"
              onClick={() => {
                setDataMode('palantirSnapshot')
                setSelectedTrackId(palantirDemoScenario.heroTrackId)
                setSelectedDetectionId(null)
                setMapFocusMode(focusModeForScenario(simulationScenario))
              }}
            >
              Palantir Snapshot
            </button>
            <button
              className={dataMode === 'palantirMission' ? 'is-selected is-mission' : ''}
              type="button"
              onClick={() => {
                setDataMode('palantirMission')
                setSelectedTrackId(palantirDemoScenario.heroTrackId)
                setSelectedDetectionId(null)
                setMapFocusMode(focusModeForScenario(simulationScenario))
              }}
            >
              Mission Data
            </button>
          </div>
          <div className="simulation-controls" aria-label="Scenario controls">
            <span>{dataMode === 'local' ? formatElapsed(activeBriefing.elapsed_seconds) : dataSourceBadge}</span>
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
            {dataMode === 'local' ? (
              <>
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
              </>
            ) : null}
          </div>
          <div className="playback-buttons" aria-label="Demo playback controls">
            <button type="button" onClick={startDemo}>Start</button>
            <button type="button" onClick={nextDemoStep}>Next</button>
            <button type="button" onClick={resetDemo}>Reset</button>
          </div>
          </div>
        </details>
      </header>

      <div className="dashboard-grid">
        <LeftTrackRail
          detections={activeDetections}
          protectedAssets={activeProtectedAssets}
          scenario={simulationScenario}
          selectedTrack={selectedTrack}
          selectedTrackId={selectedTrack.track_id}
          tracks={activeFusedTracks}
          onCreateAction={createOperatorAction}
          onSelectTrack={selectTrack}
        />
        <MissionMap
          mapData={mapData}
          readyStatus={currentDemoStep?.mapStatus ?? mapReadyStatus}
          selectedTrack={selectedTrack}
          visibleLayers={visibleLayers}
          onSelectDetectionId={setSelectedDetectionId}
          onSelectTrackId={setSelectedTrackId}
        />
        {showLegacyWorkflowRail ? <RightWorkflowRail
          actions={operatorActions}
          allTracks={activeFusedTracks}
          briefing={activeBriefing}
          demoStep={currentDemoStep}
          detections={activeDetections}
          protectedAssets={activeProtectedAssets}
          protectedZones={activeProtectedZones}
          scenario={simulationScenario}
          selectedTrack={selectedTrack}
          onCreateAction={createOperatorAction}
        /> : null}
      </div>
    </main>
  )
}

export default App
