import type { Detection, FusedTrack, OperatorAction, Platform, ProtectedAsset, ProtectedZone, Sensor } from '../../types/mission'

export type OntologyUiBundle = {
  platforms: Platform[]
  sensors: Sensor[]
  detections: Detection[]
  fusedTracks: FusedTrack[]
  operatorActions: OperatorAction[]
  protectedAssets?: ProtectedAsset[]
  protectedZones?: ProtectedZone[]
}

export function ontologySnapshotToUi(bundle: OntologyUiBundle): Required<OntologyUiBundle> {
  return {
    platforms: bundle.platforms,
    sensors: bundle.sensors,
    detections: bundle.detections,
    fusedTracks: bundle.fusedTracks,
    operatorActions: bundle.operatorActions,
    protectedAssets: bundle.protectedAssets ?? [],
    protectedZones: bundle.protectedZones ?? [],
  }
}
