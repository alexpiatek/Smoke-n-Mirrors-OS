# SmokenMirrorsOS

A simple hackathon demo for fusing noisy sensor detections into one explainable target track.

## What it does

SmokenMirrorsOS shows how an operator could combine detections from multiple sensor types into a single operational view.

The demo uses fake/simulated data from:

- Radar
- Acoustic / RF
- EO camera / visual detection

The system displays:

- Live sensor detections
- A simple map / track view
- One fused target track
- Confidence score
- Custody status
- Recommended next action for the operator

## Why this matters

Modern operators often receive separate alerts from different sensors.

The hard part is answering:

> Are these detections describing the same object?

SmokenMirrorsOS demonstrates a simple workflow for turning separate detections into one explainable decision.

Example:

> Radar sees a contact.  
> Acoustic/RF supports the same bearing.  
> EO camera briefly confirms a possible drone.  
> Visual contact drops.  
> The system keeps custody using radar + acoustic/RF and recommends where to retask the camera.

## Hackathon problem fit

This project fits the **Sensor Analysis and Integration** problem statement.

It focuses on:

- Combining detections across sensor types
- Maintaining custody of a target
- Explaining confidence to a human operator
- Recommending the next sensor action

## Demo flow

1. Open the dashboard.
2. Review incoming radar, acoustic/RF, and EO detections.
3. See the system display one fused track.
4. Watch confidence increase as sensors agree.
5. See visual contact drop.
6. The system maintains custody using the remaining sensors.
7. Operator chooses:
   - Confirm Track
   - False Alarm
   - Reacquire

## Current status

This is an early hackathon demo.

Currently included:

- Local React app
- Fake hard-coded sensor data
- Dashboard panels
- Simple map / track view
- Fused track summary
- Timeline view

Not included yet:

- Real sensor ingest
- Real radar/acoustic/camera integrations
- Palantir integration
- Authentication
- Database
- Production deployment

## Tech stack

- React
- TypeScript
- Vite
- CSS

No backend is required for the current demo.

## How to run locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open the local URL shown by Vite, usually:

```text
http://127.0.0.1:5173/
```
