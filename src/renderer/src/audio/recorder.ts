import { AUDIO_SAMPLE_RATE } from '@shared/ipc'

const WORKLET_URL = '/audio-worklets/pcm-processor.js'

/**
 * Captures microphone audio at AUDIO_SAMPLE_RATE (24kHz) as int16 mono PCM via
 * an AudioWorkletProcessor. Chunks accumulate in memory and are concatenated
 * into a single ArrayBuffer when stop() is called.
 *
 * Phase 2: buffer entire recording, send once on stop.
 * Phase 3 will stream chunks to the Realtime API instead.
 */
export class Recorder {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private workletNode: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private chunks: Int16Array[] = []
  private startedAt = 0

  isRecording(): boolean {
    return this.ctx !== null
  }

  async start(): Promise<void> {
    if (this.ctx) throw new Error('already recording')

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    this.ctx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE })
    await this.ctx.audioWorklet.addModule(WORKLET_URL)

    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.workletNode = new AudioWorkletNode(this.ctx, 'pcm-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1
    })

    this.workletNode.port.onmessage = (ev: MessageEvent<Int16Array>) => {
      this.chunks.push(ev.data)
    }

    this.source.connect(this.workletNode)
    this.chunks = []
    this.startedAt = performance.now()
  }

  async stop(): Promise<{ pcm: ArrayBuffer; sampleRate: number; durationMs: number }> {
    if (!this.ctx) throw new Error('not recording')

    const sampleRate = this.ctx.sampleRate
    const durationMs = performance.now() - this.startedAt

    this.source?.disconnect()
    this.workletNode?.disconnect()
    if (this.workletNode) this.workletNode.port.onmessage = null
    this.stream?.getTracks().forEach((t) => t.stop())
    await this.ctx.close()

    this.source = null
    this.workletNode = null
    this.stream = null
    this.ctx = null

    const pcm = concatInt16(this.chunks)
    this.chunks = []
    return { pcm, sampleRate, durationMs }
  }
}

function concatInt16(chunks: Int16Array[]): ArrayBuffer {
  let total = 0
  for (const c of chunks) total += c.length
  const buf = new ArrayBuffer(total * 2)
  const view = new Int16Array(buf)
  let offset = 0
  for (const c of chunks) {
    view.set(c, offset)
    offset += c.length
  }
  return buf
}
