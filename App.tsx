import React, { useState } from 'react';
import { Trophy, Swords, BookOpen, GraduationCap } from 'lucide-react';
import GameMode from './components/GameMode';
import OpeningExplorer from './components/OpeningExplorer';
import GameStudy from './components/GameStudy';

type Tab = 'game' | 'explorer' | 'study';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('game');

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
              Grandmaster AI
            </h1>
          </div>
          
          {/* Navigation Tabs */}
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
              <span>Play vs AI</span>
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
              <span>Game Study</span>
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
              <span>Opening Tree</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full bg-slate-900">
        <div className={activeTab === 'game' ? 'block' : 'hidden'}>
          <GameMode />
        </div>
        <div className={activeTab === 'study' ? 'block' : 'hidden'}>
          <GameStudy />
        </div>
        <div className={activeTab === 'explorer' ? 'block' : 'hidden'}>
          <OpeningExplorer />
        </div>
      </main>
    </div>
  );
};

export default App;