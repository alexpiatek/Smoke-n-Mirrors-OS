# Palantir Ontology Mapping Plan

This is a read-only integration planning document for the local SmokenMirrorsOS demo.
No Palantir ontology changes have been made.

## MCP Availability

The configured MCP server is `palantir-mcp`.

- Status: enabled
- Foundry URL: `https://nshackathon.palantirfoundry.com`
- Local MCP resources/templates: none exposed through generic MCP resource discovery
- Available Palantir tool areas include ontology search/view/create/update, datasets, SQL, docs, projects/repos, OSDK, Compute Modules, REST sources/webhooks, and global branches/proposals.

For this planning step, only read-only discovery/view tools were used.

## Current Ontology

- Display name: `NatSec Hackathon Ontology`
- API name: `ontology-57308d1b-c039-44ef-9dbe-196eb41a717c`
- Ontology RID: `ri.ontology.main.ontology.41fccd0c-2180-4c1d-841d-8a488d1abb46`
- Current ontology version observed: `00000069-1150-f6d0-7f9e-87c846095ac7`
- Default branch RID: `ri.ontology.main.branch.ef8d962d-b671-485d-9450-90fc8c71159d`

## Existing Reusable Object Types

### [Example] Platform

- Display name: `[Example] Platform`
- API name: `ExamplePlatform`
- Object type RID: `ri.ontology.main.object-type.a4f3d999-21f6-4559-ab9c-223851f024d2`
- Primary key: `platform_id`
- Existing useful fields:
  - `platform_id`
  - `callsign`
  - `platform_type`
  - `owner_unit`
  - `lat`
  - `lon`
  - `alt_m`
  - `location`
  - `notes`

### [Example] Sensors

- Display name: `[Example] Sensors`
- API name: `ExampleSensors`
- Object type RID: `ri.ontology.main.object-type.afc47255-8a83-4d7b-924e-852347f2a980`
- Primary key: `sensor_id`
- Existing useful fields:
  - `sensor_id`
  - `platform_id`
  - `modality`
  - `measurement_kind`
  - `range_max_m`
  - `fov_type`
  - `fov_h_deg`
  - `fov_v_deg`
  - `latency_ms_p50`
  - `latency_ms_p95`
  - `revisit_min_s`
  - `notes`

### Existing Link

`[Example] Platform` already links one-to-many to `[Example] Sensors`.

- Link RID: `ri.ontology.main.relation.cafc357b-bcf9-4af9-b44c-2a719506e81e`
- Left object: `[Example] Platform`
- Right object: `[Example] Sensors`
- Join: `ExamplePlatform.platform_id` to `ExampleSensors.platform_id`
- Left-to-right traversal API name: `exampleSensors`
- Right-to-left traversal API name: `examplePlatform`

## Local Entity to Palantir Mapping

| Local TypeScript Entity | Palantir Mapping | Notes |
| --- | --- | --- |
| `Platform` | Existing `[Example] Platform` / `ExamplePlatform` | Local fields map directly to existing fields. |
| `Sensor` | Existing `[Example] Sensors` / `ExampleSensors` | Local fields map directly to existing fields. |
| `Detection` | Proposed new `Detection` object type | Needed to store individual sensor observations over time. |
| `FusedTrack` | Proposed new `FusedTrack` object type | Needed to store fused custody state, confidence, threat score, explanation, and recommended action. |
| `OperatorAction` | Local-only for demo, or proposed new `OperatorAction` object type | For the current demo, local state is enough. Persist it only if we want audit history in Foundry. |

## Proposed New Object Types

### Detection

- Display name: `Detection`
- API name: `Detection`
- Primary key: `detection_id`

Required fields:

- `detection_id`: string
- `sensor_id`: string
- `timestamp`: timestamp
- `modality`: string
- `bearing_deg`: double
- `range_m`: double
- `confidence`: double
- `classification`: string
- `contributes_to_track_id`: string

Optional fields:

- `notes`: string
- `is_stale`: boolean
- `stale_reason`: string

Links to existing or proposed objects:

- Many detections belong to one existing `[Example] Sensors` object using `sensor_id`.
- Many detections can contribute to one proposed `FusedTrack` using `contributes_to_track_id`.

Recommended link types:

- `ExampleSensors` one-to-many `Detection`
  - Left key: `ExampleSensors.sensor_id`
  - Right foreign key: `Detection.sensor_id`
- `FusedTrack` one-to-many `Detection`
  - Left key: `FusedTrack.track_id`
  - Right foreign key: `Detection.contributes_to_track_id`

### FusedTrack

- Display name: `Fused Track`
- API name: `FusedTrack`
- Primary key: `track_id`

Required fields:

- `track_id`: string
- `mission_area`: string
- `custody_status`: string
- `confidence`: double
- `threat_score`: double
- `last_seen`: timestamp
- `estimated_lat`: double
- `estimated_lon`: double
- `source_summary`: string
- `recommended_next_action`: string
- `explanation`: string

Optional fields:

- `classification`: string
- `status_reason`: string
- `eo_contact_status`: string
- `created_at`: timestamp
- `updated_at`: timestamp

Links to existing or proposed objects:

- One `FusedTrack` can have many proposed `Detection` records.
- One `FusedTrack` can have many proposed `OperatorAction` records.
- `mission_area` can remain a string for the hackathon demo. A separate `MissionArea` object is not needed unless we want geofences, mission ownership, or multiple map areas.

Recommended link types:

- `FusedTrack` one-to-many `Detection`
- `FusedTrack` one-to-many `OperatorAction`

### OperatorAction

- Display name: `Operator Action`
- API name: `OperatorAction`
- Primary key: `action_id`

Required fields:

- `action_id`: string
- `track_id`: string
- `action_type`: string
- `label`: string
- `timestamp`: timestamp

Optional fields:

- `operator_id`: string
- `notes`: string
- `resulting_status`: string

Links to existing or proposed objects:

- Many `OperatorAction` records belong to one proposed `FusedTrack` using `track_id`.

Recommended link type:

- `FusedTrack` one-to-many `OperatorAction`
  - Left key: `FusedTrack.track_id`
  - Right foreign key: `OperatorAction.track_id`

## Recommendation

Do not create the new object types yet.

For the current 60-second hackathon demo, the local React mock is the fastest and lowest-risk path. It already demonstrates the ontology shape clearly:

- Existing `ExamplePlatform` and `ExampleSensors` cover the physical sensing layer.
- Local `Detection` records show the sensor observations.
- Local `FusedTrack` shows the fused custody and recommendation layer.
- Local `OperatorAction` state shows the operator audit pattern.

Create Palantir object types after the demo narrative and field names are stable. The minimum useful Palantir expansion would be:

1. Create `Detection`.
2. Create `FusedTrack`.
3. Keep `OperatorAction` local unless persisted audit history becomes part of the demo.

Only create `OperatorAction` in Palantir if the demo needs durable operator decisions, multi-user review, or downstream audit/reporting.
