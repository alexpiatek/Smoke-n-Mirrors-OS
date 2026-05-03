import type { SimulationScenarioDefinition, SimulationScenarioKey } from '../types/simulation'

const harborCenter = { lat: 37.8078, lon: -122.3749 }
const islandCenter = { lat: 37.8242, lon: -122.3705 }

const fixedPlatforms: SimulationScenarioDefinition['platforms'] = [
  {
    id: 'PLAT-HARBOR-RDR',
    callsign: 'Harbor Radar',
    platformType: 'FIXED_RADAR_TOWER',
    ownerUnit: 'Blue Cell',
    lat: 37.8107,
    lon: -122.3786,
  },
  {
    id: 'PLAT-PIER-RF',
    callsign: 'Pier RF Array',
    platformType: 'FIXED_RF_ARRAY',
    ownerUnit: 'Blue Cell',
    lat: 37.8069,
    lon: -122.3924,
  },
  {
    id: 'PLAT-BUOY-AC',
    callsign: 'Harbor Acoustic',
    platformType: 'FIXED_ACOUSTIC_BUOY',
    ownerUnit: 'Maritime Ops',
    lat: 37.8029,
    lon: -122.3679,
  },
  {
    id: 'PLAT-CRANE-EOIR',
    callsign: 'Crane EOIR',
    platformType: 'FIXED_EO_IR',
    ownerUnit: 'Port Authority',
    lat: 37.8145,
    lon: -122.3628,
  },
]

const fixedSensors: SimulationScenarioDefinition['sensors'] = [
  {
    id: 'SENS-RDR-HN-01',
    platformId: 'PLAT-HARBOR-RDR',
    modality: 'RADAR',
    measurementKind: 'RADAR_GMTI',
    rangeMaxM: 5200,
    fovType: 'SECTOR',
    fovHDeg: 94,
    latencyMsP50: 84,
    cadenceSeconds: 2,
    reliability: 0.88,
    confidenceMean: 0.68,
    confidenceJitter: 0.11,
    bearingNoiseDeg: 2.2,
    rangeNoiseM: 38,
  },
  {
    id: 'SENS-RF-HN-01',
    platformId: 'PLAT-PIER-RF',
    modality: 'RF',
    measurementKind: 'RF_ESM',
    rangeMaxM: 3600,
    fovType: 'OMNIDIRECTIONAL',
    fovHDeg: 360,
    latencyMsP50: 126,
    cadenceSeconds: 3,
    reliability: 0.72,
    confidenceMean: 0.64,
    confidenceJitter: 0.16,
    bearingNoiseDeg: 5.8,
    rangeNoiseM: 130,
  },
  {
    id: 'SENS-AC-HN-01',
    platformId: 'PLAT-BUOY-AC',
    modality: 'ACOUSTIC',
    measurementKind: 'ACOUSTIC_TONAL',
    rangeMaxM: 1800,
    fovType: 'OMNIDIRECTIONAL',
    fovHDeg: 360,
    latencyMsP50: 340,
    cadenceSeconds: 4,
    reliability: 0.64,
    confidenceMean: 0.58,
    confidenceJitter: 0.17,
    bearingNoiseDeg: 9,
    rangeNoiseM: 180,
  },
  {
    id: 'SENS-EOIR-HN-01',
    platformId: 'PLAT-CRANE-EOIR',
    modality: 'EO',
    measurementKind: 'EO_IR_VISUAL',
    rangeMaxM: 2600,
    fovType: 'GIMBALED',
    fovHDeg: 28,
    latencyMsP50: 210,
    cadenceSeconds: 5,
    reliability: 0.58,
    confidenceMean: 0.7,
    confidenceJitter: 0.14,
    bearingNoiseDeg: 1.5,
    rangeNoiseM: 24,
    degradationWindows: [
      {
        startSecond: 0,
        endSecond: 58,
        reliabilityMultiplier: 0.08,
        confidenceOffset: -0.24,
        reason: 'EO/IR awaiting slew tasking',
      },
    ],
  },
]

