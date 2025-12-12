export type PlayerColor = 'w' | 'b';

export type Language = 'en' | 'zh';

export type AiStyle = 'balanced' | 'aggressive';

export interface GameSettings {
  language: Language;
  timeControl: number; // in seconds
  aiStyle: AiStyle;
}

export interface GameState {
  fen: string;
  turn: PlayerColor;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  history: string[];
}

export interface MoveData {
  from: string;
  to: string;
  promotion?: string;
}

export interface CoachResponse {
  advice: string;
  analysis: string;
}

export interface EngineEvaluation {
  type: 'cp' | 'mate';
  value: number;
}

export interface EngineLine {
  id?: number;
  move: string;
  evaluation: EngineEvaluation;
}

export interface EngineResponse {
  best_move: string;
  evaluation: EngineEvaluation;
  depth: number;
  // Optional array if API returns multiple lines (MultiPV)
  top_lines?: EngineLine[]; 
  continuation?: string[]; 
}

export interface Arrow {
  from: string;
  to: string;
  color: string;
}

// Opening Explorer Types
export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating: number;
}

export interface OpeningStats {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening?: {
    eco: string;
    name: string;
  };
}