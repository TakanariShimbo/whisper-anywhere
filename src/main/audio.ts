import { app } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Encode mono Int16 little-endian PCM as a 44-byte-header WAV file (PCM format).
 * `pcm` is the raw little-endian samples buffer.
 */
export function encodeWav(pcm: ArrayBuffer, sampleRate: number): Buffer {
  const dataLen = pcm.byteLength
  const buf = Buffer.alloc(44 + dataLen)
  const byteRate = sampleRate * 2 // mono, 16-bit
  const blockAlign = 2

  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataLen, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16) // PCM chunk size
  buf.writeUInt16LE(1, 20) // PCM format
  buf.writeUInt16LE(1, 22) // channels
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(byteRate, 28)
  buf.writeUInt16LE(blockAlign, 32)
  buf.writeUInt16LE(16, 34) // bits per sample
  buf.write('data', 36)
  buf.writeUInt32LE(dataLen, 40)

  Buffer.from(pcm).copy(buf, 44)
  return buf
}

export async function saveRecording(pcm: ArrayBuffer, sampleRate: number): Promise<string> {
  const dir = join(app.getPath('userData'), 'recordings')
  await mkdir(dir, { recursive: true })

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, -1) // drop trailing 'Z'
  const path = join(dir, `${stamp}.wav`)

  await writeFile(path, encodeWav(pcm, sampleRate))
  return path
}
