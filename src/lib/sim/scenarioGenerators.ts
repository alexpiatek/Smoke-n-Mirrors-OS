import { createSeededRandom, type SeededRandom } from './seededRandom'
import type {
  SensorModality,
  SimulationDetection,
  SimulationPoint,
  SimulationScenarioDefinition,
  SimulationSensor,
  SimulationTrackTemplate,
} from '../types/simulation'

const earthRadiusM = 6378137

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function destinationPoint(point: SimulationPoint, bearingDeg: number, distanceM: number): SimulationPoint {
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1 = (point.lat * Math.PI) / 180
  const lon1 = (point.lon * Math.PI) / 180
  const angularDistance = distanceM / earthRadiusM
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

  return {
    lat: (lat2 * 180) / Math.PI,
    lon: ((lon2 * 180) / Math.PI + 540) % 360 - 180,
  }
}

export function distanceMeters(a: SimulationPoint, b: SimulationPoint) {
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180
  const deltaLon = ((b.lon - a.lon) * Math.PI) / 180
  const hav =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav))
}

export function bearingBetween(from: SimulationPoint, to: SimulationPoint) {
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180
  const deltaLon = ((to.lon - from.lon) * Math.PI) / 180
  const y = Math.sin(deltaLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

export function sensorModalityLabel(modality: SensorModality) {
  return modality === 'ACOUSTIC' ? 'Acoustic' : modality
}

export function generateTrackTemplates(definition: SimulationScenarioDefinition): SimulationTrackTemplate[] {
  const rng = createSeededRandom(definition.seed)
  const tracks = [createHeroTrack(definition), ...createBackgroundTracks(definition, rng)]

  return tracks.sort((a, b) => a.spawnSecond - b.spawnSecond || a.id.localeCompare(b.id))
}

export function trackPositionAt(template: SimulationTrackTemplate, elapsedSeconds: number): SimulationPoint {
  const activeSeconds = Math.max(0, elapsedSeconds - template.spawnSecond)
  const loiterWave = template.behavior === 'loiter' || template.behavior === 'clutter'
  const intermittentWave = template.behavior === 'intermittent'
  const heading =
    template.headingDeg +
    (loiterWave ? Math.sin(activeSeconds / 24) * 46 : 0) +
    (intermittentWave ? Math.sin(activeSeconds / 18) * 12 : 0)
  const distance =
    template.speedMps * activeSeconds * (template.behavior === 'clutter' ? 0.42 : 1) +
    (loiterWave ? Math.sin(activeSeconds / 14) * 70 : 0)

  return destinationPoint(template.start, heading, distance)
}

export function generateProbablePath(
  template: SimulationTrackTemplate,
  elapsedSeconds: number,
  timestampForSecond: (elapsed: number) => string,
) {
  return [20, 45, 75, 110].map((offset) => {
    const point = trackPositionAt(template, elapsedSeconds + offset)
    return {
      ...point,
      timestamp: timestampForSecond(elapsedSeconds + offset),
      confidence: clamp(template.baseConfidence - offset / 420, 0.35, 0.92),
    }
  })
}

export function createDetectionForSensor({
  definition,
  elapsedSeconds,
  platformPoint,
  sensor,
  template,
  timestamp,
  truthPoint,
}: {
  definition: SimulationScenarioDefinition
  elapsedSeconds: number
  platformPoint: SimulationPoint
  sensor: SimulationSensor
  template: SimulationTrackTemplate
  timestamp: string
  truthPoint: SimulationPoint
}): SimulationDetection | null {
  const distanceM = distanceMeters(platformPoint, truthPoint)

  if (distanceM > sensor.rangeMaxM) {
    return null
  }

  const degradation = sensor.degradationWindows?.find(
    (window) => elapsedSeconds >= window.startSecond && elapsedSeconds <= window.endSecond,
  )
  const sourceBias = template.sourceBias[sensor.modality] ?? 0
  const probability = clamp((sensor.reliability + sourceBias) * (degradation?.reliabilityMultiplier ?? 1), 0.02, 0.97)
  const rng = createSeededRandom(`${definition.seed}:${template.id}:${sensor.id}:${elapsedSeconds}`)

  if (!rng.bool(probability)) {
    return null
  }

  const trueBearing = bearingBetween(platformPoint, truthPoint)
  const bearingDeg = (trueBearing + rng.between(-sensor.bearingNoiseDeg, sensor.bearingNoiseDeg) + 360) % 360
  const rangeM = Math.max(50, distanceM + rng.between(-sensor.rangeNoiseM, sensor.rangeNoiseM))
  const detectionPoint = destinationPoint(platformPoint, bearingDeg, rangeM)
  const confidence = clamp(
    sensor.confidenceMean +
      template.baseConfidence * 0.18 +
      sourceBias * 0.24 +
      rng.between(-sensor.confidenceJitter, sensor.confidenceJitter) -
      (distanceM / sensor.rangeMaxM) * 0.16 +
      (degradation?.confidenceOffset ?? 0),
    0.18,
    0.97,
  )

  return {
    ...detectionPoint,
    id: `DET-${definition.key.toUpperCase()}-${elapsedSeconds}-${sensor.id}-${template.id}`.replace(/[^A-Z0-9-]/g, ''),
    sensorId: sensor.id,
    trackId: template.id,
    timestamp,
    elapsedSecond: elapsedSeconds,
    modality: sensor.modality,
    bearingDeg,
    rangeM,
    confidence,
    classification: detectionClassification(template, sensor.modality, confidence),
    isStale: false,
    staleReason: degradation?.reason,
    notes: degradation
      ? `${sensorModalityLabel(sensor.modality)} degraded: ${degradation.reason}`
      : `${sensorModalityLabel(sensor.modality)} detection correlated to ${template.id}`,
  }
}

function createHeroTrack(definition: SimulationScenarioDefinition): SimulationTrackTemplate {
  if (definition.key === 'droneSwarmPattern') {
    const start = destinationPoint(definition.center, 255, 1900)

    return {
      id: definition.heroTrackId,
      label: 'Lead converging UAV',
      classification: 'Probable UAV',
      behavior: 'swarm',
      start,
      headingDeg: bearingBetween(start, definition.center),
      speedMps: 16.4,
      spawnSecond: 0,
      retireSecond: definition.durationSeconds,
      baseConfidence: 0.7,
      baseThreat: 68,
      sourceBias: { RADAR: 0.12, RF: 0.18, EO: 0.08, ACOUSTIC: 0.04, IR: 0.08 },
      hero: true,
    }
  }

  return {
    id: definition.heroTrackId,
    label: 'Single inbound UAV',
    classification: 'Probable UAV',
    behavior: 'approach',
    start: destinationPoint(definition.center, 232, 1850),
    headingDeg: 51,
    speedMps: 15.4,
    spawnSecond: 0,
    retireSecond: definition.durationSeconds,
    baseConfidence: 0.66,
    baseThreat: 58,
    sourceBias: { RADAR: 0.09, RF: 0.18, EO: 0.04, ACOUSTIC: 0.03, IR: 0.07 },
    hero: true,
  }
}

function createBackgroundTracks(definition: SimulationScenarioDefinition, rng: SeededRandom) {
  const count = definition.key === 'droneSwarmPattern' ? 7 : 2
  const tracks: SimulationTrackTemplate[] = []
  const swarmVectors: Array<{
    bearing: number
    distanceM: number
    behavior: SimulationTrackTemplate['behavior']
    speedRange: [number, number]
    spawnSecond: number
    threatRange: [number, number]
  }> = [
    { bearing: 315, distanceM: 1900, behavior: 'approach', speedRange: [12, 15], spawnSecond: 0, threatRange: [54, 68] },
    { bearing: 225, distanceM: 2200, behavior: 'swarm', speedRange: [12, 16], spawnSecond: 0, threatRange: [50, 65] },
    { bearing: 0, distanceM: 1750, behavior: 'approach', speedRange: [10, 14], spawnSecond: 0, threatRange: [42, 58] },
    { bearing: 45, distanceM: 1900, behavior: 'loiter', speedRange: [7, 10], spawnSecond: 0, threatRange: [34, 50] },
    { bearing: 112, distanceM: 2100, behavior: 'approach', speedRange: [11, 15], spawnSecond: 0, threatRange: [46, 62] },
    { bearing: 180, distanceM: 2400, behavior: 'swarm', speedRange: [13, 16], spawnSecond: 0, threatRange: [50, 66] },
    { bearing: 270, distanceM: 2050, behavior: 'approach', speedRange: [10, 13], spawnSecond: 0, threatRange: [38, 54] },
  ]

  for (let index = 0; index < count; index += 1) {
    const swarm = definition.key === 'droneSwarmPattern'
    const classification = swarm ? 'Probable UAV' : index === 0 ? 'Small surface contact' : 'Friendly patrol'
    const friendly = classification.includes('Friendly')
    const vector = swarm ? swarmVectors[index] : null
    const behavior = vector?.behavior ?? (index === 0 ? 'approach' : 'transit')
    const startBearing = vector ? vector.bearing + rng.between(-5, 5) : 280 + index * 30
    const startDistance = vector ? vector.distanceM + rng.between(-90, 90) : rng.between(1650, 2450)
    const start = destinationPoint(definition.center, startBearing, startDistance)
    const idPrefix = swarm ? 'TRK-SW' : 'TRK-SD'
    const headingTarget = swarm ? bearingBetween(start, definition.center) : index === 0 ? 72 : 102

    tracks.push({
      id: `${idPrefix}-${String(index + 2).padStart(3, '0')}`,
      label: classification,
      classification,
      behavior,
      start,
      headingDeg: headingTarget + rng.between(-18, 18),
      speedMps: vector ? rng.between(vector.speedRange[0], vector.speedRange[1]) : friendly ? rng.between(2, 5) : rng.between(5, 8),
      spawnSecond: vector ? vector.spawnSecond : rng.int(80, 140),
      retireSecond: rng.int(320, definition.durationSeconds),
      baseConfidence: swarm ? rng.between(0.48, 0.72) : friendly ? rng.between(0.42, 0.56) : rng.between(0.44, 0.6),
      baseThreat: vector ? rng.between(vector.threatRange[0], vector.threatRange[1]) : friendly ? rng.between(8, 22) : rng.between(18, 34),
      sourceBias: sourceBiasForClassification(classification, rng),
      friendly,
    })
  }

  return tracks
}

function sourceBiasForClassification(classification: string, rng: SeededRandom): Partial<Record<SensorModality, number>> {
  if (classification.includes('bird') || classification.includes('clutter')) {
    return { RADAR: rng.between(0.06, 0.18), EO: rng.between(-0.2, -0.04), RF: -0.32, ACOUSTIC: -0.24, IR: -0.1 }
  }

  if (classification.includes('Friendly') || classification.includes('Low-risk')) {
    return { RADAR: 0.04, EO: 0.08, RF: -0.08, ACOUSTIC: -0.04, IR: 0.04 }
  }

  if (classification.includes('surface')) {
    return { RADAR: 0.12, ACOUSTIC: 0.12, RF: rng.between(-0.05, 0.12), EO: 0.04, IR: 0.02 }
  }

  return { RADAR: 0.08, RF: 0.12, EO: 0.04, ACOUSTIC: -0.06, IR: 0.06 }
}

function detectionClassification(template: SimulationTrackTemplate, modality: SensorModality, confidence: number) {
  if (confidence < 0.34) {
    return `${sensorModalityLabel(modality)} weak cue`
  }

  if (template.classification.includes('UAV') && modality === 'RF') {
    return 'Short command burst'
  }

  if (template.classification.includes('surface') && modality === 'ACOUSTIC') {
    return 'Low motor tone'
  }

  if (template.classification.includes('bird')) {
    return modality === 'RADAR' ? 'Erratic micro track' : 'Low-confidence biological cue'
  }

  return template.classification
}
