// PCM AudioWorkletProcessor: converts Float32 mono frames to Int16 little-endian
// and posts them to the main thread. AudioContext should already be running
// at the target sampleRate (24000) — no resampling here.
//
// Loaded as a static asset from /audio-worklets/pcm-processor.js via
// audioContext.audioWorklet.addModule().

class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel || channel.length === 0) return true

    const out = new Int16Array(channel.length)
    for (let i = 0; i < channel.length; i++) {
      const s = Math.max(-1, Math.min(1, channel[i]))
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    this.port.postMessage(out, [out.buffer])
    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)
