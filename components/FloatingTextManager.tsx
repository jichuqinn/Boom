import React, { useMemo } from 'react';
import { FloatingText } from '../types';

interface FloatingTextManagerProps {
  texts: FloatingText[];
}

const FloatingTextManager: React.FC<FloatingTextManagerProps> = React.memo(({ texts }) => {
  // Memoize text elements to avoid unnecessary re-renders
  const textElements = useMemo(() => {
    return texts.map((item) => (
      <div
        key={item.id}
        className="absolute text-center flex flex-col items-center justify-center"
        style={{
          left: item.x,
          top: item.y,
          transform: `translate(-50%, -50%) scale(${item.scale}) translateY(${-100 * (1 - item.opacity)}px)`,
          opacity: item.opacity,
          willChange: 'transform, opacity', // Hint browser for optimization
        }}
      >
        <span
          className="font-['Black_Ops_One'] text-6xl text-stroke tracking-wider bloom-text"
          style={{
            color: item.color,
            WebkitTextStroke: '2px black',
            textShadow: `0 0 20px ${item.color}`,
          }}
        >
          {item.text}
        </span>
      </div>
    ));
  }, [texts]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {textElements}
    </div>
  );
});

FloatingTextManager.displayName = 'FloatingTextManager';

export default FloatingTextManager;
