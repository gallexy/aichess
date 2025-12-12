import { EngineResponse, EngineLine } from '../types';

// Strategy:
// 1. Primary: stockfish.gallexy.dev (User Custom Server - Supports variations/MultiPV)
// 2. Secondary: chess-api.com (Reliable fallback)
// 3. Tertiary: stockfish.online (Public fallback)

const PRIMARY_API_URL = 'https://stockfish.gallexy.dev/api/best-move';
const SECONDARY_API_URL = 'https://chess-api.com/v1';
const TERTIARY_API_URL = 'https://stockfish.online/api/s/v2.php';

export const getBestMove = async (fen: string, depth: number = 15, multipv: number = 3): Promise<EngineResponse> => {
  // 1. Attempt Custom API (Primary)
  try {
    return await fetchCustomAPI(fen, depth, multipv);
  } catch (e) {
    console.warn("Primary API failed, switching to Secondary (Chess API)...", e);
  }

  // 2. Attempt Chess API (Secondary)
  try {
    // Chess API doesn't support MultiPV well, returns 1 line usually
    return await fetchChessApiCom(fen, depth);
  } catch (e) {
    console.warn("Secondary API failed, switching to Tertiary (Stockfish Online)...", e);
  }

  // 3. Attempt Stockfish Online (Tertiary)
  try {
    return await fetchStockfishOnline(fen, depth, multipv);
  } catch (e) {
    console.error("All engine services failed:", e);
  }

  throw new Error("Engine calculation failed. Please check your internet connection.");
};

// --- Implementation 1: Custom API (Primary) ---
const fetchCustomAPI = async (fen: string, depth: number, multipv: number): Promise<EngineResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); 

  try {
    const response = await fetch(PRIMARY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fen, depth, multipv: multipv }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Custom API Error Status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.variations || !Array.isArray(data.variations)) {
        throw new Error("Invalid response format from Custom API (missing variations)");
    }

    const topLines: EngineLine[] = data.variations.map((v: any) => {
        let type: 'cp' | 'mate' = 'cp';
        let value = 0;

        if (v.score_type === 'mate') {
            type = 'mate';
            value = v.score;
        } else {
            type = 'cp';
            // Custom server returns pawns (e.g. 0.34), convert to centipawns (34)
            value = Math.round(v.score * 100);
        }

        return {
            id: v.rank,
            move: v.move,
            evaluation: { type, value }
        };
    });

    if (topLines.length === 0) throw new Error("No variations returned from Custom API");

    return {
        best_move: data.best_move || topLines[0].move,
        evaluation: topLines[0].evaluation,
        depth: data.depth,
        top_lines: topLines
    };

  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// --- Implementation 2: chess-api.com (Secondary) ---
const fetchChessApiCom = async (fen: string, depth: number): Promise<EngineResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(SECONDARY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // chess-api.com standard body.
        body: JSON.stringify({ fen, depth: Math.min(depth, 30) }),
        signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Chess API Error: ${response.status}`);
    const data = await response.json();

    if (!data.move) throw new Error("Invalid response from Chess API");

    let type: 'cp' | 'mate' = 'cp';
    let value = 0;

    if (data.mate !== null && data.mate !== undefined) {
        type = 'mate';
        value = data.mate;
    } else {
        type = 'cp';
        value = Math.round(data.eval || 0);
    }

    const line: EngineLine = {
        id: 1,
        move: data.move,
        evaluation: { type, value }
    };

    return {
        best_move: data.move,
        evaluation: { type, value },
        depth: data.depth || depth,
        top_lines: [line],
        continuation: data.continuation || []
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// --- Implementation 3: stockfish.online (Tertiary) ---
const fetchStockfishOnline = async (fen: string, depth: number, multipv: number): Promise<EngineResponse> => {
  const safeDepth = Math.min(depth, 12); 
  const url = `${TERTIARY_API_URL}?fen=${encodeURIComponent(fen)}&depth=${safeDepth}&mode=lines`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Stockfish Online HTTP Error: ${response.status}`);

  const data = await response.json();
  
  if (!data.lines || !Array.isArray(data.lines)) {
      return fetchStockfishOnlineSimple(fen, safeDepth);
  }

  const topLines: EngineLine[] = [];
  data.lines.slice(0, multipv).forEach((item: any, index: number) => {
      const move = cleanMove(item.move);
      if (!move) return;
      const evaluation = parseScoreStandard(item.score);
      topLines.push({ id: index + 1, move, evaluation });
  });

  if (topLines.length === 0) throw new Error("No lines returned from Stockfish Online");

  return {
      best_move: topLines[0].move,
      evaluation: topLines[0].evaluation,
      depth: safeDepth,
      top_lines: topLines
  };
};

const fetchStockfishOnlineSimple = async (fen: string, depth: number): Promise<EngineResponse> => {
     const url = `${TERTIARY_API_URL}?fen=${encodeURIComponent(fen)}&depth=${depth}&mode=bestmove`;
     const response = await fetch(url);
     const data = await response.json();
     if(!data.success || !data.data) throw new Error("Stockfish Online Simple failed");
     
     const move = cleanMove(data.data);
     
     return {
         best_move: move,
         evaluation: { type: 'cp', value: 0 }, 
         depth: depth,
         top_lines: [{ id: 1, move, evaluation: { type: 'cp', value: 0 } }]
     };
}

// --- Helpers ---
const cleanMove = (rawMove: string): string => {
    if (!rawMove) return "";
    let clean = rawMove.trim();
    if (clean.startsWith('bestmove ')) {
        clean = clean.replace('bestmove ', '').trim();
    }
    return clean.split(' ')[0];
};

const parseScoreStandard = (score: any): { type: 'cp' | 'mate', value: number } => {
    if (typeof score === 'string') {
        const lower = score.toLowerCase();
        if (lower.includes('mate')) {
            const val = parseInt(lower.replace('mate', '').trim(), 10);
            return { type: 'mate', value: isNaN(val) ? 0 : val };
        }
        if (lower.includes('cp')) {
            const val = parseFloat(lower.replace('cp', '').trim());
            return { type: 'cp', value: isNaN(val) ? 0 : val };
        }
        const val = parseFloat(score);
        if (!isNaN(val)) return { type: 'cp', value: val };
    }
    if (typeof score === 'number') return { type: 'cp', value: score };
    return { type: 'cp', value: 0 };
};