import { ScenarioClock, formatScenarioTimestamp } from './scenarioClock'
import { scenarioDefinitions } from './scenarioDefinitions'
import {
  bearingBetween,
  clamp,
  createDetectionForSensor,
  distanceMeters,
  generateProbablePath,
  generateTrackTemplates,
  sensorModalityLabel,
  trackPositionAt,
} from './scenarioGenerators'
import type {
  SensorModality,
  SimulationActionFeedEvent,
  SimulationDetection,
  SimulationEvidenceArtifact,
  SimulationFusionContribution,
  SimulationFusedTrack,
  SimulationPoint,
  SimulationScenarioDefinition,
  SimulationScenarioKey,
  SimulationSnapshot,
  SimulationTrackPoint,
  SimulationTrackTemplate,
} from '../types/simulation'

const detectionWindowSeconds = 24
const staleAfterSeconds = 12
const maxDetectionHistory = 260
const maxActionHistory = 40
const maxTrackHistory = 56

type EngineState = {
  detections: SimulationDetection[]
  actions: SimulationActionFeedEvent[]
  emittedEventKeys: Set<string>
  trackHistory: Map<string, SimulationTrackPoint[]>
  trackCreatedAt: Map<string, string>
  lastCustodyStatus: Map<string, string>
  nextActionSequence: number
}

export class ScenarioEngine {
  private readonly definition: SimulationScenarioDefinition
  private readonly tracks: SimulationTrackTemplate[]
  private readonly clock: ScenarioClock
  private state: EngineState

  constructor(scenarioKey: SimulationScenarioKey) {
    this.definition = scenarioDefinitions[scenarioKey]
    this.tracks = generateTrackTemplates(this.definition)
    this.clock = new ScenarioClock(this.definition.startTimestamp)
    this.state = this.createInitialState()
    this.advance(1)
  }

  get scenarioKey() {
    return this.definition.key
  }

  reset() {
    this.clock.reset()
    this.state = this.createInitialState()
    this.advance(1)
  }

  advance(seconds: number) {
    const wholeSeconds = Math.max(1, Math.round(seconds))

    for (let index = 0; index < wholeSeconds; index += 1) {
      this.clock.advance(1)
      this.advanceOneSecond()
    }
  }

  getSnapshot(): SimulationSnapshot {
    const fusedTracks = this.buildFusedTracks()
    const systemStatus = this.buildSystemStatus(fusedTracks)
    const phase = this.currentPhase()

    return {
      scenarioKey: this.definition.key,
      scenarioLabel: this.definition.label,
      seed: this.definition.seed,
      elapsedSeconds: this.clock.elapsedSeconds,
      timestamp: this.clock.timestamp,
      objective: this.definition.objective,
      phase,
      heroTrackId: this.definition.heroTrackId,
      missionArea: this.definition.missionArea,
      platforms: this.definition.platforms,
      sensors: this.definition.sensors,
      detections: this.state.detections,
      fusedTracks,
      operatorActions: this.state.actions,
      protectedAssets: this.definition.protectedAssets,
      protectedZones: this.definition.protectedZones,
      systemStatus,
    }
  }

  private createInitialState(): EngineState {
    return {
      detections: [],
      actions: [],
      emittedEventKeys: new Set(),
      trackHistory: new Map(),
      trackCreatedAt: new Map(),
      lastCustodyStatus: new Map(),
      nextActionSequence: 1,
    }
  }

  private advanceOneSecond() {
    const elapsedSeconds = this.clock.elapsedSeconds
    const timestamp = this.clock.timestamp
    const newDetections = this.generateDetections(elapsedSeconds, timestamp)

    this.state.detections = [...this.state.detections, ...newDetections]
      .map((detection) => markDetectionStaleness(detection, elapsedSeconds))
      .filter((detection) => elapsedSeconds - detection.elapsedSecond <= 90)
      .slice(-maxDetectionHistory)

    this.updateTrackHistories(elapsedSeconds, timestamp)

    const fusedTracks = this.buildFusedTracks()
    this.emitScenarioEvents(fusedTracks)
    this.state.actions = this.state.actions.slice(-maxActionHistory)
  }

