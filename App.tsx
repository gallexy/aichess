import React, { useState } from 'react';
import { Trophy, Swords, BookOpen, GraduationCap, Settings, X, Check } from 'lucide-react';
import GameMode from './components/GameMode';
import OpeningExplorer from './components/OpeningExplorer';
import GameStudy from './components/GameStudy';
import { GameSettings, Language, AiStyle } from './types';

type Tab = 'game' | 'explorer' | 'study';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('game');
  const [showSettings, setShowSettings] = useState(false);

  // Global Settings State
  const [settings, setSettings] = useState<GameSettings>({
    language: 'en',
    timeControl: 900, // 15 minutes default
    aiStyle: 'balanced'
  });

  // Text Resources
  const TEXT = {
    en: {
      title: "Grandmaster AI",
      play: "Play vs AI",
      study: "Game Study",
      explorer: "Opening Tree",
      settings: "Settings",
      language: "Language",
      time: "Time Control",
      mode: "AI Style",
      modeBalanced: "Balanced (Friendly)",
      modeAggressive: "Aggressive (Optimal)",
      save: "Save Settings",
      minutes: "min"
    },
    zh: {
      title: "国际象棋大师 AI",
      play: "人机对战",
      study: "复盘分析",
      explorer: "开局库",
      settings: "设置",
      language: "语言 / Language",
      time: "计时时间",
      mode: "对战风格",
      modeBalanced: "均衡模式 (适合教学)",
      modeAggressive: "竞技模式 (最强招法)",
      save: "保存设置",
      minutes: "分钟"
    }
  };

  const t = TEXT[settings.language];

  const handleSaveSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    setShowSettings(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Main Header */}
      <header className="bg-slate-800 border-b border-slate-700 py-3 px-6 shadow-md z-20 sticky top-0">
        <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 p-2 rounded-lg shadow-lg shadow-emerald-900/50">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              {t.title}
            </h1>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700/50 overflow-x-auto max-w-full">
              <button
                onClick={() => setActiveTab('game')}
                className={`flex items-center space-x-2 px-4 md:px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === 'game' 
                    ? 'bg-slate-700 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Swords className="w-4 h-4" />
                <span>{t.play}</span>
              </button>
              <button
                onClick={() => setActiveTab('study')}
                className={`flex items-center space-x-2 px-4 md:px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === 'study' 
                    ? 'bg-slate-700 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>{t.study}</span>
              </button>
              <button
                onClick={() => setActiveTab('explorer')}
                className={`flex items-center space-x-2 px-4 md:px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === 'explorer' 
                    ? 'bg-slate-700 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>{t.explorer}</span>
              </button>
            </div>

            {/* Settings Button */}
            <button 
              onClick={() => setShowSettings(true)}
              className="ml-2 p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all shadow-sm"
              title={t.settings}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full bg-slate-900">
        <div className={activeTab === 'game' ? 'block' : 'hidden'}>
          <GameMode settings={settings} />
        </div>
        <div className={activeTab === 'study' ? 'block' : 'hidden'}>
          <GameStudy />
        </div>
        <div className={activeTab === 'explorer' ? 'block' : 'hidden'}>
          <OpeningExplorer />
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal 
          currentSettings={settings} 
          onSave={handleSaveSettings} 
          onClose={() => setShowSettings(false)} 
          t={t}
        />
      )}
    </div>
  );
};

// --- Settings Modal Component ---
interface SettingsModalProps {
  currentSettings: GameSettings;
  onSave: (s: GameSettings) => void;
  onClose: () => void;
  t: any;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ currentSettings, onSave, onClose, t }) => {
  const [localSettings, setLocalSettings] = useState(currentSettings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-500" />
            {t.settings}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Language */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">{t.language}</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setLocalSettings(s => ({...s, language: 'en'}))}
                className={`p-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${localSettings.language === 'en' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
              >
                <span>English</span>
                {localSettings.language === 'en' && <Check className="w-4 h-4" />}
              </button>
              <button 
                onClick={() => setLocalSettings(s => ({...s, language: 'zh'}))}
                className={`p-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${localSettings.language === 'zh' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
              >
                <span>中文</span>
                {localSettings.language === 'zh' && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>

           {/* AI Style */}
           <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">{t.mode}</label>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setLocalSettings(s => ({...s, aiStyle: 'balanced'}))}
                className={`p-3 rounded-lg border text-left transition-all ${localSettings.aiStyle === 'balanced' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-100' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
              >
                <div className="flex items-center justify-between">
                   <span className="font-bold">{t.modeBalanced}</span>
                   {localSettings.aiStyle === 'balanced' && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
              </button>
              <button 
                onClick={() => setLocalSettings(s => ({...s, aiStyle: 'aggressive'}))}
                className={`p-3 rounded-lg border text-left transition-all ${localSettings.aiStyle === 'aggressive' ? 'bg-red-600/20 border-red-500 text-red-100' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
              >
                <div className="flex items-center justify-between">
                   <span className="font-bold">{t.modeAggressive}</span>
                   {localSettings.aiStyle === 'aggressive' && <Check className="w-4 h-4 text-red-400" />}
                </div>
              </button>
            </div>
          </div>

          {/* Time Control */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">{t.time}</label>
            <div className="grid grid-cols-4 gap-2">
              {[300, 600, 900, 1800].map((time) => (
                <button 
                  key={time}
                  onClick={() => setLocalSettings(s => ({...s, timeControl: time}))}
                  className={`py-2 px-1 rounded-lg border text-sm font-bold transition-all ${localSettings.timeControl === time ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                >
                  {time / 60} {t.minutes}
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end">
          <button 
            onClick={() => onSave(localSettings)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center space-x-2"
          >
            <Check className="w-4 h-4" />
            <span>{t.save}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;