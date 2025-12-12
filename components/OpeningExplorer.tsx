import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from './ChessBoard';
import { BookOpen, Undo2, RotateCcw, Monitor, Plus, Minus, Volume2 } from 'lucide-react';
import { getOpeningStats } from '../services/openingService';
import { speakOpeningInfo } from '../services/geminiService';
import { OpeningStats } from '../types';

const OpeningExplorer: React.FC = () => {
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [stats, setStats] = useState<OpeningStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  
  // Board Size Control
  const [boardWidth, setBoardWidth] = useState(540);
  
  const handleZoomIn = () => setBoardWidth(prev => Math.min(prev + 50, 1200));
  const handleZoomOut = () => setBoardWidth(prev => Math.max(prev - 50, 300));

  useEffect(() => {
    fetchStats();
  }, [fen]);

  const fetchStats = async () => {
    setLoading(true);
    const data = await getOpeningStats(fen);
    setStats(data);
    setLoading(false);
  };

  const handleSpeakOpening = () => {
      if (stats) {
          speakOpeningInfo(stats, fen);
      }
  };

  const onMove = (from: string, to: string) => {
    try {
      const move = chessRef.current.move({ from, to, promotion: 'q' });
      if (move) {
        setFen(chessRef.current.fen());
        setHistory(prev => [...prev, move.san]);
        return true;
      }
    } catch (e) { return false; }
    return false;
  };

  const handleManualMove = (san: string) => {
    try {
      const move = chessRef.current.move(san);
      if (move) {
        setFen(chessRef.current.fen());
        setHistory(prev => [...prev, move.san]);
      }
    } catch (e) { console.error(e); }
  };

  const undoMove = () => {
    chessRef.current.undo();
    setFen(chessRef.current.fen());
    setHistory(prev => prev.slice(0, -1));
  };

  const resetBoard = () => {
    chessRef.current.reset();
    setFen(chessRef.current.fen());
    setHistory([]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-6 max-w-[1800px] mx-auto w-full">
      {/* Left: Board. Expanded to col-span-8/9 */}
      <div className="lg:col-span-8 xl:col-span-9 flex flex-col items-center space-y-4">
        
         {/* Board Size Controls - Buttons */}
        <div className="w-full max-w-2xl flex justify-end px-1 gap-2">
            <button 
              onClick={handleZoomOut}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700 shadow-sm"
              title="Decrease Board Size"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex items-center px-2 bg-slate-900 rounded border border-slate-800 text-xs text-slate-500 font-mono">
              {Math.round((boardWidth/540)*100)}%
            </div>
            <button 
              onClick={handleZoomIn}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700 shadow-sm"
              title="Increase Board Size"
            >
              <Plus className="w-4 h-4" />
            </button>
        </div>

        {/* Header (FIXED WIDTH) */}
        <div className="w-full max-w-2xl flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700 transition-all duration-300">
           <div className="flex items-center space-x-2 text-blue-400">
             <BookOpen className="w-5 h-5" />
             <span className="font-bold">Opening Explorer</span>
           </div>
           <div className="flex space-x-2">
             <button onClick={undoMove} disabled={history.length === 0} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white disabled:opacity-30">
               <Undo2 className="w-4 h-4" />
             </button>
             <button onClick={resetBoard} disabled={history.length === 0} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white disabled:opacity-30">
               <RotateCcw className="w-4 h-4" />
             </button>
           </div>
        </div>
        
        {/* Board (DYNAMIC WIDTH) */}
        <div 
            style={{ maxWidth: `${boardWidth}px` }}
            className="relative group shadow-2xl w-full transition-all duration-300"
        >
          <ChessBoard game={chessRef.current} onMove={onMove} />
        </div>
        
        <div className="text-sm text-slate-400 font-mono">
           {history.length > 0 ? history.join(' ') : 'Start Position'}
        </div>
      </div>

      {/* Right: Stats. Reduced to col-span-4/3 */}
      <div className="lg:col-span-4 xl:col-span-3 flex flex-col h-[calc(100vh-140px)] bg-slate-800 rounded-xl border border-slate-700 overflow-hidden lg:sticky lg:top-6">
        
        {/* Header: Opening Name */}
        <div className="p-5 border-b border-slate-700 bg-slate-900/50 flex justify-between items-start">
           <div>
             <h2 className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Current Position</h2>
             {stats?.opening ? (
               <div>
                 <div className="text-2xl font-bold text-white mb-1">{stats.opening.eco}</div>
                 <div className="text-lg text-blue-300 leading-tight">{stats.opening.name}</div>
               </div>
             ) : (
               <div className="text-lg text-slate-500 italic">Uncommon or Custom Position</div>
             )}
           </div>
           
           <button 
             onClick={handleSpeakOpening}
             disabled={loading || !stats}
             className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-blue-400 hover:text-white transition-colors border border-slate-700 shadow-md disabled:opacity-30"
             title="Hear Opening Info"
           >
              <Volume2 className="w-5 h-5" />
           </button>
        </div>

        {/* Stats List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
             <div className="text-center py-10 text-slate-500 animate-pulse">Fetching opening data...</div>
          ) : stats && stats.moves.length > 0 ? (
            stats.moves.map((move, idx) => {
              const total = move.white + move.draws + move.black;
              const whitePct = (move.white / total) * 100;
              const drawPct = (move.draws / total) * 100;
              const blackPct = (move.black / total) * 100;

              return (
                <div 
                  key={move.san} 
                  onClick={() => handleManualMove(move.san)}
                  className="bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 cursor-pointer transition-colors group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors w-12">{move.san}</span>
                    <span className="text-xs text-slate-400">{total.toLocaleString()} games</span>
                  </div>
                  
                  {/* Bar Chart */}
                  <div className="h-3 w-full flex rounded-full overflow-hidden bg-slate-800">
                     <div style={{ width: `${whitePct}%` }} className="bg-emerald-500" title={`White Won: ${Math.round(whitePct)}%`} />
                     <div style={{ width: `${drawPct}%` }} className="bg-amber-400" title={`Draw: ${Math.round(drawPct)}%`} />
                     <div style={{ width: `${blackPct}%` }} className="bg-red-500" title={`Black Won: ${Math.round(blackPct)}%`} />
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1 font-mono">
                     <span>{Math.round(whitePct)}% W</span>
                     <span>{Math.round(drawPct)}% D</span>
                     <span>{Math.round(blackPct)}% B</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-slate-500">No Master/Lichess games found for this position.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpeningExplorer;