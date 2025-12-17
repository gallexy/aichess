import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from './ChessBoard';
import Timer from './Timer';
import MoveList from './MoveList';
import AICoach from './AICoach';
import { RotateCcw, AlertTriangle, ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, ZoomIn, ZoomOut, Monitor, Plus, Minus, User, Bot } from 'lucide-react';
import { Arrow, PlayerColor, GameSettings } from '../types';
import { getBestMove } from '../services/engineService';
import { playMoveFeedback } from '../services/geminiService';

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

interface GameModeProps {
  settings: GameSettings;
}

const GameMode: React.FC<GameModeProps> = ({ settings }) => {
  const chessRef = useRef(new Chess());
  
  const [startFen, setStartFen] = useState(DEFAULT_FEN);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [gameId, setGameId] = useState(0);
  
  // Game State
  const [fen, setFen] = useState(DEFAULT_FEN);
  const [turn, setTurn] = useState<PlayerColor>('w');
  const [isGameOver, setIsGameOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [arrows, setArrows] = useState<Arrow[]>([]);
  
  // Move Quality Analysis (Index -> Quality)
  const [moveQualities, setMoveQualities] = useState<Record<number, 'best' | 'good' | 'mistake' | 'blunder'>>({});

  // Player vs AI State
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w');
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  // Board Size Control
  const [boardWidth, setBoardWidth] = useState(540);
  const handleZoomIn = () => setBoardWidth(prev => Math.min(prev + 50, 1200));
  const handleZoomOut = () => setBoardWidth(prev => Math.max(prev - 50, 300));

  // --- Translation Helper ---
  const t = (key: string) => {
    const dict: any = {
      en: {
        playWhite: "Play White",
        playBlack: "Play Black",
        white: "White",
        black: "Black",
        thinking: "Opponent is thinking...",
        selectSide: "Select Side to Start",
        checkmate: "Checkmate! $WINNER wins!",
        draw: "Game Draw!",
        check: "Check!",
        newGame: "New Game",
        whiteTimeout: "White ran out of time! Black wins.",
        blackTimeout: "Black ran out of time! White wins.",
        gameStarted: "Game Started",
      },
      zh: {
        playWhite: "执白棋",
        playBlack: "执黑棋",
        white: "白方",
        black: "黑方",
        thinking: "对手思考中...",
        selectSide: "请选择执棋方",
        checkmate: "将死！$WINNER 获胜！",
        draw: "和棋！",
        check: "将军！",
        newGame: "新游戏",
        whiteTimeout: "白方超时！黑方胜。",
        blackTimeout: "黑方超时！白方胜。",
        gameStarted: "游戏开始",
      }
    };
    return dict[settings.language][key] || key;
  };

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
      const winner = gameForDisplay.turn() === 'w' ? (settings.language === 'en' ? 'Black' : '黑方') : (settings.language === 'en' ? 'White' : '白方');
      setStatusMessage(t('checkmate').replace('$WINNER', winner));
    } else if (gameForDisplay.isDraw()) {
      setIsGameOver(true);
      setStatusMessage(t('draw'));
    } else if (gameForDisplay.inCheck()) {
      setStatusMessage(t('check'));
    } else if (moveHistory.length === 0) {
      setStatusMessage(t('selectSide'));
    } else {
      setStatusMessage("");
    }
  }, [gameForDisplay, settings.language]);

  // Auto-scroll
  useEffect(() => {
    setCurrentMoveIndex(moveHistory.length - 1);
  }, [moveHistory.length]);

  const onMove = (source: string, target: string, isAiMove: boolean = false): boolean => {
    if (isGameOver) return false;
    
    // Prevent player from moving AI pieces
    if (!isAiMove) {
       if (turn !== playerColor) return false;
       if (gameForDisplay.get(source as any)?.color !== playerColor) return false;
    }

    const fenBeforeMove = gameForDisplay.fen();
    const tempGame = new Chess(fenBeforeMove);
    
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
        const newMoveIndex = newHistory.length;
        newHistory.push(move.san);
        setMoveHistory(newHistory);
        
        // If it was the player's move, check if it was a good move in the background
        if (!isAiMove) {
            checkPlayerMoveQuality(fenBeforeMove, source, target, newMoveIndex, move.san);
        }

        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  };

  const checkPlayerMoveQuality = async (fen: string, from: string, to: string, moveIndex: number, moveSan: string) => {
      try {
          // Request top 10 lines
          const response = await getBestMove(fen, 10, 10);
          const topLines = response.top_lines || [];
          const bestMove = response.best_move;
          
          if (!topLines.length) return;

          const bestEval = topLines[0].evaluation.value;
          const bestEvalType = topLines[0].evaluation.type;
          
          const userMoveUci = from + to;
          
          const userLine = topLines.find(l => l.move.startsWith(userMoveUci));
          
          let quality: 'best' | 'good' | 'mistake' | 'blunder' = 'good';

          if (userLine) {
              if (userLine.move === bestMove || userLine.id === 1) {
                  quality = 'best';
              } else {
                  const userEval = userLine.evaluation.value;
                  const userEvalType = userLine.evaluation.type;
                  
                  if (bestEvalType === 'mate' && userEvalType !== 'mate') {
                      quality = 'blunder'; 
                  } else if (bestEvalType === userEvalType) {
                       const diff = Math.abs(bestEval - userEval);
                       if (diff > 200) quality = 'blunder'; 
                       else if (diff > 80) quality = 'mistake'; 
                       else quality = 'good';
                  }
              }
          } else {
              quality = 'blunder';
          }

          if (quality !== 'good') {
              setMoveQualities(prev => ({ ...prev, [moveIndex]: quality }));
              if (quality === 'best' || quality === 'blunder') {
                  playMoveFeedback(fen, moveSan, quality);
              }
          }
      } catch (e) {
          console.debug("Quick analysis failed", e);
      }
  };

  // AI Logic
  useEffect(() => {
    if (isGameOver || isAiThinking || turn === playerColor) return;
    
    let isCancelled = false;

    const makeAiMove = async () => {
        setIsAiThinking(true);
        setStatusMessage(t('thinking'));
        
        try {
            // "Aggressive": Picks top move (MultiPV=1)
            // "Balanced": Picks MultiPV=5, sorts by closest to 0 or keeps game complex without ruthless mating
            const multiPv = settings.aiStyle === 'aggressive' ? 1 : 5;
            const depth = settings.aiStyle === 'aggressive' ? 12 : 10;
            
            const response = await getBestMove(fen, depth, multiPv);
            
            if (isCancelled) return;

            if (response.top_lines && response.top_lines.length > 0) {
                let chosenMove = response.best_move;

                if (settings.aiStyle === 'balanced' && response.top_lines.length > 1) {
                     // Sort by "gentleness" - closer to 0 or keeping options open, avoiding rapid mate unless necessary
                     // For simplicity: balanced mode picks the move that isn't the absolute best but is still decent (e.g., 2nd or 3rd best)
                     // Or sorts by absolute value to find 0.
                     const lines = [...response.top_lines];
                     
                     // If we are crushing the player (> 300 CP), give them a chance by picking the 2nd or 3rd best move if available
                     // But don't pick a move that loses (< -100).
                     if (response.evaluation.value > 300 && response.evaluation.type === 'cp') {
                         const validSuboptimal = lines.filter(l => l.evaluation.type === 'cp' && l.evaluation.value > -50);
                         if (validSuboptimal.length > 1) {
                             chosenMove = validSuboptimal[1].move; // Pick 2nd best
                         }
                     }
                     // Otherwise default to best move if game is close
                } else {
                    // Aggressive: Always best move
                    chosenMove = response.best_move;
                }
                
                const from = chosenMove.substring(0, 2);
                const to = chosenMove.substring(2, 4);
                
                setTimeout(() => {
                   if (!isCancelled) {
                       onMove(from, to, true);
                       setIsAiThinking(false);
                   }
                }, 10000); // 10 second delay as requested
            } else {
                 if (!isCancelled) setIsAiThinking(false);
            }
        } catch (e) {
            if (!isCancelled) {
                console.error("AI Move failed", e);
                setIsAiThinking(false);
            }
        }
    };

    makeAiMove();

    return () => {
        isCancelled = true;
    };

  }, [turn, playerColor, isGameOver, fen, settings.aiStyle]);


  const handleTimeout = useCallback(() => {
    setIsGameOver(true);
    setStatusMessage(turn === 'w' ? t('whiteTimeout') : t('blackTimeout'));
  }, [turn, settings.language]);

  const resetGame = (color: PlayerColor) => {
    setPlayerColor(color);
    chessRef.current = new Chess();
    setStartFen(DEFAULT_FEN);
    setMoveHistory([]);
    setMoveQualities({});
    setCurrentMoveIndex(-1);
    setIsGameOver(false);
    setIsAiThinking(false); // Reset AI thinking state
    setStatusMessage(t('gameStarted'));
    setArrows([]);
    setGameId(prev => prev + 1);
  };

  // Navigation
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

        {/* Status Bar & Controls */}
        <div className="w-full max-w-2xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-3 flex flex-row justify-between items-start gap-2 shadow-lg relative overflow-hidden">
           
           {/* Left: Black Controls */}
           <div className="flex flex-col items-center gap-2 z-10 w-[140px]">
             <button 
                onClick={() => resetGame('b')}
                className={`flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all border shadow-sm text-[10px] font-bold uppercase tracking-wider w-full ${playerColor === 'b' ? 'bg-slate-600 border-slate-500 text-white ring-2 ring-slate-500/50' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
              >
                <Bot className="w-3 h-3" />
                <span>{t('playBlack')}</span>
             </button>
             {/* Key ensures timer resets when settings change */}
             <Timer key={`timer-b-${gameId}-${settings.timeControl}`} label={t('black')} initialTimeSeconds={settings.timeControl} isActive={!isGameOver && turn === 'b'} onTimeout={handleTimeout} variant="dark" />
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
                  <span>{t('newGame')}</span>
               </button>
           </div>

           {/* Right: White Controls */}
           <div className="flex flex-col items-center gap-2 z-10 w-[140px]">
             <button 
                onClick={() => resetGame('w')}
                className={`flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all border shadow-sm text-[10px] font-bold uppercase tracking-wider w-full ${playerColor === 'w' ? 'bg-emerald-700 border-emerald-500 text-white ring-2 ring-emerald-500/50' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
              >
                <User className="w-3 h-3" />
                <span>{t('playWhite')}</span>
             </button>
             <Timer key={`timer-w-${gameId}-${settings.timeControl}`} label={t('white')} initialTimeSeconds={settings.timeControl} isActive={!isGameOver && turn === 'w'} onTimeout={handleTimeout} variant="light" />
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
           <MoveList moves={moveHistory} moveQualities={moveQualities} />
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