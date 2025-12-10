import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing from environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

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
    你是一位友好的国际象棋特级大师教练，专门辅导初学者和中级玩家。
    
    当前局面 (FEN): ${fen}
    当前轮次: ${turn === 'w' ? '白方' : '黑方'}
    最近走法: ${history.slice(-5).join(', ')}
    ${bestMove ? `引擎推荐的最佳着法: ${bestMove}` : ''}
    ${evaluation ? `当前局面评分 (CP/Mate): ${evaluation}` : ''}

    请用**中文**提供以下内容:
    1. **局势简述**: 简要分析当前局势（谁有优势以及原因）。
    2. **最佳着法解释**: ${bestMove 
      ? `重点解释为什么 **${bestMove}** 是这一步的最佳着法。它达到了什么战略目的？（例如：控制中心、战术组合、防御威胁、改善子力位置等）。` 
      : '给出一个策略建议或推荐一步好棋。'}
    3. **总结**: 保持简练（150字以内）并富有鼓励性。

    请使用 Markdown 格式输出。
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful chess tutor. Always answer in Chinese.",
      }
    });

    return response.text || "教练正在思考，但暂时无法给出建议...";
  } catch (error) {
    console.error("Error fetching chess advice:", error);
    return "AI 教练暂时无法连接，请稍后再试。";
  }
};