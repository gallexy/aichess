import React, { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { Arrow } from '../types';

interface ChessBoardProps {
  game: Chess;
  onMove: (from: string, to: string) => boolean;
  orientation?: 'w' | 'b';
  arrows?: Arrow[];
}

// Standard SVG Chess Pieces (Cburnett style - similar to Lichess/Wikipedia)
const PIECE_IMAGES: Record<string, string> = {
  // White
  'wp': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
  'wn': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
  'wb': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
  'wr': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
  'wq': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
  'wk': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
  // Black
  'bp': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
  'bn': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
  'bb': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
  'br': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
  'bq': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
  'bk': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const ChessBoard: React.FC<ChessBoardProps> = ({ game, onMove, orientation = 'w', arrows = [] }) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  
  const board = game.board(); 
  const inCheck = game.inCheck();
  const turn = game.turn();

  // Determine last move directly from game history to support both human and AI moves
  const historyVerbose = game.history({ verbose: true });
  const lastMove = historyVerbose.length > 0 ? historyVerbose[historyVerbose.length - 1] : null;

  useEffect(() => {
    // Clear selection if game is reset
    if (game.history().length === 0) {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  }, [game]); 

  const getValidMoves = (square: string) => {
    const moves = game.moves({ square: square as Square, verbose: true });
    return moves.map(m => m.to);
  };

  const handleSquareClick = (square: string) => {
    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      }

      const success = onMove(selectedSquare, square);
      if (success) {
        // Move successful, selection clears. 
        // Last move highlighting is handled by the re-render with updated game prop.
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else {
        const piece = game.get(square as Square);
        if (piece && piece.color === game.turn()) {
          setSelectedSquare(square);
          setPossibleMoves(getValidMoves(square));
        } else {
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      }
    } else {
      const piece = game.get(square as Square);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        setPossibleMoves(getValidMoves(square));
      }
    }
  };

  // Rendering helpers
  const isDark = (rankIndex: number, fileIndex: number) => (rankIndex + fileIndex) % 2 === 1;

  const displayFiles = orientation === 'w' ? FILES : [...FILES].reverse();
  const displayRanks = orientation === 'w' ? RANKS : [...RANKS].reverse();

  // Helper to get coordinates for arrows (0-100%)
  const getSquareCenter = (square: string) => {
    const fileChar = square.charAt(0);
    const rankChar = square.charAt(1);
    
    const fileIndex = FILES.indexOf(fileChar);
    const rankIndex = RANKS.indexOf(rankChar); // 0 is rank 8

    // If orientation is white
    let x = fileIndex;
    let y = rankIndex;

    // If orientation is black, flip
    if (orientation === 'b') {
      x = 7 - x;
      y = 7 - y;
    }

    // Convert to percentage (center of square)
    // Grid is 8x8. 100/8 = 12.5% per square.
    // Center is +6.25%
    return {
      x: x * 12.5 + 6.25,
      y: y * 12.5 + 6.25
    };
  };

  return (
    // REMOVED max-w-[1125px], now relies on parent container.
    <div className="w-full aspect-square select-none shadow-2xl rounded-lg overflow-hidden border-4 border-[#b58863] relative">
      <div className="w-full h-full grid grid-cols-8 grid-rows-8 relative z-0">
        {displayRanks.map((rank, rIndex) => (
          displayFiles.map((file, fIndex) => {
            const square = `${file}${rank}` as Square;
            const piece = game.get(square);
            const isSelected = selectedSquare === square;
            const isPossibleMove = possibleMoves.includes(square);
            const isLastMoveFrom = lastMove?.from === square;
            const isLastMoveTo = lastMove?.to === square;
            const isKingInCheck = inCheck && piece?.type === 'k' && piece?.color === turn;

            let bgClass = isDark(rIndex, fIndex) ? 'bg-[#b58863]' : 'bg-[#f0d9b5]';
            if (isSelected) bgClass = 'bg-[#646f40]'; 
            else if (isLastMoveFrom || isLastMoveTo) bgClass = isDark(rIndex, fIndex) ? 'bg-[#aaa23a]' : 'bg-[#cdd26a]';
            if (isKingInCheck) bgClass = 'bg-red-500';

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(square)}
                className={`relative flex items-center justify-center cursor-pointer ${bgClass} transition-colors duration-75`}
              >
                {/* Labels */}
                {fIndex === 0 && (
                   <span className={`absolute left-0.5 top-0.5 text-[10px] sm:text-sm font-bold ${isDark(rIndex, fIndex) ? 'text-[#f0d9b5]' : 'text-[#b58863]'}`}>
                     {rank}
                   </span>
                )}
                {rIndex === 7 && (
                   <span className={`absolute right-0.5 bottom-0 text-[10px] sm:text-sm font-bold ${isDark(rIndex, fIndex) ? 'text-[#f0d9b5]' : 'text-[#b58863]'}`}>
                     {file}
                   </span>
                )}

                {/* Hints */}
                {isPossibleMove && !piece && (
                  <div className="absolute w-1/3 h-1/3 rounded-full bg-black/20 pointer-events-none" />
                )}
                {isPossibleMove && piece && (
                   <div className="absolute w-full h-full border-[6px] border-black/10 rounded-full pointer-events-none" />
                )}

                {/* Piece Image - INCREASED SIZE to w-full h-full with small padding */}
                {piece && (
                  <div className="w-full h-full p-0.5 flex items-center justify-center">
                    <img
                      src={PIECE_IMAGES[`${piece.color}${piece.type}`]}
                      alt={`${piece.color}${piece.type}`}
                      className="w-full h-full object-contain select-none transform transition-transform duration-100 hover:scale-110 z-10 drop-shadow-sm"
                      draggable={false}
                    />
                  </div>
                )}
              </div>
            );
          })
        ))}
      </div>

      {/* SVG Overlay for Arrows */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
        <defs>
          <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="currentColor" className="text-current" />
          </marker>
        </defs>
        {arrows.map((arrow, i) => {
          const start = getSquareCenter(arrow.from);
          const end = getSquareCenter(arrow.to);
          return (
            <g key={i} style={{ color: arrow.color }}>
              <line 
                x1={`${start.x}%`} 
                y1={`${start.y}%`} 
                x2={`${end.x}%`} 
                y2={`${end.y}%`} 
                stroke="currentColor" 
                strokeWidth="2.5%" 
                markerEnd="url(#arrowhead)" 
                opacity="0.8"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default ChessBoard;