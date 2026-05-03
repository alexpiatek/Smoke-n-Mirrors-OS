export type Platform = {
  platform_id: string
  callsign: string
  platform_type: string
  owner_unit: string
  lat: number
  lon: number
}

export type Sensor = {
  sensor_id: string
  platform_id: string
  modality: string
  measurement_kind: string
  range_max_m: number
  fov_type: string
  fov_h_deg: number
  latency_ms_p50: number
}

export type TrackPoint = {
  timestamp: string
  lat: number
  lon: number
  confidence?: number
}

export type FusionContribution = {
  sensor_id: string
  modality: string
  confidence: number
  status: string
  last_detection_id?: string
  last_seen: string
  age_seconds?: number
}

export type EvidenceArtifact = {
  artifact_id: string
  track_id: string
  sensor_id: string
  modality: string
  timestamp: string
  label: string
  summary: string
  confidence: number
  thumbnail_class?: string
  is_new?: boolean
}

export type Detection = {
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
  estimated_lat?: number
  estimated_lon?: number
}

export type FusedTrack = {
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
  classification?: string
  status_reason?: string
  heading_deg?: number
  speed_mps?: number
  distance_to_asset_m?: number
  eta_seconds_to_asset?: number
  track_history?: TrackPoint[]
  probable_path?: TrackPoint[]
  fusion_contributions?: FusionContribution[]
  evidence?: EvidenceArtifact[]
}

export type OperatorAction = {
  action_id: string
  track_id: string
  action_type: string
  label: string
  timestamp: string
  operator_id?: string
  notes?: string
  resulting_status?: string
}

export type ScenarioBriefing = {
  scenario_key: string
  scenario_name: string
  objective: string
  phase_label: string
  phase_description: string
  elapsed_seconds: number
  next_event?: string
  active_tracks: number
  highest_threat: number
}

export type ProtectedZone = {
  zone_id: string
  label: string
  kind: 'mission' | 'restricted' | 'asset_buffer'
  coordinates: Array<{ lat: number; lon: number }>
}

export type ProtectedAsset = {
  asset_id: string
  label: string
  lat: number
  lon: number
  priority: 'critical' | 'high' | 'standard'
}

export type GeoJsonGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] }

export type GeoJsonFeature = {
  type: 'Feature'
  geometry: GeoJsonGeometry
  properties: Record<string, string | number | boolean | null>
}

export type GeoJsonCollection = {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}
