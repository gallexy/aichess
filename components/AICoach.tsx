import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, MessageSquare, Cpu, ArrowRight, AlertTriangle, Zap } from 'lucide-react';
import { getChessAdvice } from '../services/geminiService';
import { getBestMove } from '../services/engineService';
import { EngineResponse, Arrow, EngineLine } from '../types';
import ReactMarkdown from 'react-markdown';

interface AICoachProps {
  fen: string;
  turn: 'w' | 'b';
  history: string[];
  onAnalysisUpdate: (arrows: Arrow[]) => void;
}

const AICoach: React.FC<AICoachProps> = ({ fen, turn, history, onAnalysisUpdate }) => {
  const [advice, setAdvice] = useState<string | null>(null);
  const [engineData, setEngineData] = useState<EngineResponse | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset local analysis state when the board position (FEN) changes
  useEffect(() => {
    setAdvice(null);
    setEngineData(null);
    setError(null);
    // Note: Arrows are cleared in parent App on move.
  }, [fen]);

  const parseMove = (moveStr: string) => {
    if (!moveStr || moveStr.length < 4) return null;
    return {
      from: moveStr.substring(0, 2),
      to: moveStr.substring(2, 4)
    };
  };

  const formatEvaluation = (evalData: { type: 'cp' | 'mate', value: number }) => {
    if (evalData.type === 'mate') {
      return `M ${evalData.value}`;
    }
    const score = evalData.value / 100;
    const sign = score > 0 ? '+' : '';
    return `${sign}${score.toFixed(2)}`;
  };

  const handleCalculateMove = async () => {
    setEngineLoading(true);
    setEngineData(null);
    setError(null);
    onAnalysisUpdate([]);

    try {
      const result = await getBestMove(fen);
      setEngineData(result);
      
      const newArrows: Arrow[] = [];
      const lines = result.top_lines || [{ move: result.best_move, evaluation: result.evaluation }];
      
      lines.slice(0, 3).forEach((line, index) => {
          const parsed = parseMove(line.move);
          if (parsed) {
              const color = index === 0 ? '#10b981' : index === 1 ? '#3b82f6' : '#f97316';
              newArrows.push({ from: parsed.from, to: parsed.to, color });
          }
      });
      onAnalysisUpdate(newArrows);

    } catch (e) {
      console.error(e);
      setError("引擎启动失败");
    } finally {
      setEngineLoading(false);
    }
  };

  const handleAskAI = async () => {
    setAiLoading(true);
    try {
        let bestMoveStr = undefined;
        let evalStr = undefined;

        if (engineData) {
            bestMoveStr = engineData.best_move;
            const val = engineData.evaluation.value;
            const type = engineData.evaluation.type;
            evalStr = type === 'mate' ? `Mate in ${val}` : `Centipawns: ${val}`;
        }

        const text = await getChessAdvice(fen, turn, history, bestMoveStr, evalStr);
        setAdvice(text);
    } catch (e) {
        console.error(e);
        setError("AI 分析失败");
    } finally {
        setAiLoading(false);
    }
  };

  // Helper for lines
  const displayLines = engineData 
    ? (engineData.top_lines || [{ move: engineData.best_move, evaluation: engineData.evaluation }]).slice(0, 3) 
    : [];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-full shadow-lg">
      <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h2 className="font-bold text-white">AI 助手</h2>
        </div>
        <button
          onClick={handleCalculateMove}
          disabled={engineLoading || aiLoading}
          className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-full flex items-center space-x-1 transition-all shadow-md border border-emerald-500/30"
        >
          {engineLoading ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>计算中...</span>
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              <span>计算最佳着法</span>
            </>
          )}
        </button>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto bg-slate-900/30 space-y-4">
        
        {error && (
            <div className="bg-red-900/20 border border-red-500/30 p-3 rounded-lg flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300">{error}</p>
            </div>
        )}

        {/* Introduction / Empty State */}
        {!engineData && !engineLoading && !advice && !aiLoading && (
           <div className="flex flex-col items-center justify-center text-slate-500 text-center py-8">
              <Cpu className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">点击上方按钮让引擎计算最佳走法。</p>
           </div>
        )}

        {/* Engine Analysis Display */}
        {engineData && displayLines.length > 0 && (
          <div className="space-y-2 animate-in fade-in duration-300">
             <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2 text-orange-400">
                    <Cpu className="w-4 h-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">引擎推荐</h3>
                </div>
                <span className="text-xs text-slate-500">Depth: {engineData.depth}</span>
             </div>
             
             {displayLines.map((line, idx) => (
                <div key={idx} className="bg-slate-800/80 rounded-lg p-2 border border-slate-700 flex items-center justify-between shadow-sm">
                    <div className="flex items-center space-x-2 font-mono">
                        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${
                            idx === 0 ? 'bg-emerald-900 text-emerald-400' : 
                            idx === 1 ? 'bg-blue-900 text-blue-400' : 'bg-orange-900 text-orange-400'
                        }`}>
                            {idx + 1}
                        </span>
                        <div className="flex items-center text-white font-bold">
                            <span>{line.move.substring(0, 2)}</span>
                            <ArrowRight className="w-3 h-3 mx-1 text-slate-500" />
                            <span>{line.move.substring(2, 4)}</span>
                            {line.move.length > 4 && <span className="text-xs text-yellow-500 ml-1">={line.move.substring(4)}</span>}
                        </div>
                    </div>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                        (line.evaluation.value > 0 && turn === 'w') || (line.evaluation.value < 0 && turn === 'b') 
                        ? 'bg-emerald-900/30 text-emerald-400' 
                        : 'bg-red-900/30 text-red-400'
                    }`}>
                        {formatEvaluation(line.evaluation)}
                    </span>
                </div>
             ))}
          </div>
        )}

        {/* AI Analysis Trigger Button - Visible if we have engine data or just want to ask AI */}
        {(engineData || (!engineLoading && !aiLoading && !advice)) && !aiLoading && !advice && (
            <div className="flex justify-center pt-2">
                <button
                    onClick={handleAskAI}
                    className="group flex items-center space-x-2 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2 rounded-lg shadow-md transition-all border border-purple-500/30"
                >
                    <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
                    <span>大师深度解析</span>
                </button>
            </div>
        )}

        {/* AI Loading State */}
        {aiLoading && (
           <div className="space-y-3 animate-pulse pt-2">
              <div className="flex items-center space-x-2 text-purple-400 mb-2">
                 <RefreshCw className="w-4 h-4 animate-spin" />
                 <span className="text-xs font-bold">AI 大师正在思考...</span>
              </div>
              <div className="h-4 bg-slate-800 rounded w-3/4"></div>
              <div className="h-4 bg-slate-800 rounded w-full"></div>
              <div className="h-4 bg-slate-800 rounded w-5/6"></div>
           </div>
        )}

        {/* Gemini Advice Section */}
        {advice && (
          <div className="bg-slate-800/40 rounded-lg p-3 border border-purple-500/20 mt-4 animate-in slide-in-from-bottom-2 duration-500">
             <div className="flex items-center space-x-2 text-purple-400 mb-2">
                <MessageSquare className="w-4 h-4" />
                <h3 className="text-sm font-bold uppercase tracking-wider">大师点评</h3>
              </div>
            <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed">
              <ReactMarkdown>{advice}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AICoach;