  private generateDetections(elapsedSeconds: number, timestamp: string) {
    const activeTracks = this.activeTracks(elapsedSeconds)
    const detections: SimulationDetection[] = []

    activeTracks.forEach((track) => {
      const truthPoint = trackPositionAt(track, elapsedSeconds)

      this.definition.sensors.forEach((sensor) => {
        if (elapsedSeconds % sensor.cadenceSeconds !== 0) {
          return
        }

        const platform = this.definition.platforms.find((candidate) => candidate.id === sensor.platformId)

        if (!platform) {
          return
        }

        const detection = createDetectionForSensor({
          definition: this.definition,
          elapsedSeconds,
          platformPoint: platform,
          sensor,
          template: track,
          timestamp,
          truthPoint,
        })

        if (detection) {
          detections.push(detection)
        }
      })
    })

    return detections
  }

  private updateTrackHistories(elapsedSeconds: number, timestamp: string) {
    this.activeTracks(elapsedSeconds).forEach((track) => {
      const history = this.state.trackHistory.get(track.id) ?? []
      const point = trackPositionAt(track, elapsedSeconds)
      const nextHistory = [
        ...history,
        {
          ...point,
          timestamp,
          confidence: track.baseConfidence,
        },
      ].slice(-maxTrackHistory)

      this.state.trackHistory.set(track.id, nextHistory)

      if (!this.state.trackCreatedAt.has(track.id)) {
        this.state.trackCreatedAt.set(track.id, timestamp)
      }
    })
  }

  private buildFusedTracks() {
    return this.activeTracks(this.clock.elapsedSeconds)
      .map((track) => this.buildFusedTrack(track))
      .filter((track) => track.custodyStatus !== 'Cleared')
      .sort((a, b) => b.threatScore - a.threatScore || b.confidence - a.confidence)
  }

  private buildFusedTrack(track: SimulationTrackTemplate): SimulationFusedTrack {
    const now = this.clock.elapsedSeconds
    const timestamp = this.clock.timestamp
    const point = trackPositionAt(track, now)
    const recentDetections = this.state.detections.filter(
      (detection) => detection.trackId === track.id && now - detection.elapsedSecond <= detectionWindowSeconds,
    )
    const latestDetection = [...recentDetections].sort((a, b) => b.elapsedSecond - a.elapsedSecond)[0]
    const currentDetections = recentDetections.filter((detection) => !detection.isStale)
    const contributions = this.buildFusionContributions(track, recentDetections)
    const modalities = Array.from(
      new Set(
        contributions
          .filter((contribution) => ['tentative', 'correlated', 'confirmed', 'visual', 'reacquiring'].includes(contribution.status))
          .map((c) => c.modality),
      ),
    )
    const confidence = this.calculateConfidence(track, currentDetections, contributions)
    const custodyStatus = this.calculateCustodyStatus(track, latestDetection, modalities.length)
    const { distanceToAssetM, etaSecondsToAsset } = this.assetDistanceAndEta(track, point)
    const threatScore = this.calculateThreatScore(track, confidence, modalities.length, distanceToAssetM, etaSecondsToAsset)
    const evidence = this.buildEvidence(track, recentDetections)
    const history = this.state.trackHistory.get(track.id) ?? []
    const lastSeen = latestDetection?.timestamp ?? timestamp
    const sourceSummary = modalities.length ? modalities.map(sensorModalityLabel).join(' + ') : 'No current sensor custody'

    return {
      ...point,
      id: track.id,
      missionArea: this.definition.missionArea,
      classification: track.classification,
      custodyStatus,
      confidence,
      threatScore,
      lastSeen,
      sourceSummary,
      recommendedNextAction: recommendedAction(track, custodyStatus, threatScore, modalities),
      explanation: trackExplanation(track, custodyStatus, threatScore, distanceToAssetM, modalities),
      createdAt: this.state.trackCreatedAt.get(track.id) ?? timestamp,
      updatedAt: timestamp,
      headingDeg: currentHeading(track, now),
      speedMps: track.speedMps,
      distanceToAssetM,
      etaSecondsToAsset,
      history,
      probablePath: generateProbablePath(track, now, (elapsed) =>
        formatScenarioTimestamp(Date.parse(this.definition.startTimestamp), elapsed),
      ),
      fusionContributions: contributions,
      evidence,
    }
  }

