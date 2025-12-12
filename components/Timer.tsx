import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimerProps {
  initialTimeSeconds?: number;
  isActive: boolean;
  onTimeout: () => void;
  label: string;
  variant?: 'light' | 'dark';
}

const Timer: React.FC<TimerProps> = ({ initialTimeSeconds = 600, isActive, onTimeout, label, variant = 'dark' }) => {
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
  const isLight = variant === 'light';

  // Dynamic classes based on variant (light/dark) and state (active/inactive)
  // Reduced padding (px-5 py-3 -> px-3 py-1) and min-width to make it shorter/compact
  let containerClasses = "flex items-center space-x-2 px-3 py-1.5 rounded-lg border-2 transition-all duration-300 min-w-[130px] ";
  
  if (isLight) {
      // Light Theme (White Background)
      if (isActive) {
          containerClasses += "bg-white border-emerald-500 shadow-[0_0_10px_rgba(255,255,255,0.3)] scale-105 z-10";
      } else {
          containerClasses += "bg-slate-200 border-slate-300 opacity-60 text-slate-500 grayscale";
      }
  } else {
      // Dark Theme (Dark Background)
      if (isActive) {
          containerClasses += "bg-slate-800 border-emerald-500 shadow-[0_0_10px_rgba(0,0,0,0.5)] scale-105 z-10";
      } else {
          containerClasses += "bg-slate-900 border-slate-800 opacity-60 text-slate-500";
      }
  }

  // Text Styling
  const labelColor = isLight 
    ? (isActive ? "text-slate-500" : "text-slate-400")
    : (isActive ? "text-slate-400" : "text-slate-600");

  // Reduced text size (text-3xl -> text-xl)
  let timeColor = "text-xl font-mono font-bold tracking-tight ";
  if (isLowTime) {
      timeColor += "text-red-500";
  } else {
      timeColor += isLight ? "text-slate-900" : "text-white";
  }

  const iconColor = isLowTime && isActive
     ? 'text-red-500 animate-pulse' 
     : (isLight ? 'text-slate-400' : 'text-slate-600');

  return (
    <div className={containerClasses}>
      <Clock className={`w-4 h-4 ${iconColor}`} />
      <div className="flex flex-col leading-none justify-center">
        <span className={`text-[9px] uppercase font-black tracking-widest ${labelColor}`}>{label}</span>
        <span className={timeColor}>
          {formatTime(timeLeft)}
        </span>
      </div>
    </div>
  );
};

export default Timer;