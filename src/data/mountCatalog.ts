// A small offline list of common equatorial/alt-az mounts for name
// suggestions in the mount form. Names only - a starting point, not a lock.

export const MOUNT_CATALOG: string[] = [
  'ZWO AM5',
  'ZWO AM3',
  'Sky-Watcher EQ6-R Pro',
  'Sky-Watcher EQ6-R',
  'Sky-Watcher NEQ6 Pro',
  'Sky-Watcher HEQ5 Pro',
  'Sky-Watcher EQ5 Pro',
  'Sky-Watcher Star Adventurer 2i',
  'Sky-Watcher Star Adventurer GTi',
  'Sky-Watcher Wave 150i',
  'Celestron CGEM II',
  'Celestron CGX',
  'Celestron CGX-L',
  'Celestron Advanced VX',
  'Celestron Origin Mount',
  'iOptron CEM26',
  'iOptron CEM40',
  'iOptron CEM70',
  'iOptron GEM45',
  'iOptron HAE29',
  'iOptron HAZ31',
  'iOptron SkyGuider Pro',
  'Losmandy G11',
  'Losmandy GM811',
  'Rainbow Astro RST-135',
  'Rainbow Astro RST-300',
  '10Micron GM1000 HPS',
  '10Micron GM2000 HPS',
  'Software Bisque Paramount MyT',
  'Software Bisque Paramount MX+',
  'Astro-Physics Mach2GTO',
  'Orion Sirius EQ-G',
  'Orion Atlas EQ-G',
]

export function searchMountCatalog(query: string, limit = 6): string[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return MOUNT_CATALOG.filter((m) => m.toLowerCase().includes(q)).slice(0, limit)
}
