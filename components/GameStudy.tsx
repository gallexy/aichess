import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from './ChessBoard';
import { BookOpen, Undo2, RotateCcw, Monitor, Plus, Minus, Upload, Image as ImageIcon, X, Paperclip, Loader2, ArrowUp, Cpu, Sparkles, BrainCircuit, Copy, Check, Volume2 } from 'lucide-react';
import { getBestMove } from '../services/engineService';
import { parseGameInput, getDeepAnalysis, speakDeepAnalysis } from '../services/geminiService';
import { EngineResponse, EngineLine } from '../types';
import ReactMarkdown from 'react-markdown';

const GameStudy: React.FC = () => {
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [history, setHistory] = useState<string[]>([]);
  
  // Board Size Control
  const [boardWidth, setBoardWidth] = useState(540);
  const handleZoomIn = () => setBoardWidth(prev => Math.min(prev + 50, 1200));
  const handleZoomOut = () => setBoardWidth(prev => Math.max(prev - 50, 300));

  // Analysis State
  const [engineData, setEngineData] = useState<EngineResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Gemini 3 Deep Analysis State
  const [geminiAnalysis, setGeminiAnalysis] = useState<string | null>(null);
  const [isGeminiThinking, setIsGeminiThinking] = useState(false);

  // Import State
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy State
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchAnalysis();
    // Clear Gemini analysis on new move to avoid stale data
    setGeminiAnalysis(null);
  }, [fen]);

  const fetchAnalysis = async () => {
    setAnalyzing(true);
    setEngineData(null);
    try {
        const data = await getBestMove(fen, 15, 3);
        setEngineData(data);
    } catch (e) {
        console.error("Analysis failed", e);
    } finally {
        setAnalyzing(false);
    }
  };

  const handleDeepAnalysis = async () => {
      setIsGeminiThinking(true);
      try {
          const analysis = await getDeepAnalysis(fen, history);
          setGeminiAnalysis(analysis);
          // Auto speak summary of the deep analysis
          speakDeepAnalysis(analysis);
      } catch (e) {
          console.error("Gemini 3 failed", e);
      } finally {
          setIsGeminiThinking(false);
      }
  };

  const onMove = (from: string, to: string) => {
    try {
      const move = chessRef.current.move({ from, to, promotion: 'q' });
      if (move) {
        setFen(chessRef.current.fen());
        setHistory(prev => [...prev, move.san]);
        return true;
      }
    } catch (e) { return false; }
    return false;
  };

  const handleManualMove = (uci: string) => {
    // Convert UCI (e2e4) to move
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    onMove(from, to);
  };

  const undoMove = () => {
    chessRef.current.undo();
    setFen(chessRef.current.fen());
    setHistory(prev => prev.slice(0, -1));
  };

  const resetBoard = () => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setHistory([]);
  };

  // --- Import Handlers ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setSelectedFile(e.target.files[0]);
          setImportText(""); 
      }
  };

  const clearFile = () => {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!importText.trim() && !selectedFile) return;
    setIsImporting(true);

    try {
        if (selectedFile) {
            const newFen = await parseGameInput(selectedFile);
            if (newFen) {
                try {
                    chessRef.current = new Chess(newFen);
                    setFen(newFen);
                    setHistory([]);
                    clearFile();
                } catch (fenError) {
                    alert("Invalid FEN from image.");
                }
            } else {
                alert("Could not recognize board.");
            }
        } else {
            const cleanPgn = importText.replace(/[\t\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
            const tempChess = new Chess();
            let loaded = false;
            try { tempChess.loadPgn(importText); loaded = true; } catch (e) {
                try { tempChess.loadPgn(cleanPgn); loaded = true; } catch (e2) {}
            }

            if (loaded) {
                chessRef.current = tempChess;
                setFen(chessRef.current.fen());
                setHistory(chessRef.current.history());
                setImportText("");
                setIsImporting(false);
                return;
            }

            const newFen = await parseGameInput(importText);
            if (newFen) {
                try {
                     chessRef.current = new Chess(newFen);
                     setFen(newFen);
                     setHistory([]);
                     setImportText("");
                } catch (e) { alert("Invalid FEN/PGN"); }
            } else {
                alert("Could not understand input.");
            }
        }
    } catch (e) {
      alert("Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopyFen = () => {
    navigator.clipboard.writeText(fen);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatScore = (ev: {type: string, value: number}) => {
      if (ev.type === 'mate') return `M${ev.value}`;
      return (ev.value / 100).toFixed(2);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-6 max-w-[1800px] mx-auto w-full">
      {/* Left: Board & Import */}
      <div className="lg:col-span-8 xl:col-span-9 flex flex-col items-center space-y-4">
        
         {/* Size Controls */}
        <div className="w-full max-w-2xl flex justify-end px-1 gap-2">
            <button onClick={handleZoomOut} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700 shadow-sm"><Minus className="w-4 h-4" /></button>
            <div className="flex items-center px-2 bg-slate-900 rounded border border-slate-800 text-xs text-slate-500 font-mono">{Math.round((boardWidth/540)*100)}%</div>
            <button onClick={handleZoomIn} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700 shadow-sm"><Plus className="w-4 h-4" /></button>
        </div>

        {/* Header */}
        <div className="w-full max-w-2xl flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700 transition-all duration-300">
           <div className="flex items-center space-x-2 text-indigo-400">
             <BookOpen className="w-5 h-5" />
             <span className="font-bold">Game Study & Analysis</span>
           </div>
           <div className="flex space-x-2">
             <button onClick={undoMove} disabled={history.length === 0} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white disabled:opacity-30"><Undo2 className="w-4 h-4" /></button>
             <button onClick={resetBoard} disabled={history.length === 0} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white disabled:opacity-30"><RotateCcw className="w-4 h-4" /></button>
           </div>
        </div>
        
        {/* Board */}
        <div style={{ maxWidth: `${boardWidth}px` }} className="relative group shadow-2xl w-full transition-all duration-300">
          <ChessBoard game={chessRef.current} onMove={onMove} />
        </div>

        {/* FEN Display */}
        <div className="w-full max-w-2xl bg-slate-900/50 rounded-lg border border-slate-700 p-2 flex items-center space-x-3 shadow-inner">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest select-none shrink-0">FEN</span>
            <input 
              type="text" 
              readOnly 
              value={fen} 
              className="flex-1 bg-transparent border-none outline-none text-xs text-slate-400 font-mono truncate focus:text-slate-200 transition-colors"
              onClick={(e) => e.currentTarget.select()}
            />
            <button 
              onClick={handleCopyFen} 
              className="p-1.5 hover:bg-slate-800 rounded-md text-slate-500 hover:text-white transition-colors shrink-0"
              title="Copy FEN"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
        </div>
        
        {/* Import Section (Moved from GameMode) */}
        <div className="w-full max-w-2xl bg-slate-800 rounded-xl border border-slate-700 p-2 shadow-lg">
          <div className="flex items-center space-x-2 mb-1 text-slate-300">
            <Upload className="w-4 h-4" />
            <h3 className="font-bold text-sm">Load Game / Position</h3>
          </div>
          <div className="relative bg-slate-900 border border-slate-700 rounded-lg p-2 focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all">
            <textarea 
              className="w-full bg-transparent border-none outline-none text-sm text-slate-200 resize-none h-10 placeholder-slate-500 p-1"
              placeholder={selectedFile ? "Image selected..." : "Paste PGN or FEN..."}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              disabled={!!selectedFile || isImporting}
            />
            {selectedFile && (
                <div className="absolute top-1 left-1 right-1 bottom-10 bg-slate-800/90 backdrop-blur-sm rounded-md flex items-center justify-center border border-emerald-500/30">
                    <div className="flex items-center space-x-2 text-emerald-400 bg-slate-900 px-3 py-1 rounded-full shadow-lg">
                        <ImageIcon className="w-3 h-3" />
                        <span className="text-xs font-medium truncate max-w-[150px]">{selectedFile.name}</span>
                        <button onClick={clearFile} className="p-0.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><X className="w-3 h-3" /></button>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center mt-1 px-1 pt-1 border-t border-slate-800">
                <div className="flex items-center">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className={`p-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center space-x-2 ${selectedFile ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}><Paperclip className="w-4 h-4" /><span className="text-xs font-medium hidden sm:inline">Upload Image</span></button>
                </div>
                <button onClick={handleSubmit} disabled={isImporting || (!importText.trim() && !selectedFile)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-md text-xs font-bold flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
                  {isImporting ? <><Loader2 className="w-3 h-3 animate-spin"/><span>Loading...</span></> : <><ArrowUp className="w-3 h-3" /><span>Load</span></>}
                </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Analysis (Split View) */}
      <div className="lg:col-span-4 xl:col-span-3 flex flex-col h-[calc(100vh-140px)] bg-slate-800 rounded-xl border border-slate-700 overflow-hidden lg:sticky lg:top-6">
        
        {/* Top Half: Engine Analysis */}
        <div className="flex-1 flex flex-col border-b border-slate-700 min-h-[30%]">
            <div className="p-3 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                <div className="flex items-center space-x-2 text-indigo-400">
                    <Cpu className="w-4 h-4" />
                    <span className="font-bold text-sm">Engine Lines</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Stockfish</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {analyzing ? (
                <div className="flex flex-col items-center justify-center py-4 space-y-2 text-slate-500 animate-pulse">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs">Calculating...</span>
                </div>
            ) : engineData && engineData.top_lines ? (
                engineData.top_lines.map((line, idx) => (
                    <div 
                    key={idx} 
                    onClick={() => handleManualMove(line.move)}
                    className="bg-slate-700/30 hover:bg-slate-700/60 border border-slate-600/50 rounded-lg p-2 cursor-pointer transition-colors group flex items-center justify-between"
                    >
                    <div className="flex items-center space-x-2">
                        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${idx === 0 ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                            {idx + 1}
                        </span>
                        <span className="text-sm font-bold text-white group-hover:text-indigo-400 font-mono">
                            {line.move.substring(0,2)}&rarr;{line.move.substring(2,4)}
                        </span>
                    </div>
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${line.evaluation.value > 0 ? 'bg-emerald-500/10 text-emerald-400' : line.evaluation.value < 0 ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'}`}>
                        {formatScore(line.evaluation)}
                    </span>
                    </div>
                ))
            ) : (
                <div className="text-center py-4 text-xs text-slate-500">Lines unavailable.</div>
            )}
            </div>
        </div>

        {/* Bottom Half: Gemini 3 Grandmaster Insight */}
        <div className="flex-[2] flex flex-col bg-slate-900/30">
             <div className="p-3 border-b border-slate-700 bg-gradient-to-r from-slate-900 to-indigo-950/30 flex justify-between items-center">
                <div className="flex items-center space-x-2 text-purple-400">
                    <BrainCircuit className="w-4 h-4" />
                    <span className="font-bold text-sm">Grandmaster Insight</span>
                </div>
                <div className="flex items-center space-x-1">
                     <button 
                        onClick={() => geminiAnalysis && speakDeepAnalysis(geminiAnalysis)}
                        disabled={!geminiAnalysis}
                        className="p-1 hover:bg-purple-500/20 rounded-full text-purple-400 hover:text-purple-200 transition-colors disabled:opacity-30"
                        title="Read Analysis"
                    >
                        <Volume2 className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] uppercase font-bold text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">Gemini 3 Pro</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-700">
                {!geminiAnalysis && !isGeminiThinking && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                        <Sparkles className="w-8 h-8 text-slate-600 opacity-50" />
                        <p className="text-sm text-slate-400 max-w-[200px]">Use advanced AI reasoning to understand the strategy behind the position.</p>
                        <button 
                            onClick={handleDeepAnalysis}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-purple-900/20 transition-all flex items-center space-x-2 border border-purple-400/20"
                        >
                            <Sparkles className="w-3 h-3" />
                            <span>Analyze with Gemini 3</span>
                        </button>
                    </div>
                )}

                {isGeminiThinking && (
                     <div className="h-full flex flex-col items-center justify-center space-y-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <BrainCircuit className="w-5 h-5 text-purple-500 animate-pulse" />
                            </div>
                        </div>
                        <span className="text-xs text-purple-300 font-medium animate-pulse">Analyzing structure & strategy...</span>
                     </div>
                )}

                {geminiAnalysis && (
                    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-purple-300 prose-headings:font-bold prose-headings:text-sm prose-p:text-slate-300 prose-strong:text-slate-100">
                        <ReactMarkdown>{geminiAnalysis}</ReactMarkdown>
                        <div className="pt-4 flex justify-center">
                             <button 
                                onClick={handleDeepAnalysis}
                                className="text-xs text-slate-500 hover:text-purple-400 flex items-center space-x-1 transition-colors"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span>Re-analyze</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default GameStudy;