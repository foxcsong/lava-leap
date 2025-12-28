import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { PlayerSkin, GameMode, ColorType } from './game/Entities';
import { sounds } from './game/SoundManager';
import { CONFIG } from './game/Config';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(1.0);
  const [speedMult, setSpeedMult] = useState(1.0);
  const [selectedSkin, setSelectedSkin] = useState<PlayerSkin>(PlayerSkin.DEFAULT);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.NORMAL);

  const handleGameOver = useCallback((finalScore: number, finalDistance: number, finalMaxSpeed: number) => {
    setScore(finalScore);
    setDistance(finalDistance);
    setMaxSpeed(finalMaxSpeed);
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
        handleUpdateStats,
        selectedSkin,
        gameMode
      );
    }
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [handleGameOver, handleUpdateStats]);

  // 同步皮肤
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSkin(selectedSkin);
    }
  }, [selectedSkin]);

  // 同步模式
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setMode(gameMode);
    }
  }, [gameMode]);

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

  const resumeAudioContext = () => {
    sounds.playJump(); // 此调用只是为了激活 AudioContext
  };

  const startGame = () => {
    resumeAudioContext();
    setGameState('PLAYING');
    setIsPaused(false);

    if (engineRef.current) {
      try {
        engineRef.current.reset();
      } catch (err) {
        console.error('Engine reset failed:', err);
      }
    }

    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {
        console.warn('Fullscreen request failed');
      });
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
      resumeAudioContext();
      engineRef.current?.startJump();
    }
  };

  const handleColorShift = () => {
    if (gameState === 'PLAYING' && !isPaused) {
      resumeAudioContext();
      sounds.playColorShift();
      engineRef.current?.switchPlayerColor();
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
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <div className="relative w-full h-full landscape:w-[92vw] landscape:h-[85vh] bg-black shadow-2xl overflow-hidden font-sans">
        <canvas
          ref={canvasRef}
          className={`w-full h-full block ${gameState === 'START' ? 'invisible' : 'visible'} ${gameMode === GameMode.COLOR_SHIFT ? 'bg-slate-950' : ''}`}
        />

        <div className="absolute top-4 right-4 text-white text-right drop-shadow-lg pointer-events-none select-none z-10">
          {gameState !== 'START' && (
            <>
              <div className="text-xl font-bold">里程: <span className="text-yellow-400">{Math.floor(distance)}m</span></div>
              <div className="text-xl font-bold">分数: <span className="text-cyan-400">{score}</span></div>
              <div className="text-lg font-bold">速度: <span className={`${speedMult > 2.5 ? 'text-red-500 animate-pulse' : 'text-orange-400'}`}>{(speedMult * 100).toFixed(0)}%</span></div>
              {gameMode === GameMode.COLOR_SHIFT && (
                <div className="mt-1 px-2 py-0.5 bg-indigo-600/40 border border-indigo-400/50 rounded text-xs font-black uppercase tracking-widest text-indigo-100"> Color Shift Mode </div>
              )}
            </>
          )}
        </div>

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
            {/* 角色选择 - 左上角 */}
            <div className="absolute top-4 left-4 z-[60] flex flex-col gap-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest ml-1">选择角色</span>
              <div className="flex gap-2">
                {[
                  { id: PlayerSkin.DEFAULT, label: '方橙', color: 'bg-orange-500' },
                  { id: PlayerSkin.FROG, label: '蛙姐', color: 'bg-green-500' },
                  { id: PlayerSkin.CHICKEN, label: '熔岩鸡', color: 'bg-white' },
                ].map((skin) => (
                  <button
                    key={skin.id}
                    onClick={() => setSelectedSkin(skin.id)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div
                      className={`relative w-12 h-12 md:w-16 md:h-16 rounded-xl border-2 transition-all flex items-center justify-center overflow-hidden animate-in fade-in slide-in-from-left duration-300 ${selectedSkin === skin.id
                        ? 'border-yellow-400 bg-white/20 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                    >
                      <div className={`w-6 h-6 md:w-8 md:h-8 ${skin.color} rounded-sm shadow-sm transform group-hover:scale-110 transition-transform`}></div>
                      {selectedSkin === skin.id && (
                        <div className="absolute top-0 right-0 p-1">
                          <i className="fa-solid fa-circle-check text-yellow-400 text-[10px]"></i>
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] md:text-xs font-bold transition-colors ${selectedSkin === skin.id ? 'text-yellow-400' : 'text-slate-400'}`}>
                      {skin.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 模式选择 - 右上角 */}
            <div className="absolute top-4 right-4 z-[60] flex flex-col items-end gap-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mr-1">游戏模式</span>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-sm shadow-xl">
                {[
                  { id: GameMode.NORMAL, label: '普通', icon: 'fa-cube' },
                  { id: GameMode.COLOR_SHIFT, label: '变色', icon: 'fa-palette' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setGameMode(m.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${gameMode === m.id
                      ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-105'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <i className={`fa-solid ${m.icon}`}></i>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

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
                  <span>按住 <span className="text-yellow-400 font-mono bg-black/30 px-1 rounded">右键</span> 或 <span className="text-yellow-400 font-mono bg-black/30 px-1 rounded">跳跃按钮</span> 控制高度，支持二段跳。</span>
                </li>
                {gameMode === GameMode.COLOR_SHIFT ? (
                  <li className="flex items-start gap-3 border-l-2 border-indigo-500 pl-3 py-1 bg-indigo-500/10">
                    <i className="fa-solid fa-palette mt-1 text-indigo-400"></i>
                    <span>在该模式下，<span className="text-yellow-400 font-mono bg-black/30 px-1 rounded">左键</span> 将变为 <span className="text-indigo-400 font-bold uppercase">变色</span>。角色颜色必须与踏上的平台颜色一致。</span>
                  </li>
                ) : (
                  <li className="flex items-start gap-3">
                    <i className="fa-solid fa-mouse mt-1 text-slate-400"></i>
                    <span>两边的按钮都可以进行跳跃，适合双手操作。</span>
                  </li>
                )}
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-triangle-exclamation mt-1 text-red-500"></i>
                  <span>碰到 <span className="text-red-500 font-bold">岩浆</span> 或撞到平台 <span className="text-red-500 font-bold">侧面</span> 会立即失败。</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-gem mt-1 text-cyan-300"></i>
                  <span><span className="text-cyan-300">蓝色宝石</span> 加分，<span className="text-purple-400 font-bold">彩色大宝石</span> 提供巨额积分。</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={startGame}
                onTouchStart={(e) => { e.stopPropagation(); }}
                className="px-12 py-3 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 transition-colors rounded-full text-xl md:text-2xl font-bold uppercase tracking-widest shadow-xl transform hover:scale-105 active:scale-95 touch-manipulation z-[70] cursor-pointer"
              >
                立刻开跑
              </button>
              <div className="flex items-center gap-2 text-slate-400 text-xs mt-2 animate-pulse overflow-hidden bg-black/40 px-3 py-1 rounded-full border border-slate-700">
                <i className="fa-solid fa-sync fa-spin"></i>
                <span>建议锁定屏幕自动旋转，获得最佳全屏体验</span>
              </div>
              <div className="mt-8 flex flex-col items-center gap-1">
                <div className="text-slate-600 text-[10px] font-mono tracking-widest uppercase">
                  Version {CONFIG.VERSION}
                </div>
                <div className="text-slate-500 text-[10px] md:text-xs font-medium tracking-widest uppercase">
                  开发者：高阶方陈（Nick）
                </div>
              </div>
            </div>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-red-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 z-[100] animate-in fade-in duration-300">
            <div className="bg-slate-900/95 p-6 md:p-10 rounded-3xl border-4 border-orange-500 shadow-2xl flex flex-col items-center max-w-sm w-full animate-in zoom-in duration-300">
              <h2 className="text-3xl font-black mb-2 text-orange-500 text-center uppercase tracking-tighter italic">GAME OVER</h2>
              <div className="text-yellow-400 font-bold mb-6 text-sm md:text-base animate-pulse text-center">
                你真棒！我跑了这么远！
              </div>
              <div className="w-full space-y-2 mb-6 text-xl">
                <div className="flex justify-between border-b border-slate-700 pb-1">
                  <span>总里程</span>
                  <span className="font-mono text-yellow-400">{Math.floor(distance)}m</span>
                </div>
                <div className="flex justify-between border-b border-slate-700 pb-1">
                  <span>得分</span>
                  <span className="font-mono text-cyan-400">{score}</span>
                </div>
                <div className="flex justify-between border-b border-slate-700 pb-1">
                  <span>最高速度</span>
                  <span className="font-mono text-pink-400">{maxSpeed.toFixed(2)}x</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={startGame}
                  onTouchEnd={(e) => { e.preventDefault(); startGame(); }}
                  className="w-full py-4 bg-orange-600 hover:bg-orange-500 transition-colors rounded-xl text-xl font-bold uppercase shadow-lg transform active:scale-95"
                >
                  再次挑战
                </button>
                <button
                  onClick={goToMainMenu}
                  onTouchEnd={(e) => { e.preventDefault(); goToMainMenu(); }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-lg font-bold text-slate-300 transform active:scale-95"
                >
                  返回主页
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === 'PLAYING' && (
          <>
            {/* 左侧功能键 */}
            <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 pointer-events-none z-30">
              <button
                onMouseDown={(e) => { e.preventDefault(); gameMode === GameMode.COLOR_SHIFT ? handleColorShift() : handleJumpPress(); }}
                onMouseUp={(e) => { e.preventDefault(); if (gameMode !== GameMode.COLOR_SHIFT) handleJumpRelease(); }}
                onMouseLeave={(e) => { e.preventDefault(); if (gameMode !== GameMode.COLOR_SHIFT) handleJumpRelease(); }}
                onTouchStart={(e) => { e.preventDefault(); gameMode === GameMode.COLOR_SHIFT ? handleColorShift() : handleJumpPress(); }}
                onTouchEnd={(e) => { e.preventDefault(); if (gameMode !== GameMode.COLOR_SHIFT) handleJumpRelease(); }}
                className={`pointer-events-auto w-24 h-24 md:w-36 md:h-36 border-4 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl backdrop-blur-sm select-none active:scale-95 ${gameMode === GameMode.COLOR_SHIFT ? 'border-indigo-400 bg-indigo-600/30' : 'border-white/30 bg-white/10'} ${isPaused ? 'opacity-20' : ''}`}
              >
                <i className={`fa-solid ${gameMode === GameMode.COLOR_SHIFT ? 'fa-palette' : 'fa-angles-up'} text-2xl md:text-3xl mb-1`}></i>
                <span className="text-xs md:text-xl font-black uppercase tracking-widest">
                  {gameMode === GameMode.COLOR_SHIFT ? '变色' : '跳跃'}
                </span>
              </button>
            </div>

            {/* 右侧跳跃键 */}
            <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 pointer-events-none z-30">
              <button
                onMouseDown={handleJumpPress}
                onMouseUp={handleJumpRelease}
                onMouseLeave={handleJumpRelease}
                onTouchStart={(e) => { e.preventDefault(); handleJumpPress(); }}
                onTouchEnd={(e) => { e.preventDefault(); handleJumpRelease(); }}
                className={`pointer-events-auto w-24 h-24 md:w-36 md:h-36 bg-white/10 hover:bg-white/20 active:bg-white/40 border-4 border-white/30 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl backdrop-blur-sm select-none active:scale-95 ${isPaused ? 'opacity-20' : ''}`}
              >
                <i className="fa-solid fa-angles-up text-2xl md:text-3xl mb-1"></i>
                <span className="text-xs md:text-xl font-black uppercase tracking-widest">跳跃</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
