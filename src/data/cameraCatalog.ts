// A small offline catalog of common dedicated astrophotography camera specs,
// keyed by model name/aliases. Same rationale as the target catalog: no live
// API exists for camera hardware specs the way it does for sky catalogs, so
// this is a bundled starting point you can always correct - not a lock.
//
// Many cameras from different brands share the same underlying Sony/Panasonic
// sensor (and therefore the same sensor size and pixel pitch), which is
// called out below since that's where these numbers come from.

export interface CameraSpec {
  match: string[] // lowercase strings to match against the typed description
  model: string // canonical display name
  sensor: string // e.g. "Sony IMX571"
  sensorType: 'Mono' | 'Color'
  sensorWidthMm: number
  sensorHeightMm: number
  pixelSizeUm: number
  resolutionWidthPx: number
  resolutionHeightPx: number
}

export const CAMERA_CATALOG: CameraSpec[] = [
  {
    match: ['asi2600mm', 'asi 2600mm', '2600mm'],
    model: 'ZWO ASI2600MM Pro',
    sensor: 'Sony IMX571',
    sensorType: 'Mono',
    sensorWidthMm: 23.5,
    sensorHeightMm: 15.7,
    pixelSizeUm: 3.76,
    resolutionWidthPx: 6248,
    resolutionHeightPx: 4176,
  },
  {
    match: ['asi2600mc', 'asi 2600mc', '2600mc'],
    model: 'ZWO ASI2600MC Pro',
    sensor: 'Sony IMX571',
    sensorType: 'Color',
    sensorWidthMm: 23.5,
    sensorHeightMm: 15.7,
    pixelSizeUm: 3.76,
    resolutionWidthPx: 6248,
    resolutionHeightPx: 4176,
  },
  {
    match: ['asi294mm', 'asi 294mm', '294mm'],
    model: 'ZWO ASI294MM Pro',
    sensor: 'Sony IMX492',
    sensorType: 'Mono',
    sensorWidthMm: 19.1,
    sensorHeightMm: 13.0,
    pixelSizeUm: 4.63,
    resolutionWidthPx: 4144,
    resolutionHeightPx: 2822,
  },
  {
    match: ['asi294mc', 'asi 294mc', '294mc'],
    model: 'ZWO ASI294MC Pro',
    sensor: 'Sony IMX294',
    sensorType: 'Color',
    sensorWidthMm: 19.1,
    sensorHeightMm: 13.0,
    pixelSizeUm: 4.63,
    resolutionWidthPx: 4144,
    resolutionHeightPx: 2822,
  },
  {
    match: ['asi533mm', 'asi 533mm', '533mm'],
    model: 'ZWO ASI533MM Pro',
    sensor: 'Sony IMX533',
    sensorType: 'Mono',
    sensorWidthMm: 11.3,
    sensorHeightMm: 11.3,
    pixelSizeUm: 3.76,
    resolutionWidthPx: 3008,
    resolutionHeightPx: 3008,
  },
  {
    match: ['asi533mc', 'asi 533mc', '533mc'],
    model: 'ZWO ASI533MC Pro',
    sensor: 'Sony IMX533',
    sensorType: 'Color',
    sensorWidthMm: 11.3,
    sensorHeightMm: 11.3,
    pixelSizeUm: 3.76,
    resolutionWidthPx: 3008,
    resolutionHeightPx: 3008,
  },
  {
    match: ['asi1600mm', 'asi 1600mm', '1600mm'],
    model: 'ZWO ASI1600MM Pro',
    sensor: 'Panasonic MN34230',
    sensorType: 'Mono',
    sensorWidthMm: 17.7,
    sensorHeightMm: 13.4,
    pixelSizeUm: 3.8,
    resolutionWidthPx: 4656,
    resolutionHeightPx: 3520,
  },
  {
    match: ['asi1600mc', 'asi 1600mc', '1600mc'],
    model: 'ZWO ASI1600MC Pro',
    sensor: 'Panasonic MN34230',
    sensorType: 'Color',
    sensorWidthMm: 17.7,
    sensorHeightMm: 13.4,
    pixelSizeUm: 3.8,
    resolutionWidthPx: 4656,
    resolutionHeightPx: 3520,
  },
  {
    match: ['asi183mm', 'asi 183mm', '183mm'],
    model: 'ZWO ASI183MM Pro',
    sensor: 'Sony IMX183',
    sensorType: 'Mono',
    sensorWidthMm: 13.2,
    sensorHeightMm: 8.8,
    pixelSizeUm: 2.4,
    resolutionWidthPx: 5496,
    resolutionHeightPx: 3672,
  },
  {
    match: ['asi183mc', 'asi 183mc', '183mc'],
    model: 'ZWO ASI183MC Pro',
    sensor: 'Sony IMX183',
    sensorType: 'Color',
    sensorWidthMm: 13.2,
    sensorHeightMm: 8.8,
    pixelSizeUm: 2.4,
    resolutionWidthPx: 5496,
    resolutionHeightPx: 3672,
  },
  {
    match: ['asi071mc', 'asi 071mc', '071mc'],
    model: 'ZWO ASI071MC Pro',
    sensor: 'Sony IMX071',
    sensorType: 'Color',
    sensorWidthMm: 23.6,
    sensorHeightMm: 15.6,
    pixelSizeUm: 4.78,
    resolutionWidthPx: 4944,
    resolutionHeightPx: 3284,
  },
  {
    match: ['asi6200mm', 'asi 6200mm', '6200mm'],
    model: 'ZWO ASI6200MM Pro',
    sensor: 'Sony IMX455',
    sensorType: 'Mono',
    sensorWidthMm: 35.6,
    sensorHeightMm: 23.8,
    pixelSizeUm: 3.76,
    resolutionWidthPx: 9576,
    resolutionHeightPx: 6388,
  },
  {
    match: ['asi6200mc', 'asi 6200mc', '6200mc'],
    model: 'ZWO ASI6200MC Pro',
    sensor: 'Sony IMX455',
    sensorType: 'Color',
    sensorWidthMm: 35.6,
    sensorHeightMm: 23.8,
    pixelSizeUm: 3.76,
    resolutionWidthPx: 9576,
    resolutionHeightPx: 6388,
  },
  {
    match: ['asi2400mc', 'asi 2400mc', '2400mc'],
    model: 'ZWO ASI2400MC Pro',
    sensor: 'Sony IMX410',
    sensorType: 'Color',
    sensorWidthMm: 35.6,
    sensorHeightMm: 23.7,
    pixelSizeUm: 5.94,
    resolutionWidthPx: 5992,
    resolutionHeightPx: 3992,
  },
  {
    match: ['qhy268m', 'qhy 268m'],
    model: 'QHY268M',
    sensor: 'Sony IMX571',
    sensorType: 'Mono',
    sensorWidthMm: 23.5,
    sensorHeightMm: 15.7,
    pixelSizeUm: 3.76,
    resolutionWidthPx: 6280,
    resolutionHeightPx: 4210,
  },
  {
    match: ['qhy268c', 'qhy 268c'],
    model: 'QHY268C',
    sensor: 'Sony IMX571',
    sensorType: 'Color',
    sensorWidthMm: 23.5,
    sensorHeightMm: 15.7,
    pixelSizeUm: 3.76,
    resolutionWidthPx: 6280,
    resolutionHeightPx: 4210,
  },
  {
    match: ['qhy600m', 'qhy 600m'],
    model: 'QHY600M',
    sensor: 'Sony IMX455',
    sensorType: 'Mono',
    sensorWidthMm: 35.6,
    sensorHeightMm: 23.8,
    pixelSizeUm: 3.76,
    resolutionWidthPx: 9576,
    resolutionHeightPx: 6388,
  },
  {
    match: ['poseidon-c pro', 'poseidon c pro', 'poseidon-c'],
    model: 'Player One Poseidon-C Pro',
    sensor: 'Sony IMX571',
    sensorType: 'Color',
    sensorWidthMm: 23.5,
    sensorHeightMm: 15.7,
    pixelSizeUm: 3.76,
    resolutionWidthPx: 6248,
    resolutionHeightPx: 4176,
  },
]

export function findCameraSpec(query: string): CameraSpec | undefined {
  const q = query.trim().toLowerCase()
  if (q.length < 3) return undefined
  return CAMERA_CATALOG.find((c) => c.match.some((m) => q.includes(m)))
}

export function searchCameraCatalog(query: string, limit = 6): CameraSpec[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return CAMERA_CATALOG.filter(
    (c) => c.model.toLowerCase().includes(q) || c.match.some((m) => m.includes(q)),
  ).slice(0, limit)
}
