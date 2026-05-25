// PCM AudioWorkletProcessor:
//   - converts mono Float32 frames to Int16 little-endian
//   - batches into fixed-size chunks (default 960 samples = 40ms at 24kHz)
//   - posts each completed chunk to the main thread (transferring the buffer)
//
// AudioContext should already be running at the target sampleRate (24000).
// Loaded as a static asset from /audio-worklets/pcm-processor.js via
// audioContext.audioWorklet.addModule().

const CHUNK_SAMPLES = 960 // 40ms @ 24kHz

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Int16Array(CHUNK_SAMPLES)
    this.offset = 0
  }

  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel || channel.length === 0) return true

    for (let i = 0; i < channel.length; i++) {
      const s = Math.max(-1, Math.min(1, channel[i]))
      this.buffer[this.offset++] = s < 0 ? s * 0x8000 : s * 0x7fff
      if (this.offset === CHUNK_SAMPLES) {
        this.port.postMessage(this.buffer, [this.buffer.buffer])
        this.buffer = new Int16Array(CHUNK_SAMPLES)
        this.offset = 0
      }
    }
    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)
