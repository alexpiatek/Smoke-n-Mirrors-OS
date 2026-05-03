import type {
  Detection,
  FusedTrack,
  OperatorAction,
  Platform,
  ProtectedAsset,
  ProtectedZone,
  ScenarioBriefing,
  Sensor,
} from '../../types/mission'
import type { SimulationSnapshot } from '../../types/simulation'

export type SimulationUiBundle = {
  platforms: Platform[]
  sensors: Sensor[]
  detections: Detection[]
  fusedTracks: FusedTrack[]
  operatorActions: OperatorAction[]
  protectedAssets: ProtectedAsset[]
  protectedZones: ProtectedZone[]
  briefing: ScenarioBriefing
  statusText: string
}

export function simulationToUi(snapshot: SimulationSnapshot): SimulationUiBundle {
  return {
    platforms: snapshot.platforms.map((platform) => ({
      platform_id: platform.id,
      callsign: platform.callsign,
      platform_type: platform.platformType,
      owner_unit: platform.ownerUnit,
      lat: platform.lat,
      lon: platform.lon,
    })),
    sensors: snapshot.sensors.map((sensor) => ({
      sensor_id: sensor.id,
      platform_id: sensor.platformId,
      modality: sensor.modality,
      measurement_kind: sensor.measurementKind,
      range_max_m: sensor.rangeMaxM,
      fov_type: sensor.fovType,
      fov_h_deg: sensor.fovHDeg,
      latency_ms_p50: sensor.latencyMsP50,
    })),
    detections: snapshot.detections.map((detection) => ({
      detection_id: detection.id,
      sensor_id: detection.sensorId,
      timestamp: detection.timestamp,
      modality: detection.modality,
      bearing_deg: detection.bearingDeg,
      range_m: detection.rangeM,
      confidence: detection.confidence,
      classification: detection.classification,
      contributes_to_track_id: detection.trackId,
      is_stale: detection.isStale,
      stale_reason: detection.staleReason,
      notes: detection.notes,
      estimated_lat: detection.lat,
      estimated_lon: detection.lon,
    })),
    fusedTracks: snapshot.fusedTracks.map((track) => ({
      track_id: track.id,
      mission_area: track.missionArea,
      custody_status: track.custodyStatus,
      confidence: track.confidence,
      threat_score: track.threatScore,
      last_seen: track.lastSeen,
      estimated_lat: track.lat,
      estimated_lon: track.lon,
      source_summary: track.sourceSummary,
      recommended_next_action: track.recommendedNextAction,
      explanation: track.explanation,
      created_at: track.createdAt,
      updated_at: track.updatedAt,
      classification: track.classification,
      heading_deg: track.headingDeg,
      speed_mps: track.speedMps,
      distance_to_asset_m: track.distanceToAssetM,
      eta_seconds_to_asset: track.etaSecondsToAsset,
      track_history: track.history.map((point) => ({
        timestamp: point.timestamp,
        lat: point.lat,
        lon: point.lon,
        confidence: point.confidence,
      })),
      probable_path: track.probablePath.map((point) => ({
        timestamp: point.timestamp,
        lat: point.lat,
        lon: point.lon,
        confidence: point.confidence,
      })),
      fusion_contributions: track.fusionContributions.map((contribution) => ({
        sensor_id: contribution.sensorId,
        modality: contribution.modality,
        confidence: contribution.confidence,
        status: contribution.status,
        last_detection_id: contribution.lastDetectionId,
        last_seen: contribution.lastSeen,
        age_seconds: contribution.ageSeconds,
      })),
      evidence: track.evidence.map((artifact) => ({
        artifact_id: artifact.id,
        track_id: artifact.trackId,
        sensor_id: artifact.sensorId,
        modality: artifact.modality,
        timestamp: artifact.timestamp,
        label: artifact.label,
        summary: artifact.summary,
        confidence: artifact.confidence,
        thumbnail_class: artifact.modality.toLowerCase(),
        is_new: artifact.isNew,
      })),
    })),
    operatorActions: snapshot.operatorActions.map((action) => ({
      action_id: action.id,
      track_id: action.trackId,
      action_type: action.actionType,
      label: action.label,
      timestamp: action.timestamp,
      operator_id: action.operatorId,
      notes: action.notes,
      resulting_status: action.resultingStatus,
    })),
    protectedAssets: snapshot.protectedAssets.map((asset) => ({
      asset_id: asset.id,
      label: asset.label,
      lat: asset.lat,
      lon: asset.lon,
      priority: asset.priority,
    })),
    protectedZones: snapshot.protectedZones.map((zone) => ({
      zone_id: zone.id,
      label: zone.label,
      kind: zone.kind,
      coordinates: zone.points.map((point) => ({ lat: point.lat, lon: point.lon })),
    })),
    briefing: {
      scenario_key: snapshot.scenarioKey,
      scenario_name: snapshot.scenarioLabel,
      objective: snapshot.objective,
      phase_label: snapshot.phase.label,
      phase_description: snapshot.phase.description,
      elapsed_seconds: snapshot.elapsedSeconds,
      next_event: snapshot.phase.nextEvent,
      active_tracks: snapshot.fusedTracks.length,
      highest_threat: Math.max(0, ...snapshot.fusedTracks.map((track) => track.threatScore)),
    },
    statusText: snapshot.systemStatus.message,
  }
}
