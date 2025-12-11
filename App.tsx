
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Beat, FloatingText, Particle, Shockwave, Nebula, Debris, FloatingGeo } from './types';
import { audioService } from './services/audioService';
import FloatingTextManager from './components/FloatingTextManager';
import GameCharacter from './components/GameCharacter';

// Game Constants
const FALL_TIME = 1.8; 
const HIT_WINDOW = 0.15; 
const PERFECT_WINDOW = 0.05; 
const LANES = 3;

// Lane Colors
const COLORS = [
  '#f43f5e', // Lane 0 (Left): Rose/Red
  '#22d3ee', // Lane 1 (Mid): Cyan
  '#fbbf24'  // Lane 2 (Right): Amber/Gold
];

// Tier Background Colors (Center, Outer)
const TIER_BG_COLORS = [
  { center: '#0f172a', outer: '#020617' }, // Tier 0: Deep Slate
  { center: '#083344', outer: '#020617' }, // Tier 1: Deep Cyan
  { center: '#451a03', outer: '#000000' }, // Tier 2: Deep Amber
  { center: '#4a044e', outer: '#000000' }, // Tier 3: Deep Purple
];

const TIER_NEBULA_COLORS = [
  'rgba(255, 255, 255, 0.05)', // Tier 0: White mist
  'rgba(34, 211, 238, 0.15)',  // Tier 1: Cyan
  'rgba(251, 191, 36, 0.15)',  // Tier 2: Gold
  'rgba(217, 70, 239, 0.2)'    // Tier 3: Purple
];

