import { GoogleGenAI, Modality } from "@google/genai";
import { OpeningStats } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing from environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// --- Audio Decoding Utils ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- Native TTS Fallback ---
const speakNative = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    // Cancel any ongoing speech to avoid overlap
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to select a pleasant English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
        (v.name.includes("Google") && v.name.includes("English") && v.name.includes("US")) || 
        v.name.includes("Samantha") || 
        v.name.includes("Zira")
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.1; // Slightly faster for coaching
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
};

// Ensure voices are loaded (Chrome quirk)
if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

// --- Internal: Core TTS Helper ---
// Raw function: Takes text -> Calls TTS Model -> Plays Audio
// Fallback to Native TTS if API fails (e.g. 429 Quota Exceeded)
const synthesizeAndPlay = async (textToSpeak: string) => {
    const client = getClient();
    
    // If no client (no API key), go straight to native
    if (!client) {
        speakNative(textToSpeak);
        return;
    }

    if (!textToSpeak) return;

    try {
        const response = await client.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: textToSpeak }] }],
            config: {
                responseModalities: ['AUDIO'] as any, 
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Puck' or 'Kore' are good for coaching
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        
        if (base64Audio) {
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
            const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                outputAudioContext,
                24000,
                1,
            );
            
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.start();
        } else {
            // API returned but no audio? Fallback.
            throw new Error("No audio content in response");
        }
    } catch (e) {
        console.warn("Gemini TTS Engine failed (likely quota/network), switching to native fallback.", e);
        speakNative(textToSpeak);
    }
};

// --- Internal: Script Generator ---
// Takes complex data -> Calls Flash Model -> Returns concise spoken script
const generateSpokenScript = async (systemInstruction: string, contextData: string): Promise<string> => {
    const client = getClient();
    if (!client) return "";

    try {
        const response = await client.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: [{ parts: [{ text: `
                Context: ${contextData}
                
                Task: ${systemInstruction}
                
                Constraint: Return ONLY the spoken text. No markdown. No emojis. Keep it under 2 sentences unless specified.
            ` }] }]
        });
        return response.text?.trim() || "";
    } catch (e) {
        console.error("Script generation failed:", e);
        // If script generation fails, we can't really speak anything useful unless we fallback to raw context, 
        // but usually we just return empty to avoid speaking nonsense.
        return "";
    }
};


// --- Public Audio Features ---

export const playMoveFeedback = async (
  fen: string,
  moveSan: string,
  quality: 'best' | 'good' | 'mistake' | 'blunder'
) => {
  // Generate script
  const script = await generateSpokenScript(
      "You are a sharp chess commentator. Give a 1-sentence reaction to the move. If it's a mistake, explicitly say what is lost (e.g. 'That blunders the knight'). If it's good, explain the benefit (e.g. 'Strong control of the center'). Avoid generic praise.",
      `Move: ${moveSan}, Quality: ${quality}, Position FEN: ${fen}`
  );
  // Speak script
  await synthesizeAndPlay(script);
};

export const speakAdvice = async (adviceText: string) => {
    // Summarize the markdown advice into a verbal summary
    const script = await generateSpokenScript(
        "You are a Grandmaster coach. Summarize this analysis into 2 sentences. Focus on the *consequences* and the *key threat*. Explain 'Why' it matters.",
        adviceText
    );
    await synthesizeAndPlay(script);
};

export const speakDeepAnalysis = async (analysisText: string) => {
    // Deep analysis is long, so we need a slightly longer summary
    const script = await generateSpokenScript(
        "You are a Grandmaster. Give a 3-sentence executive summary of this deep analysis. Mention the key pawn structure feature and the main plan for the player.",
        analysisText
    );
    await synthesizeAndPlay(script);
};

export const speakOpeningInfo = async (stats: OpeningStats, fen: string) => {
    const openingName = stats.opening ? `${stats.opening.eco} - ${stats.opening.name}` : "Unknown position";
    const context = `
        Opening: ${openingName}
        Stats: White wins ${stats.white} games, Black wins ${stats.black}, Draws ${stats.draws}.
        Top moves: ${stats.moves.slice(0,3).map(m => m.san).join(', ')}.
    `;
    
    const script = await generateSpokenScript(
        "You are a chess historian. Introduce this opening briefly. Mention if it favors White or Black based on the stats, and name the most popular continuation move.",
        context
    );
    await synthesizeAndPlay(script);
};

