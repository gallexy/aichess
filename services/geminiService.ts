import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing from environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// --- Main Analysis Function (Quick Advice for Play Mode) ---
export const getChessAdvice = async (
  fen: string, 
  turn: 'w' | 'b', 
  history: string[], 
  bestMove?: string, 
  evaluation?: string
): Promise<string> => {
  const client = getClient();
  if (!client) return "API Key unavailable. Cannot consult the AI Coach.";

  const prompt = `
    You are a friendly chess Grandmaster tutor, specifically coaching beginners and intermediate players.
    
    Current Position (FEN): ${fen}
    Current Turn: ${turn === 'w' ? 'White' : 'Black'}
    Recent History: ${history.slice(-5).join(', ')}
    ${bestMove ? `Engine Best Move Recommendation: ${bestMove}` : ''}
    ${evaluation ? `Current Evaluation (CP/Mate): ${evaluation}` : ''}

    Please provide the following in **English**:
    1. **Situation Brief**: A concise analysis of the current position (who has the advantage and why).
    2. **Best Move Explanation**: ${bestMove 
      ? `Explain why **${bestMove}** is the best move here. What strategic goal does it achieve? (e.g., controlling center, tactical combination, defending a threat, improving piece activity).` 
      : 'Give a strategic tip or suggest a good move.'}
    3. **Summary**: Keep it concise (under 100 words) and encouraging.

    Output using Markdown format.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful chess tutor.",
      }
    });

    return response.text || "The coach is thinking but cannot provide advice right now...";
  } catch (error) {
    console.error("Error fetching chess advice:", error);
    return "AI Coach is currently unavailable. Please try again later.";
  }
};

// --- Deep Strategic Analysis (Gemini 3 Pro for Game Study) ---
export const getDeepAnalysis = async (fen: string, history: string[]): Promise<string> => {
    const client = getClient();
    if (!client) return "API Key unavailable.";
  
    const prompt = `
      You are a renowned Chess Grandmaster providing a deep strategic analysis of a specific board position for a student.
  
      **Position (FEN):** ${fen}
      **Recent Moves:** ${history.slice(-10).join(', ')}
  
      Please analyze this position using your advanced reasoning capabilities. Do not just list engine lines. Focus on human-understandable concepts.
      
      Structure your response in Markdown with the following sections:
      
      ### ♟️ Pawn Structure & Weaknesses
      Analyze the pawn skeleton. Are there isolated pawns, backwards pawns, or passed pawns? Who controls the center?
  
      ### ⚔️ Plans & Strategy
      *   **White's Plan:** What should White be trying to achieve? (e.g., King's side attack, minority attack, simplify to endgame).
      *   **Black's Plan:** What is Black's best counterplay?
  
      ### 🚀 Key Tactical Motifs
      Are there immediate pins, forks, or back-rank issues that either side must watch out for?
      
      ### 🎓 Verdict
      Who is winning and why? (e.g., "White has a slight space advantage," or "Dynamic equality").
    `;
  
    try {
      const response = await client.models.generateContent({
        model: 'gemini-3-pro-preview', // Utilizing the more powerful reasoning model
        contents: prompt,
        config: {
            temperature: 0.7, // Slightly creative to generate good explanations
        }
      });
  
      return response.text || "Analysis generation failed.";
    } catch (error) {
      console.error("Error fetching deep analysis:", error);
      return "Gemini 3 Deep Analysis is currently unavailable.";
    }
  };

// --- Input Parsing Function (Text/Image -> FEN) ---
export const parseGameInput = async (input: string | File): Promise<string | null> => {
  const client = getClient();
  if (!client) return null;

  let contents: any[] = [];
  const isImage = typeof input !== 'string';

  if (typeof input === 'string') {
    // Text input (PGN or Move list)
    contents = [
      {
        text: `You are a chess engine helper.
        Convert the following chess game text (PGN, move list, or description) into a FEN string of the final position reached.
        If the input is just a move list like "1. e4 e5 2. Nf3...", simulate the moves to find the final FEN.
        If the text is invalid or nonsensical, return "INVALID".
        
        CRITICAL: Return ONLY the FEN string. Do not output markdown code blocks.

        Input:
        ${input}`
      }
    ];
  } else {
    // Image input
    // Strategy: Ask for an 8x8 visual grid which is less prone to hallucination than FEN arithmetic.
    const base64Data = await fileToBase64(input);
    contents = [
        {
            inlineData: {
                mimeType: input.type,
                data: base64Data
            }
        },
        {
            text: `Analyze this chess board image.
            Generate a 8x8 character grid representing the board state.
            - Use '.' for empty squares.
            - Use standard FEN pieces: 'P','N','B','R','Q','K' for White; 'p','n','b','r','q','k' for Black.
            - The first line must be Rank 8 (Black's starting side, top of image).
            - The last line must be Rank 1 (White's starting side, bottom of image).
            - Ignore any highlights, arrows, or board labels.
            - Do not include spaces between characters.
            
            CRITICAL: Return ONLY the 8 lines of the grid. No markdown.`
        }
    ];
  }

  try {
     const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: contents,
    });
    
    let text = response.text?.trim();
    if (!text) return null;

    // Cleanup potential markdown formatting
    text = text.replace(/```(fen|txt)?/gi, '').replace(/```/g, '').trim();
    text = text.replace(/^["']|["']$/g, ''); // Remove quotes

    if (text.toUpperCase() === "INVALID") return null;

    // Determine if we got a Grid (Image) or FEN (Text)
    // Grids have newlines and look like 8x8 blocks. FENs typically don't have newlines in the board part (just /)
    if (isImage && text.includes('\n')) {
        try {
            return gridToFen(text);
        } catch (e) {
            console.error("Failed to parse grid from AI:", text, e);
            // If grid parsing fails, maybe it returned a FEN anyway? Check for slashes
            if (text.includes('/')) return text.replace(/\n/g, ''); 
            return null;
        }
    }

    return text;
  } catch (e) {
      console.error("Gemini parse error", e);
      return null;
  }
}

// Convert 8x8 char grid to FEN
const gridToFen = (grid: string): string => {
  // Split by newlines and remove empty lines
  const lines = grid.trim().split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length !== 8) {
      // If AI output extra lines (like explanation), try to find the 8 lines block
      // Filter for lines that look like board rows (length approx 8, only valid chars)
      const validLines = lines.filter(l => /^[pnbrqkPNBRQK\.]+$/.test(l));
      if (validLines.length === 8) {
          return processGridRows(validLines);
      }
      throw new Error(`Invalid grid height: ${lines.length}`);
  }

  return processGridRows(lines);
};

const processGridRows = (lines: string[]): string => {
    const fenRows = lines.map(line => {
      // Clean: keep only valid chars
      let cleaned = line.replace(/[^pnbrqkPNBRQK\.]/g, '');
      
      // Safety: Pad or truncate to ensure 8 columns
      if (cleaned.length < 8) cleaned = cleaned.padEnd(8, '.');
      if (cleaned.length > 8) cleaned = cleaned.substring(0, 8);
      
      let out = "";
      let empty = 0;
      for (const char of cleaned) {
          if (char === '.') {
              empty++;
          } else {
              if (empty > 0) {
                  out += empty;
                  empty = 0;
              }
              out += char;
          }
      }
      if (empty > 0) out += empty;
      return out;
  });
  
  // Default active color w, castling KQkq, en passant -, halfmove 0, fullmove 1
  return `${fenRows.join('/')} w KQkq - 0 1`;
}

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        // Remove data url prefix (e.g. "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}