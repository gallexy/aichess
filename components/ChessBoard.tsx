import React, { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { Arrow } from '../types';

interface ChessBoardProps {
  game: Chess;
  onMove: (from: string, to: string) => boolean;
  orientation?: 'w' | 'b';
  arrows?: Arrow[];
}

const PIECE_SYMBOLS: Record<string, string> = {
  'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
  'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const ChessBoard: React.FC<ChessBoardProps> = ({ game, onMove, orientation = 'w', arrows = [] }) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{from: string, to: string} | null>(null);
  
  const board = game.board(); 
  const inCheck = game.inCheck();
  const turn = game.turn();

  useEffect(() => {
    if (game.history().length === 0) {
      setLastMove(null);
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
        setLastMove({ from: selectedSquare, to: square });
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
    <div className="w-full max-w-[600px] aspect-square select-none shadow-2xl rounded-lg overflow-hidden border-4 border-[#b58863] relative">
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
                   <span className={`absolute left-0.5 top-0.5 text-[10px] font-bold ${isDark(rIndex, fIndex) ? 'text-[#f0d9b5]' : 'text-[#b58863]'}`}>
                     {rank}
                   </span>
                )}
                {rIndex === 7 && (
                   <span className={`absolute right-0.5 bottom-0 text-[10px] font-bold ${isDark(rIndex, fIndex) ? 'text-[#f0d9b5]' : 'text-[#b58863]'}`}>
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

                {/* Piece */}
                {piece && (
                  <span 
                    className={`
                      text-5xl sm:text-6xl leading-none select-none drop-shadow-md transform transition-transform duration-100 hover:scale-110 z-10
                      ${piece.color === 'w' ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-black drop-shadow-[0_2px_2px_rgba(255,255,255,0.5)]'}
                    `}
                    style={{ 
                      filter: piece.color === 'b' ? 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))'
                    }}
                  >
                    {PIECE_SYMBOLS[piece.color === 'w' ? piece.type.toUpperCase() : piece.type]}
                  </span>
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