const protectedAssets: SimulationScenarioDefinition['protectedAssets'] = [
  {
    id: 'ASSET-WATERFRONT',
    label: 'Protected Waterfront',
    priority: 'critical',
    lat: 37.8095,
    lon: -122.3697,
  },
]

const protectedZones: SimulationScenarioDefinition['protectedZones'] = [
  {
    id: 'ZONE-HARBOR-MISSION',
    label: 'Harbor North Mission Box',
    kind: 'mission',
    points: [
      { lat: 37.7939, lon: -122.3982 },
      { lat: 37.8225, lon: -122.3974 },
      { lat: 37.8239, lon: -122.3545 },
      { lat: 37.7949, lon: -122.3506 },
      { lat: 37.7939, lon: -122.3982 },
    ],
  },
  {
    id: 'ZONE-HARBOR-RESTRICTED',
    label: 'Restricted Waterfront Standoff',
    kind: 'restricted',
    points: [
      { lat: 37.8057, lon: -122.3748 },
      { lat: 37.8136, lon: -122.374 },
      { lat: 37.8142, lon: -122.3654 },
      { lat: 37.8063, lon: -122.3639 },
      { lat: 37.8057, lon: -122.3748 },
    ],
  },
]

const islandPlatforms: SimulationScenarioDefinition['platforms'] = [
  {
    id: 'PLAT-HARBOR-RDR',
    callsign: 'Island Radar',
    platformType: 'FIXED_RADAR_TOWER',
    ownerUnit: 'Blue Cell',
    lat: 37.8216,
    lon: -122.3926,
  },
  {
    id: 'PLAT-PIER-RF',
    callsign: 'North RF Array',
    platformType: 'FIXED_RF_ARRAY',
    ownerUnit: 'Blue Cell',
    lat: 37.8353,
    lon: -122.3788,
  },
  {
    id: 'PLAT-BUOY-AC',
    callsign: 'Island Acoustic',
    platformType: 'FIXED_ACOUSTIC_BUOY',
    ownerUnit: 'Maritime Ops',
    lat: 37.8144,
    lon: -122.3598,
  },
  {
    id: 'PLAT-CRANE-EOIR',
    callsign: 'Island EOIR',
    platformType: 'FIXED_EO_IR',
    ownerUnit: 'Port Authority',
    lat: 37.8235,
    lon: -122.3634,
  },
]

const islandSensors: SimulationScenarioDefinition['sensors'] = fixedSensors.map((sensor) => ({
  ...sensor,
  reliability: sensor.modality === 'RADAR' || sensor.modality === 'RF' ? Math.min(0.94, sensor.reliability + 0.08) : sensor.reliability,
  rangeMaxM: sensor.modality === 'ACOUSTIC' ? 2400 : sensor.rangeMaxM,
}))

const islandProtectedAssets: SimulationScenarioDefinition['protectedAssets'] = [
  {
    id: 'ASSET-ISLAND',
    label: 'Protected Island',
    priority: 'critical',
    lat: islandCenter.lat,
    lon: islandCenter.lon,
  },
]

const islandProtectedZones: SimulationScenarioDefinition['protectedZones'] = [
  {
    id: 'ZONE-ISLAND-MISSION',
    label: 'Island Mission Box',
    kind: 'mission',
    points: [
      { lat: 37.7988, lon: -122.405 },
      { lat: 37.8365, lon: -122.403 },
      { lat: 37.8374, lon: -122.348 },
      { lat: 37.7976, lon: -122.3462 },
      { lat: 37.7988, lon: -122.405 },
    ],
  },
  {
    id: 'ZONE-ISLAND-RESTRICTED',
    label: 'Restricted Island Standoff',
    kind: 'restricted',
    points: [
      { lat: 37.8188, lon: -122.3798 },
      { lat: 37.8294, lon: -122.3791 },
      { lat: 37.8301, lon: -122.3608 },
      { lat: 37.8193, lon: -122.3589 },
      { lat: 37.8188, lon: -122.3798 },
    ],
  },
]

