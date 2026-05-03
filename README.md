# SmokenMirrorsOS

SmokenMirrorsOS is a NatSec hackathon prototype for turning noisy, multi-sensor observations into one explainable operator decision.

The purpose is simple: help an operator answer, quickly and defensibly, whether separate radar, RF, acoustic, EO, and IR cues are describing the same threat, whether custody is still maintained, and what sensor or operator action should happen next.

## Mission Problem

Modern defense and security teams rarely suffer from a lack of signals. They suffer from fragmented signals.

A radar hit, a short RF burst, an acoustic cue, and a low-confidence EO/IR glimpse may arrive in different systems, at different latencies, with different confidence levels. The operational question is not "what did one sensor see?" It is:

> Do these observations add up to a track that requires action?

SmokenMirrorsOS demonstrates a focused workflow for that problem:

- Normalize detections from multiple sensing modalities.
- Fuse related detections into a single track.
- Preserve the evidence trail behind the fused assessment.
- Explain confidence, custody, stale signals, and recommended next action.
- Keep the human operator in the decision loop.

## Hackathon Fit

This project is built for the NatSec Hackathon sensor analysis and integration mission space.

It shows how a small team could use Palantir-backed data models, local simulation, and an operator-grade interface to prototype a mission workflow before connecting real sensors or production data pipelines.

The prototype is intentionally scoped around a high-value wedge:

- Multi-source detection fusion.
- Track custody under incomplete evidence.
- Operator decision support.
- Data provenance visible in the UI.
- A path from local demo data to Palantir ontology-backed mission data.

## Demo Narrative

The demo puts the operator in a protected waterfront scenario.

1. A contact appears near a mission zone.
2. Radar gives the first cue.
3. RF, acoustic, EO, or IR evidence adds partial confirmation.
4. Some signals may become stale or low-confidence.
5. The system keeps one fused track alive when the evidence still agrees.
6. The operator sees why the track is maintained and what action is recommended.
7. The operator can confirm, reject, or task reacquisition.

The intended 60-second story is:

> A possible unmanned threat enters the protected area. The sensors disagree in quality, but agree enough in time, bearing, and behavior. SmokenMirrorsOS fuses the evidence, explains the confidence, preserves custody, and recommends the next sensor action.

## Current Capabilities

- Tactical React dashboard for a NatSec mission operator.
- Scenario controls for local simulation.
- Map-based sensor, detection, track, protected-zone, and path visualization.
- Track queue, evidence panels, confidence, threat score, custody, and recommended action.
- Operator action workflow for confirm, false alarm, and reacquire-style decisions.
- Evidence assets for EO/IR imagery and acoustic/RF review.
- Local simulation mode for fast offline demo use.
- Palantir snapshot mode using existing `ExamplePlatform` and `ExampleSensors` ontology data.
- Palantir mission data mode using branch-backed synthetic mission rows for `Detection`, `FusedTrack`, and `SmokenMirrorsOperatorAction`.

## Data Modes

The app currently supports three demo modes.

| Mode | Purpose | Data posture |
| --- | --- | --- |
| `Local Mock` | Fast, reliable offline demo with generated mission data. | Local TypeScript simulation only. |
| `Palantir Snapshot` | Shows how existing Palantir ontology objects can anchor the sensor layer. | Reads platform and sensor snapshot data; fusion remains local. |
| `Mission Data` | Shows the intended ontology-backed mission workflow. | Uses Palantir branch-backed synthetic mission rows for detections, fused track, and operator actions. |

The UI deliberately labels provenance so judges and reviewers can see whether a view is local simulation, Palantir snapshot, or mission-data backed.

## Palantir Integration Shape

The prototype is aligned to the `NatSec Hackathon Ontology`.

Existing reusable ontology objects:

- `[Example] Platform` / `ExamplePlatform`
- `[Example] Sensors` / `ExampleSensors`

Mission workflow objects represented in the prototype:

- `Detection`
- `FusedTrack`
- `SmokenMirrorsOperatorAction`

The current mission snapshot includes:

- 10 detections
- 1 fused track
- 2 operator actions

See `PALANTIR_MAPPING.md` for the ontology mapping plan, object-type rationale, and recommended expansion path.

## What Is Real vs Simulated

This is a hackathon prototype, not a production command system.

Real or integration-backed:

- React, TypeScript, Vite app.
- MapLibre-based tactical map UI.
- Palantir ontology mapping plan.
- Palantir snapshot metadata for platform and sensor objects.
- Branch-backed synthetic mission rows captured for demo use.

Simulated or prototype-only:

- Sensor detections.
- Threat scenario.
- Fusion scoring.
- Operator actions.
- Evidence artifacts.
- Mission outcomes.

Not included yet:

- Live sensor ingest.
- Production fusion algorithms.
- Authentication and user roles.
- Backend persistence for local operator actions.
- Deployment hardening.
- Authorization, audit, and release controls required for operational use.

## Why It Matters

The prototype is not trying to be a generic dashboard. It is a narrow decision-support system for the moment when an operator must decide whether fragmented signals represent a real track.

That matters because:

- False positives waste scarce sensor and operator time.
- False negatives create security risk.
- Custody can be lost when one sensor drops but other evidence still supports the track.
- Operators need evidence and explanation, not only an alert.
- Hackathon demos need a credible path from mock data to real mission data.

SmokenMirrorsOS is the first step toward that workflow.

## Tech Stack

- React
- TypeScript
- Vite
- MapLibre GL
- CSS

No backend is required for the current local demo.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open:

```text
http://127.0.0.1:5173/
```

Build:

```bash
npm run build
```

## Deployed Demo

Production Vercel URL:

```text
https://smokenmirrorsos.vercel.app
```