  private buildFusionContributions(
    track: SimulationTrackTemplate,
    recentDetections: SimulationDetection[],
  ): SimulationFusionContribution[] {
    return this.definition.sensors.map((sensor) => {
      const detections = recentDetections
        .filter((detection) => detection.sensorId === sensor.id)
        .sort((a, b) => b.elapsedSecond - a.elapsedSecond)
      const latest = detections[0]

      if (!latest) {
        const pending = this.clock.elapsedSeconds - track.spawnSecond < 42

        return {
          sensorId: sensor.id,
          modality: sensor.modality,
          confidence: Math.max(0.12, track.baseConfidence - 0.24),
          status: pending ? 'pending' : 'lost',
          lastSeen: this.clock.timestamp,
          ageSeconds: Math.max(0, this.clock.elapsedSeconds - track.spawnSecond),
        }
      }

      const ageSeconds = Math.max(0, this.clock.elapsedSeconds - latest.elapsedSecond)
      const status = contributionStatus(sensor.modality, latest, ageSeconds, track.behavior)

      return {
        sensorId: sensor.id,
        modality: sensor.modality,
        confidence: latest.confidence,
        status,
        lastDetectionId: latest.id,
        lastSeen: latest.timestamp,
        ageSeconds,
      }
    })
  }

  private calculateConfidence(
    track: SimulationTrackTemplate,
    currentDetections: SimulationDetection[],
    contributions: SimulationFusionContribution[],
  ) {
    const sourceCount = new Set(currentDetections.map((detection) => detection.modality)).size
    const avgDetectionConfidence =
      currentDetections.length > 0
        ? currentDetections.reduce((sum, detection) => sum + detection.confidence, 0) / currentDetections.length
        : track.baseConfidence - 0.2
    const stalePenalty = contributions.filter((contribution) => contribution.status === 'stale').length * 0.035
    const lostPenalty = contributions.filter((contribution) => contribution.status === 'lost').length * 0.02
    const clutterPenalty = track.behavior === 'clutter' ? 0.16 : 0

    return clamp(track.baseConfidence * 0.38 + avgDetectionConfidence * 0.42 + sourceCount * 0.055 - stalePenalty - lostPenalty - clutterPenalty, 0.12, 0.96)
  }

  private calculateCustodyStatus(
    track: SimulationTrackTemplate,
    latestDetection: SimulationDetection | undefined,
    modalityCount: number,
  ): SimulationFusedTrack['custodyStatus'] {
    if (track.behavior === 'clutter' && this.clock.elapsedSeconds > 150 && modalityCount <= 1) {
      return 'Cleared'
    }

    if (!latestDetection) {
      return this.clock.elapsedSeconds - track.spawnSecond > 18 ? 'Lost' : 'Tentative'
    }

    const age = this.clock.elapsedSeconds - latestDetection.elapsedSecond

    if (age > 28) {
      return 'Lost'
    }

    if (age > staleAfterSeconds || modalityCount === 0) {
      return 'Reacquiring'
    }

    if (modalityCount >= 2) {
      return 'Maintained'
    }

    return track.behavior === 'intermittent' && this.clock.elapsedSeconds > 58 ? 'Reacquiring' : 'Tentative'
  }

  private assetDistanceAndEta(track: SimulationTrackTemplate, point: SimulationPoint) {
    const protectedAsset = this.definition.protectedAssets[0]

    if (!protectedAsset) {
      return { distanceToAssetM: 99999, etaSecondsToAsset: undefined }
    }

    const distanceToAssetM = distanceMeters(point, protectedAsset)
    const futurePoint = trackPositionAt(track, this.clock.elapsedSeconds + 30)
    const futureDistance = distanceMeters(futurePoint, protectedAsset)
    const closingMps = Math.max(0, (distanceToAssetM - futureDistance) / 30)

    return {
      distanceToAssetM,
      etaSecondsToAsset: closingMps > 0.8 ? Math.round(distanceToAssetM / closingMps) : undefined,
    }
  }

