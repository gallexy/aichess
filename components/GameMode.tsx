import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from './ChessBoard';
import Timer from './Timer';
import MoveList from './MoveList';
import AICoach from './AICoach';
import { RotateCcw, AlertTriangle, ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, ZoomIn, ZoomOut, Monitor, Plus, Minus, User, Bot } from 'lucide-react';
import { Arrow, PlayerColor } from '../types';
import { getBestMove } from '../services/engineService';

// Sound utility
const playMoveSound = (isCapture: boolean = false, isCheck: boolean = false) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isCheck) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.3);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (isCapture) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    } else {
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

const DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const GameMode: React.FC = () => {
  const chessRef = useRef(new Chess());
  
  const [startFen, setStartFen] = useState(DEFAULT_FEN);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [gameId, setGameId] = useState(0);
  
  // Game State
  const [fen, setFen] = useState(DEFAULT_FEN);
  const [turn, setTurn] = useState<PlayerColor>('w');
  const [isGameOver, setIsGameOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Select Side to Start");
  const [arrows, setArrows] = useState<Arrow[]>([]);
  
  // Player vs AI State
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w');
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  // Board Size Control
  const [boardWidth, setBoardWidth] = useState(540);
  const handleZoomIn = () => setBoardWidth(prev => Math.min(prev + 50, 1200));
  const handleZoomOut = () => setBoardWidth(prev => Math.max(prev - 50, 300));

  // --- Derived Game State ---
  const gameForDisplay = useMemo(() => {
    const g = new Chess(startFen);
    for (let i = 0; i <= currentMoveIndex; i++) {
        if (moveHistory[i]) {
            try { g.move(moveHistory[i]); } catch (e) { console.error("History replay error", e); }
        }
    }
    return g;
  }, [startFen, moveHistory, currentMoveIndex]);

  // Sync derived state
  useEffect(() => {
    setFen(gameForDisplay.fen());
    setTurn(gameForDisplay.turn());
    setArrows([]);

    if (gameForDisplay.isCheckmate()) {
      setIsGameOver(true);
      setStatusMessage(`Checkmate! ${gameForDisplay.turn() === 'w' ? 'Black' : 'White'} wins!`);
    } else if (gameForDisplay.isDraw()) {
      setIsGameOver(true);
      setStatusMessage("Game Draw!");
    } else if (gameForDisplay.inCheck()) {
      setStatusMessage("Check!");
    } else {
      setStatusMessage("");
    }
  }, [gameForDisplay]);

  // Auto-scroll
  useEffect(() => {
    setCurrentMoveIndex(moveHistory.length - 1);
  }, [moveHistory.length]);

  const onMove = (source: string, target: string, isAiMove: boolean = false): boolean => {
    if (isGameOver) return false;
    
    // Prevent player from moving AI pieces
    // If it's not an AI move, checks if it's player's turn and player's piece
    if (!isAiMove) {
       if (turn !== playerColor) return false;
       if (gameForDisplay.get(source as any)?.color !== playerColor) return false;
    }

    const tempGame = new Chess(gameForDisplay.fen());
    try {
      const move = tempGame.move({
        from: source,
        to: target,
        promotion: 'q', 
      });

      if (move) {
        const isCapture = !!move.captured;
        const isCheck = tempGame.inCheck();
        playMoveSound(isCapture, isCheck);

        const newHistory = moveHistory.slice(0, currentMoveIndex + 1);
        newHistory.push(move.san);
        setMoveHistory(newHistory);
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  };

  // AI Logic
  useEffect(() => {
    if (isGameOver || isAiThinking || turn === playerColor) return;
    
    // It is AI's turn
    const makeAiMove = async () => {
        setIsAiThinking(true);
        setStatusMessage("Opponent is thinking...");
        
        try {
            // Request 5 lines (multipv=5) to find a balanced move
            // Depth 10 for faster response
            const response = await getBestMove(fen, 10, 5);
            
            if (response.top_lines && response.top_lines.length > 0) {
                // Strategy: Find the move with evaluation closest to 0 (balanced)
                // sort by absolute value of evaluation
                const sortedLines = [...response.top_lines].sort((a, b) => {
                    // Treat mate scores as high numbers (e.g. 10000)
                    const valA = a.evaluation.type === 'mate' ? 10000 : Math.abs(a.evaluation.value);
                    const valB = b.evaluation.type === 'mate' ? 10000 : Math.abs(b.evaluation.value);
                    return valA - valB;
                });
                
                // Pick the most balanced move (index 0 after sort)
                const balancedMove = sortedLines[0].move;
                
                const from = balancedMove.substring(0, 2);
                const to = balancedMove.substring(2, 4);
                
                // Add small delay for realism
                setTimeout(() => {
                   onMove(from, to, true); // Pass true for isAiMove
                   setIsAiThinking(false);
                }, 800);
            } else {
                 // Fallback if no lines (should be rare)
                 setIsAiThinking(false);
            }
        } catch (e) {
            console.error("AI Move failed", e);
            setIsAiThinking(false);
        }
    };

    makeAiMove();

  }, [turn, playerColor, isGameOver, fen]);


  const handleTimeout = useCallback(() => {
    setIsGameOver(true);
    setStatusMessage(turn === 'w' ? "White ran out of time! Black wins." : "Black ran out of time! White wins.");
  }, [turn]);

  const resetGame = (color: PlayerColor) => {
    setPlayerColor(color);
    chessRef.current = new Chess();
    setStartFen(DEFAULT_FEN);
    setMoveHistory([]);
    setCurrentMoveIndex(-1);
    setIsGameOver(false);
    setStatusMessage("Game Started");
    setArrows([]);
    setGameId(prev => prev + 1);
  };

  // --- Navigation Controls ---
  const goToFirst = () => setCurrentMoveIndex(-1);
  const goToPrev = () => setCurrentMoveIndex(prev => Math.max(-1, prev - 1));
  const goToNext = () => setCurrentMoveIndex(prev => Math.min(moveHistory.length - 1, prev + 1));
  const goToLast = () => setCurrentMoveIndex(moveHistory.length - 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-6 max-w-[1800px] mx-auto w-full">
      {/* Left Column: Board */}
      <div className="lg:col-span-8 xl:col-span-9 flex flex-col items-center space-y-6">
        
        {/* Board Size Controls */}
        <div className="w-full max-w-2xl flex justify-end px-1 gap-2">
            <button onClick={handleZoomOut} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700 shadow-sm"><Minus className="w-4 h-4" /></button>
            <div className="flex items-center px-2 bg-slate-900 rounded border border-slate-800 text-xs text-slate-500 font-mono">{Math.round((boardWidth/540)*100)}%</div>
            <button onClick={handleZoomIn} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700 shadow-sm"><Plus className="w-4 h-4" /></button>
        </div>

        {/* Status Bar & Controls (New Layout) */}
        <div className="w-full max-w-2xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-3 flex flex-row justify-between items-start gap-2 shadow-lg relative overflow-hidden">
           
           {/* Left: Black Controls */}
           <div className="flex flex-col items-center gap-2 z-10 w-[140px]">
             <button 
                onClick={() => resetGame('b')}
                className={`flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all border shadow-sm text-[10px] font-bold uppercase tracking-wider w-full ${playerColor === 'b' ? 'bg-slate-600 border-slate-500 text-white ring-2 ring-slate-500/50' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
              >
                <Bot className="w-3 h-3" />
                <span>Play Black</span>
             </button>
             {/* Timer set to 900s (15 mins) */}
             <Timer key={`timer-b-${gameId}`} label="Black" initialTimeSeconds={900} isActive={!isGameOver && turn === 'b'} onTimeout={handleTimeout} variant="dark" />
           </div>

           {/* Center: Status & New Game */}
           <div className="flex-1 flex flex-col items-center justify-start pt-1 gap-3 z-10">
               <div className="flex items-center space-x-2 text-xs md:text-sm font-bold text-amber-400 animate-pulse text-center min-h-[20px]">
                   {statusMessage}
               </div>
               
               <button 
                  onClick={() => resetGame(playerColor)}
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-1.5 rounded-lg transition-all border border-indigo-400 shadow-lg hover:shadow-indigo-500/30 text-[10px] font-bold uppercase tracking-wider"
               >
                  <RotateCcw className="w-3 h-3" />
                  <span>New Game</span>
               </button>
           </div>

           {/* Right: White Controls */}
           <div className="flex flex-col items-center gap-2 z-10 w-[140px]">
             <button 
                onClick={() => resetGame('w')}
                className={`flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all border shadow-sm text-[10px] font-bold uppercase tracking-wider w-full ${playerColor === 'w' ? 'bg-emerald-700 border-emerald-500 text-white ring-2 ring-emerald-500/50' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
              >
                <User className="w-3 h-3" />
                <span>Play White</span>
             </button>
             {/* Timer set to 900s (15 mins) */}
             <Timer key={`timer-w-${gameId}`} label="White" initialTimeSeconds={900} isActive={!isGameOver && turn === 'w'} onTimeout={handleTimeout} variant="light" />
           </div>

           {/* Progress Bars */}
           <div className={`absolute bottom-0 left-0 h-1 transition-all duration-500 ${turn === 'b' ? 'w-full bg-slate-500' : 'w-0'}`}></div>
           <div className={`absolute bottom-0 right-0 h-1 transition-all duration-500 ${turn === 'w' ? 'w-full bg-emerald-500' : 'w-0'}`}></div>

        </div>

        {/* Chess Board */}
        <div 
          style={{ maxWidth: `${boardWidth}px` }}
          className="relative group shadow-2xl rounded-lg w-full transition-all duration-300"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <ChessBoard 
            game={gameForDisplay} 
            onMove={(from, to) => onMove(from, to, false)} 
            arrows={arrows} 
            orientation={playerColor} 
          />
        </div>
      </div>

      {/* Right Column: History & AI */}
      <div className="lg:col-span-4 xl:col-span-3 flex flex-col space-y-4 h-[calc(100vh-140px)] lg:sticky lg:top-6">
        <div className="flex-1 min-h-[200px]">
           <MoveList moves={moveHistory} />
        </div>

        <div className="flex items-center justify-center space-x-2 bg-slate-800 p-2 rounded-xl border border-slate-700 shadow-md shrink-0">
           <button onClick={goToFirst} disabled={currentMoveIndex === -1} className="p-3 hover:bg-slate-700 rounded-lg disabled:opacity-30 text-slate-300"><ChevronFirst className="w-5 h-5" /></button>
           <button onClick={goToPrev} disabled={currentMoveIndex === -1} className="p-3 hover:bg-slate-700 rounded-lg disabled:opacity-30 text-slate-300"><ChevronLeft className="w-5 h-5" /></button>
           <div className="px-4 py-2 min-w-[80px] text-center font-mono text-slate-400 font-bold text-sm bg-slate-900/50 rounded-lg border border-slate-700/50 mx-1">{currentMoveIndex + 1} / {moveHistory.length}</div>
           <button onClick={goToNext} disabled={currentMoveIndex >= moveHistory.length - 1} className="p-3 hover:bg-slate-700 rounded-lg disabled:opacity-30 text-slate-300"><ChevronRight className="w-5 h-5" /></button>
           <button onClick={goToLast} disabled={currentMoveIndex >= moveHistory.length - 1} className="p-3 hover:bg-slate-700 rounded-lg disabled:opacity-30 text-slate-300"><ChevronLast className="w-5 h-5" /></button>
        </div>

        <div className="flex-[1.5] min-h-[300px]">
          <AICoach fen={fen} turn={turn} history={moveHistory} onAnalysisUpdate={setArrows} />
        </div>
      </div>
    </div>
  );
};

export default GameMode;