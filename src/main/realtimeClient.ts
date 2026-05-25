import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { AUDIO_SAMPLE_RATE } from '@shared/ipc'

const REALTIME_URL = 'wss://api.openai.com/v1/realtime?intent=transcription'
const MODEL = 'gpt-realtime-whisper'
const PRE_BUFFER_MAX = 250 // ~10s at 40ms/chunk
const COMMIT_WAIT_MS = 4000 // grace period after stop() for final transcript

interface RealtimeEvents {
  ready: () => void
  partial: (text: string) => void
  final: (text: string) => void
  error: (err: Error) => void
  closed: () => void
}

export interface RealtimeClient {
  on<E extends keyof RealtimeEvents>(event: E, listener: RealtimeEvents[E]): this
  off<E extends keyof RealtimeEvents>(event: E, listener: RealtimeEvents[E]): this
  once<E extends keyof RealtimeEvents>(event: E, listener: RealtimeEvents[E]): this
  emit<E extends keyof RealtimeEvents>(event: E, ...args: Parameters<RealtimeEvents[E]>): boolean
}

/**
 * One-shot transcription session against OpenAI Realtime API. Lifecycle:
 *   start() → connect → onSessionReady → send audio → stop() → close
 *
 * Audio is buffered until the session is ready (up to PRE_BUFFER_MAX chunks),
 * then flushed. Concatenates all `.completed` transcripts into the final result.
 */
export class RealtimeClient extends EventEmitter {
  private ws: WebSocket | null = null
  private ready = false
  private closed = false
  private preBuffer: string[] = [] // base64 chunks queued before ready
  private finalParts: string[] = []
  private currentPartial = ''
  private stopping = false
  private commitTimer: NodeJS.Timeout | null = null

  constructor(private readonly apiKey: string) {
    super()
  }

  start(): void {
    if (this.ws) throw new Error('already started')

    this.ws = new WebSocket(REALTIME_URL, {
      headers: { Authorization: `Bearer ${this.apiKey}` }
    })

    this.ws.on('open', () => this.handleOpen())
    this.ws.on('message', (data) => this.handleMessage(data.toString()))
    this.ws.on('error', (err) => {
      if (this.closed) return
      this.emit('error', err)
    })
    this.ws.on('close', () => this.finishClose())
  }

  /** Queue or send a 40ms PCM chunk (int16 mono LE). */
  sendChunk(pcm: ArrayBuffer): void {
    if (this.closed || this.stopping) return
    const b64 = Buffer.from(pcm).toString('base64')
    if (!this.ready) {
      if (this.preBuffer.length < PRE_BUFFER_MAX) {
        this.preBuffer.push(b64)
      }
      return
    }
    this.sendAppend(b64)
  }

  /** Signal end of audio. Commits the buffer and waits briefly for the final transcript. */
  stop(): void {
    if (this.closed || this.stopping || !this.ws) return
    this.stopping = true
    if (this.ready) {
      this.flushPreBuffer()
      this.sendJson({ type: 'input_audio_buffer.commit' })
    }
    this.commitTimer = setTimeout(() => this.close(), COMMIT_WAIT_MS)
  }

  close(): void {
    if (this.closed) return
    try {
      this.ws?.close()
    } catch {
      // ignore
    }
    this.finishClose()
  }

  private finishClose(): void {
    if (this.closed) return
    this.closed = true
    this.clearCommitTimer()
    this.ws = null
    this.emit('closed')
  }

  private handleOpen(): void {
    this.sendJson({
      type: 'session.update',
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: AUDIO_SAMPLE_RATE },
            transcription: { model: MODEL }
          }
        }
      }
    })
  }

  private handleMessage(raw: string): void {
    let msg: { type?: string; [k: string]: unknown }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    const type = msg.type

    if (type === 'session.updated' || type === 'transcription_session.updated') {
      if (!this.ready) {
        this.ready = true
        this.flushPreBuffer()
        this.emit('ready')
        if (this.stopping) {
          // stop() was called before ready — commit now and let timer close us
          this.sendJson({ type: 'input_audio_buffer.commit' })
        }
      }
      return
    }

    if (type === 'conversation.item.input_audio_transcription.delta') {
      const delta = typeof msg.delta === 'string' ? msg.delta : ''
      if (delta) {
        this.currentPartial += delta
        this.emit('partial', this.currentPartial)
      }
      return
    }

    if (type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = typeof msg.transcript === 'string' ? msg.transcript : ''
      if (transcript) {
        this.finalParts.push(transcript)
        this.emit('final', this.finalParts.join(''))
      }
      this.currentPartial = ''
      // If we're stopping and have a final, close right away.
      if (this.stopping) this.close()
      return
    }

    if (type === 'error') {
      const err = msg.error as { message?: string } | undefined
      this.emit('error', new Error(err?.message ?? 'realtime error'))
    }
  }

  private flushPreBuffer(): void {
    for (const b64 of this.preBuffer) this.sendAppend(b64)
    this.preBuffer = []
  }

  private sendAppend(audioBase64: string): void {
    this.sendJson({ type: 'input_audio_buffer.append', audio: audioBase64 })
  }

  private sendJson(obj: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify(obj))
  }

  private clearCommitTimer(): void {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer)
      this.commitTimer = null
    }
  }
}
