
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speedMult, setSpeedMult] = useState(1.0);

  const handleGameOver = useCallback((finalScore: number, finalDistance: number) => {
    setScore(finalScore);
    setDistance(finalDistance);
    setGameState('GAMEOVER');
    setIsPaused(false);
  }, []);

  const handleUpdateStats = useCallback((currScore: number, currDistance: number, currMult: number) => {
    setScore(currScore);
    setDistance(currDistance);
    setSpeedMult(currMult);
  }, []);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(
        canvasRef.current,
        handleGameOver,
        handleUpdateStats
      );
    }
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [handleGameOver, handleUpdateStats]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const startGame = () => {
    // 立即切换状态，确保 UI 响应
    setGameState('PLAYING');
    setIsPaused(false);

    // 尝试重置引擎
    if (engineRef.current) {
      try {
        engineRef.current.reset();
      } catch (err) {
        console.error('Engine reset failed:', err);
      }
    }
  };

  const goToMainMenu = () => {
    setGameState('START');
  };

  const togglePause = () => {
    if (gameState === 'PLAYING') {
      engineRef.current?.togglePause();
      setIsPaused(prev => !prev);
    }
  };

  const handleJumpPress = () => {
    if (gameState === 'PLAYING' && !isPaused) {
      engineRef.current?.startJump();
    }
  };

  const handleJumpRelease = () => {
    if (gameState === 'PLAYING') {
      engineRef.current?.stopJump();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (gameState === 'START' || gameState === 'GAMEOVER') {
          startGame();
        } else {
          handleJumpPress();
        }
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        togglePause();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        handleJumpRelease();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, isPaused]);

  return (
    <div className="w-screen h-[100dvh] bg-zinc-950 flex items-center justify-center p-0 landscape:p-4 overflow-hidden">
      {/* 游戏安全容器: 在横屏时缩小并居中，避开浏览器 UI 遮挡 */}
      <div className="relative w-full h-full landscape:max-w-[92vw] landscape:max-h-[85vh] bg-black shadow-2xl overflow-hidden rounded-none landscape:rounded-xl border-0 landscape:border-2 landscape:border-white/10 font-sans">

        {/* 画布 */}
        <canvas
          ref={canvasRef}
          className={`w-full h-full block ${gameState === 'START' ? 'invisible' : 'visible'}`}
        />

        {/* 统计信息覆盖层 */}
        <div className="absolute top-4 right-4 text-white text-right drop-shadow-lg pointer-events-none select-none z-10">
          {gameState !== 'START' && (
            <>
              <div className="text-xl font-bold">里程: <span className="text-yellow-400">{Math.floor(distance)}m</span></div>
              <div className="text-xl font-bold">分数: <span className="text-cyan-400">{score}</span></div>
              <div className="text-lg font-bold">速度: <span className={`${speedMult > 2.5 ? 'text-red-500 animate-pulse' : 'text-orange-400'}`}>{(speedMult * 100).toFixed(0)}%</span></div>
            </>
          )}
        </div>

        {/* 暂停按钮 */}
        {gameState === 'PLAYING' && (
          <button
            onClick={togglePause}
            className="absolute top-4 left-4 w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/30 rounded-lg flex items-center justify-center text-white transition-all shadow-lg backdrop-blur-sm z-20"
          >
            <i className={`fa-solid ${isPaused ? 'fa-play' : 'fa-pause'} text-xl`}></i>
          </button>
        )}

        {gameState === 'START' && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center text-white p-4 z-50">
            <h1 className="text-5xl md:text-7xl font-black mb-2 tracking-tighter italic text-orange-500 uppercase drop-shadow-[0_4px_4px_rgba(0,0,0,1)]">
              LAVA DASH
            </h1>
            <p className="text-lg md:text-xl mb-4 text-slate-300">跳跃，生存，收集宝石！</p>

            <div className="bg-slate-900/90 p-5 md:p-6 rounded-2xl border border-slate-700 max-w-lg mb-6 backdrop-blur-md overflow-y-auto max-h-[40vh]">
              <h3 className="text-orange-400 font-bold mb-3 border-b border-slate-700 pb-1 text-lg flex justify-between items-center">
                <span>游戏规则</span>
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30 md:hidden">
                  <i className="fa-solid fa-mobile-screen-button mr-1"></i> 横屏体验最佳
                </span>
              </h3>
              <ul className="text-xs md:text-sm space-y-2 md:space-y-3 text-slate-200">
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-keyboard mt-1 text-cyan-400"></i>
                  <span>按住 <span className="text-yellow-400 font-mono bg-black/30 px-1 rounded">空格</span> 或 <span className="text-yellow-400 font-mono bg-black/30 px-1 rounded">跳跃按钮</span> 控制高度。</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-triangle-exclamation mt-1 text-red-500"></i>
                  <span>碰到 <span className="text-red-500 font-bold">岩浆</span> 或撞到平台 <span className="text-red-500 font-bold">侧面</span> 会立即失败。</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={startGame}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  startGame();
                }}
                className="px-12 py-3 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 transition-colors rounded-full text-xl md:text-2xl font-bold uppercase tracking-widest shadow-xl transform hover:scale-105 active:scale-95 touch-manipulation z-[60]"
              >
                立刻开跑
              </button>
            </div>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-red-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 z-40">
            <div className="bg-slate-900/95 p-6 md:p-10 rounded-3xl border-4 border-orange-500 shadow-2xl flex flex-col items-center max-w-sm w-full animate-in zoom-in duration-300">
              <h2 className="text-3xl font-black mb-4 text-orange-500 text-center uppercase tracking-tighter italic">GAME OVER</h2>
              <div className="w-full space-y-2 mb-6 text-xl">
                <div className="flex justify-between border-b border-slate-700 pb-1">
                  <span>总里程</span>
                  <span className="font-mono text-yellow-400">{Math.floor(distance)}m</span>
                </div>
                <div className="flex justify-between border-b border-slate-700 pb-1">
                  <span>得分</span>
                  <span className="font-mono text-cyan-400">{score}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={startGame}
                  onTouchEnd={(e) => { e.preventDefault(); startGame(); }}
                  className="w-full py-4 bg-orange-600 hover:bg-orange-500 transition-colors rounded-xl text-xl font-bold uppercase shadow-lg"
                >
                  再次挑战
                </button>
                <button
                  onClick={goToMainMenu}
                  onTouchEnd={(e) => { e.preventDefault(); goToMainMenu(); }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-lg font-bold text-slate-300"
                >
                  返回主页
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === 'PLAYING' && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none z-30 px-[env(safe-area-inset-bottom)]">
            <button
              onMouseDown={handleJumpPress}
              onMouseUp={handleJumpRelease}
              onMouseLeave={handleJumpRelease}
              onTouchStart={(e) => { e.preventDefault(); handleJumpPress(); }}
              onTouchEnd={(e) => { e.preventDefault(); handleJumpRelease(); }}
              className={`pointer-events-auto w-24 h-24 md:w-32 md:h-32 bg-white/10 hover:bg-white/20 active:bg-white/40 border-4 border-white/30 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl backdrop-blur-sm select-none ${isPaused ? 'opacity-20' : ''}`}
            >
              <i className="fa-solid fa-angles-up text-2xl mb-1"></i>
              <span className="text-sm font-black uppercase tracking-widest">跳跃</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
