
import React from 'react';

interface StartScreenProps {
  onStart: () => void;
  onSpectate: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart, onSpectate }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-900 text-white font-sans">
      <div className="text-center p-8 bg-gray-800 rounded-lg shadow-2xl">
        <h1 className="text-4xl md:text-6xl font-bold tracking-wider mb-4">
          Political World Game
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-8">
          A real-time political simulation.
        </p>
        <div className="flex gap-4 justify-center">
            <button
              onClick={onStart}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xl transition-transform transform hover:scale-105"
            >
              Start Game
            </button>
            <button
              onClick={onSpectate}
              className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xl transition-transform transform hover:scale-105"
            >
              Spectator Mode
            </button>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