  private calculateThreatScore(
    track: SimulationTrackTemplate,
    confidence: number,
    sourceCount: number,
    distanceToAssetM: number,
    etaSecondsToAsset?: number,
  ) {
    const proximityBoost = clamp((2400 - distanceToAssetM) / 2400, 0, 1) * 32
    const etaBoost = etaSecondsToAsset && etaSecondsToAsset < 360 ? 12 : 0
    const sourceBoost = Math.min(sourceCount * 4, 16)
    const confidenceBoost = confidence * 11
    const friendlyPenalty = track.friendly ? 28 : 0
    const clutterPenalty = track.behavior === 'clutter' ? 24 : 0

    return Math.round(clamp(track.baseThreat + proximityBoost + etaBoost + sourceBoost + confidenceBoost - friendlyPenalty - clutterPenalty, 1, 96))
  }

  private buildEvidence(track: SimulationTrackTemplate, recentDetections: SimulationDetection[]): SimulationEvidenceArtifact[] {
    return recentDetections
      .filter((detection) => ['RADAR', 'EO', 'IR', 'RF', 'ACOUSTIC'].includes(detection.modality) || detection.confidence > 0.72)
      .sort((a, b) => a.elapsedSecond - b.elapsedSecond)
      .slice(-8)
      .map((detection) => ({
        id: `EVD-${detection.id}`,
        trackId: track.id,
        sensorId: detection.sensorId,
        modality: detection.modality,
        timestamp: detection.timestamp,
        label:
          detection.modality === 'EO' || detection.modality === 'IR'
            ? `${sensorModalityLabel(detection.modality)} thumbnail`
            : `${sensorModalityLabel(detection.modality)} summary`,
        summary: detection.notes,
        confidence: detection.confidence,
        isNew: this.clock.elapsedSeconds - detection.elapsedSecond <= 8,
      }))
  }

  private emitScenarioEvents(fusedTracks: SimulationFusedTrack[]) {
    fusedTracks.forEach((track) => {
      const isHero = track.id === this.definition.heroTrackId
      const shouldNarrate = isHero || track.threatScore >= 55

      if (!shouldNarrate) {
        return
      }

      this.emitHeroSensorEvents(track)
      this.emitPhaseEvents(track)

      if (track.threatScore >= 70) {
        this.emitOnce(`${track.id}:threat70`, track, 'threat_increased', 'Threat score crossed high threshold')
      }

      if (track.distanceToAssetM < 850) {
        this.emitOnce(`${track.id}:zone850`, track, 'entered_protected_zone', 'Track entered protected asset standoff')
      }

      if (track.confidence >= 0.78) {
        this.emitOnce(`${track.id}:confidence78`, track, 'confidence_increased', 'Confidence increased with multi-sensor support')
      }

      if (isHero && this.clock.elapsedSeconds > 0 && this.clock.elapsedSeconds % 32 === 0) {
        this.emitTimelineEvent(track, 'path_updated', 'Probable path updated from latest velocity history')
      }

      const previousStatus = this.state.lastCustodyStatus.get(track.id)

      if (previousStatus && previousStatus !== track.custodyStatus) {
        const actionType = track.custodyStatus === 'Maintained' ? 'reacquired' : 'custody_changed'
        const label = track.custodyStatus === 'Maintained' ? 'Track reacquired and fused' : `Custody changed to ${track.custodyStatus}`
        this.emitTimelineEvent(track, actionType, label)
      }

      this.state.lastCustodyStatus.set(track.id, track.custodyStatus)
    })
  }

  private emitOnce(key: string, track: SimulationFusedTrack, actionType: string, label: string) {
    if (this.state.emittedEventKeys.has(key)) {
      return
    }

    this.state.emittedEventKeys.add(key)
    this.emitTimelineEvent(track, actionType, label)
  }

  private emitTimelineEvent(track: SimulationFusedTrack, actionType: string, label: string) {
    const sequence = this.state.nextActionSequence
    this.state.nextActionSequence += 1

    this.state.actions.push({
      id: `ACT-SIM-${String(sequence).padStart(4, '0')}`,
      trackId: track.id,
      actionType,
      label,
      timestamp: this.clock.timestamp,
      operatorId: actionType === 'review' ? 'system-fusion' : 'system',
      notes: track.explanation,
      resultingStatus: track.custodyStatus,
    })
  }

