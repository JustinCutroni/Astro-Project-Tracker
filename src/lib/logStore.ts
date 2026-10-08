import { newId, nowIso } from './ids'
import { putDoc } from '../firebase/firestoreDb'
import type { SessionLog } from '../types/models'

// Log files are kept byte-for-byte: gzipped with the browser's built-in
// CompressionStream, then base64-encoded into a Firestore document. Text logs
// compress roughly tenfold, so a long night still fits well inside Firestore's
// 1 MiB document limit; the cap below leaves room for the other fields.
const MAX_ENCODED_CHARS = 900_000

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function fromBase64(encoded: string): Uint8Array<ArrayBuffer> {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function encodeLog(file: Blob): Promise<string> {
  const compressed = file.stream().pipeThrough(new CompressionStream('gzip'))
  return toBase64(new Uint8Array(await new Response(compressed).arrayBuffer()))
}

export async function decodeLog(data: string): Promise<Blob> {
  const stream = new Blob([fromBase64(data)]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).blob()
}

// Throws an Error with a user-readable message if the file is too big to store.
export async function saveSessionLog(
  file: File,
  session: { id: string; projectId: string },
): Promise<SessionLog> {
  const data = await encodeLog(file)
  if (data.length > MAX_ENCODED_CHARS) {
    throw new Error(
      `${file.name} is too large to store (${formatBytes(file.size)}, ${formatBytes(data.length)} compressed).`,
    )
  }
  const log: SessionLog = {
    id: newId(),
    sessionId: session.id,
    projectId: session.projectId,
    fileName: file.name,
    sizeBytes: file.size,
    encoding: 'gzip-base64',
    data,
    importedAt: nowIso(),
  }
  await putDoc<SessionLog>('sessionLogs', log)
  return log
}

export async function downloadSessionLog(log: SessionLog): Promise<void> {
  const url = URL.createObjectURL(await decodeLog(log.data))
  const a = document.createElement('a')
  a.href = url
  a.download = log.fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
