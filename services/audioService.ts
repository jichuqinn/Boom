

export interface BeatData {
  time: number;
  lane: number;
}

export class AudioService {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private startTime: number = 0;
  
  public init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  public async loadFile(file: File): Promise<void> {
    this.init();
    if (!this.ctx) return;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.error("Error decoding audio data", e);
      throw e;
    }
  }

  // Analyzes the loaded buffer to find peaks/beats
  public analyzeBeats(threshold: number = 1.2, minInterval: number = 0.25): BeatData[] {
    if (!this.buffer) return [];

    const rawData = this.buffer.getChannelData(0); // Use first channel
    const sampleRate = this.buffer.sampleRate;
    const beats: BeatData[] = [];
    
    // Process in chunks (windows)
    const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
    let lastBeatTime = -minInterval;

    // Simple local energy detector
    for (let i = 0; i < rawData.length; i += windowSize) {
        let sum = 0;
        for (let j = 0; j < windowSize && i + j < rawData.length; j++) {
            sum += rawData[i + j] * rawData[i + j];
        }
        const rms = Math.sqrt(sum / windowSize);

        if (rms > 0.1 && (i / sampleRate) - lastBeatTime > minInterval) {
            // Assign a random lane (0, 1, 2)
            // Weight center lane slightly higher for main beats
            const r = Math.random();
            let lane = 1;
            if (r < 0.3) lane = 0;
            else if (r > 0.7) lane = 2;

            beats.push({
              time: parseFloat((i / sampleRate).toFixed(3)),
              lane: lane
            });
            lastBeatTime = i / sampleRate;
        }
    }

    return beats;
  }

  // Generates a simple synthesized techno beat for immediate play
  public createDemoTrack(): BeatData[] {
    this.init();
    if (!this.ctx) throw new Error("AudioContext not initialized");

    const duration = 30; // 30 seconds
    const sampleRate = this.ctx.sampleRate;
    const frameCount = sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    
    const bpm = 135; // Slightly faster
    const beatInterval = 60 / bpm; 
    const beats: BeatData[] = [];
    
    const startOffset = 2.0;

    for (let t = 0; t < duration; t += beatInterval / 2) { // 8th notes
      const isDownBeat = Math.abs(t % beatInterval) < 0.01;
      const sampleIndex = Math.floor(t * sampleRate);
      
      // Add Beat Timestamp
      if (t >= startOffset) {
        // Kick (Downbeat) -> Center Lane (1)
        if (isDownBeat) {
             beats.push({ time: t, lane: 1 });
        } 
        // Offbeat -> Side Lanes (0 or 2)
        else {
             // Alternate sides
             const side = (Math.floor(t / beatInterval) % 2 === 0) ? 0 : 2;
             beats.push({ time: t, lane: side });
        }
      }

      // Audio Synthesis
      if (isDownBeat) {
        // Kick
        const kickLen = Math.floor(0.15 * sampleRate);
        for (let i = 0; i < kickLen && sampleIndex + i < frameCount; i++) {
            const time = i / sampleRate;
            const freq = 150 * Math.exp(-25 * time);
            const volume = Math.max(0, 1 - (time / 0.15));
            data[sampleIndex + i] += Math.sin(2 * Math.PI * freq * time) * volume * 0.9;
        }
      } else {
        // Hi-Hat / Snareish
        const hatLen = Math.floor(0.08 * sampleRate);
        if (sampleIndex + hatLen < frameCount) {
            for (let i = 0; i < hatLen; i++) {
            const noise = (Math.random() * 2 - 1);
            const volume = (1 - (i / hatLen)) * 0.4;
            data[sampleIndex + i] += noise * volume;
            }
        }
      }
    }

    this.buffer = buffer;
    return beats;
  }

  public play(delay: number = 0) {
    if (!this.ctx || !this.buffer) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.stop();

    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.ctx.destination);
    
    const startCtxTime = this.ctx.currentTime + delay;
    this.startTime = startCtxTime;
    this.source.start(startCtxTime);
  }

  public stop() {
    if (this.source) {
      try {
        this.source.stop();
      } catch (e) {
        // Ignore
      }
      this.source.disconnect();
      this.source = null;
    }
  }

  public getCurrentTime(): number {
    if (!this.ctx || !this.source) return 0;
    // CRITICAL FIX: Removed Math.max(0, ...) to allow negative time for countdown
    return this.ctx.currentTime - this.startTime;
  }

  public getDuration(): number {
    return this.buffer?.duration || 0;
  }

  public isReady(): boolean {
    return !!this.buffer;
  }
}

export const audioService = new AudioService();
