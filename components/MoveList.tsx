import React, { useEffect, useRef } from 'react';
import { ScrollText, Download, Star, AlertCircle, AlertTriangle } from 'lucide-react';

interface MoveListProps {
  moves: string[];
  moveQualities?: Record<number, 'best' | 'good' | 'mistake' | 'blunder'>;
}

const MoveList: React.FC<MoveListProps> = ({ moves, moveQualities = {} }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves]);

  // Group moves into pairs (White, Black)
  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      index: Math.floor(i / 2) + 1,
      white: moves[i],
      whiteIdx: i,
      black: moves[i + 1] || '',
      blackIdx: i + 1,
    });
  }

  const handleDownloadPgn = () => {
    if (moves.length === 0) return;

    let pgn = "";
    movePairs.forEach(pair => {
      pgn += `${pair.index}. ${pair.white} ${pair.black} `;
    });

    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `game-${new Date().toISOString().slice(0, 10)}.pgn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderMoveCell = (move: string, idx: number) => {
    if (!move) return null;
    const quality = moveQualities[idx];
    
    return (
        <div className="flex items-center space-x-1.5 relative group/cell">
            <span>{move}</span>
            {quality === 'best' && (
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 animate-pulse" />
            )}
            {quality === 'blunder' && (
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 fill-red-500/20" />
            )}
            {quality === 'mistake' && (
                <AlertCircle className="w-3 h-3 text-orange-400" />
            )}
        </div>
    );
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col h-full overflow-hidden shadow-lg">
      <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ScrollText className="w-5 h-5 text-emerald-400" />
          <h2 className="font-bold text-white">Move History</h2>
        </div>
        <button 
          onClick={handleDownloadPgn}
          disabled={moves.length === 0}
          className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Save Game (PGN)"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent"
      >
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 sticky top-0">
            <tr>
              <th className="px-4 py-2 w-16">#</th>
              <th className="px-4 py-2">White</th>
              <th className="px-4 py-2">Black</th>
            </tr>
          </thead>
          <tbody>
            {movePairs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500 italic">
                  Game hasn't started yet
                </td>
              </tr>
            ) : (
              movePairs.map((pair) => (
                <tr key={pair.index} className="border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-2 text-slate-500 font-mono">{pair.index}.</td>
                  <td className="px-4 py-2 text-slate-200 font-medium">
                      {renderMoveCell(pair.white, pair.whiteIdx)}
                  </td>
                  <td className="px-4 py-2 text-slate-200 font-medium">
                      {renderMoveCell(pair.black, pair.blackIdx)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MoveList;