import React from 'react';

interface GameCharacterProps {
  isHit: boolean;
  isFinished: boolean;
}

const GameCharacter: React.FC<GameCharacterProps> = React.memo(({ isHit, isFinished }) => {
  const baseClasses = "relative transition-all duration-75 ease-out";
  const scaleClass = isFinished 
    ? "scale-[2] -translate-y-20" 
    : isHit 
      ? "scale-110 brightness-125 translate-y-2" 
      : "scale-100";

  return (
    <div className={`pointer-events-none ${baseClasses} ${scaleClass}`}>
      {/* Glow Aura */}
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-3xl transition-opacity duration-100 ${isHit ? 'bg-cyan-500 opacity-60' : 'bg-blue-600 opacity-20'}`}></div>

      {/* Core Body */}
      <div className={`relative w-24 h-24 rounded-full border-4 border-white flex items-center justify-center overflow-hidden bg-cyan-600 shadow-[0_0_30px_#06b6d4]`}>
          {/* Eyes */}
          <div className="flex gap-3 mt-[-4px]">
            <div className={`w-3 h-6 bg-black rounded-full transition-all duration-75 ${isHit ? 'h-2 scale-x-125' : 'h-6'}`}></div>
            <div className={`w-3 h-6 bg-black rounded-full transition-all duration-75 ${isHit ? 'h-2 scale-x-125' : 'h-6'}`}></div>
          </div>
          
          {/* Mouth (appears on hit) */}
          <div className={`absolute bottom-5 w-4 h-2 bg-black rounded-full transition-all duration-75 ${isHit ? 'opacity-100 scale-150' : 'opacity-0 scale-0'}`}></div>
      </div>
      
      {/* Headphones */}
      <div className="absolute top-[-10px] left-[-10px] w-[116px] h-12 border-8 border-slate-800 rounded-t-full z-10"></div>
      <div className="absolute top-6 left-[-16px] w-8 h-12 bg-slate-700 rounded-lg z-0"></div>
      <div className="absolute top-6 right-[-16px] w-8 h-12 bg-slate-700 rounded-lg z-0"></div>

      {/* Burst Effect for Finale */}
      {isFinished && (
        <div className="absolute inset-0 flex items-center justify-center z-[-1]">
            <div className="absolute w-[800px] h-[800px] bg-white opacity-20 blur-3xl animate-pulse"></div>
        </div>
      )}
    </div>
  );
});

GameCharacter.displayName = 'GameCharacter';

export default GameCharacter;
