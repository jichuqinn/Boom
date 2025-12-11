import React from 'react';
import { FloatingText } from '../types';

interface FloatingTextManagerProps {
  texts: FloatingText[];
}

const FloatingTextManager: React.FC<FloatingTextManagerProps> = ({ texts }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {texts.map((item) => (
        <div
          key={item.id}
          className="absolute text-center flex flex-col items-center justify-center"
          style={{
            left: item.x,
            top: item.y,
            transform: `translate(-50%, -50%) scale(${item.scale}) translateY(${-100 * (1 - item.opacity)}px)`,
            opacity: item.opacity,
            transition: 'transform 0.1s linear, opacity 0.1s linear',
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
      ))}
    </div>
  );
};

export default FloatingTextManager;
