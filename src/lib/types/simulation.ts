export type SimulationScenarioKey = 'singleDroneIntrusion' | 'droneSwarmPattern'

export type SensorModality = 'RADAR' | 'RF' | 'ACOUSTIC' | 'EO' | 'IR'

export type SimulationPoint = {
  lat: number
  lon: number
}

export type SimulationWindow = {
  startSecond: number
  endSecond: number
  reliabilityMultiplier: number
  confidenceOffset: number
  reason: string
}

export type SimulationSensorPlatform = SimulationPoint & {
  id: string
  callsign: string
  platformType: string
  ownerUnit: string
}

export type SimulationSensor = {
  id: string
  platformId: string
  modality: SensorModality
  measurementKind: string
  rangeMaxM: number
  fovType: string
  fovHDeg: number
  latencyMsP50: number
  cadenceSeconds: number
  reliability: number
  confidenceMean: number
  confidenceJitter: number
  bearingNoiseDeg: number
  rangeNoiseM: number
  degradationWindows?: SimulationWindow[]
}

export type SimulationScenarioPhase = {
  id: string
  label: string
  startSecond: number
  description: string
  nextEvent?: string
}

export type SimulationProtectedZone = {
  id: string
  label: string
  kind: 'mission' | 'restricted' | 'asset_buffer'
  points: SimulationPoint[]
}

export type SimulationProtectedAsset = SimulationPoint & {
  id: string
  label: string
  priority: 'critical' | 'high' | 'standard'
}

export type TrackBehavior = 'approach' | 'loiter' | 'transit' | 'outbound' | 'clutter' | 'intermittent' | 'swarm'

export type SimulationTrackTemplate = {
  id: string
  label: string
  classification: string
  behavior: TrackBehavior
  start: SimulationPoint
  headingDeg: number
  speedMps: number
  spawnSecond: number
  retireSecond: number
  baseConfidence: number
  baseThreat: number
  sourceBias: Partial<Record<SensorModality, number>>
  friendly?: boolean
  hero?: boolean
}

export type SimulationTrackPoint = SimulationPoint & {
  timestamp: string
  confidence: number
}

export type SimulationDetection = SimulationPoint & {
  id: string
  sensorId: string
  trackId: string
  timestamp: string
  elapsedSecond: number
  modality: SensorModality
  bearingDeg: number
  rangeM: number
  confidence: number
  classification: string
  isStale: boolean
  staleReason?: string
  notes: string
}

export type SimulationFusionContribution = {
  sensorId: string
  modality: SensorModality
  confidence: number
  status: 'pending' | 'tentative' | 'correlated' | 'confirmed' | 'visual' | 'stale' | 'lost' | 'reacquiring'
  lastDetectionId?: string
  lastSeen: string
  ageSeconds: number
}

export type SimulationEvidenceArtifact = {
  id: string
  trackId: string
  sensorId: string
  modality: SensorModality
  timestamp: string
  label: string
  summary: string
  confidence: number
  isNew: boolean
}

export type SimulationFusedTrack = SimulationPoint & {
  id: string
  missionArea: string
  classification: string
  custodyStatus: 'Maintained' | 'Tentative' | 'Reacquiring' | 'Lost' | 'Cleared'
  confidence: number
  threatScore: number
  lastSeen: string
  sourceSummary: string
  recommendedNextAction: string
  explanation: string
  createdAt: string
  updatedAt: string
  headingDeg: number
  speedMps: number
  distanceToAssetM: number
  etaSecondsToAsset?: number
  history: SimulationTrackPoint[]
  probablePath: SimulationTrackPoint[]
  fusionContributions: SimulationFusionContribution[]
  evidence: SimulationEvidenceArtifact[]
}

export type SimulationActionFeedEvent = {
  id: string
  trackId: string
  actionType: string
  label: string
  timestamp: string
  operatorId?: string
  notes?: string
  resultingStatus?: string
}

export type SimulationSystemStatus = {
  state: 'nominal' | 'degraded' | 'reacquiring'
  message: string
}

export type SimulationScenarioDefinition = {
  key: SimulationScenarioKey
  label: string
  seed: string
  missionArea: string
  startTimestamp: string
  center: SimulationPoint
  heroTrackId: string
  durationSeconds: number
  objective: string
  phases: SimulationScenarioPhase[]
  platforms: SimulationSensorPlatform[]
  sensors: SimulationSensor[]
  protectedAssets: SimulationProtectedAsset[]
  protectedZones: SimulationProtectedZone[]
}

export type SimulationSnapshot = {
  scenarioKey: SimulationScenarioKey
  scenarioLabel: string
  seed: string
  elapsedSeconds: number
  timestamp: string
  objective: string
  phase: SimulationScenarioPhase
  heroTrackId: string
  missionArea: string
  platforms: SimulationSensorPlatform[]
  sensors: SimulationSensor[]
  detections: SimulationDetection[]
  fusedTracks: SimulationFusedTrack[]
  operatorActions: SimulationActionFeedEvent[]
  protectedAssets: SimulationProtectedAsset[]
  protectedZones: SimulationProtectedZone[]
  systemStatus: SimulationSystemStatus
}
