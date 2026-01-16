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
    
    // Attempt to select a pleasant Chinese voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
        (v.name.includes("Chinese") || v.lang.includes("zh"))
    ) || voices.find(v => v.lang.startsWith('zh')) || voices[0];

    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.0; 
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
};

// Ensure voices are loaded
if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

// --- Internal: Core TTS Helper ---
const synthesizeAndPlay = async (textToSpeak: string) => {
    const client = getClient();
    
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
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, 
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
            throw new Error("No audio content in response");
        }
    } catch (e) {
        console.warn("Gemini TTS Engine failed, switching to native fallback.", e);
        speakNative(textToSpeak);
    }
};

// --- Internal: Script Generator ---
const generateSpokenScript = async (systemInstruction: string, contextData: string): Promise<string> => {
    const client = getClient();
    if (!client) return "";

    try {
        const response = await client.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: [{ parts: [{ text: `
                背景信息: ${contextData}
                
                任务: ${systemInstruction}
                
                约束条件: 仅返回朗读文本。不要使用 Markdown 或表情符号。字数控制在2句话以内，必须使用中文回答。
            ` }] }]
        });
        return response.text?.trim() || "";
    } catch (e) {
        console.error("Script generation failed:", e);
        return "";
    }
};


// --- Public Audio Features ---

export const playMoveFeedback = async (
  fen: string,
  moveSan: string,
  quality: 'best' | 'good' | 'mistake' | 'blunder'
) => {
  const script = await generateSpokenScript(
      "你是一位敏锐的国际象棋解说员。请对这步棋做一个短促有力的评价（一句话）。如果是失误，明确指出丢了什么（例如：'这步棋丢了马'）。如果是妙着，解释好处（例如：'完美控制了中心'）。",
      `棋步: ${moveSan}, 质量: ${quality}, 局面 FEN: ${fen}`
  );
  await synthesizeAndPlay(script);
};

export const speakAdvice = async (adviceText: string) => {
    const script = await generateSpokenScript(
        "你是一位大师级教练。请用两句话总结这段分析。重点说明这步棋的后果和主要威胁。解释‘为什么’这很重要。",
        adviceText
    );
    await synthesizeAndPlay(script);
};

export const speakDeepAnalysis = async (analysisText: string) => {
    const script = await generateSpokenScript(
        "你是一位特级大师。请对这段深度分析做一个3句话左右的中文摘要。提到关键的兵形结构特征和接下来的主要计划。",
        analysisText
    );
    await synthesizeAndPlay(script);
};

export const speakOpeningInfo = async (stats: OpeningStats, fen: string) => {
    const openingName = stats.opening ? `${stats.opening.eco} - ${stats.opening.name}` : "未知开局";
    const context = `
        开局: ${openingName}
        统计数据: 白胜 ${stats.white} 局, 黑胜 ${stats.black}, 和棋 ${stats.draws}。
        热门棋步: ${stats.moves.slice(0,3).map(m => m.san).join(', ')}。
    `;
    
    const script = await generateSpokenScript(
        "你是一位国际象棋历史学家。请简要介绍这个开局。根据统计数据说明它对哪一方有利，并提及最常见的后续走法。",
        context
    );
    await synthesizeAndPlay(script);
};

export const speakExplanation = async (fen: string, moveSan: string) => {
    const script = await generateSpokenScript(
        "你是一位特级大师教练。请用一句简短的中文解释为什么这个电脑推荐的棋步很强。专注于直接的收益（例如：'这形成了一个对王和车的双击'或'它巩固了中心'）。",
        `棋步: ${moveSan}, 局面 FEN: ${fen}`
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
  if (!client) return "API 密钥不可用。无法咨询 AI 教练。";

  const prompt = `
    你是一位世界级的国际象棋教练（如 Jeremy Silman）。用户希望深入了解当前局面的后果。
    
    当前局面 (FEN): ${fen}
    轮到谁走: ${turn === 'w' ? '白方' : '黑方'}
    引擎推荐走法: ${bestMove || '未计算'}
    引擎评估: ${evaluation || '未计算'}
    对局历史: ${history.slice(-6).join(' ')}

    请针对此局面进行分析，严格关注 **因果影响** 和 **后续计划**。
    
    请按以下 Markdown 格式提供回复：

    1. **关键含义**: 
       - 解释当前棋盘结构如何决定比赛方向。
       - *示例:* "d5位的落后兵是黑方可以攻击的长期弱点。" 或 "白方在王翼拥有空间优势，允许发起进攻。"
       
    2. **即时战术局势**:
       - 现在存在哪些具体的威胁？
       - *示例:* "如果白方移动这匹马，f2兵就会丢失。"

    3. **推荐计划**:
       - 为什么推荐的走法是最好的？它创造了什么样的未来？
       - *示例:* "将车移到 e1 可以控制开放线，并为支持 e4 冲兵做准备。"

    **不要** 使用类似 "这是一个好局面" 这样空洞的话，必须解释原因。
    **不要** 含糊其辞。具体指出坐标（如 f7, d4）和棋子。
    **必须使用中文回答**。
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        systemInstruction: "你是一位深邃的国际象棋战略思想家。你讨厌泛泛而谈。你专注于棋盘机制和未来计划。请始终使用中文回答。",
      }
    });

    return response.text || "正在思考...";
  } catch (error) {
    console.error("Error fetching chess advice:", error);
    return "AI 教练暂时不可用。";
  }
};

// --- Deep Strategic Analysis (Gemini 3 Pro) ---
export const getDeepAnalysis = async (fen: string, history: string[]): Promise<string> => {
    const client = getClient();
    if (!client) return "API 密钥不可用。";
  
    const prompt = `
      你是一位著名的国际象棋特级大师。请分析此局面 (FEN: ${fen})。
      
      请以中文提供结构化的 Markdown 报告：
      
      ### ♟️ 结构与不平衡性
      分析兵形结构、弱点方格和空间。谁控制着中心？

      ### ⚔️ 战略计划
      白方的目标应该是什么？黑方的目标应该是什么？（例如：少数兵进攻、王翼风暴）。

      ### 💡 关键战术与威胁
      是否存在即时的战术主题或需要避免的陷阱。
      
      ### 🎓 特级大师裁定
      对局面动态潜力的最终评估。
    `;
  
    try {
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash-lite', 
        contents: prompt,
        config: { temperature: 0.7 }
      });
  
      return response.text || "分析生成失败。";
    } catch (error) {
      console.error("Error fetching deep analysis:", error);
      return "Gemini 深度分析暂时不可用。";
    }
  };

// --- Input Parsing Function ---
export const parseGameInput = async (input: string | File): Promise<string | null> => {
  const client = getClient();
  if (!client) return null;

  let contents: any[] = [];
  const isImage = typeof input !== 'string';

  if (typeof input === 'string') {
    contents = [{ text: `将以下国际象棋文本/PGN/移动列表转换为 FEN 字符串。仅返回 FEN。输入: ${input}` }];
  } else {
    const base64Data = await fileToBase64(input);
    contents = [
        { inlineData: { mimeType: input.type, data: base64Data } },
        { text: `返回此棋盘的 8x8 字符网格。使用 '.' 表示空位。使用标准 FEN 字符 (PNBRQK)。第 8 横线在最上方。` }
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