  private activeTracks(elapsedSeconds: number) {
    return this.tracks.filter((track) => elapsedSeconds >= track.spawnSecond && elapsedSeconds <= track.retireSecond)
  }

  private currentPhase() {
    return [...this.definition.phases]
      .sort((a, b) => b.startSecond - a.startSecond)
      .find((phase) => this.clock.elapsedSeconds >= phase.startSecond) ?? this.definition.phases[0]
  }

  private emitHeroSensorEvents(track: SimulationFusedTrack) {
    const contributions = track.fusionContributions
    const hasCurrentModality = (modalities: SensorModality[]) =>
      contributions.some(
        (contribution) =>
          modalities.includes(contribution.modality) &&
          ['tentative', 'correlated', 'confirmed', 'visual'].includes(contribution.status),
      )

    if (hasCurrentModality(['RADAR'])) {
      this.emitOnce(`${track.id}:radar-detection`, track, 'radar_detection_created', 'Radar detection created')
    }

    if (hasCurrentModality(['RF', 'ACOUSTIC'])) {
      this.emitOnce(`${track.id}:passive-correlated`, track, 'bearing_correlated', 'Acoustic/RF bearing correlated')
    }

    if (hasCurrentModality(['EO', 'IR'])) {
      this.emitOnce(`${track.id}:visual-acquired`, track, 'eo_visual_acquired', 'EO/IR visual acquired')
    }

    if (track.custodyStatus === 'Maintained') {
      this.emitOnce(`${track.id}:fused-established`, track, 'fused_track_established', 'Fused track established')
    }
  }

  private emitPhaseEvents(track: SimulationFusedTrack) {
    const phase = this.currentPhase()

    if (track.id !== this.definition.heroTrackId) {
      return
    }

    if (phase.id === 'eo-tasked') {
      this.emitOnce(`${track.id}:eo-tasked`, track, 'eo_camera_tasked', 'EO camera tasked to projected intercept')
    }

    if (phase.id === 'operator-review') {
      this.emitOnce(`${track.id}:operator-review`, track, 'review_opened', 'Operator opened priority review')
    }

    if (phase.id === 'action-recommended') {
      this.emitOnce(`${track.id}:action-recommended`, track, 'recommended_action_updated', 'Recommended action updated')
    }

    if (phase.id === 'multiple-tracks-detected') {
      this.emitOnce(`${track.id}:multiple-tracks`, track, 'multiple_tracks_detected', 'Multiple UAV tracks detected')
    }

    if (phase.id === 'swarm-pattern-suspected') {
      this.emitOnce(`${track.id}:swarm-pattern`, track, 'swarm_pattern_suspected', 'Swarm pattern suspected')
    }

    if (phase.id === 'lead-threat-prioritized') {
      this.emitOnce(`${track.id}:lead-prioritized`, track, 'threat_increased', 'Lead swarm track prioritized')
    }

    if (phase.id === 'simultaneous-boundary-crossing') {
      this.emitOnce(`${track.id}:boundary-crossing`, track, 'entered_protected_zone', 'Simultaneous boundary crossing detected')
    }

    if (phase.id === 'response-resolution') {
      this.emitOnce(`${track.id}:response-monitoring`, track, 'track_monitored', 'Track monitored under response workflow')
    }

    if (phase.id === 'custody-drop') {
      this.emitOnce(`${track.id}:sensor-dropout`, track, 'sensor_drop', 'Radar custody degraded in marina clutter')
    }

    if (phase.id === 'reacquiring') {
      this.emitOnce(`${track.id}:reacquire-needed`, track, 'reacquire', 'Fusion holding tentative custody')
    }
  }

