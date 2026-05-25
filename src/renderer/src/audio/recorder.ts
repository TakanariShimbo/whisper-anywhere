import { AUDIO_SAMPLE_RATE } from '@shared/ipc'

const WORKLET_URL = '/audio-worklets/pcm-processor.js'

export type ChunkCallback = (pcm: ArrayBuffer) => void

/**
 * Streams microphone audio at AUDIO_SAMPLE_RATE (24kHz) as int16 mono PCM.
 * The worklet emits 40ms chunks (1920 bytes each); each one is delivered
 * straight to onChunk so callers can forward to the Realtime API in real time.
 */
export class Recorder {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private workletNode: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null

  isRecording(): boolean {
    return this.ctx !== null
  }

  async start(onChunk: ChunkCallback): Promise<void> {
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
      onChunk(ev.data.buffer as ArrayBuffer)
    }

    this.source.connect(this.workletNode)
  }

  async stop(): Promise<void> {
    if (!this.ctx) return

    this.source?.disconnect()
    this.workletNode?.disconnect()
    if (this.workletNode) this.workletNode.port.onmessage = null
    this.stream?.getTracks().forEach((t) => t.stop())
    await this.ctx.close()

    this.source = null
    this.workletNode = null
    this.stream = null
    this.ctx = null
  }
}
