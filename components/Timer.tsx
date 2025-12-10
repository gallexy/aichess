import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimerProps {
  initialTimeSeconds?: number;
  isActive: boolean;
  onTimeout: () => void;
  label: string;
}

const Timer: React.FC<TimerProps> = ({ initialTimeSeconds = 600, isActive, onTimeout, label }) => {
  const [timeLeft, setTimeLeft] = useState(initialTimeSeconds);

  useEffect(() => {
    let interval: number | undefined;

    if (isActive && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            onTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft, onTimeout]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeLeft < 60;

  return (
    <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${isActive 
      ? 'bg-slate-700 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
      : 'bg-slate-800 border-slate-700 opacity-70'}`}>
      <Clock className={`w-5 h-5 ${isLowTime && isActive ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
      <div className="flex flex-col">
        <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">{label}</span>
        <span className={`text-2xl font-mono font-bold ${isLowTime ? 'text-red-400' : 'text-white'}`}>
          {formatTime(timeLeft)}
        </span>
      </div>
    </div>
  );
};

export default Timer;
