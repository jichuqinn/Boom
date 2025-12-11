
export enum GameState {
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED'
}

export interface Beat {
  id: number;
  time: number;
  lane: number; // 0: Left, 1: Center, 2: Right
  hit: boolean;
  missed: boolean;
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  scale: number;
  opacity: number;
  createdAt: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Debris {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  deltaRotation: number;
  color: string;
  size: number;
  life: number;
}

export interface Shockwave {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  opacity: number;
}

export interface Nebula {
  id: number;
  x: number;
  y: number;
  radius: number;
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
}

export interface FloatingGeo {
  id: number;
  x: number; // 0-1 screen width
  y: number; // 0-1 screen height
  size: number;
  rotation: number;
  speed: number;
  shape: 'CUBE' | 'PYRAMID';
}
