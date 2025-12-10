import React, { useState, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from './components/ChessBoard';
import Timer from './components/Timer';
import MoveList from './components/MoveList';
import AICoach from './components/AICoach';
import { RotateCcw, Trophy, AlertTriangle } from 'lucide-react';
import { Arrow } from './types';

// Sound utility using Web Audio API to avoid external assets
const playMoveSound = (isCapture: boolean = false, isCheck: boolean = false) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    
    // Main oscillator for the "body" of the sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isCheck) {
      // High pitch "ding" for check
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t); // A5
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.3);
      
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (isCapture) {
      // Sharper, higher pitch "snap" for capture
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      
      osc.start(t);
      osc.stop(t + 0.1);
    } else {
      // Lower, woody "thud" for normal move
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);
      
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      
      osc.start(t);
      osc.stop(t + 0.15);
    }
  } catch (e) {
    console.error("Failed to play sound", e);
  }
};

const App: React.FC = () => {
  // Game State
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  // Used to force-reset components like Timer on new game
  const [gameId, setGameId] = useState(0);
  
  // Status State
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [isGameOver, setIsGameOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Game Start");

  // Analysis State
  const [arrows, setArrows] = useState<Arrow[]>([]);

  // Timer Handlers
  const handleTimeout = useCallback(() => {
    setIsGameOver(true);
    setStatusMessage(turn === 'w' ? "White ran out of time! Black wins." : "Black ran out of time! White wins.");
  }, [turn]);

  const resetGame = () => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setMoveHistory([]);
    setTurn('w');
    setIsGameOver(false);
    setStatusMessage("New Game Started");
    setArrows([]); // Clear arrows on reset
    setGameId(prev => prev + 1); // Force reset timers
  };

  const onMove = (source: string, target: string): boolean => {
    if (isGameOver) return false;

    try {
      const move = chessRef.current.move({
        from: source,
        to: target,
        promotion: 'q', 
      });

      if (move) {
        // Play sound effect based on move type
        const isCapture = !!move.captured;
        const isCheck = chessRef.current.inCheck();
        playMoveSound(isCapture, isCheck);

        setFen(chessRef.current.fen());
        setMoveHistory(chessRef.current.history());
        setTurn(chessRef.current.turn());
        setArrows([]); // Clear arrows when user moves
        
        // Check game status
        if (chessRef.current.isCheckmate()) {
          setIsGameOver(true);
          setStatusMessage(`Checkmate! ${chessRef.current.turn() === 'w' ? 'Black' : 'White'} wins!`);
        } else if (chessRef.current.isDraw()) {
          setIsGameOver(true);
          setStatusMessage("Game Draw!");
        } else if (chessRef.current.inCheck()) {
          setStatusMessage("Check!");
        } else {
          setStatusMessage("");
        }
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 py-4 px-6 shadow-md z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Grandmaster AI Tutor
            </h1>
          </div>
          
          <button 
            onClick={resetGame}
            className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-all border border-slate-600"
          >
            <RotateCcw className="w-4 h-4" />
            <span>New Game</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Board & Timers */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col items-center space-y-6">
          
          {/* Status Bar */}
          <div className="w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 flex justify-between items-center shadow-lg">
            <Timer 
              key={`timer-black-${gameId}`}
              label="Black" 
              initialTimeSeconds={600} 
              isActive={!isGameOver && turn === 'b'} 
              onTimeout={handleTimeout} 
            />
            
            <div className="text-center px-4">
               {statusMessage && (
                 <div className="flex items-center space-x-2 text-amber-400 font-bold animate-pulse">
                   <AlertTriangle className="w-5 h-5" />
                   <span>{statusMessage}</span>
                 </div>
               )}
            </div>

            <Timer 
              key={`timer-white-${gameId}`}
              label="White" 
              initialTimeSeconds={600} 
              isActive={!isGameOver && turn === 'w'} 
              onTimeout={handleTimeout} 
            />
          </div>

          {/* Chess Board */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <ChessBoard game={chessRef.current} onMove={onMove} arrows={arrows} />
          </div>

          {/* Mobile Only History (Hidden on LG) */}
          <div className="lg:hidden w-full h-64">
            <MoveList moves={moveHistory} />
          </div>
        </div>

        {/* Right Column: History & AI Coach */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col space-y-6 h-[calc(100vh-140px)] sticky top-6">
          
          {/* Move History */}
          <div className="flex-1 min-h-[200px] max-h-[40%]">
             <MoveList moves={moveHistory} />
          </div>

          {/* AI Coach */}
          <div className="flex-[1.5] min-h-[300px]">
            <AICoach 
              fen={fen} 
              turn={turn} 
              history={moveHistory} 
              onAnalysisUpdate={setArrows} 
            />
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;