  private buildSystemStatus(fusedTracks: SimulationFusedTrack[]) {
    const heroTrack = fusedTracks.find((track) => track.id === this.definition.heroTrackId)

    if (heroTrack?.custodyStatus === 'Reacquiring' || heroTrack?.custodyStatus === 'Lost') {
      return {
        state: 'reacquiring' as const,
        message: `${heroTrack.id} custody ${heroTrack.custodyStatus.toLowerCase()}`,
      }
    }

    const degradedSensor = this.definition.sensors.find((sensor) =>
      sensor.degradationWindows?.some(
        (window) => this.clock.elapsedSeconds >= window.startSecond && this.clock.elapsedSeconds <= window.endSecond,
      ),
    )

    if (degradedSensor) {
      return {
        state: 'degraded' as const,
        message: `${degradedSensor.id} degraded, fusion still running`,
      }
    }

    return {
      state: 'nominal' as const,
      message: `${fusedTracks.length} fused tracks / ${this.state.detections.length} recent detections`,
    }
  }
}

export function createScenarioEngine(scenarioKey: SimulationScenarioKey) {
  return new ScenarioEngine(scenarioKey)
}

function markDetectionStaleness(detection: SimulationDetection, elapsedSeconds: number): SimulationDetection {
  const ageSeconds = elapsedSeconds - detection.elapsedSecond

  if (ageSeconds <= staleAfterSeconds) {
    return {
      ...detection,
      isStale: false,
    }
  }

  return {
    ...detection,
    isStale: true,
    staleReason: detection.staleReason ?? 'Detection aged beyond fusion freshness window',
  }
}

function contributionStatus(
  modality: SensorModality,
  latest: SimulationDetection,
  ageSeconds: number,
  behavior: SimulationTrackTemplate['behavior'],
): SimulationFusionContribution['status'] {
  if (ageSeconds > 24) {
    return 'lost'
  }

  if (latest.isStale || ageSeconds > staleAfterSeconds) {
    return behavior === 'intermittent' ? 'reacquiring' : 'stale'
  }

  if (modality === 'EO' || modality === 'IR') {
    return latest.confidence >= 0.55 ? 'visual' : 'tentative'
  }

  if (modality === 'RF' || modality === 'ACOUSTIC') {
    return latest.confidence >= 0.5 ? 'correlated' : 'tentative'
  }

  return latest.confidence >= 0.58 ? 'confirmed' : 'tentative'
}

function currentHeading(track: SimulationTrackTemplate, elapsedSeconds: number) {
  const current = trackPositionAt(track, elapsedSeconds)
  const next = trackPositionAt(track, elapsedSeconds + 12)
  return bearingBetween(current, next)
}

function recommendedAction(
  track: SimulationTrackTemplate,
  custodyStatus: SimulationFusedTrack['custodyStatus'],
  threatScore: number,
  modalities: SensorModality[],
) {
  if (custodyStatus === 'Lost' || custodyStatus === 'Reacquiring') {
    return 'Reacquire with EO/IR while maintaining passive RF watch.'
  }

  if (track.behavior === 'clutter' || track.classification.includes('bird')) {
    return 'Monitor until confidence decays, then downgrade as clutter.'
  }

  if (threatScore >= 70 && modalities.length >= 3) {
    return 'Confirm track and dispatch harbor intercept.'
  }

  if (!modalities.includes('EO') && !modalities.includes('IR')) {
    return 'Slew EO/IR to establish visual custody.'
  }

  return 'Maintain fused custody and continue passive collection.'
}

function trackExplanation(
  track: SimulationTrackTemplate,
  custodyStatus: SimulationFusedTrack['custodyStatus'],
  threatScore: number,
  distanceToAssetM: number,
  modalities: SensorModality[],
) {
  const sources = modalities.length ? modalities.map(sensorModalityLabel).join(', ') : 'no fresh sensors'
  const distanceLabel = `${Math.round(distanceToAssetM)} m`

  if (track.behavior === 'clutter') {
    return `Low-confidence ${track.classification.toLowerCase()} is being held for review because ${sources} produced intermittent cues.`
  }

  if (custodyStatus === 'Reacquiring' || custodyStatus === 'Lost') {
    return `${track.classification} is ${custodyStatus.toLowerCase()} after stale detections; last fusion sources were ${sources}.`
  }

  return `${track.classification} has ${custodyStatus.toLowerCase()} custody from ${sources}; threat ${threatScore} is driven by proximity ${distanceLabel} from the protected asset.`
}