export const speakExplanation = async (fen: string, moveSan: string) => {
    const script = await generateSpokenScript(
        "You are a Grandmaster instructor. Explain in 1 short sentence why this computer-recommended move is strong. Focus on the immediate benefit (e.g. 'This forks the rook and king' or 'It secures the center').",
        `Move: ${moveSan}, Position FEN: ${fen}`
    );
    await synthesizeAndPlay(script);
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

  // Refined prompt for conciseness and key points
  const prompt = `
    You are a world-class Chess Coach (like Jeremy Silman). The user wants deep insight into the position's consequences.
    
    Current Position (FEN): ${fen}
    Side to move: ${turn === 'w' ? 'White' : 'Black'}
    Best Move according to Engine: ${bestMove || 'Not calculated'}
    Engine Evaluation: ${evaluation || 'Not calculated'}
    Game History: ${history.slice(-6).join(' ')}

    Analyze this position focusing strictly on **Causal Impact** and **Future Plans**.
    
    Please provide your response in this structured Markdown format:

    1. **The Critical Implication**: 
       - Explain exactly how the current board structure dictates the game. 
       - *Example:* "The backward d-pawn is a long-term weakness that Black can target." or "White has a space advantage on the kingside allowing for an attack."
       
    2. **Immediate Tactical Landscape**:
       - What specific threats exist right now? 
       - *Example:* "If White moves the knight, the f2 pawn hangs."

    3. **The Recommended Plan**:
       - Why is the best move the best? What future does it create?
       - *Example:* "Moving the Rook to e1 controls the open file and prepares to support the e4 push."

    **Do NOT** use phrases like "This is a good position" without explaining WHY. 
    **Do NOT** be vague. Be specific about squares (e.g. f7, d4) and pieces.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        systemInstruction: "You are a deep strategic chess thinker. You hate generic advice. You focus on board mechanics and future plans.",
      }
    });

    return response.text || "Thinking...";
  } catch (error) {
    console.error("Error fetching chess advice:", error);
    return "AI Coach unavailable.";
  }
};

// --- Deep Strategic Analysis (Gemini 3 Pro) ---
export const getDeepAnalysis = async (fen: string, history: string[]): Promise<string> => {
    const client = getClient();
    if (!client) return "API Key unavailable.";
  
    const prompt = `
      You are a renowned Chess Grandmaster. Analyze this position (FEN: ${fen}).
      
      Provide a structured report in Markdown:
      
      ### ♟️ Structure & Imbalances
      Analyze pawn structures, weak squares, and space. Who controls the center?

      ### ⚔️ Strategic Plans
      What should White aim for? What should Black aim for? (e.g. Minority attack, Kingside storm).

      ### 💡 Key Tactics & Threats
      Any immediate tactical themes or traps to avoid.
      
      ### 🎓 Grandmaster Verdict
      Final evaluation of the position's dynamic potential.
    `;
  
    try {
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash-lite', 
        contents: prompt,
        config: { temperature: 0.7 }
      });
  
      return response.text || "Analysis generation failed.";
    } catch (error) {
      console.error("Error fetching deep analysis:", error);
      return "Gemini 3 Deep Analysis unavailable.";
    }
  };

// --- Input Parsing Function ---
export const parseGameInput = async (input: string | File): Promise<string | null> => {
  const client = getClient();
  if (!client) return null;

  let contents: any[] = [];
  const isImage = typeof input !== 'string';

  if (typeof input === 'string') {
    contents = [{ text: `Convert this chess text/PGN/Move list to a FEN string. Return ONLY the FEN. Input: ${input}` }];
  } else {
    const base64Data = await fileToBase64(input);
    contents = [
        { inlineData: { mimeType: input.type, data: base64Data } },
        { text: `Return a 8x8 character grid of this chess board. Use '.' for empty. Standard FEN chars (PNBRQK). Rank 8 on top.` }
    ];
  }

  try {
     const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: contents,
    });
    
    let text = response.text?.trim();
    if (!text) return null;

    text = text.replace(/```(fen|txt)?/gi, '').replace(/```/g, '').trim().replace(/^["']|["']$/g, '');

    if (isImage && text.includes('\n')) {
        try { return gridToFen(text); } catch (e) { if (text.includes('/')) return text.replace(/\n/g, ''); return null; }
    }
    return text;
  } catch (e) {
      return null;
  }
}

// Convert 8x8 char grid to FEN
const gridToFen = (grid: string): string => {
  const lines = grid.trim().split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length !== 8) {
      const validLines = lines.filter(l => /^[pnbrqkPNBRQK\.]+$/.test(l));
      if (validLines.length === 8) return processGridRows(validLines);
      throw new Error(`Invalid grid height: ${lines.length}`);
  }
  return processGridRows(lines);
};

const processGridRows = (lines: string[]): string => {
    const fenRows = lines.map(line => {
      let cleaned = line.replace(/[^pnbrqkPNBRQK\.]/g, '');
      if (cleaned.length < 8) cleaned = cleaned.padEnd(8, '.');
      if (cleaned.length > 8) cleaned = cleaned.substring(0, 8);
      let out = "";
      let empty = 0;
      for (const char of cleaned) {
          if (char === '.') { empty++; } 
          else {
              if (empty > 0) { out += empty; empty = 0; }
              out += char;
          }
      }
      if (empty > 0) out += empty;
      return out;
  });
  return `${fenRows.join('/')} w KQkq - 0 1`;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
}