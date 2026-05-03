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
  if (definition.key === 'falsePositiveClutter') {
    return {
      id: definition.heroTrackId,
      label: 'Bird-like clutter candidate',
      classification: 'Suspected bird flock',
      behavior: 'clutter',
      start: destinationPoint(definition.center, 246, 1100),
      headingDeg: 72,
      speedMps: 5.4,
      spawnSecond: 0,
      retireSecond: definition.durationSeconds,
      baseConfidence: 0.36,
      baseThreat: 12,
      sourceBias: { RADAR: 0.15, EO: -0.24, RF: -0.36, ACOUSTIC: -0.28, IR: -0.2 },
      hero: true,
    }
  }

  if (definition.key === 'intermittentCustody') {
    return {
      id: definition.heroTrackId,
      label: 'Intermittent low-altitude UAV',
      classification: 'Probable UAV',
      behavior: 'intermittent',
      start: destinationPoint(definition.center, 238, 1750),
      headingDeg: 48,
      speedMps: 16.8,
      spawnSecond: 0,
      retireSecond: definition.durationSeconds,
      baseConfidence: 0.61,
      baseThreat: 54,
      sourceBias: { RADAR: 0.06, RF: 0.16, EO: 0.02, ACOUSTIC: -0.08, IR: 0.08 },
      hero: true,
    }
  }

  return {
    id: definition.heroTrackId,
    label: 'High-interest waterfront approach',
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
  const count = definition.key === 'falsePositiveClutter' ? 23 : 18
  const classes = [
    'Probable UAV',
    'Suspected bird',
    'Small surface contact',
    'Outbound track',
    'Friendly patrol',
    'Low-risk harbor traffic',
  ]
  const tracks: SimulationTrackTemplate[] = []

  for (let index = 0; index < count; index += 1) {
    const classification = definition.key === 'falsePositiveClutter' ? weightedClutterClass(rng) : rng.pick(classes)
    const friendly = classification.includes('Friendly') || classification.includes('Low-risk')
    const bird = classification.includes('bird')
    const surface = classification.includes('surface') || classification.includes('harbor')
    const behavior = bird
      ? 'clutter'
      : classification.includes('Outbound')
        ? 'outbound'
        : surface
          ? rng.pick(['transit', 'loiter'] as const)
          : rng.pick(['approach', 'transit', 'loiter'] as const)
    const startBearing = rng.between(0, 360)
    const startDistance = rng.between(850, 3200)
    const idPrefix = definition.key === 'falsePositiveClutter' ? 'TRK-FP' : definition.key === 'intermittentCustody' ? 'TRK-IC' : 'TRK-HB'
    const headingTarget = behavior === 'outbound' ? bearingBetween(definition.center, destinationPoint(definition.center, startBearing, startDistance)) : rng.between(22, 118)

    tracks.push({
      id: `${idPrefix}-${String(index + 2).padStart(3, '0')}`,
      label: classification,
      classification,
      behavior,
      start: destinationPoint(definition.center, startBearing, startDistance),
      headingDeg: headingTarget + rng.between(-18, 18),
      speedMps: bird ? rng.between(4, 11) : surface ? rng.between(2, 7) : rng.between(6, 14),
      spawnSecond: rng.int(0, definition.key === 'falsePositiveClutter' ? 40 : 75),
      retireSecond: rng.int(320, definition.durationSeconds),
      baseConfidence: bird ? rng.between(0.24, 0.5) : friendly ? rng.between(0.42, 0.62) : rng.between(0.43, 0.72),
      baseThreat: bird ? rng.between(4, 20) : friendly ? rng.between(8, 26) : rng.between(24, 58),
      sourceBias: sourceBiasForClassification(classification, rng),
      friendly,
    })
  }

  return tracks
}

function weightedClutterClass(rng: SeededRandom) {
  const roll = rng.next()

  if (roll < 0.5) {
    return 'Suspected bird'
  }

  if (roll < 0.68) {
    return 'Low-confidence clutter'
  }

  if (roll < 0.84) {
    return 'Friendly patrol'
  }

  return 'Small surface contact'
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
