/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import FlowEditor from './components/FlowEditor';
import { clsx } from 'clsx';
import { BrainCircuit } from 'lucide-react';

function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 500); // Wait for fade out animation
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={clsx(
      "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#121212] text-white transition-opacity duration-500",
      isExiting ? "opacity-0 pointer-events-none" : "opacity-100"
    )}>
      <div className="relative flex items-center justify-center mb-6">
        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
        <BrainCircuit size={64} className="text-blue-500 animate-bounce" />
      </div>
      
      <h1 className="text-4xl font-bold mb-2 tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-700">
        FlowMind
      </h1>
      
      <p className="text-gray-400 text-sm font-medium tracking-widest uppercase animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
        Visual Note-Taking Reimagined
      </p>

      <div className="mt-8 w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 animate-[loading_2s_ease-in-out_infinite]" style={{ width: '50%' }} />
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    console.log('App mounted, isLoading:', isLoading);
  }, [isLoading]);

  return (
    <div className="w-screen h-screen bg-[#121212] text-white overflow-hidden">
      {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}
      <FlowEditor />
    </div>
  );
}
