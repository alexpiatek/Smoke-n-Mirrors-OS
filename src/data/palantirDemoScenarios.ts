import type { Detection, FusedTrack, OperatorAction, Platform, ProtectedAsset, ProtectedZone, Sensor } from '../lib/types/mission'
import type { SimulationScenarioKey } from '../lib/types/simulation'

export type PalantirDemoScenarioBundle = {
  scenarioId: string
  runId: string
  scenarioName: string
  missionArea: string
  description: string
  heroTrackId: string
  sourceLabel: 'Demo Generated'
  provenance: {
    dataSource: 'simulated'
    scenarioSource: 'SmokenMirrorsOS demo'
    generatedBy: 'scenario_engine'
    isOperationalRealData: false
    generatedAtUtc: string
    scenarioId: string
    runId: string
  }
  platforms: Platform[]
  sensors: Sensor[]
  protectedAssets: ProtectedAsset[]
  protectedZones: ProtectedZone[]
  detections: Detection[]
  fusedTracks: FusedTrack[]
  operatorActions: OperatorAction[]
}

export const palantirDemoDatasetMetadata = {
  "foundryFolderRid": "ri.compass.main.folder.d8c8216c-66aa-4736-bf0b-a2341c99b02d",
  "foundryFolderPath": "/NatSec Hackathon-32b6df/Smoke&Mirrors Project",
  "branch": "master",
  "datasetRids": {
    "scenarios": "ri.foundry.main.dataset.dbf7d526-2535-419f-a8bb-0b86ef1041d6",
    "platforms": "ri.foundry.main.dataset.df88ff33-80f5-4a5f-b26c-8ddc3c5abdda",
    "sensors": "ri.foundry.main.dataset.50bbbe85-760d-4795-9c58-6b0fdcf2a3a5",
    "protectedAssets": "ri.foundry.main.dataset.06ae2b23-2564-45c8-97bc-1a9b93caa625",
    "protectedZones": "ri.foundry.main.dataset.e55ac7d9-08fa-48f3-8835-433303380a0c",
    "fusedTracks": "ri.foundry.main.dataset.49cdd72e-5749-4adb-a170-9a8271ea0751",
    "detections": "ri.foundry.main.dataset.1e5ee3f9-4fee-45a5-8b5b-41eff195e8a5",
    "fusionContributions": "ri.foundry.main.dataset.cc189737-1026-4fdf-a966-6366a24fef58",
    "evidenceArtifacts": "ri.foundry.main.dataset.441090e6-c211-440d-ac3e-33601fe10427",
    "operatorActions": "ri.foundry.main.dataset.f0462d1c-055f-4292-821b-87c92e68ee0c"
  },
  "generatedAtUtc": "2026-05-03T05:00:00.000Z"
} as const

export const palantirDemoScenarioIdByKey: Record<SimulationScenarioKey, string> = {
  "singleDroneIntrusion": "single-drone-intrusion",
  "droneSwarmPattern": "drone-swarm-pattern"
}

