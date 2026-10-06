// A small offline catalog of common telescopes/lenses so the telescope form
// can suggest names and fill in focal length - same idea as the camera
// catalog: a starting point you can always correct, not a lock.

export interface TelescopeSpec {
  match: string[] // lowercase strings to match against the typed description
  model: string // canonical display name
  focalLengthMm: number
}

export const TELESCOPE_CATALOG: TelescopeSpec[] = [
  { match: ['redcat 51', 'redcat51'], model: 'William Optics RedCat 51', focalLengthMm: 250 },
  { match: ['redcat 71', 'redcat71'], model: 'William Optics RedCat 71', focalLengthMm: 350 },
  { match: ['zenithstar 61'], model: 'William Optics Zenithstar 61', focalLengthMm: 360 },
  { match: ['esprit 80'], model: 'Sky-Watcher Esprit 80ED', focalLengthMm: 400 },
  { match: ['esprit 100'], model: 'Sky-Watcher Esprit 100ED', focalLengthMm: 550 },
  { match: ['esprit 120'], model: 'Sky-Watcher Esprit 120ED', focalLengthMm: 840 },
  { match: ['esprit 150'], model: 'Sky-Watcher Esprit 150ED', focalLengthMm: 1050 },
  { match: ['evostar 72'], model: 'Sky-Watcher Evostar 72ED', focalLengthMm: 420 },
  { match: ['evostar 80'], model: 'Sky-Watcher Evostar 80ED', focalLengthMm: 600 },
  { match: ['fra400', 'fra 400'], model: 'Askar FRA400', focalLengthMm: 400 },
  { match: ['fra500', 'fra 500'], model: 'Askar FRA500', focalLengthMm: 500 },
  { match: ['fra600', 'fra 600'], model: 'Askar FRA600', focalLengthMm: 600 },
  { match: ['sqa55', 'sqa 55'], model: 'Askar SQA55', focalLengthMm: 264 },
  { match: ['askar 71f', '71f'], model: 'Askar 71F', focalLengthMm: 490 },
  { match: ['fsq-106', 'fsq106'], model: 'Takahashi FSQ-106EDX4', focalLengthMm: 530 },
  { match: ['fsq-85', 'fsq85'], model: 'Takahashi FSQ-85EDP', focalLengthMm: 450 },
  { match: ['toa-130', 'toa130'], model: 'Takahashi TOA-130', focalLengthMm: 1000 },
  { match: ['ed102'], model: 'Explore Scientific ED102', focalLengthMm: 714 },
  { match: ['ed127'], model: 'Explore Scientific ED127', focalLengthMm: 952 },
  { match: ['edge hd 8', 'edgehd 8', 'edgehd8'], model: 'Celestron EdgeHD 8', focalLengthMm: 2032 },
  { match: ['edge hd 9', 'edgehd 9', 'edgehd925'], model: 'Celestron EdgeHD 9.25', focalLengthMm: 2352 },
  { match: ['edge hd 11', 'edgehd 11', 'edgehd11'], model: 'Celestron EdgeHD 11', focalLengthMm: 2800 },
  { match: ['edge hd 14', 'edgehd 14', 'edgehd14'], model: 'Celestron EdgeHD 14', focalLengthMm: 3910 },
  { match: ['rasa 8', 'rasa8'], model: 'Celestron RASA 8', focalLengthMm: 400 },
  { match: ['rasa 11', 'rasa11'], model: 'Celestron RASA 11', focalLengthMm: 620 },
  { match: ['c8 sct', 'celestron c8'], model: 'Celestron C8 SCT', focalLengthMm: 2032 },
  { match: ['8in rc', '8" rc', 'gso 8', '8 rc'], model: 'GSO 8in RC (f/8)', focalLengthMm: 1600 },
  { match: ['6in rc', '6" rc', 'gso 6', '6 rc'], model: 'GSO 6in RC (f/9)', focalLengthMm: 1370 },
  { match: ['ed80t'], model: 'Orion ED80T CF', focalLengthMm: 600 },
  { match: ['orion 8', 'astrograph'], model: 'Orion 8in f/4 Astrograph', focalLengthMm: 800 },
  { match: ['61edph'], model: 'Sharpstar 61EDPH', focalLengthMm: 275 },
  { match: ['samyang 135', 'rokinon 135'], model: 'Samyang 135mm f/2', focalLengthMm: 135 },
]

export function findTelescopeSpec(query: string): TelescopeSpec | undefined {
  const q = query.trim().toLowerCase()
  if (q.length < 3) return undefined
  return TELESCOPE_CATALOG.find((t) => t.model.toLowerCase() === q || t.match.some((m) => q.includes(m)))
}

export function searchTelescopeCatalog(query: string, limit = 6): TelescopeSpec[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return TELESCOPE_CATALOG.filter(
    (t) => t.model.toLowerCase().includes(q) || t.match.some((m) => m.includes(q)),
  ).slice(0, limit)
}