// Visual Constants
const PERSPECTIVE = 0.5; // Narrowing factor
const HORIZON_Y = 0.3;   // Horizon height (0-1)
const HIT_Y_PERCENT = 0.85; 
const TRACK_WIDTH_BOTTOM = 700; 

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.SETUP);
  
  // UI State (synced from Refs)
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [heat, setHeat] = useState(0); 
  const [tier, setTier] = useState(0);
  const [isHitFrame, setIsHitFrame] = useState(false);
  const [triggerPulse, setTriggerPulse] = useState(0); // For CSS animations

  // Loading / Setup State
  const [isLoading, setIsLoading] = useState(false);
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [rawBeatsInput, setRawBeatsInput] = useState('');
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState(0); // Only for countdown text

  // Refs for High-Frequency Logic (The "Real" Game State)
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const heatRef = useRef(0);
  const shakeIntensityRef = useRef(0);
  const activeLanesRef = useRef<boolean[]>([false, false, false]);
  
  // Game Objects
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<number>(0);
  const textRef = useRef<FloatingText[]>([]);
  const debrisRef = useRef<Debris[]>([]); 
  const shockwavesRef = useRef<Shockwave[]>([]);
  const nebulaRef = useRef<Nebula[]>([]);
  const floatingGeoRef = useRef<FloatingGeo[]>([]);
  const laneLasersRef = useRef<number[]>([0, 0, 0]);
  const pulseBrightnessRef = useRef<number>(0); 
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beatsRef = useRef<Beat[]>([]);

  // Initialize Nebulas and Floating Geo
  useEffect(() => {
    const nebulas: Nebula[] = [];
    for (let i = 0; i < 6; i++) {
      nebulas.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight * 0.6, 
        baseX: Math.random() * window.innerWidth,
        baseY: Math.random() * window.innerHeight * 0.6,
        radius: 200 + Math.random() * 300,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0005 + Math.random() * 0.001
      });
    }
    nebulaRef.current = nebulas;

    const geos: FloatingGeo[] = [];
    for (let i = 0; i < 4; i++) {
        geos.push({
            id: i,
            x: 0.1 + Math.random() * 0.8,
            y: 0.1 + Math.random() * 0.3,
            size: 40 + Math.random() * 60,
            rotation: Math.random() * Math.PI,
            speed: (Math.random() - 0.5) * 0.01,
            shape: Math.random() > 0.5 ? 'CUBE' : 'PYRAMID'
        });
    }
    floatingGeoRef.current = geos;
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsLoading(true);
      try {
        await audioService.loadFile(e.target.files[0]);
        setIsFileLoaded(true);
      } catch (err) {
        alert("音频加载失败");
      }
      setIsLoading(false);
    }
  };

  const handleAutoGenerate = () => {
    if (!audioService.isReady()) return;
    setIsLoading(true);
    setTimeout(() => {
      try {
        const detectedBeats = audioService.analyzeBeats();
        setRawBeatsInput(JSON.stringify(detectedBeats, null, 2));
      } catch (e) {
        console.error(e);
        alert("无法分析音频");
      }
      setIsLoading(false);
    }, 100);
  };

  const loadDemo = () => {
    try {
      setIsLoading(true);
      const demoBeats = audioService.createDemoTrack();
      setIsFileLoaded(true);
      setRawBeatsInput(JSON.stringify(demoBeats, null, 2));
      setTimeout(() => {
        startGame(demoBeats);
        setIsLoading(false);
      }, 500);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const startGame = (overrideBeats?: any[]) => {
    if (!audioService.isReady()) {
      alert("请先上传音频或选择演示模式！");
      return;
    }

    try {
      let beatData: any[] = [];
      
      if (overrideBeats) {
        beatData = overrideBeats;
      } else {
        if (!rawBeatsInput) {
          alert("请输入谱面数据");
          return;
        }
        beatData = JSON.parse(rawBeatsInput);
      }

      // Validate format
      if (!Array.isArray(beatData)) throw new Error("Format error");
      
      const parsedBeats = beatData.map((b: any, i: number) => ({
        id: i,
        time: typeof b === 'number' ? b : b.time,
        lane: typeof b === 'number' ? 1 : (b.lane ?? 1),
        hit: false,
        missed: false
      }));
      
      parsedBeats.sort((a, b) => a.time - b.time);
      
      beatsRef.current = parsedBeats;
      
      // Reset Refs
      scoreRef.current = 0;
      comboRef.current = 0;
      heatRef.current = 0;
      shakeIntensityRef.current = 0;
      textRef.current = [];
      debrisRef.current = [];
      shockwavesRef.current = [];
      laneLasersRef.current = [0,0,0];
      pulseBrightnessRef.current = 0;
      activeLanesRef.current = [false, false, false];

      // Sync State
      setScore(0);
      setCombo(0);
      setHeat(0);
      setTier(0);
      setCurrentTimeDisplay(-3);
      setGameState(GameState.PLAYING);
      
      audioService.play(3.0);
    } catch (e) {
      alert("谱面数据无效");
    }
  };

  // --- Visual Spawners ---

  const spawnFloatingText = (rating: 'PERFECT' | 'GREAT' | 'BLOOM', x: number, y: number, color: string) => {
    textRef.current.push({
      id: Math.random(),
      text: rating === 'BLOOM' ? 'BLOOM!' : rating + "!",
      x,
      y,
      color: color,
      scale: 0.5,
      opacity: 1,
      createdAt: Date.now()
    });
  };

  const spawnShockwave = (x: number, y: number, color: string) => {
    shockwavesRef.current.push({
      id: Math.random(),
      x,
      y,
      color,
      size: 20,
      opacity: 1.0
    });
  };

  const spawnDebris = (x: number, y: number, color: string, count: number) => {
    for(let i=0; i<count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.5;
      const speed = Math.random() * 12 + 5;
      debrisRef.current.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI,
        deltaRotation: (Math.random() - 0.5) * 0.3,
        life: 1.0,
        color,
        size: Math.random() * 12 + 6
      });
    }
  };

  // --- Input Logic ---

  const handleLaneInput = useCallback((laneIndex: number) => {
    if (gameState !== GameState.PLAYING) return;
    
    const currentTime = audioService.getCurrentTime();
    if (currentTime < 0) return;

    // Set Active Lane Ref
    const newActive = [...activeLanesRef.current];
    newActive[laneIndex] = true;
    activeLanesRef.current = newActive;
    
    // Auto release after delay
    setTimeout(() => {
       const reset = [...activeLanesRef.current];
       reset[laneIndex] = false;
       activeLanesRef.current = reset;
    }, 100);

    const hittableBeat = beatsRef.current.find(b => 
      !b.hit && 
      !b.missed &&
      b.lane === laneIndex &&
      Math.abs(b.time - currentTime) < HIT_WINDOW
    );

    if (hittableBeat) {
      hittableBeat.hit = true;
      const diff = Math.abs(hittableBeat.time - currentTime);
      
      let rating: 'PERFECT' | 'GREAT' | 'BLOOM' = 'GREAT';
      let scoreAdd = 100;
      let heatAdd = 5;
      
      if (diff < PERFECT_WINDOW) {
         rating = 'PERFECT';
         scoreAdd = 300;
         heatAdd = 10;
         if (comboRef.current > 30 && Math.random() > 0.8) rating = 'BLOOM';
      }

      // Update Refs
      scoreRef.current += scoreAdd;
      comboRef.current += 1;
      heatRef.current = Math.min(100, heatRef.current + heatAdd);
      shakeIntensityRef.current = rating === 'BLOOM' ? 25 : 10;
      
      // Visual Triggers
      pulseBrightnessRef.current = 1.0;
      laneLasersRef.current[laneIndex] = 1.0;

      // Sync UI State
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      // We don't sync Heat every hit to save renders, loop handles it mostly, but syncing here ensures responsiveness
      setHeat(heatRef.current); 
      setTriggerPulse(prev => prev + 1);
      setIsHitFrame(true);
      setTimeout(() => setIsHitFrame(false), 80);

      // Feedback Locations
      const hitVisualProgress = (HIT_Y_PERCENT - HORIZON_Y) / (1 - HORIZON_Y);
      const w = window.innerWidth;
      const laneStart = { currentTrackWidth: TRACK_WIDTH_BOTTOM * PERSPECTIVE }; 
      const laneEnd = { currentTrackWidth: TRACK_WIDTH_BOTTOM };
      const trackW = laneStart.currentTrackWidth + (laneEnd.currentTrackWidth - laneStart.currentTrackWidth) * hitVisualProgress;
      const laneW = trackW / LANES;
      const centerX = w / 2;
      const hitX = centerX + (laneIndex - 1) * laneW;
      const hitY = window.innerHeight * HIT_Y_PERCENT;

      spawnFloatingText(rating, hitX, hitY - 50, COLORS[laneIndex]);
      spawnDebris(hitX, hitY, COLORS[laneIndex], 12);
      spawnShockwave(hitX, hitY, COLORS[laneIndex]);
    }
  }, [gameState]); // Removed combo/score from dependencies!

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; 
      if (e.code === 'KeyA') handleLaneInput(0);
      if (e.code === 'Space') { e.preventDefault(); handleLaneInput(1); }
      if (e.code === 'KeyD') handleLaneInput(2);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleLaneInput]);

  // Helper to determine tier based on ref
  const getTierFromRef = () => {
    const c = comboRef.current;
    if (c < 10) return 0; // 0-9
    if (c < 30) return 1; // 10-29: Cyan
    if (c < 50) return 2; // 30-49: Gold
    return 3;             // 50+: Purple/Glitch
  };

  // --- Main Loop ---

  useEffect(() => {
    if (gameState !== GameState.PLAYING) {
      cancelAnimationFrame(frameRef.current);
      audioService.stop();
      return;
    }

    const loop = () => {
      const now = audioService.getCurrentTime();
      
      // Update Display Time for Countdown (low frequency update)
      // FIX: Allow updating past 0 to ensure the UI state flips to positive (hiding the overlay)
      if (now < 0.5) {
        setCurrentTimeDisplay(now);
      }

      const canvas = canvasRef.current;
      
      // Decay Logic (Refs)
      heatRef.current = Math.max(0, heatRef.current - 0.15);
      pulseBrightnessRef.current *= 0.90; 
      
      if (shakeIntensityRef.current > 0) {
        shakeIntensityRef.current = Math.max(0, shakeIntensityRef.current - 1);
      }

      for(let i=0; i<3; i++) {
          laneLasersRef.current[i] *= 0.85;
      }

      // Sync Tier
      const currentTier = getTierFromRef();
      // Only sync tier state if changed (to update UI colors)
      setTier(prev => {
          if (prev !== currentTier) return currentTier;
          return prev;
      });

      // Sync Heat (Throttled update for smooth UI bar)
      if (Math.floor(now * 60) % 4 === 0) {
          setHeat(heatRef.current);
      }

      // Check finish
      if (now > audioService.getDuration() + 2 && audioService.getDuration() > 0) {
        setGameState(GameState.FINISHED);
        return;
      }

      // Check misses
      if (now > 0) {
        beatsRef.current.forEach(beat => {
          if (!beat.hit && !beat.missed && now > beat.time + HIT_WINDOW) {
            beat.missed = true;
            // Penalty
            comboRef.current = 0;
            heatRef.current = Math.max(0, heatRef.current - 15);
            
            setCombo(0);
            setHeat(heatRef.current);
          }
        });
      }

      // Update Entities (In-place mutation to reduce GC)
      let i = 0;
      while (i < textRef.current.length) {
          const t = textRef.current[i];
          t.y -= 1.5;
          t.opacity -= 0.02;
          if (t.opacity <= 0) {
              textRef.current.splice(i, 1);
          } else {
              i++;
          }
      }

      i = 0;
      while (i < debrisRef.current.length) {
          const p = debrisRef.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.8;
          p.rotation += p.deltaRotation;
          p.life -= 0.02;
          if (p.life <= 0) {
              debrisRef.current.splice(i, 1);
          } else {
              i++;
          }
      }

      i = 0;
      while (i < shockwavesRef.current.length) {
          const s = shockwavesRef.current[i];
          s.size += 15;
          s.opacity -= 0.05;
          if (s.opacity <= 0) {
              shockwavesRef.current.splice(i, 1);
          } else {
              i++;
          }
      }

      floatingGeoRef.current.forEach(g => {
         g.rotation += g.speed;
      });

      // --- RENDERING ---
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          const w = canvas.width;
          const h = canvas.height;
          
          const cx = w / 2;
          const cy = h / 2;

          // READ REFS
          const heatVal = heatRef.current;
          const tierVal = currentTier;
          const shakeVal = shakeIntensityRef.current + (heatVal > 90 ? Math.random() * 2 : 0); // Extra shake at high heat
          const pulseVal = pulseBrightnessRef.current;

          // Apply Shake (Canvas Translation)
          ctx.save();
          if (Math.abs(shakeVal) > 0.1) {
              const dx = (Math.random() - 0.5) * shakeVal;
              const dy = (Math.random() - 0.5) * shakeVal;
              ctx.translate(dx, dy);
          }

          const bounceY = pulseVal * 25 + (heatVal > 80 ? Math.sin(now * 20) * 5 : 0);

          // 0. BACKGROUND & SKYBOX
          const bgColors = TIER_BG_COLORS[tierVal];
          
          const grad = ctx.createRadialGradient(cx, cy * 0.5 + bounceY, 0, cx, cy, Math.max(w, h));
          grad.addColorStop(0, bgColors.center);
          grad.addColorStop(1, bgColors.outer);
          
          ctx.fillStyle = grad;
          ctx.fillRect(-20, -20, w + 40, h + 40);

          // 1. NEBULA FOG SYSTEM
          const nebulaColor = TIER_NEBULA_COLORS[tierVal];
          ctx.globalCompositeOperation = 'screen'; 
          
          nebulaRef.current.forEach(n => {
            const offsetX = Math.sin(now * n.speed + n.phase) * 50;
            const offsetY = Math.cos(now * n.speed * 0.7 + n.phase) * 30;
            const pulse = 1 + Math.sin(now * 2 + n.phase) * 0.1;

            const x = n.baseX + offsetX;
            const y = n.baseY + offsetY + bounceY * 0.5; 
            const r = n.radius * pulse;

            const nGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
            nGrad.addColorStop(0, nebulaColor);
            nGrad.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.fillStyle = nGrad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          });
          
          // 1.5 FLOATING GEOMETRY
          ctx.strokeStyle = `rgba(255,255,255,${0.05 + heatVal/1000})`;
          ctx.lineWidth = 2;
          
          floatingGeoRef.current.forEach(g => {
             const gx = g.x * w;
             const gy = g.y * h + bounceY * 0.2;
             
             ctx.save();
             ctx.translate(gx, gy);
             ctx.rotate(g.rotation + (heatVal > 80 ? Math.sin(now * 10) * 0.1 : 0)); // Jitter at high heat
             
             ctx.beginPath();
             if (g.shape === 'CUBE') {
                 const s = g.size;
                 ctx.strokeRect(-s/2, -s/2, s, s);
                 ctx.strokeRect(-s/4, -s/4, s/2, s/2);
                 ctx.moveTo(-s/2, -s/2); ctx.lineTo(-s/4, -s/4);
                 ctx.moveTo(s/2, -s/2); ctx.lineTo(s/4, -s/4);
                 ctx.moveTo(s/2, s/2); ctx.lineTo(s/4, s/4);
                 ctx.moveTo(-s/2, s/2); ctx.lineTo(-s/4, s/4);
             } else {
                 const s = g.size;
                 ctx.moveTo(0, -s);
                 ctx.lineTo(s, s);
                 ctx.lineTo(-s, s);
                 ctx.closePath();
                 ctx.moveTo(0, 0); ctx.lineTo(0, -s);
                 ctx.moveTo(0, 0); ctx.lineTo(s, s);
                 ctx.moveTo(0, 0); ctx.lineTo(-s, s);
             }
             ctx.stroke();
             ctx.restore();
          });

          ctx.globalCompositeOperation = 'source-over';

          // Pulse Overlay
          if (pulseVal > 0.01) {
            ctx.fillStyle = `rgba(255,255,255,${pulseVal * 0.2})`;
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillRect(0,0,w,h);
            ctx.globalCompositeOperation = 'source-over';
          }

          // 3D Projection
          const project = (progress: number, laneIndex: number) => {
             const horizonRealY = (h * HORIZON_Y) + bounceY;
             const bottomRealY = h + bounceY; 
             
             const y = horizonRealY + (progress * (bottomRealY - horizonRealY));
             
             const scale = PERSPECTIVE + (1 - PERSPECTIVE) * progress;
             const currentTrackWidth = TRACK_WIDTH_BOTTOM * scale;
             const laneWidth = currentTrackWidth / LANES;
             const centerX = w / 2;
             const laneOffset = (laneIndex - 1) * laneWidth;
             const x = centerX + laneOffset;

             return { x, y, scale, laneWidth, currentTrackWidth };
          };

          const laneStart = project(0, 1); 
          const laneEnd = project(1, 1);   
          
          // 2. Draw Moving Grid
          const GRID_SPEED = 2.5 + (heatVal / 100) * 2.5; // Faster at high heat
          const gridTime = now < 0 ? now * 0.5 : now;
          const gridOffset = (gridTime * GRID_SPEED) % 1; 
          
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(w/2 - laneStart.currentTrackWidth/2, laneStart.y);
          ctx.lineTo(w/2 + laneStart.currentTrackWidth/2, laneStart.y);
          ctx.lineTo(w/2 + laneEnd.currentTrackWidth/2, laneEnd.y);
          ctx.lineTo(w/2 - laneEnd.currentTrackWidth/2, laneEnd.y);
          ctx.closePath();
          ctx.clip();

          // Floor Gradient
          const floorAlpha = 0.5 + (heatVal/200);
          const floorColor = heatVal > 80 ? `rgba(80, 0, 50, ${floorAlpha})` : `rgba(20, 30, 40, ${floorAlpha})`;
          const floorGrad = ctx.createLinearGradient(0, laneStart.y, 0, laneEnd.y);
          floorGrad.addColorStop(0, 'rgba(0,0,0,0)');
          floorGrad.addColorStop(0.2, floorColor);
          floorGrad.addColorStop(1, floorColor);
          ctx.fillStyle = floorGrad;
          ctx.fill();

          // LASERS
          for(let i=0; i<3; i++) {
              if (laneLasersRef.current[i] > 0.01) {
                  const opacity = laneLasersRef.current[i];
                  const pTop = project(0, i);
                  const pBot = project(1, i);
                  
                  ctx.beginPath();
                  ctx.moveTo(pTop.x - pTop.laneWidth/2, pTop.y);
                  ctx.lineTo(pTop.x + pTop.laneWidth/2, pTop.y);
                  ctx.lineTo(pBot.x + pBot.laneWidth/2, pBot.y);
                  ctx.lineTo(pBot.x - pBot.laneWidth/2, pBot.y);
                  ctx.closePath();

                  const laserGrad = ctx.createLinearGradient(0, pTop.y, 0, pBot.y);
                  laserGrad.addColorStop(0, `rgba(255,255,255,0)`);
                  laserGrad.addColorStop(0.5, COLORS[i]);
                  laserGrad.addColorStop(1, COLORS[i]);
                  
                  ctx.globalAlpha = opacity * 0.6;
                  ctx.globalCompositeOperation = 'screen';
                  ctx.fillStyle = laserGrad;
                  ctx.fill();
                  ctx.globalCompositeOperation = 'source-over';
                  ctx.globalAlpha = 1.0;
              }
          }

          // Lane Dividers
          ctx.lineWidth = 2;
          ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`;
          for(let i = 0; i <= LANES; i++) {
             const p1 = project(0, 0); 
             const topW = p1.currentTrackWidth;
             const topX = w/2 - topW/2 + (i * (topW/LANES));
             const p2 = project(1, 0);
             const botW = p2.currentTrackWidth;
             const botX = w/2 - botW/2 + (i * (botW/LANES));

             ctx.beginPath();
             ctx.moveTo(topX, laneStart.y);
             ctx.lineTo(botX, laneEnd.y);
             ctx.stroke();
          }

          // Horizontal Grid Lines
          for(let i=0; i<12; i++) {
              let lineProgress = (i / 12) + gridOffset;
              if (lineProgress > 1) lineProgress -= 1;
              if (lineProgress < 0) lineProgress += 1;
              
              const p = project(lineProgress, 1);
              
              ctx.beginPath();
              ctx.moveTo(w/2 - p.currentTrackWidth/2, p.y);
              ctx.lineTo(w/2 + p.currentTrackWidth/2, p.y);
              const alpha = (0.05 + (lineProgress * 0.1)) * (1 + heatVal/200);
              
              // Climax visual: Glow lines at high heat
              if (heatVal > 90) {
                 ctx.shadowBlur = 10;
                 ctx.shadowColor = '#d946ef';
                 ctx.strokeStyle = `rgba(255, 100, 255, ${alpha})`;
              } else {
                 ctx.shadowBlur = 0;
                 ctx.strokeStyle = `rgba(255,255,255, ${alpha})`;
              }
              
              ctx.stroke();
          }
          ctx.shadowBlur = 0; // Reset
          ctx.restore();

          // 2.5 SPECTRUM SKYLINE
          const barCount = 20;
          const skylineW = w * 0.8;
          const barW = skylineW / barCount;
          ctx.fillStyle = tierVal >= 2 ? '#fbbf24' : '#22d3ee';
          
          for(let i=0; i<barCount; i++) {
              const distFromCenter = Math.abs(i - barCount/2) / (barCount/2); 
              const wave = Math.sin(now * 5 + i * 0.5) * 0.5 + 0.5;
              const hBase = 20 + (heatVal * 0.5);
              const barH = hBase * wave * (1 - distFromCenter * 0.5) + (pulseVal * 50);
              
              const bx = (w - skylineW)/2 + i * barW;
              const by = laneStart.y - barH; 
              
              ctx.globalAlpha = 0.1 + (heatVal/300);
              ctx.fillRect(bx + 2, by, barW - 4, barH);
          }
          ctx.globalAlpha = 1.0;

          // 3. HORIZON BLEND
          const horizonH = h * 0.2;
          const fogGrad = ctx.createLinearGradient(0, laneStart.y - horizonH * 0.5, 0, laneStart.y + horizonH);
          fogGrad.addColorStop(0, bgColors.center); 
          fogGrad.addColorStop(0.4, bgColors.center);
          fogGrad.addColorStop(1, 'rgba(0,0,0,0)');
          
          ctx.fillStyle = fogGrad;
          ctx.fillRect(0, laneStart.y - horizonH, w, horizonH * 2);

          // 4. PERIPHERAL MONOLITHS
          const monoWidth = w * 0.08;
          const monoHeightBase = h * 0.4;
          const monoHeight = monoHeightBase + (heatVal/100 * h * 0.3) + (pulseVal * 100);
          const monoColor = tierVal === 1 ? '#22d3ee' : tierVal === 2 ? '#fbbf24' : tierVal === 3 ? '#d946ef' : '#64748b';
          
          ctx.filter = 'blur(40px)'; 
          ctx.globalAlpha = 0.3 + (heatVal / 200);
          ctx.fillStyle = monoColor;
          ctx.fillRect(-monoWidth/2, h - monoHeight, monoWidth * 1.5, monoHeight);
          ctx.fillRect(w - monoWidth, h - monoHeight, monoWidth * 1.5, monoHeight);
          ctx.filter = 'none';
          ctx.globalAlpha = 1.0;

          // 5. Draw Receptors
          const hitVisualProgress = (HIT_Y_PERCENT - HORIZON_Y) / (1 - HORIZON_Y);
          for (let i=0; i<LANES; i++) {
            const p = project(hitVisualProgress, i);
            const size = 20 * p.scale;
            const isActive = activeLanesRef.current[i];
            const color = COLORS[i];
            
            ctx.shadowBlur = isActive ? 30 : 10;
            ctx.shadowColor = color;
            ctx.lineWidth = 3 * p.scale;
            ctx.strokeStyle = isActive ? 'white' : color;
            ctx.strokeRect(p.x - p.laneWidth/2 + 4, p.y - size/2, p.laneWidth - 8, size);
            
            if (isActive) {
               ctx.fillStyle = color;
               ctx.globalAlpha = 0.3;
               ctx.fillRect(p.x - p.laneWidth/2 + 4, p.y - size/2, p.laneWidth - 8, size);
               ctx.globalAlpha = 1.0;
            }
            ctx.shadowBlur = 0;
            
            if (hitVisualProgress > 0) {
               ctx.fillStyle = 'rgba(255,255,255,0.5)';
               ctx.font = `bold ${16 * p.scale}px 'Outfit'`;
               ctx.textAlign = 'center';
               const keyLabel = i === 0 ? 'A' : i === 1 ? 'SPACE' : 'D';
               ctx.fillText(keyLabel, p.x, p.y + size * 2);
            }
          }

          // 6. Draw Notes
          beatsRef.current.forEach(beat => {
             if (beat.hit) return;
             
             const timeToHit = beat.time - now; 
             if (timeToHit > FALL_TIME || timeToHit < -0.2) return;

             const progress = hitVisualProgress - (timeToHit / FALL_TIME * hitVisualProgress);
             if (progress < 0 || progress > 1.1) return;

             const p = project(progress, beat.lane);
             const color = COLORS[beat.lane];
             
             if (!beat.missed) {
               const size = 25 * p.scale;
               let width = p.laneWidth * 0.8;
               let height = size;

               // Squashing effect
               if (timeToHit < 0.1 && timeToHit > 0) {
                   height *= 0.7;
                   width *= 1.2;
               }

               ctx.shadowBlur = 15 * p.scale;
               ctx.shadowColor = color;
               ctx.fillStyle = color;
               
               // Draw Note Block
               ctx.fillRect(p.x - width/2, p.y - height/2, width, height);
               
               // Highlight
               ctx.fillStyle = 'white';
               ctx.globalAlpha = 0.5;
               ctx.fillRect(p.x - width/2, p.y - height/2, width, height * 0.3);
               ctx.globalAlpha = 1.0;
               ctx.shadowBlur = 0;
             }
          });

          // 7. Draw Effects
          shockwavesRef.current.forEach(sw => {
             ctx.beginPath();
             ctx.ellipse(sw.x, sw.y, sw.size, sw.size * 0.6, 0, 0, Math.PI * 2);
             ctx.strokeStyle = sw.color;
             ctx.lineWidth = 4;
             ctx.globalAlpha = sw.opacity;
             ctx.stroke();
             ctx.globalAlpha = 1.0;
          });

          // Draw Rotating Debris
          debrisRef.current.forEach(d => {
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rotation);
            ctx.fillStyle = d.color;
            ctx.globalAlpha = d.life;
            const s = d.size;
            ctx.fillRect(-s/2, -s/2, s, s);
            ctx.restore();
          });
          ctx.globalAlpha = 1.0;
          
          // 8. Breathing Vignette
          const vignettePulse = 1.0 + Math.sin(now * 8) * 0.05; 
          const vignetteScale = 1.0 - (heatVal / 200); 
          const vGrad = ctx.createRadialGradient(cx, cy, h * 0.4 * vignetteScale * vignettePulse, cx, cy, h * 0.9);
          vGrad.addColorStop(0, 'rgba(0,0,0,0)');
          vGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
          ctx.fillStyle = vGrad;
          ctx.fillRect(0,0,w,h);
          
          ctx.restore(); // Restore shake translation
        }
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [gameState]); // Only depends on gameState!

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getCountdownText = () => {
    if (currentTimeDisplay < -2) return "3";
    if (currentTimeDisplay < -1) return "2";
    if (currentTimeDisplay < 0) return "1";
    return "";
  };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden bg-black touch-none select-none font-sans"
    >
      <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none" />
      <div className="absolute inset-0 z-40 scanlines opacity-30 pointer-events-none"></div>

      {/* Character */}
      {(gameState === GameState.PLAYING || gameState === GameState.FINISHED) && (
        <div className="absolute inset-x-0 z-20 flex justify-center pointer-events-none" style={{ top: `${HIT_Y_PERCENT * 100}%`, marginTop: '-150px' }}>
           <GameCharacter 
             isHit={isHitFrame} 
             isFinished={gameState === GameState.FINISHED} 
           />
        </div>
      )}

      {/* COUNTDOWN OVERLAY */}
      {gameState === GameState.PLAYING && currentTimeDisplay < 0 && (
         <div className="absolute inset-0 z-50 flex items-center justify-center flex-col pointer-events-none">
            <div className="text-white/20 font-['Black_Ops_One'] text-6xl tracking-[1em] mb-8 animate-pulse">GET READY</div>
            <div className="text-9xl font-['Black_Ops_One'] text-cyan-400 drop-shadow-[0_0_50px_rgba(34,211,238,0.8)] scale-150 transition-all duration-75">
               {getCountdownText()}
            </div>
         </div>
      )}

      {/* Ghost HUD */}
      {gameState === GameState.PLAYING && currentTimeDisplay >= 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none mix-blend-plus-lighter">
           <div className="flex flex-col items-center justify-center transform translate-y-[-50px]">
              
              <div 
                key={triggerPulse} 
                className={`text-9xl font-black italic tracking-tighter transition-all duration-300 ${isHitFrame ? 'animate-pulse-beat' : ''} ${tier === 3 ? 'glitch-text' : ''}`}
                style={{
                  color: tier === 0 ? 'rgba(255,255,255,0.1)' : 
                         tier === 1 ? '#22d3ee' : 
                         tier === 2 ? '#fbbf24' : '#d946ef',
                  opacity: tier === 0 ? 0.3 : 0.9,
                  textShadow: tier > 0 ? `0 0 ${tier * 20}px currentColor` : 'none',
                  WebkitTextStroke: tier === 3 ? '1px white' : 'none'
                }}
              >
                {combo}
              </div>
              
              <div className="text-white/50 text-xl font-bold tracking-[0.5em] mt-[-10px]">COMBO</div>

              {/* Enhanced Heat Gauge */}
              <div 
                 className={`w-96 h-3 bg-gray-900 rounded-full mt-6 overflow-hidden border border-white/10 transition-all duration-300 ${
                     heat > 80 ? 'shadow-[0_0_30px_#d946ef] border-white/80 scale-105 animate-pulse' : 'shadow-[0_0_10px_black]'
                 }`}
              >
                 <div 
                    className="h-full transition-all duration-150 ease-out relative"
                    style={{
                       width: `${heat}%`,
                       background: heat > 80 
                         ? `linear-gradient(90deg, #fbbf24, #ef4444, #d946ef, #ffffff)`
                         : `linear-gradient(90deg, #22d3ee, #d946ef)`,
                       boxShadow: heat > 80 ? `0 0 25px white` : `0 0 10px #d946ef`
                    }}
                 >
                    {/* Overdrive Sparkles */}
                    {heat > 80 && (
                        <div className="absolute inset-0 w-full animate-pulse bg-white/50 mix-blend-overlay"></div>
                    )}
                 </div>
              </div>
              
              {/* Overdrive Label */}
              <div className={`mt-2 text-xs font-black tracking-[0.5em] transition-opacity duration-300 ${heat > 80 ? 'opacity-100 text-fuchsia-400 animate-pulse' : 'opacity-0'}`}>
                  OVERDRIVE
              </div>

              <div className="mt-8 text-2xl font-mono text-white/40 font-bold">
                 SCORE: {score.toLocaleString()}
              </div>
           </div>
        </div>
      )}

      <FloatingTextManager texts={textRef.current} />

      {/* Setup Screen (Updated to Simplified Chinese) */}
      {gameState === GameState.SETUP && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
          <div className="max-w-md w-full bg-zinc-900/90 p-8 rounded-3xl shadow-[0_0_100px_rgba(6,182,212,0.3)] border border-white/10">
            <div className="text-center mb-6">
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 to-purple-500 mb-2 font-['Black_Ops_One'] drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                TRINITY<br/>BEAT
              </h1>
              <h2 className="text-xl text-white/70 font-bold tracking-[0.5em] uppercase">光环 · 节奏</h2>
            </div>

            <div className="flex justify-between text-xs font-mono text-cyan-500/60 mb-8 border-y border-white/5 py-3 px-2">
                <span>[A] 左轨</span>
                <span>[空格] 中轨</span>
                <span>[D] 右轨</span>
            </div>
            
            <div className="space-y-6">
              {/* Demo Section */}
              <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 p-1 rounded-xl group relative overflow-hidden">
                <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <button 
                  onClick={loadDemo}
                  className="relative w-full py-4 bg-black/40 rounded-lg font-black text-xl text-white hover:text-cyan-200 transition-all active:scale-95 flex items-center justify-center gap-3 border border-cyan-500/30 hover:border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.2)]"
                >
                  <span className="animate-pulse">▶</span> 快速体验 (DEMO)
                </button>
                <p className="text-center text-cyan-300/50 text-[10px] mt-2 pb-1 font-mono">体验自动生成的合成波三轨谱面</p>
              </div>

              {/* Custom Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="flex-shrink-0 mx-4 text-zinc-600 text-[10px] font-bold tracking-widest">自定义模式</span>
                <div className="flex-grow border-t border-zinc-800"></div>
              </div>

              {/* Input Section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1 tracking-wider">上传音乐文件</label>
                  <input 
                    type="file" 
                    accept="audio/*" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-zinc-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-xs file:font-bold
                      file:bg-zinc-800 file:text-cyan-300
                      hover:file:bg-zinc-700
                      cursor-pointer bg-black/50 rounded-lg border border-white/5"
                  />
                  {isFileLoaded && <p className="text-cyan-400 text-[10px] mt-1 font-mono ml-1">✓ 音频已加载</p>}
                </div>

                <div>
                  <div className="flex justify-between items-end mb-1">
                      <label className="block text-[10px] font-bold text-zinc-500 tracking-wider">谱面数据 (JSON)</label>
                      <button 
                        onClick={handleAutoGenerate}
                        disabled={!isFileLoaded}
                        className="text-[10px] bg-cyan-900/30 hover:bg-cyan-800/50 text-cyan-300 px-3 py-1 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono border border-cyan-500/20"
                      >
                        ⚡ 自动生成
                      </button>
                  </div>
                  <textarea 
                    value={rawBeatsInput}
                    onChange={(e) => setRawBeatsInput(e.target.value)}
                    className="w-full h-16 bg-black/50 border border-zinc-800 rounded-lg p-3 text-[10px] text-green-500 font-mono focus:ring-1 focus:ring-cyan-500 outline-none resize-none transition-all"
                    placeholder='[{"time": 0.5, "lane": 0}, ...]'
                  />
                </div>

                <button 
                  onClick={() => startGame()}
                  className="w-full py-3 bg-zinc-800 rounded-lg font-bold text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 text-sm"
                  disabled={(!isFileLoaded && !audioService.isReady()) && !rawBeatsInput}
                >
                  开始游戏
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finished Screen (Updated to Simplified Chinese) */}
      {gameState === GameState.FINISHED && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl">
          <div className="text-center animate-bounce-in relative">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-purple-500 blur-3xl opacity-20"></div>
            <h2 className="text-7xl font-black text-white mb-2 tracking-tighter italic" style={{textShadow: '0 0 30px rgba(255,255,255,0.5)'}}>COMPLETE</h2>
            <div className="text-xl text-white/50 tracking-[1em] mb-8 font-bold">演奏完成</div>
            
            <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 mb-8 drop-shadow-2xl font-['Black_Ops_One']">
               {score.toLocaleString()}
            </div>
            
            <div className="flex gap-4 justify-center relative z-10">
              <button 
                onClick={() => setGameState(GameState.SETUP)}
                className="px-8 py-3 bg-zinc-800 text-white font-bold rounded-full hover:bg-zinc-700 transition-colors border border-white/10"
              >
                主菜单
              </button>
              <button 
                onClick={() => {
                   setGameState(GameState.PLAYING);
                   setScore(0);
                   setCombo(0);
                   setHeat(0);
                   audioService.play(3.0); 
                   beatsRef.current.forEach(b => { b.hit = false; b.missed = false; });
                   // Reset Refs again just in case
                   comboRef.current = 0;
                   scoreRef.current = 0;
                   heatRef.current = 0;
                }}
                className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-all shadow-[0_0_20px_white]"
              >
                重玩
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