export const palantirDemoScenarios: Record<SimulationScenarioKey, PalantirDemoScenarioBundle> = {
  "singleDroneIntrusion": {
    "scenarioId": "single-drone-intrusion",
    "runId": "RUN-SMOS-SD-20260503T050000Z",
    "scenarioName": "Single Drone Intrusion",
    "missionArea": "MissionArea-Harbor-North",
    "description": "One probable UAV approaches the protected waterfront zone for operator decision workflow.",
    "heroTrackId": "TRK-SD-001",
    "sourceLabel": "Demo Generated",
    "provenance": {
      "dataSource": "simulated",
      "scenarioSource": "SmokenMirrorsOS demo",
      "generatedBy": "scenario_engine",
      "isOperationalRealData": false,
      "generatedAtUtc": "2026-05-03T05:00:00.000Z",
      "scenarioId": "single-drone-intrusion",
      "runId": "RUN-SMOS-SD-20260503T050000Z"
    },
    "platforms": [
      {
        "platform_id": "PLAT-HARBOR-RDR",
        "callsign": "Harbor Radar",
        "platform_type": "FIXED_RADAR_TOWER",
        "owner_unit": "Blue Cell",
        "lat": 37.8107,
        "lon": -122.3786
      },
      {
        "platform_id": "PLAT-PIER-RF",
        "callsign": "Pier RF Array",
        "platform_type": "FIXED_RF_ARRAY",
        "owner_unit": "Blue Cell",
        "lat": 37.8069,
        "lon": -122.3924
      },
      {
        "platform_id": "PLAT-BUOY-AC",
        "callsign": "Harbor Acoustic",
        "platform_type": "FIXED_ACOUSTIC_BUOY",
        "owner_unit": "Maritime Ops",
        "lat": 37.8029,
        "lon": -122.3679
      },
      {
        "platform_id": "PLAT-CRANE-EOIR",
        "callsign": "Crane EOIR",
        "platform_type": "FIXED_EO_IR",
        "owner_unit": "Port Authority",
        "lat": 37.8145,
        "lon": -122.3628
      }
    ],
    "sensors": [
      {
        "sensor_id": "SENS-RDR-HN-01",
        "platform_id": "PLAT-HARBOR-RDR",
        "modality": "RADAR",
        "measurement_kind": "RADAR_GMTI",
        "range_max_m": 5200,
        "fov_type": "SECTOR",
        "fov_h_deg": 94,
        "latency_ms_p50": 84
      },
      {
        "sensor_id": "SENS-RF-HN-01",
        "platform_id": "PLAT-PIER-RF",
        "modality": "RF",
        "measurement_kind": "RF_ESM",
        "range_max_m": 3600,
        "fov_type": "OMNIDIRECTIONAL",
        "fov_h_deg": 360,
        "latency_ms_p50": 126
      },
      {
        "sensor_id": "SENS-AC-HN-01",
        "platform_id": "PLAT-BUOY-AC",
        "modality": "ACOUSTIC",
        "measurement_kind": "ACOUSTIC_TONAL",
        "range_max_m": 1800,
        "fov_type": "OMNIDIRECTIONAL",
        "fov_h_deg": 360,
        "latency_ms_p50": 340
      },
      {
        "sensor_id": "SENS-EOIR-HN-01",
        "platform_id": "PLAT-CRANE-EOIR",
        "modality": "EO",
        "measurement_kind": "EO_IR_VISUAL",
        "range_max_m": 2600,
        "fov_type": "GIMBALED",
        "fov_h_deg": 28,
        "latency_ms_p50": 210
      }
    ],
    "protectedAssets": [
      {
        "asset_id": "ASSET-WATERFRONT",
        "label": "Protected Waterfront",
        "priority": "critical",
        "lat": 37.8095,
        "lon": -122.3697
      }
    ],
    "protectedZones": [
      {
        "zone_id": "ZONE-HARBOR-MISSION",
        "label": "Harbor North Mission Box",
        "kind": "mission",
        "coordinates": [
          {
            "lat": 37.7939,
            "lon": -122.3982
          },
          {
            "lat": 37.8225,
            "lon": -122.3974
          },
          {
            "lat": 37.8239,
            "lon": -122.3545
          },
          {
            "lat": 37.7949,
            "lon": -122.3506
          },
          {
            "lat": 37.7939,
            "lon": -122.3982
          }
        ]
      },
      {
        "zone_id": "ZONE-HARBOR-RESTRICTED",
        "label": "Restricted Waterfront Standoff",
        "kind": "restricted",
        "coordinates": [
          {
            "lat": 37.8057,
            "lon": -122.3748
          },
          {
            "lat": 37.8136,
            "lon": -122.374
          },
          {
            "lat": 37.8142,
            "lon": -122.3654
          },
          {
            "lat": 37.8063,
            "lon": -122.3639
          },
          {
            "lat": 37.8057,
            "lon": -122.3748
          }
        ]
      }
    ],
    "detections": [
      {
        "detection_id": "DET-SD-RDR-001",
        "sensor_id": "SENS-RDR-HN-01",
        "timestamp": "2026-05-03T05:00:24.000Z",
        "modality": "RADAR",
        "bearing_deg": 52,
        "range_m": 1850,
        "confidence": 0.54,
        "classification": "Initial radar UAV-size contact",
        "contributes_to_track_id": "TRK-SD-001",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated radar-first event",
        "estimated_lat": 37.7976,
        "estimated_lon": -122.3915
      },
      {
        "detection_id": "DET-SD-RF-002",
        "sensor_id": "SENS-RF-HN-01",
        "timestamp": "2026-05-03T05:01:05.000Z",
        "modality": "RF",
        "bearing_deg": 49,
        "range_m": 1540,
        "confidence": 0.66,
        "classification": "Short command burst",
        "contributes_to_track_id": "TRK-SD-001",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated RF correlation",
        "estimated_lat": 37.8001,
        "estimated_lon": -122.3866
      },
      {
        "detection_id": "DET-SD-AC-003",
        "sensor_id": "SENS-AC-HN-01",
        "timestamp": "2026-05-03T05:01:20.000Z",
        "modality": "ACOUSTIC",
        "bearing_deg": 51,
        "range_m": 1320,
        "confidence": 0.63,
        "classification": "Small rotor acoustic tone",
        "contributes_to_track_id": "TRK-SD-001",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated acoustic correlation",
        "estimated_lat": 37.8011,
        "estimated_lon": -122.3852
      },
      {
        "detection_id": "DET-SD-RDR-004",
        "sensor_id": "SENS-RDR-HN-01",
        "timestamp": "2026-05-03T05:02:34.000Z",
        "modality": "RADAR",
        "bearing_deg": 54,
        "range_m": 720,
        "confidence": 0.78,
        "classification": "Closing UAV-size track",
        "contributes_to_track_id": "TRK-SD-001",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated threat score increase",
        "estimated_lat": 37.8047,
        "estimated_lon": -122.3798
      },
      {
        "detection_id": "DET-SD-EOIR-005",
        "sensor_id": "SENS-EOIR-HN-01",
        "timestamp": "2026-05-03T05:03:20.000Z",
        "modality": "EO",
        "bearing_deg": 57,
        "range_m": 354,
        "confidence": 0.84,
        "classification": "EO/IR visual confirmation",
        "contributes_to_track_id": "TRK-SD-001",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated EO/IR visual placeholder",
        "estimated_lat": 37.8057,
        "estimated_lon": -122.3772
      }
    ],
    "fusedTracks": [
      {
        "track_id": "TRK-SD-001",
        "mission_area": "MissionArea-Harbor-North",
        "custody_status": "Maintained",
        "confidence": 0.84,
        "threat_score": 82,
        "last_seen": "2026-05-03T05:03:20.000Z",
        "estimated_lat": 37.8057,
        "estimated_lon": -122.3772,
        "source_summary": "Radar + RF + Acoustic + EO/IR",
        "recommended_next_action": "Notify response team and keep EO/IR on track",
        "explanation": "Probable UAV is inbound toward the protected waterfront with multi-sensor custody and a short ETA.",
        "created_at": "2026-05-03T05:00:24.000Z",
        "updated_at": "2026-05-03T05:03:20.000Z",
        "classification": "Probable UAV",
        "heading_deg": 51,
        "speed_mps": 15.6,
        "distance_to_asset_m": 354,
        "eta_seconds_to_asset": 58,
        "behavior_type": "single_intrusion",
        "track_history": [
          {
            "timestamp": "2026-05-03T05:00:24.000Z",
            "lat": 37.7976,
            "lon": -122.3915,
            "confidence": 0.52
          },
          {
            "timestamp": "2026-05-03T05:01:05.000Z",
            "lat": 37.8001,
            "lon": -122.3866,
            "confidence": 0.66
          },
          {
            "timestamp": "2026-05-03T05:01:48.000Z",
            "lat": 37.8028,
            "lon": -122.3825,
            "confidence": 0.74
          },
          {
            "timestamp": "2026-05-03T05:02:34.000Z",
            "lat": 37.8047,
            "lon": -122.3798,
            "confidence": 0.81
          },
          {
            "timestamp": "2026-05-03T05:03:20.000Z",
            "lat": 37.8057,
            "lon": -122.3772,
            "confidence": 0.84
          }
        ],
        "probable_path": [
          {
            "timestamp": "2026-05-03T05:03:45.000Z",
            "lat": 37.8065,
            "lon": -122.3757,
            "confidence": 0.8
          },
          {
            "timestamp": "2026-05-03T05:04:15.000Z",
            "lat": 37.8075,
            "lon": -122.3738,
            "confidence": 0.76
          },
          {
            "timestamp": "2026-05-03T05:04:50.000Z",
            "lat": 37.8086,
            "lon": -122.3717,
            "confidence": 0.71
          }
        ],
        "fusion_contributions": [
          {
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "confidence": 0.7899999999999999,
            "status": "confirmed",
            "last_seen": "2026-05-03T05:03:20.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "confidence": 0.7899999999999999,
            "status": "correlated",
            "last_seen": "2026-05-03T05:03:20.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-AC-HN-01",
            "modality": "ACOUSTIC",
            "confidence": 0.7899999999999999,
            "status": "correlated",
            "last_seen": "2026-05-03T05:03:20.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "confidence": 0.86,
            "status": "visual",
            "last_seen": "2026-05-03T05:03:20.000Z",
            "age_seconds": 0
          }
        ],
        "evidence": [
          {
            "artifact_id": "EVD-TRK-SD-001-RADAR",
            "track_id": "TRK-SD-001",
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "timestamp": "2026-05-03T05:03:20.000Z",
            "label": "Radar plot placeholder",
            "summary": "Simulated radar plot placeholder for TRK-SD-001.",
            "confidence": 0.76,
            "thumbnail_class": "radar",
            "is_new": true
          },
          {
            "artifact_id": "EVD-TRK-SD-001-RFAC",
            "track_id": "TRK-SD-001",
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "timestamp": "2026-05-03T05:03:20.000Z",
            "label": "RF/acoustic bearing record",
            "summary": "Simulated RF/acoustic bearing record for TRK-SD-001.",
            "confidence": 0.78,
            "thumbnail_class": "acoustic-rf",
            "is_new": false
          },
          {
            "artifact_id": "EVD-TRK-SD-001-EOIR",
            "track_id": "TRK-SD-001",
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "timestamp": "2026-05-03T05:03:20.000Z",
            "label": "EO/IR visual placeholder",
            "summary": "Simulated EO/IR visual placeholder for TRK-SD-001.",
            "confidence": 0.86,
            "thumbnail_class": "eo",
            "is_new": true
          }
        ]
      }
    ],
    "operatorActions": [
      {
        "action_id": "ACT-SD-0001",
        "track_id": "TRK-SD-001",
        "action_type": "radar_detection_created",
        "label": "Radar detection created",
        "timestamp": "2026-05-03T05:00:24.000Z",
        "operator_id": "system-fusion",
        "notes": "Simulated radar detection seeded the track.",
        "resulting_status": "Tentative"
      },
      {
        "action_id": "ACT-SD-0002",
        "track_id": "TRK-SD-001",
        "action_type": "bearing_correlated",
        "label": "RF/acoustic correlated",
        "timestamp": "2026-05-03T05:01:20.000Z",
        "operator_id": "system-fusion",
        "notes": "Simulated passive sources correlated with radar.",
        "resulting_status": "Correlating"
      },
      {
        "action_id": "ACT-SD-0003",
        "track_id": "TRK-SD-001",
        "action_type": "fused_track_established",
        "label": "Fused track established",
        "timestamp": "2026-05-03T05:02:34.000Z",
        "operator_id": "system-fusion",
        "notes": "Track promoted to maintained custody.",
        "resulting_status": "Maintained"
      },
      {
        "action_id": "ACT-SD-0004",
        "track_id": "TRK-SD-001",
        "action_type": "eo_camera_tasked",
        "label": "EO/IR tasked",
        "timestamp": "2026-05-03T05:02:50.000Z",
        "operator_id": "system",
        "notes": "EO/IR tasked to projected intercept corridor.",
        "resulting_status": "Maintained"
      },
      {
        "action_id": "ACT-SD-0005",
        "track_id": "TRK-SD-001",
        "action_type": "threat_increased",
        "label": "Threat increased",
        "timestamp": "2026-05-03T05:03:05.000Z",
        "operator_id": "system-fusion",
        "notes": "Threat score increased as range closed.",
        "resulting_status": "Maintained"
      },
      {
        "action_id": "ACT-SD-0006",
        "track_id": "TRK-SD-001",
        "action_type": "notify_response",
        "label": "Notify response team recommended",
        "timestamp": "2026-05-03T05:03:20.000Z",
        "operator_id": "system",
        "notes": "Recommended response team notification.",
        "resulting_status": "Maintained"
      }
    ]
  },
  "droneSwarmPattern": {
    "scenarioId": "drone-swarm-pattern",
    "runId": "RUN-SMOS-SW-20260503T050000Z",
    "scenarioName": "Drone Swarm Pattern",
    "missionArea": "MissionArea-Treasure-Island",
    "description": "Multiple simulated UAV tracks approach the protected island from north, west, south, and east vectors for a clear swarm-defense operator decision.",
    "heroTrackId": "TRK-SW-001",
    "sourceLabel": "Demo Generated",
    "provenance": {
      "dataSource": "simulated",
      "scenarioSource": "SmokenMirrorsOS demo",
      "generatedBy": "scenario_engine",
      "isOperationalRealData": false,
      "generatedAtUtc": "2026-05-03T05:00:00.000Z",
      "scenarioId": "drone-swarm-pattern",
      "runId": "RUN-SMOS-SW-20260503T050000Z"
    },
    "platforms": [
      {
        "platform_id": "PLAT-HARBOR-RDR",
        "callsign": "Island Radar",
        "platform_type": "FIXED_RADAR_TOWER",
        "owner_unit": "Blue Cell",
        "lat": 37.8216,
        "lon": -122.3926
      },
      {
        "platform_id": "PLAT-PIER-RF",
        "callsign": "North RF Array",
        "platform_type": "FIXED_RF_ARRAY",
        "owner_unit": "Blue Cell",
        "lat": 37.8353,
        "lon": -122.3788
      },
      {
        "platform_id": "PLAT-BUOY-AC",
        "callsign": "Island Acoustic",
        "platform_type": "FIXED_ACOUSTIC_BUOY",
        "owner_unit": "Maritime Ops",
        "lat": 37.8144,
        "lon": -122.3598
      },
      {
        "platform_id": "PLAT-CRANE-EOIR",
        "callsign": "Island EOIR",
        "platform_type": "FIXED_EO_IR",
        "owner_unit": "Port Authority",
        "lat": 37.8235,
        "lon": -122.3634
      }
    ],
    "sensors": [
      {
        "sensor_id": "SENS-RDR-HN-01",
        "platform_id": "PLAT-HARBOR-RDR",
        "modality": "RADAR",
        "measurement_kind": "RADAR_GMTI",
        "range_max_m": 5200,
        "fov_type": "SECTOR",
        "fov_h_deg": 94,
        "latency_ms_p50": 84
      },
      {
        "sensor_id": "SENS-RF-HN-01",
        "platform_id": "PLAT-PIER-RF",
        "modality": "RF",
        "measurement_kind": "RF_ESM",
        "range_max_m": 3600,
        "fov_type": "OMNIDIRECTIONAL",
        "fov_h_deg": 360,
        "latency_ms_p50": 126
      },
      {
        "sensor_id": "SENS-AC-HN-01",
        "platform_id": "PLAT-BUOY-AC",
        "modality": "ACOUSTIC",
        "measurement_kind": "ACOUSTIC_TONAL",
        "range_max_m": 2400,
        "fov_type": "OMNIDIRECTIONAL",
        "fov_h_deg": 360,
        "latency_ms_p50": 340
      },
      {
        "sensor_id": "SENS-EOIR-HN-01",
        "platform_id": "PLAT-CRANE-EOIR",
        "modality": "EO",
        "measurement_kind": "EO_IR_VISUAL",
        "range_max_m": 2600,
        "fov_type": "GIMBALED",
        "fov_h_deg": 28,
        "latency_ms_p50": 210
      }
    ],
    "protectedAssets": [
      {
        "asset_id": "ASSET-ISLAND",
        "label": "Protected Island",
        "priority": "critical",
        "lat": 37.8242,
        "lon": -122.3705
      }
    ],
    "protectedZones": [
      {
        "zone_id": "ZONE-ISLAND-MISSION",
        "label": "Island Mission Box",
        "kind": "mission",
        "coordinates": [
          {
            "lat": 37.7988,
            "lon": -122.405
          },
          {
            "lat": 37.8365,
            "lon": -122.403
          },
          {
            "lat": 37.8374,
            "lon": -122.348
          },
          {
            "lat": 37.7976,
            "lon": -122.3462
          },
          {
            "lat": 37.7988,
            "lon": -122.405
          }
        ]
      },
      {
        "zone_id": "ZONE-ISLAND-RESTRICTED",
        "label": "Restricted Island Standoff",
        "kind": "restricted",
        "coordinates": [
          {
            "lat": 37.8188,
            "lon": -122.3798
          },
          {
            "lat": 37.8294,
            "lon": -122.3791
          },
          {
            "lat": 37.8301,
            "lon": -122.3608
          },
          {
            "lat": 37.8193,
            "lon": -122.3589
          },
          {
            "lat": 37.8188,
            "lon": -122.3798
          }
        ]
      }
    ],
    "detections": [
      {
        "detection_id": "DET-SW-001-RDR",
        "sensor_id": "SENS-RDR-HN-01",
        "timestamp": "2026-05-03T05:06:00.000Z",
        "modality": "RADAR",
        "bearing_deg": 103,
        "range_m": 596,
        "confidence": 0.8,
        "classification": "UAV-size radar track",
        "contributes_to_track_id": "TRK-SW-001",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm radar cue for lead_converging_approach",
        "estimated_lat": 37.8204,
        "estimated_lon": -122.386
      },
      {
        "detection_id": "DET-SW-001-RF",
        "sensor_id": "SENS-RF-HN-01",
        "timestamp": "2026-05-03T05:07:05.000Z",
        "modality": "RF",
        "bearing_deg": 185,
        "range_m": 1463,
        "confidence": 0.84,
        "classification": "Coordinated command burst",
        "contributes_to_track_id": "TRK-SW-001",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm RF cue for lead_converging_approach",
        "estimated_lat": 37.8222,
        "estimated_lon": -122.3802
      },
      {
        "detection_id": "DET-SW-001-AC",
        "sensor_id": "SENS-AC-HN-01",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "modality": "ACOUSTIC",
        "bearing_deg": 296,
        "range_m": 1993,
        "confidence": 0.76,
        "classification": "Rotor acoustic bearing",
        "contributes_to_track_id": "TRK-SW-001",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm acoustic cue for lead_converging_approach",
        "estimated_lat": 37.8222,
        "estimated_lon": -122.3802
      },
      {
        "detection_id": "DET-SW-001-EOIR",
        "sensor_id": "SENS-EOIR-HN-01",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "modality": "EO",
        "bearing_deg": 269,
        "range_m": 1046,
        "confidence": 0.9,
        "classification": "EO/IR visual UAV cue",
        "contributes_to_track_id": "TRK-SW-001",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm visual cue for lead_converging_approach",
        "estimated_lat": 37.8234,
        "estimated_lon": -122.3753
      },
      {
        "detection_id": "DET-SW-002-RDR",
        "sensor_id": "SENS-RDR-HN-01",
        "timestamp": "2026-05-03T05:06:00.000Z",
        "modality": "RADAR",
        "bearing_deg": 30,
        "range_m": 1407,
        "confidence": 0.7,
        "classification": "UAV-size radar track",
        "contributes_to_track_id": "TRK-SW-002",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm radar cue for northwest_split_approach",
        "estimated_lat": 37.8325,
        "estimated_lon": -122.3845
      },
      {
        "detection_id": "DET-SW-002-RF",
        "sensor_id": "SENS-RF-HN-01",
        "timestamp": "2026-05-03T05:07:05.000Z",
        "modality": "RF",
        "bearing_deg": 188,
        "range_m": 608,
        "confidence": 0.74,
        "classification": "Coordinated command burst",
        "contributes_to_track_id": "TRK-SW-002",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm RF cue for northwest_split_approach",
        "estimated_lat": 37.8299,
        "estimated_lon": -122.3798
      },
      {
        "detection_id": "DET-SW-002-AC",
        "sensor_id": "SENS-AC-HN-01",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "modality": "ACOUSTIC",
        "bearing_deg": 314,
        "range_m": 2464,
        "confidence": 0.66,
        "classification": "Rotor acoustic bearing",
        "contributes_to_track_id": "TRK-SW-002",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm acoustic cue for northwest_split_approach",
        "estimated_lat": 37.8299,
        "estimated_lon": -122.3798
      },
      {
        "detection_id": "DET-SW-003-RDR",
        "sensor_id": "SENS-RDR-HN-01",
        "timestamp": "2026-05-03T05:06:00.000Z",
        "modality": "RADAR",
        "bearing_deg": 140,
        "range_m": 1327,
        "confidence": 0.68,
        "classification": "UAV-size radar track",
        "contributes_to_track_id": "TRK-SW-003",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm radar cue for southwest_split_approach",
        "estimated_lat": 37.8124,
        "estimated_lon": -122.383
      },
      {
        "detection_id": "DET-SW-003-RF",
        "sensor_id": "SENS-RF-HN-01",
        "timestamp": "2026-05-03T05:07:05.000Z",
        "modality": "RF",
        "bearing_deg": 180,
        "range_m": 2093,
        "confidence": 0.72,
        "classification": "Coordinated command burst",
        "contributes_to_track_id": "TRK-SW-003",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm RF cue for southwest_split_approach",
        "estimated_lat": 37.8165,
        "estimated_lon": -122.379
      },
      {
        "detection_id": "DET-SW-003-AC",
        "sensor_id": "SENS-AC-HN-01",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "modality": "ACOUSTIC",
        "bearing_deg": 278,
        "range_m": 1705,
        "confidence": 0.64,
        "classification": "Rotor acoustic bearing",
        "contributes_to_track_id": "TRK-SW-003",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm acoustic cue for southwest_split_approach",
        "estimated_lat": 37.8165,
        "estimated_lon": -122.379
      },
      {
        "detection_id": "DET-SW-004-RDR",
        "sensor_id": "SENS-RDR-HN-01",
        "timestamp": "2026-05-03T05:06:00.000Z",
        "modality": "RADAR",
        "bearing_deg": 49,
        "range_m": 2591,
        "confidence": 0.61,
        "classification": "UAV-size radar track",
        "contributes_to_track_id": "TRK-SW-004",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm radar cue for north_boundary_crossing",
        "estimated_lat": 37.837,
        "estimated_lon": -122.3705
      },
      {
        "detection_id": "DET-SW-004-RF",
        "sensor_id": "SENS-RF-HN-01",
        "timestamp": "2026-05-03T05:07:05.000Z",
        "modality": "RF",
        "bearing_deg": 115,
        "range_m": 807,
        "confidence": 0.65,
        "classification": "Coordinated command burst",
        "contributes_to_track_id": "TRK-SW-004",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm RF cue for north_boundary_crossing",
        "estimated_lat": 37.8322,
        "estimated_lon": -122.3705
      },
      {
        "detection_id": "DET-SW-004-AC",
        "sensor_id": "SENS-AC-HN-01",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "modality": "ACOUSTIC",
        "bearing_deg": 335,
        "range_m": 2194,
        "confidence": 0.57,
        "classification": "Rotor acoustic bearing",
        "contributes_to_track_id": "TRK-SW-004",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm acoustic cue for north_boundary_crossing",
        "estimated_lat": 37.8322,
        "estimated_lon": -122.3705
      },
      {
        "detection_id": "DET-SW-004-EOIR",
        "sensor_id": "SENS-EOIR-HN-01",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "modality": "EO",
        "bearing_deg": 310,
        "range_m": 815,
        "confidence": 0.71,
        "classification": "EO/IR visual UAV cue",
        "contributes_to_track_id": "TRK-SW-004",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm visual cue for north_boundary_crossing",
        "estimated_lat": 37.8282,
        "estimated_lon": -122.3705
      },
      {
        "detection_id": "DET-SW-005-RDR",
        "sensor_id": "SENS-RDR-HN-01",
        "timestamp": "2026-05-03T05:06:00.000Z",
        "modality": "RADAR",
        "bearing_deg": 65,
        "range_m": 3480,
        "confidence": 0.55,
        "classification": "UAV-size radar track",
        "contributes_to_track_id": "TRK-SW-005",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm radar cue for northeast_loitering_probe",
        "estimated_lat": 37.8346,
        "estimated_lon": -122.3566
      },
      {
        "detection_id": "DET-SW-005-RF",
        "sensor_id": "SENS-RF-HN-01",
        "timestamp": "2026-05-03T05:07:05.000Z",
        "modality": "RF",
        "bearing_deg": 107,
        "range_m": 1620,
        "confidence": 0.59,
        "classification": "Coordinated command burst",
        "contributes_to_track_id": "TRK-SW-005",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm RF cue for northeast_loitering_probe",
        "estimated_lat": 37.831,
        "estimated_lon": -122.3612
      },
      {
        "detection_id": "DET-SW-005-AC",
        "sensor_id": "SENS-AC-HN-01",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "modality": "ACOUSTIC",
        "bearing_deg": 356,
        "range_m": 1852,
        "confidence": 0.51,
        "classification": "Rotor acoustic bearing",
        "contributes_to_track_id": "TRK-SW-005",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm acoustic cue for northeast_loitering_probe",
        "estimated_lat": 37.831,
        "estimated_lon": -122.3612
      },
      {
        "detection_id": "DET-SW-006-RDR",
        "sensor_id": "SENS-RDR-HN-01",
        "timestamp": "2026-05-03T05:06:00.000Z",
        "modality": "RADAR",
        "bearing_deg": 100,
        "range_m": 3551,
        "confidence": 0.66,
        "classification": "UAV-size radar track",
        "contributes_to_track_id": "TRK-SW-006",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm radar cue for east_southeast_boundary_crossing",
        "estimated_lat": 37.8162,
        "estimated_lon": -122.3528
      },
      {
        "detection_id": "DET-SW-006-RF",
        "sensor_id": "SENS-RF-HN-01",
        "timestamp": "2026-05-03T05:07:05.000Z",
        "modality": "RF",
        "bearing_deg": 135,
        "range_m": 2517,
        "confidence": 0.7,
        "classification": "Coordinated command burst",
        "contributes_to_track_id": "TRK-SW-006",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm RF cue for east_southeast_boundary_crossing",
        "estimated_lat": 37.8192,
        "estimated_lon": -122.3587
      },
      {
        "detection_id": "DET-SW-006-AC",
        "sensor_id": "SENS-AC-HN-01",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "modality": "ACOUSTIC",
        "bearing_deg": 10,
        "range_m": 543,
        "confidence": 0.62,
        "classification": "Rotor acoustic bearing",
        "contributes_to_track_id": "TRK-SW-006",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm acoustic cue for east_southeast_boundary_crossing",
        "estimated_lat": 37.8192,
        "estimated_lon": -122.3587
      },
      {
        "detection_id": "DET-SW-006-EOIR",
        "sensor_id": "SENS-EOIR-HN-01",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "modality": "EO",
        "bearing_deg": 203,
        "range_m": 181,
        "confidence": 0.76,
        "classification": "EO/IR visual UAV cue",
        "contributes_to_track_id": "TRK-SW-006",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm visual cue for east_southeast_boundary_crossing",
        "estimated_lat": 37.822,
        "estimated_lon": -122.3642
      },
      {
        "detection_id": "DET-SW-007-RDR",
        "sensor_id": "SENS-RDR-HN-01",
        "timestamp": "2026-05-03T05:06:00.000Z",
        "modality": "RADAR",
        "bearing_deg": 129,
        "range_m": 2498,
        "confidence": 0.64,
        "classification": "UAV-size radar track",
        "contributes_to_track_id": "TRK-SW-007",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm radar cue for southern_converging_approach",
        "estimated_lat": 37.8075,
        "estimated_lon": -122.3705
      },
      {
        "detection_id": "DET-SW-007-RF",
        "sensor_id": "SENS-RF-HN-01",
        "timestamp": "2026-05-03T05:07:05.000Z",
        "modality": "RF",
        "bearing_deg": 162,
        "range_m": 2396,
        "confidence": 0.68,
        "classification": "Coordinated command burst",
        "contributes_to_track_id": "TRK-SW-007",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm RF cue for southern_converging_approach",
        "estimated_lat": 37.8148,
        "estimated_lon": -122.3705
      },
      {
        "detection_id": "DET-SW-007-AC",
        "sensor_id": "SENS-AC-HN-01",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "modality": "ACOUSTIC",
        "bearing_deg": 273,
        "range_m": 942,
        "confidence": 0.6,
        "classification": "Rotor acoustic bearing",
        "contributes_to_track_id": "TRK-SW-007",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm acoustic cue for southern_converging_approach",
        "estimated_lat": 37.8148,
        "estimated_lon": -122.3705
      },
      {
        "detection_id": "DET-SW-008-RDR",
        "sensor_id": "SENS-RDR-HN-01",
        "timestamp": "2026-05-03T05:06:00.000Z",
        "modality": "RADAR",
        "bearing_deg": 16,
        "range_m": 510,
        "confidence": 0.54,
        "classification": "UAV-size radar track",
        "contributes_to_track_id": "TRK-SW-008",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm radar cue for western_decoy_probe",
        "estimated_lat": 37.826,
        "estimated_lon": -122.391
      },
      {
        "detection_id": "DET-SW-008-RF",
        "sensor_id": "SENS-RF-HN-01",
        "timestamp": "2026-05-03T05:07:05.000Z",
        "modality": "RF",
        "bearing_deg": 206,
        "range_m": 1240,
        "confidence": 0.58,
        "classification": "Coordinated command burst",
        "contributes_to_track_id": "TRK-SW-008",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm RF cue for western_decoy_probe",
        "estimated_lat": 37.8253,
        "estimated_lon": -122.385
      },
      {
        "detection_id": "DET-SW-008-AC",
        "sensor_id": "SENS-AC-HN-01",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "modality": "ACOUSTIC",
        "bearing_deg": 299,
        "range_m": 2526,
        "confidence": 0.5,
        "classification": "Rotor acoustic bearing",
        "contributes_to_track_id": "TRK-SW-008",
        "is_stale": false,
        "stale_reason": "",
        "notes": "simulated island swarm acoustic cue for western_decoy_probe",
        "estimated_lat": 37.8253,
        "estimated_lon": -122.385
      }
    ],
    "fusedTracks": [
      {
        "track_id": "TRK-SW-001",
        "mission_area": "MissionArea-Treasure-Island",
        "custody_status": "Maintained",
        "confidence": 0.88,
        "threat_score": 89,
        "last_seen": "2026-05-03T05:08:10.000Z",
        "estimated_lat": 37.8234,
        "estimated_lon": -122.3753,
        "source_summary": "Radar + RF + Acoustic + EO/IR",
        "recommended_next_action": "Notify response team and track lead island approach",
        "explanation": "Lead UAV is converging on the protected island from the west-southwest with multi-sensor custody.",
        "created_at": "2026-05-03T05:05:00.000Z",
        "updated_at": "2026-05-03T05:08:10.000Z",
        "classification": "Probable UAV",
        "heading_deg": 76,
        "speed_mps": 16.8,
        "distance_to_asset_m": 431,
        "eta_seconds_to_asset": 45,
        "behavior_type": "lead_converging_approach",
        "track_history": [
          {
            "timestamp": "2026-05-03T05:05:00.000Z",
            "lat": 37.8178,
            "lon": -122.3925,
            "confidence": 0.44
          },
          {
            "timestamp": "2026-05-03T05:06:10.000Z",
            "lat": 37.8204,
            "lon": -122.386,
            "confidence": 0.58
          },
          {
            "timestamp": "2026-05-03T05:07:15.000Z",
            "lat": 37.8222,
            "lon": -122.3802,
            "confidence": 0.7
          },
          {
            "timestamp": "2026-05-03T05:08:10.000Z",
            "lat": 37.8234,
            "lon": -122.3753,
            "confidence": 0.88
          }
        ],
        "probable_path": [
          {
            "timestamp": "2026-05-03T05:08:40.000Z",
            "lat": 37.824,
            "lon": -122.3724,
            "confidence": 0.84
          },
          {
            "timestamp": "2026-05-03T05:09:20.000Z",
            "lat": 37.8242,
            "lon": -122.3708,
            "confidence": 0.8
          }
        ],
        "fusion_contributions": [
          {
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "confidence": 0.82,
            "status": "confirmed",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "confidence": 0.83,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-AC-HN-01",
            "modality": "ACOUSTIC",
            "confidence": 0.78,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "confidence": 0.88,
            "status": "visual",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          }
        ],
        "evidence": [
          {
            "artifact_id": "EVD-TRK-SW-001-RADAR",
            "track_id": "TRK-SW-001",
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "Radar plot placeholder",
            "summary": "Simulated island radar plot for TRK-SW-001.",
            "confidence": 0.78,
            "thumbnail_class": "radar",
            "is_new": true
          },
          {
            "artifact_id": "EVD-TRK-SW-001-RFAC",
            "track_id": "TRK-SW-001",
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "RF/acoustic bearing record",
            "summary": "Simulated RF/acoustic island bearing record for TRK-SW-001.",
            "confidence": 0.8,
            "thumbnail_class": "acoustic-rf",
            "is_new": false
          },
          {
            "artifact_id": "EVD-TRK-SW-001-EOIR",
            "track_id": "TRK-SW-001",
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "EO/IR visual placeholder",
            "summary": "Simulated EO/IR island visual placeholder for TRK-SW-001.",
            "confidence": 0.86,
            "thumbnail_class": "eo",
            "is_new": true
          }
        ]
      },
      {
        "track_id": "TRK-SW-002",
        "mission_area": "MissionArea-Treasure-Island",
        "custody_status": "Maintained",
        "confidence": 0.78,
        "threat_score": 71,
        "last_seen": "2026-05-03T05:08:10.000Z",
        "estimated_lat": 37.8275,
        "estimated_lon": -122.3753,
        "source_summary": "Radar + RF + Acoustic",
        "recommended_next_action": "Track as secondary northwest vector",
        "explanation": "Secondary UAV is closing on the protected island from the northwest vector.",
        "created_at": "2026-05-03T05:05:00.000Z",
        "updated_at": "2026-05-03T05:08:10.000Z",
        "classification": "Probable UAV",
        "heading_deg": 138,
        "speed_mps": 13.7,
        "distance_to_asset_m": 560,
        "eta_seconds_to_asset": 58,
        "behavior_type": "northwest_split_approach",
        "track_history": [
          {
            "timestamp": "2026-05-03T05:05:00.000Z",
            "lat": 37.8352,
            "lon": -122.3892,
            "confidence": 0.42
          },
          {
            "timestamp": "2026-05-03T05:06:10.000Z",
            "lat": 37.8325,
            "lon": -122.3845,
            "confidence": 0.55
          },
          {
            "timestamp": "2026-05-03T05:07:15.000Z",
            "lat": 37.8299,
            "lon": -122.3798,
            "confidence": 0.65
          },
          {
            "timestamp": "2026-05-03T05:08:10.000Z",
            "lat": 37.8275,
            "lon": -122.3753,
            "confidence": 0.78
          }
        ],
        "probable_path": [
          {
            "timestamp": "2026-05-03T05:08:40.000Z",
            "lat": 37.826,
            "lon": -122.3726,
            "confidence": 0.73
          },
          {
            "timestamp": "2026-05-03T05:09:20.000Z",
            "lat": 37.8246,
            "lon": -122.3709,
            "confidence": 0.69
          }
        ],
        "fusion_contributions": [
          {
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "confidence": 0.72,
            "status": "confirmed",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "confidence": 0.73,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-AC-HN-01",
            "modality": "ACOUSTIC",
            "confidence": 0.68,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "confidence": 0.6,
            "status": "pending",
            "last_seen": "2026-05-03T05:07:35.000Z",
            "age_seconds": 35
          }
        ],
        "evidence": [
          {
            "artifact_id": "EVD-TRK-SW-002-RADAR",
            "track_id": "TRK-SW-002",
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "Radar plot placeholder",
            "summary": "Simulated island radar plot for TRK-SW-002.",
            "confidence": 0.68,
            "thumbnail_class": "radar",
            "is_new": false
          },
          {
            "artifact_id": "EVD-TRK-SW-002-RFAC",
            "track_id": "TRK-SW-002",
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "RF/acoustic bearing record",
            "summary": "Simulated RF/acoustic island bearing record for TRK-SW-002.",
            "confidence": 0.7,
            "thumbnail_class": "acoustic-rf",
            "is_new": false
          }
        ]
      },
      {
        "track_id": "TRK-SW-003",
        "mission_area": "MissionArea-Treasure-Island",
        "custody_status": "Maintained",
        "confidence": 0.76,
        "threat_score": 68,
        "last_seen": "2026-05-03T05:08:10.000Z",
        "estimated_lat": 37.8204,
        "estimated_lon": -122.3744,
        "source_summary": "Radar + RF + Acoustic",
        "recommended_next_action": "Track as secondary southwest vector",
        "explanation": "Secondary UAV is approaching the island from the southwest, separated from the lead vector.",
        "created_at": "2026-05-03T05:05:00.000Z",
        "updated_at": "2026-05-03T05:08:10.000Z",
        "classification": "Probable UAV",
        "heading_deg": 42,
        "speed_mps": 14.2,
        "distance_to_asset_m": 545,
        "eta_seconds_to_asset": 62,
        "behavior_type": "southwest_split_approach",
        "track_history": [
          {
            "timestamp": "2026-05-03T05:05:00.000Z",
            "lat": 37.8084,
            "lon": -122.3876,
            "confidence": 0.42
          },
          {
            "timestamp": "2026-05-03T05:06:10.000Z",
            "lat": 37.8124,
            "lon": -122.383,
            "confidence": 0.54
          },
          {
            "timestamp": "2026-05-03T05:07:15.000Z",
            "lat": 37.8165,
            "lon": -122.379,
            "confidence": 0.64
          },
          {
            "timestamp": "2026-05-03T05:08:10.000Z",
            "lat": 37.8204,
            "lon": -122.3744,
            "confidence": 0.76
          }
        ],
        "probable_path": [
          {
            "timestamp": "2026-05-03T05:08:40.000Z",
            "lat": 37.8222,
            "lon": -122.3724,
            "confidence": 0.71
          },
          {
            "timestamp": "2026-05-03T05:09:20.000Z",
            "lat": 37.8237,
            "lon": -122.3709,
            "confidence": 0.67
          }
        ],
        "fusion_contributions": [
          {
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "confidence": 0.7,
            "status": "confirmed",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "confidence": 0.71,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-AC-HN-01",
            "modality": "ACOUSTIC",
            "confidence": 0.66,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "confidence": 0.58,
            "status": "pending",
            "last_seen": "2026-05-03T05:07:35.000Z",
            "age_seconds": 35
          }
        ],
        "evidence": [
          {
            "artifact_id": "EVD-TRK-SW-003-RADAR",
            "track_id": "TRK-SW-003",
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "Radar plot placeholder",
            "summary": "Simulated island radar plot for TRK-SW-003.",
            "confidence": 0.66,
            "thumbnail_class": "radar",
            "is_new": false
          },
          {
            "artifact_id": "EVD-TRK-SW-003-RFAC",
            "track_id": "TRK-SW-003",
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "RF/acoustic bearing record",
            "summary": "Simulated RF/acoustic island bearing record for TRK-SW-003.",
            "confidence": 0.68,
            "thumbnail_class": "acoustic-rf",
            "is_new": false
          }
        ]
      },
      {
        "track_id": "TRK-SW-004",
        "mission_area": "MissionArea-Treasure-Island",
        "custody_status": "Maintained",
        "confidence": 0.69,
        "threat_score": 55,
        "last_seen": "2026-05-03T05:08:10.000Z",
        "estimated_lat": 37.8282,
        "estimated_lon": -122.3705,
        "source_summary": "Radar + RF + Acoustic + EO/IR",
        "recommended_next_action": "Monitor northern standoff crossing",
        "explanation": "Northern UAV is crossing toward the island standoff boundary while the lead closes from the west.",
        "created_at": "2026-05-03T05:05:00.000Z",
        "updated_at": "2026-05-03T05:08:10.000Z",
        "classification": "Probable UAV",
        "heading_deg": 180,
        "speed_mps": 10.5,
        "distance_to_asset_m": 445,
        "eta_seconds_to_asset": 70,
        "behavior_type": "north_boundary_crossing",
        "track_history": [
          {
            "timestamp": "2026-05-03T05:05:00.000Z",
            "lat": 37.8426,
            "lon": -122.3706,
            "confidence": 0.38
          },
          {
            "timestamp": "2026-05-03T05:06:10.000Z",
            "lat": 37.837,
            "lon": -122.3705,
            "confidence": 0.5
          },
          {
            "timestamp": "2026-05-03T05:07:15.000Z",
            "lat": 37.8322,
            "lon": -122.3705,
            "confidence": 0.59
          },
          {
            "timestamp": "2026-05-03T05:08:10.000Z",
            "lat": 37.8282,
            "lon": -122.3705,
            "confidence": 0.69
          }
        ],
        "probable_path": [
          {
            "timestamp": "2026-05-03T05:08:40.000Z",
            "lat": 37.826,
            "lon": -122.3705,
            "confidence": 0.64
          },
          {
            "timestamp": "2026-05-03T05:09:20.000Z",
            "lat": 37.8245,
            "lon": -122.3705,
            "confidence": 0.6
          }
        ],
        "fusion_contributions": [
          {
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "confidence": 0.63,
            "status": "confirmed",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "confidence": 0.64,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-AC-HN-01",
            "modality": "ACOUSTIC",
            "confidence": 0.59,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "confidence": 0.69,
            "status": "visual",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          }
        ],
        "evidence": [
          {
            "artifact_id": "EVD-TRK-SW-004-RADAR",
            "track_id": "TRK-SW-004",
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "Radar plot placeholder",
            "summary": "Simulated island radar plot for TRK-SW-004.",
            "confidence": 0.59,
            "thumbnail_class": "radar",
            "is_new": false
          },
          {
            "artifact_id": "EVD-TRK-SW-004-RFAC",
            "track_id": "TRK-SW-004",
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "RF/acoustic bearing record",
            "summary": "Simulated RF/acoustic island bearing record for TRK-SW-004.",
            "confidence": 0.61,
            "thumbnail_class": "acoustic-rf",
            "is_new": false
          },
          {
            "artifact_id": "EVD-TRK-SW-004-EOIR",
            "track_id": "TRK-SW-004",
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "EO/IR visual placeholder",
            "summary": "Simulated EO/IR island visual placeholder for TRK-SW-004.",
            "confidence": 0.67,
            "thumbnail_class": "eo",
            "is_new": false
          }
        ]
      },
      {
        "track_id": "TRK-SW-005",
        "mission_area": "MissionArea-Treasure-Island",
        "custody_status": "Tentative",
        "confidence": 0.63,
        "threat_score": 49,
        "last_seen": "2026-05-03T05:08:10.000Z",
        "estimated_lat": 37.8278,
        "estimated_lon": -122.3655,
        "source_summary": "Radar + RF + Acoustic",
        "recommended_next_action": "Track northeast probe",
        "explanation": "Northeast UAV is probing toward the island with tentative custody.",
        "created_at": "2026-05-03T05:05:00.000Z",
        "updated_at": "2026-05-03T05:08:10.000Z",
        "classification": "Probable UAV",
        "heading_deg": 222,
        "speed_mps": 9.1,
        "distance_to_asset_m": 595,
        "eta_seconds_to_asset": 92,
        "behavior_type": "northeast_loitering_probe",
        "track_history": [
          {
            "timestamp": "2026-05-03T05:05:00.000Z",
            "lat": 37.8386,
            "lon": -122.3518,
            "confidence": 0.36
          },
          {
            "timestamp": "2026-05-03T05:06:10.000Z",
            "lat": 37.8346,
            "lon": -122.3566,
            "confidence": 0.47
          },
          {
            "timestamp": "2026-05-03T05:07:15.000Z",
            "lat": 37.831,
            "lon": -122.3612,
            "confidence": 0.55
          },
          {
            "timestamp": "2026-05-03T05:08:10.000Z",
            "lat": 37.8278,
            "lon": -122.3655,
            "confidence": 0.63
          }
        ],
        "probable_path": [
          {
            "timestamp": "2026-05-03T05:08:40.000Z",
            "lat": 37.826,
            "lon": -122.3678,
            "confidence": 0.58
          },
          {
            "timestamp": "2026-05-03T05:09:20.000Z",
            "lat": 37.8247,
            "lon": -122.3697,
            "confidence": 0.54
          }
        ],
        "fusion_contributions": [
          {
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "confidence": 0.57,
            "status": "confirmed",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "confidence": 0.58,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-AC-HN-01",
            "modality": "ACOUSTIC",
            "confidence": 0.53,
            "status": "pending",
            "last_seen": "2026-05-03T05:07:35.000Z",
            "age_seconds": 35
          },
          {
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "confidence": 0.45,
            "status": "pending",
            "last_seen": "2026-05-03T05:07:35.000Z",
            "age_seconds": 35
          }
        ],
        "evidence": [
          {
            "artifact_id": "EVD-TRK-SW-005-RADAR",
            "track_id": "TRK-SW-005",
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "Radar plot placeholder",
            "summary": "Simulated island radar plot for TRK-SW-005.",
            "confidence": 0.53,
            "thumbnail_class": "radar",
            "is_new": false
          },
          {
            "artifact_id": "EVD-TRK-SW-005-RFAC",
            "track_id": "TRK-SW-005",
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "RF/acoustic bearing record",
            "summary": "Simulated RF/acoustic island bearing record for TRK-SW-005.",
            "confidence": 0.55,
            "thumbnail_class": "acoustic-rf",
            "is_new": false
          }
        ]
      },
      {
        "track_id": "TRK-SW-006",
        "mission_area": "MissionArea-Treasure-Island",
        "custody_status": "Maintained",
        "confidence": 0.74,
        "threat_score": 64,
        "last_seen": "2026-05-03T05:08:10.000Z",
        "estimated_lat": 37.822,
        "estimated_lon": -122.3642,
        "source_summary": "Radar + RF + Acoustic + EO/IR",
        "recommended_next_action": "Track east-southeast crossing",
        "explanation": "East-southeast UAV has visual support and is projected toward the protected island.",
        "created_at": "2026-05-03T05:05:00.000Z",
        "updated_at": "2026-05-03T05:08:10.000Z",
        "classification": "Probable UAV",
        "heading_deg": 296,
        "speed_mps": 14.8,
        "distance_to_asset_m": 606,
        "eta_seconds_to_asset": 66,
        "behavior_type": "east_southeast_boundary_crossing",
        "track_history": [
          {
            "timestamp": "2026-05-03T05:05:00.000Z",
            "lat": 37.8128,
            "lon": -122.347,
            "confidence": 0.39
          },
          {
            "timestamp": "2026-05-03T05:06:10.000Z",
            "lat": 37.8162,
            "lon": -122.3528,
            "confidence": 0.53
          },
          {
            "timestamp": "2026-05-03T05:07:15.000Z",
            "lat": 37.8192,
            "lon": -122.3587,
            "confidence": 0.64
          },
          {
            "timestamp": "2026-05-03T05:08:10.000Z",
            "lat": 37.822,
            "lon": -122.3642,
            "confidence": 0.74
          }
        ],
        "probable_path": [
          {
            "timestamp": "2026-05-03T05:08:40.000Z",
            "lat": 37.8232,
            "lon": -122.3672,
            "confidence": 0.69
          },
          {
            "timestamp": "2026-05-03T05:09:20.000Z",
            "lat": 37.824,
            "lon": -122.3698,
            "confidence": 0.65
          }
        ],
        "fusion_contributions": [
          {
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "confidence": 0.68,
            "status": "confirmed",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "confidence": 0.69,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-AC-HN-01",
            "modality": "ACOUSTIC",
            "confidence": 0.64,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "confidence": 0.74,
            "status": "visual",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          }
        ],
        "evidence": [
          {
            "artifact_id": "EVD-TRK-SW-006-RADAR",
            "track_id": "TRK-SW-006",
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "Radar plot placeholder",
            "summary": "Simulated island radar plot for TRK-SW-006.",
            "confidence": 0.64,
            "thumbnail_class": "radar",
            "is_new": false
          },
          {
            "artifact_id": "EVD-TRK-SW-006-RFAC",
            "track_id": "TRK-SW-006",
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "RF/acoustic bearing record",
            "summary": "Simulated RF/acoustic island bearing record for TRK-SW-006.",
            "confidence": 0.66,
            "thumbnail_class": "acoustic-rf",
            "is_new": false
          },
          {
            "artifact_id": "EVD-TRK-SW-006-EOIR",
            "track_id": "TRK-SW-006",
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "EO/IR visual placeholder",
            "summary": "Simulated EO/IR island visual placeholder for TRK-SW-006.",
            "confidence": 0.72,
            "thumbnail_class": "eo",
            "is_new": false
          }
        ]
      },
      {
        "track_id": "TRK-SW-007",
        "mission_area": "MissionArea-Treasure-Island",
        "custody_status": "Maintained",
        "confidence": 0.72,
        "threat_score": 62,
        "last_seen": "2026-05-03T05:08:10.000Z",
        "estimated_lat": 37.8205,
        "estimated_lon": -122.3705,
        "source_summary": "Radar + RF + Acoustic",
        "recommended_next_action": "Track southern approach",
        "explanation": "Southern UAV is closing directly up the water channel toward the protected island.",
        "created_at": "2026-05-03T05:05:00.000Z",
        "updated_at": "2026-05-03T05:08:10.000Z",
        "classification": "Probable UAV",
        "heading_deg": 0,
        "speed_mps": 15.5,
        "distance_to_asset_m": 412,
        "eta_seconds_to_asset": 52,
        "behavior_type": "southern_converging_approach",
        "track_history": [
          {
            "timestamp": "2026-05-03T05:05:00.000Z",
            "lat": 37.8004,
            "lon": -122.3705,
            "confidence": 0.39
          },
          {
            "timestamp": "2026-05-03T05:06:10.000Z",
            "lat": 37.8075,
            "lon": -122.3705,
            "confidence": 0.52
          },
          {
            "timestamp": "2026-05-03T05:07:15.000Z",
            "lat": 37.8148,
            "lon": -122.3705,
            "confidence": 0.63
          },
          {
            "timestamp": "2026-05-03T05:08:10.000Z",
            "lat": 37.8205,
            "lon": -122.3705,
            "confidence": 0.72
          }
        ],
        "probable_path": [
          {
            "timestamp": "2026-05-03T05:08:40.000Z",
            "lat": 37.8228,
            "lon": -122.3705,
            "confidence": 0.67
          },
          {
            "timestamp": "2026-05-03T05:09:20.000Z",
            "lat": 37.824,
            "lon": -122.3705,
            "confidence": 0.63
          }
        ],
        "fusion_contributions": [
          {
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "confidence": 0.66,
            "status": "confirmed",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "confidence": 0.67,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-AC-HN-01",
            "modality": "ACOUSTIC",
            "confidence": 0.62,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "confidence": 0.54,
            "status": "pending",
            "last_seen": "2026-05-03T05:07:35.000Z",
            "age_seconds": 35
          }
        ],
        "evidence": [
          {
            "artifact_id": "EVD-TRK-SW-007-RADAR",
            "track_id": "TRK-SW-007",
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "Radar plot placeholder",
            "summary": "Simulated island radar plot for TRK-SW-007.",
            "confidence": 0.62,
            "thumbnail_class": "radar",
            "is_new": false
          },
          {
            "artifact_id": "EVD-TRK-SW-007-RFAC",
            "track_id": "TRK-SW-007",
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "RF/acoustic bearing record",
            "summary": "Simulated RF/acoustic island bearing record for TRK-SW-007.",
            "confidence": 0.64,
            "thumbnail_class": "acoustic-rf",
            "is_new": false
          }
        ]
      },
      {
        "track_id": "TRK-SW-008",
        "mission_area": "MissionArea-Treasure-Island",
        "custody_status": "Tentative",
        "confidence": 0.62,
        "threat_score": 47,
        "last_seen": "2026-05-03T05:08:10.000Z",
        "estimated_lat": 37.8247,
        "estimated_lon": -122.3802,
        "source_summary": "Radar + RF + Acoustic",
        "recommended_next_action": "Monitor western decoy probe",
        "explanation": "Western UAV remains outside the restricted island box but its path is projected toward the protected asset.",
        "created_at": "2026-05-03T05:05:00.000Z",
        "updated_at": "2026-05-03T05:08:10.000Z",
        "classification": "Probable UAV",
        "heading_deg": 92,
        "speed_mps": 10.8,
        "distance_to_asset_m": 855,
        "eta_seconds_to_asset": 96,
        "behavior_type": "western_decoy_probe",
        "track_history": [
          {
            "timestamp": "2026-05-03T05:05:00.000Z",
            "lat": 37.8265,
            "lon": -122.3975,
            "confidence": 0.35
          },
          {
            "timestamp": "2026-05-03T05:06:10.000Z",
            "lat": 37.826,
            "lon": -122.391,
            "confidence": 0.46
          },
          {
            "timestamp": "2026-05-03T05:07:15.000Z",
            "lat": 37.8253,
            "lon": -122.385,
            "confidence": 0.54
          },
          {
            "timestamp": "2026-05-03T05:08:10.000Z",
            "lat": 37.8247,
            "lon": -122.3802,
            "confidence": 0.62
          }
        ],
        "probable_path": [
          {
            "timestamp": "2026-05-03T05:08:40.000Z",
            "lat": 37.8245,
            "lon": -122.376,
            "confidence": 0.57
          },
          {
            "timestamp": "2026-05-03T05:09:20.000Z",
            "lat": 37.8243,
            "lon": -122.3725,
            "confidence": 0.53
          }
        ],
        "fusion_contributions": [
          {
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "confidence": 0.56,
            "status": "confirmed",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "confidence": 0.57,
            "status": "correlated",
            "last_seen": "2026-05-03T05:08:10.000Z",
            "age_seconds": 0
          },
          {
            "sensor_id": "SENS-AC-HN-01",
            "modality": "ACOUSTIC",
            "confidence": 0.52,
            "status": "pending",
            "last_seen": "2026-05-03T05:07:35.000Z",
            "age_seconds": 35
          },
          {
            "sensor_id": "SENS-EOIR-HN-01",
            "modality": "EO",
            "confidence": 0.44,
            "status": "pending",
            "last_seen": "2026-05-03T05:07:35.000Z",
            "age_seconds": 35
          }
        ],
        "evidence": [
          {
            "artifact_id": "EVD-TRK-SW-008-RADAR",
            "track_id": "TRK-SW-008",
            "sensor_id": "SENS-RDR-HN-01",
            "modality": "RADAR",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "Radar plot placeholder",
            "summary": "Simulated island radar plot for TRK-SW-008.",
            "confidence": 0.52,
            "thumbnail_class": "radar",
            "is_new": false
          },
          {
            "artifact_id": "EVD-TRK-SW-008-RFAC",
            "track_id": "TRK-SW-008",
            "sensor_id": "SENS-RF-HN-01",
            "modality": "RF",
            "timestamp": "2026-05-03T05:08:10.000Z",
            "label": "RF/acoustic bearing record",
            "summary": "Simulated RF/acoustic island bearing record for TRK-SW-008.",
            "confidence": 0.54,
            "thumbnail_class": "acoustic-rf",
            "is_new": false
          }
        ]
      }
    ],
    "operatorActions": [
      {
        "action_id": "ACT-SW-0001",
        "track_id": "TRK-SW-001",
        "action_type": "multiple_tracks_detected",
        "label": "Multiple UAV tracks detected",
        "timestamp": "2026-05-03T05:06:00.000Z",
        "operator_id": "system-fusion",
        "notes": "Eight simulated UAV tracks detected around the protected island.",
        "resulting_status": "Maintained"
      },
      {
        "action_id": "ACT-SW-0002",
        "track_id": "TRK-SW-001",
        "action_type": "swarm_pattern_suspected",
        "label": "Swarm pattern suspected",
        "timestamp": "2026-05-03T05:07:05.000Z",
        "operator_id": "system-fusion",
        "notes": "Converging tracks approach the island from separated north, west, south, and east vectors.",
        "resulting_status": "Maintained"
      },
      {
        "action_id": "ACT-SW-0003",
        "track_id": "TRK-SW-001",
        "action_type": "threat_increased",
        "label": "Threat score increased",
        "timestamp": "2026-05-03T05:07:35.000Z",
        "operator_id": "system-fusion",
        "notes": "Lead swarm track crossed high-threat threshold near the island standoff boundary.",
        "resulting_status": "Maintained"
      },
      {
        "action_id": "ACT-SW-0004",
        "track_id": "TRK-SW-001",
        "action_type": "notify_response",
        "label": "Notify/dispatch recommended",
        "timestamp": "2026-05-03T05:08:10.000Z",
        "operator_id": "system",
        "notes": "Recommended response dispatch for protected island defense.",
        "resulting_status": "Maintained"
      },
      {
        "action_id": "ACT-SW-0005",
        "track_id": "TRK-SW-002",
        "action_type": "monitor",
        "label": "Monitor secondary tracks",
        "timestamp": "2026-05-03T05:08:12.000Z",
        "operator_id": "system",
        "notes": "Secondary island swarm vectors retained in queue.",
        "resulting_status": "Maintained"
      }
    ]
  }
}

export function getPalantirDemoScenario(key: SimulationScenarioKey) {
  return palantirDemoScenarios[key]
}
