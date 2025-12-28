
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { PlayerSkin } from './game/Entities';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speedMult, setSpeedMult] = useState(1.0);
  const [selectedSkin, setSelectedSkin] = useState<PlayerSkin>(PlayerSkin.DEFAULT);
  const [shareImage, setShareImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
        handleUpdateStats,
        selectedSkin
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
    // 立即切换状态，确保 UI 响应，防止被请求全屏可能产生的阻塞
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

    // 在状态切换后再异步请求全屏（仅在有交互时有效）
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

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const canv = document.createElement('canvas');
      const ctx = canv.getContext('2d');
      if (!ctx) return;

      // 海报尺寸 (标准竖向)
      canv.width = 750;
      canv.height = 1100;

      // 1. 背景渐变
      const grad = ctx.createLinearGradient(0, 0, 0, canv.height);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canv.width, canv.height);

      // 2. 装饰边框/底纹
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
      ctx.lineWidth = 15;
      ctx.strokeRect(30, 30, canv.width - 60, canv.height - 60);

      // 3. 标题
      ctx.fillStyle = '#f97316';
      ctx.font = 'italic black 100px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LAVA DASH', canv.width / 2, 180);

      // 4. 用户寄语
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText('你真棒！我跑了这么远！', canv.width / 2, 280);

      // 5. 分数面板
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(100, 360, 550, 300);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(100, 360, 550, 300);

      ctx.fillStyle = '#fbbf24'; // 里程颜色
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('总里程', canv.width / 2, 430);
      ctx.font = 'bold 80px Courier New';
      ctx.fillText(`${Math.floor(distance)}m`, canv.width / 2, 510);

      ctx.fillStyle = '#22d3ee'; // 分数颜色
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('最终得分', canv.width / 2, 590);
      ctx.font = 'bold 60px Courier New';
      ctx.fillText(`${score}`, canv.width / 2, 650);

      // 6. 二维码图片
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent('https://lavaleap.2284.xyz')}&color=f97316&bgcolor=000000`;

      const qrImage = new Image();
      qrImage.crossOrigin = "anonymous";
      qrImage.src = qrUrl;

      await new Promise((resolve, reject) => {
        qrImage.onload = resolve;
        qrImage.onerror = reject;
      });

      // 绘制二维码容器
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(canv.width / 2 - 125, 750, 250, 250);
      ctx.drawImage(qrImage, canv.width / 2 - 125, 750, 250, 250);

      // 7. 引导文案
      ctx.fillStyle = '#94a3b8';
      ctx.font = '28px sans-serif';
      ctx.fillText('长按识别二维码，挑战我的高分', canv.width / 2, 1040);

      const dataUrl = canv.toDataURL('image/png');
      setShareImage(dataUrl);
    } catch (err) {
      console.error('Failed to generate share image:', err);
      alert('生成海报失败，请重试');
    } finally {
      setIsGenerating(false);
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
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {/* 游戏安全容器: 在正常横屏时提供边距，在强制旋转时充满可用空间 */}
      <div className="relative w-full h-full landscape:w-[92vw] landscape:h-[85vh] bg-black shadow-2xl overflow-hidden font-sans">

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
                  <span>按住 <span className="text-yellow-400 font-mono bg-black/30 px-1 rounded">空格</span> 或 <span className="text-yellow-400 font-mono bg-black/30 px-1 rounded">跳跃按钮</span> 控制高度，支持 <span className="text-cyan-400 font-bold">二段跳</span>。</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-triangle-exclamation mt-1 text-red-500"></i>
                  <span>碰到 <span className="text-red-500 font-bold">岩浆</span> 或撞到平台 <span className="text-red-500 font-bold">侧面</span> 会立即失败。</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-gem mt-1 text-cyan-300"></i>
                  <span><span className="text-cyan-300">蓝色宝石</span> 加分，<span className="text-purple-400 font-bold">彩色大宝石</span> 提供巨额积分。</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-caret-down mt-1 text-red-400"></i>
                  <span>速度极快时会出现 <span className="text-red-400 font-bold">红色减速宝石</span>，吃掉可降低移动速度。</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={startGame}
                // 在微信强制旋转模式下，有时候 touch 事件更可靠
                onTouchStart={(e) => {
                  e.stopPropagation();
                  // 不调用 preventDefault 以便 onClick 也能触发（或二选一）
                }}
                className="px-12 py-3 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 transition-colors rounded-full text-xl md:text-2xl font-bold uppercase tracking-widest shadow-xl transform hover:scale-105 active:scale-95 touch-manipulation z-[70] cursor-pointer"
              >
                立刻开跑
              </button>

              <div className="flex items-center gap-2 text-slate-400 text-xs mt-2 animate-pulse overflow-hidden bg-black/40 px-3 py-1 rounded-full border border-slate-700">
                <i className="fa-solid fa-sync fa-spin"></i>
                <span>建议锁定屏幕自动旋转，获得最佳全屏体验</span>
              </div>
            </div>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-red-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 z-40">
            <div className="bg-slate-900/95 p-6 md:p-10 rounded-3xl border-4 border-orange-500 shadow-2xl flex flex-col items-center max-w-sm w-full animate-in zoom-in duration-300">
              <h2 className="text-3xl font-black mb-2 text-orange-500 text-center uppercase tracking-tighter italic">GAME OVER</h2>
              <div className="text-yellow-400 font-bold mb-6 text-sm md:text-base animate-pulse text-center">
                你真棒！转发朋友圈秀出你的分数吧！
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
              </div>

              <div className="flex flex-col gap-3 w-full">
                <div className="flex gap-2">
                  <button
                    onClick={startGame}
                    onTouchEnd={(e) => { e.preventDefault(); startGame(); }}
                    className="flex-1 py-4 bg-orange-600 hover:bg-orange-500 transition-colors rounded-xl text-xl font-bold uppercase shadow-lg transform active:scale-95"
                  >
                    再来
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 transition-colors rounded-xl text-xl font-bold uppercase shadow-lg flex items-center justify-center gap-2 transform active:scale-95"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fa-solid fa-share-nodes"></i>
                    )}
                    分享
                  </button>
                </div>
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

        {/* 分享海报弹窗 */}
        {shareImage && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-[100] animate-in fade-in duration-300">
            <div className="relative max-w-[90vw] max-h-[80vh] flex flex-col items-center">
              <img src={shareImage} alt="Share Poster" className="w-full h-full object-contain rounded-lg shadow-2xl border-2 border-white/20" />
              <button
                onClick={() => setShareImage(null)}
                className="absolute -top-4 -right-4 w-10 h-10 bg-red-500 text-white rounded-full shadow-xl flex items-center justify-center border-2 border-white"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
              <div className="mt-4 text-white text-center">
                <p className="text-lg font-bold">海报已生成！</p>
                <p className="text-sm text-slate-400">长按上方图片保存，或直接分享给好友</p>
              </div>
            </div>
          </div>
        )}

        {gameState === 'PLAYING' && (
          <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 pointer-events-none z-30">
            <button
              onMouseDown={handleJumpPress}
              onMouseUp={handleJumpRelease}
              onMouseLeave={handleJumpRelease}
              onTouchStart={(e) => { e.preventDefault(); handleJumpPress(); }}
              onTouchEnd={(e) => { e.preventDefault(); handleJumpRelease(); }}
              className={`pointer-events-auto w-24 h-24 md:w-36 md:h-36 bg-white/10 hover:bg-white/20 active:bg-white/40 border-4 border-white/30 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl backdrop-blur-sm select-none ${isPaused ? 'opacity-20' : ''}`}
            >
              <i className="fa-solid fa-angles-up text-2xl md:text-3xl mb-1"></i>
              <span className="text-xs md:text-xl font-black uppercase tracking-widest">跳跃</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
