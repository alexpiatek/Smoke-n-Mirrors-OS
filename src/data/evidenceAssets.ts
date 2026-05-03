export type EvidenceClassification = 'drone' | 'helicopter' | 'biological' | 'unknown'
export type EvidenceSensorType = 'Acoustic/RF' | 'EO/IR'

type EvidenceAssetBase = {
  assetId: string
  trackId: string
  sensorType: EvidenceSensorType
  classification: EvidenceClassification
  localPath: string
  source: 'Foundry Compass' | 'Foundry MIO' | 'Local Demo'
  sourceRid: string | null
  licenseNote: string
  foundryRid: string | null
}

export type EvidenceImageAsset = EvidenceAssetBase & {
  sensorType: 'EO/IR'
  frameLabel: string
}

export type EvidenceAudioAsset = EvidenceAssetBase & {
  sensorType: 'Acoustic/RF'
  buttonLabel: string
}

export const eoirCompassFolderRid = 'ri.compass.main.folder.b6030cdf-f691-4454-89f0-95bb678fbb4a'
export const acousticMioMediaSetRid = 'ri.mio.main.media-set.3b11b223-fbff-401c-9c2a-1a033a7b6d33'

const foundryExportNote =
  'User-supplied Foundry media for hackathon demo. Runtime uses local static exports and does not fetch Foundry directly.'

export const eoirEvidenceImages: EvidenceImageAsset[] = [
  {
    assetId: 'EOIR-TRK-SD-001-FRAME-01',
    trackId: 'TRK-SD-001',
    sensorType: 'EO/IR',
    classification: 'drone',
    frameLabel: 'EO/IR frame 01',
    localPath: '/evidence/eoir/drone 1.jpg',
    source: 'Foundry Compass',
    sourceRid: eoirCompassFolderRid,
    licenseNote: foundryExportNote,
    foundryRid: eoirCompassFolderRid,
  },
  {
    assetId: 'EOIR-TRK-SD-001-FRAME-02',
    trackId: 'TRK-SD-001',
    sensorType: 'EO/IR',
    classification: 'drone',
    frameLabel: 'EO/IR frame 02',
    localPath: '/evidence/eoir/drone 2.jpg',
    source: 'Foundry Compass',
    sourceRid: eoirCompassFolderRid,
    licenseNote: foundryExportNote,
    foundryRid: eoirCompassFolderRid,
  },
]

export const acousticEvidenceAssets: EvidenceAudioAsset[] = [
  {
    assetId: 'AUD-TRK-SD-001-MIO-ROTOR',
    trackId: 'TRK-SD-001',
    sensorType: 'Acoustic/RF',
    classification: 'drone',
    buttonLabel: 'Play drone sound',
    localPath: '/evidence/audio/0503.MP3',
    source: 'Foundry MIO',
    sourceRid: acousticMioMediaSetRid,
    licenseNote: foundryExportNote,
    foundryRid: acousticMioMediaSetRid,
  },
]

export const evidenceAssets = {
  acoustic: acousticEvidenceAssets,
  eoir: eoirEvidenceImages,
}

function isDroneTrack(trackId?: string | null, classification?: string | null) {
  const normalized = (classification ?? '').toLowerCase()
  return trackId === 'TRK-SD-001' || normalized.includes('uav') || normalized.includes('drone')
}

export function acousticEvidenceAssetForTrack(trackId?: string | null, classification?: string | null) {
  if (!isDroneTrack(trackId, classification)) {
    return null
  }

  return acousticEvidenceAssets.find((asset) => asset.trackId === 'TRK-SD-001') ?? null
}

export function eoirEvidenceAssetsForTrack(trackId?: string | null, classification?: string | null) {
  if (!isDroneTrack(trackId, classification)) {
    return []
  }

  return eoirEvidenceImages.filter((asset) => asset.trackId === 'TRK-SD-001')
}