export const scenarioDefinitions: Record<SimulationScenarioKey, SimulationScenarioDefinition> = {
  singleDroneIntrusion: {
    key: 'singleDroneIntrusion',
    label: 'Single Drone Intrusion',
    seed: 'smoken-mirrors-single-drone-v2',
    missionArea: 'MissionArea-Harbor-North',
    startTimestamp: '2026-05-03T05:00:00.000Z',
    center: harborCenter,
    heroTrackId: 'TRK-SD-001',
    durationSeconds: 600,
    objective: 'Identify one probable UAV approaching the protected waterfront and choose the next action.',
    phases: [
      {
        id: 'radar-detection',
        label: 'Radar detection',
        startSecond: 0,
        description: 'Radar seeds one UAV-size track southwest of the protected waterfront.',
        nextEvent: 'Correlate RF/acoustic bearings',
      },
      {
        id: 'passive-correlation',
        label: 'RF/acoustic correlation',
        startSecond: 26,
        description: 'RF and acoustic bearings align with the radar contact.',
        nextEvent: 'Establish fused custody',
      },
      {
        id: 'fused-track-established',
        label: 'Fused track established',
        startSecond: 58,
        description: 'Fusion promotes TRK-SD-001 to maintained custody.',
        nextEvent: 'Task EO/IR',
      },
      {
        id: 'eo-tasked',
        label: 'EO/IR tasked',
        startSecond: 86,
        description: 'EO/IR is slewed to the projected intercept corridor.',
        nextEvent: 'Threat increases',
      },
      {
        id: 'threat-increasing',
        label: 'Threat increasing',
        startSecond: 118,
        description: 'The track closes range to the waterfront standoff area.',
        nextEvent: 'Notify response team',
      },
      {
        id: 'action-recommended',
        label: 'Action recommended',
        startSecond: 154,
        description: 'The operator is prompted to notify response and keep EO/IR on track.',
        nextEvent: 'Monitor response',
      },
    ],
    platforms: fixedPlatforms,
    sensors: fixedSensors,
    protectedAssets,
    protectedZones,
  },
  droneSwarmPattern: {
    key: 'droneSwarmPattern',
    label: 'Drone Swarm Pattern',
    seed: 'smoken-mirrors-swarm-v2',
    missionArea: 'MissionArea-Treasure-Island',
    startTimestamp: '2026-05-03T05:05:00.000Z',
    center: islandCenter,
    heroTrackId: 'TRK-SW-001',
    durationSeconds: 720,
    objective: 'Recognize a coordinated UAV swarm converging on the protected island and prioritize the lead threat.',
    phases: [
      {
        id: 'multiple-tracks-detected',
        label: 'Multiple tracks detected',
        startSecond: 0,
        description: 'Multiple UAV-size tracks appear around the island mission box.',
        nextEvent: 'Assess coordination',
      },
      {
        id: 'swarm-pattern-suspected',
        label: 'Swarm pattern suspected',
        startSecond: 36,
        description: 'Inbound tracks approach the island from north, west, south, and east vectors.',
        nextEvent: 'Prioritize lead track',
      },
      {
        id: 'lead-threat-prioritized',
        label: 'Lead threat prioritized',
        startSecond: 76,
        description: 'TRK-SW-001 becomes the lead high-priority track.',
        nextEvent: 'Dispatch response',
      },
      {
        id: 'simultaneous-boundary-crossing',
        label: 'Boundary crossing',
        startSecond: 118,
        description: 'Two secondary tracks cross the island standoff boundary while the lead track closes.',
        nextEvent: 'Monitor secondary tracks',
      },
      {
        id: 'action-recommended',
        label: 'Action recommended',
        startSecond: 158,
        description: 'Fusion recommends notifying response and monitoring secondary swarm tracks.',
        nextEvent: 'Continue swarm watch',
      },
    ],
    platforms: islandPlatforms,
    sensors: islandSensors,
    protectedAssets: islandProtectedAssets,
    protectedZones: islandProtectedZones,
  },
}

export const scenarioOptions = Object.values(scenarioDefinitions).map((scenario) => ({
  key: scenario.key,
  label: scenario.label,
}))
