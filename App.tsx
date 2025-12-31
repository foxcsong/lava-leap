import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { PlayerSkin, GameMode, ColorType, Difficulty } from './game/Entities';
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
  const [gameDifficulty, setGameDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  const [lives, setLives] = useState(1);
  const [countdown, setCountdown] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const rulesContainerRef = useRef<HTMLDivElement>(null);

  // 用户与排行榜状态
  const [currentUser, setCurrentUser] = useState<{ id: number, username: string } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [rankType, setRankType] = useState<'score' | 'mileage'>('score');
  const [rankFilterMode, setRankFilterMode] = useState<GameMode>(GameMode.NORMAL);
  const [rankFilterDiff, setRankFilterDiff] = useState<Difficulty>(Difficulty.NORMAL);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');

  // 管理后台状态
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [allScores, setAllScores] = useState<any[]>([]);
  const [adminError, setAdminError] = useState('');

  const submitScore = async (finalScore: number, finalDistance: number) => {
    if (!currentUser) return; // 匿名玩家不记录成绩到数据库

    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser?.id,
          username: currentUser?.username || '匿名玩家',
          score: finalScore,
          mileage: finalDistance,
          mode: gameMode,
          difficulty: gameDifficulty
        })
      });
    } catch (err) {
      console.error('Score submission failed:', err);
    }
  };

  const handleGameOver = useCallback((finalScore: number, finalDistance: number, finalMaxSpeed: number) => {
    setScore(finalScore);
    setDistance(finalDistance);
    setMaxSpeed(finalMaxSpeed);
    setGameState('GAMEOVER');
    setIsPaused(false);
    submitScore(finalScore, finalDistance);
  }, [currentUser, gameMode]);

  const handleUpdateStats = useCallback((currScore: number, currDistance: number, currMult: number, currLives: number, currCountdown: number) => {
    setScore(currScore);
    setDistance(currDistance);
    setSpeedMult(currMult);
    setLives(currLives);
    setCountdown(currCountdown);
  }, []);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(
        canvasRef.current,
        handleGameOver,
        handleUpdateStats,
        selectedSkin,
        gameMode,
        gameDifficulty
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

  // 同步难度
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setDifficulty(gameDifficulty);
    }
  }, [gameDifficulty]);

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
      // 防止某些键触发浏览器默认行为（如滚动）
      if (['Space', 'ArrowUp', 'ShiftLeft', 'ShiftRight', 'KeyZ', 'KeyX'].includes(e.code)) {
        if (gameState === 'PLAYING') e.preventDefault();
      }

      if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (gameState === 'START' || gameState === 'GAMEOVER') {
          startGame();
        } else {
          handleJumpPress();
        }
      }

      // 变色快捷键 (Shift, Z, X)
      if (gameMode === GameMode.COLOR_SHIFT && (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyZ' || e.code === 'KeyX')) {
        handleColorShift();
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        togglePause();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        handleJumpRelease();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, isPaused, gameMode]);

  const fetchLeaderboard = async (type: 'score' | 'mileage', modeFilter?: GameMode, diffFilter?: Difficulty) => {
    try {
      const activeMode = modeFilter !== undefined ? modeFilter : rankFilterMode;
      const activeDiff = diffFilter !== undefined ? diffFilter : rankFilterDiff;
      setRankType(type);
      setRankFilterMode(activeMode);
      setRankFilterDiff(activeDiff);

      let url = `/api/scores?type=${type}&mode=${activeMode}&difficulty=${activeDiff}`;

      const res = await fetch(url);
      const data = await res.json();
      setLeaderboardData(Array.isArray(data) ? data : []);
      setShowLeaderboard(true);
    } catch (err) {
      console.error('Failed to fetch leaderboard');
    }
  };

  const handleVersionClick = () => {
    setAdminClickCount(prev => {
      const next = prev + 1;
      if (next >= 7) {
        setShowAdminLogin(true);
        return 0;
      }
      return next;
    });
    // 3秒后重置计数
    setTimeout(() => setAdminClickCount(0), 3000);
  };

  const fetchAllScores = async () => {
    try {
      const res = await fetch('/api/admin', {
        headers: { 'X-Admin-Key': adminKey }
      });
      if (res.ok) {
        const data = await res.json();
        setAllScores(data);
        setShowAdminPanel(true);
        setShowAdminLogin(false);
      } else {
        setAdminError('密钥校验失败');
      }
    } catch (err) {
      setAdminError('请求异常');
    }
  };

  const deleteScore = async (id: number) => {
    if (!window.confirm('确定要删除此条记录吗？')) return;
    try {
      const res = await fetch(`/api/admin?id=${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': adminKey }
      });
      if (res.ok) {
        setAllScores(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      alert('删除失败');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        localStorage.setItem('lava_leap_user', JSON.stringify(data.user));
        setShowLoginModal(false);
      } else {
        setAuthError(data.error || '登录失败');
      }
    } catch (err) {
      setAuthError('网络请求失败');
    }
  };

  useEffect(() => {
    const checkOverflow = () => {
      if (rulesContainerRef.current) {
        const { scrollHeight, clientHeight } = rulesContainerRef.current;
        setShowScrollHint(scrollHeight > clientHeight + 5); // 增加 5px 容差
      }
    };

    if (gameState === 'START' && rulesContainerRef.current) {
      checkOverflow();
      // 使用 ResizeObserver 监听容器或内容尺寸变化
      const observer = new ResizeObserver(checkOverflow);
      observer.observe(rulesContainerRef.current);
      return () => observer.disconnect();
    }
  }, [gameState, gameMode]);

  useEffect(() => {
    const savedUser = localStorage.getItem('lava_leap_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('lava_leap_user');
      }
    }
  }, []);

  return (
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <div className="relative w-full h-full landscape:w-[92vw] landscape:h-[85vh] bg-black shadow-2xl overflow-hidden font-sans">
        <canvas
          ref={canvasRef}
          className={`w-full h-full block ${gameState === 'START' ? 'invisible' : 'visible'} ${gameMode === GameMode.COLOR_SHIFT ? 'bg-slate-950' : ''}`}
        />

        {/* HUD 数据显示 */}
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

        {/* 游戏内 HUD: 暂停与身份卡片 */}
        {(gameState === 'PLAYING' || gameState === 'GAMEOVER') && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
            {gameState === 'PLAYING' && (
              <button
                onClick={togglePause}
                className="w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/30 rounded-lg flex items-center justify-center text-white transition-all shadow-lg backdrop-blur-sm"
              >
                <i className={`fa-solid ${isPaused ? 'fa-play' : 'fa-pause'} text-xl`}></i>
              </button>
            )}

            <div className="bg-black/40 border border-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${currentUser ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-white leading-none uppercase tracking-tighter">
                    {currentUser ? currentUser.username : '匿名用户'}
                  </span>
                  {/* 生命值心形图标 */}
                  {gameDifficulty === Difficulty.EASY && (
                    <div className="flex gap-0.5 ml-1">
                      {[...Array(lives)].map((_, i) => (
                        <i key={i} className="fa-solid fa-heart text-red-500 text-[8px] animate-pulse"></i>
                      ))}
                    </div>
                  )}
                </div>
                {!currentUser && (
                  <span className="text-[8px] text-slate-400 font-bold leading-none mt-0.5">成绩不入榜</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 主菜单界面 */}
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center text-white p-4 z-50">
            {/* 角色选择与功能按钮 - 位于左上角 */}
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

              {/* 功能按钮组 - 放在角色选择下方 */}
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="flex-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm text-[10px] font-black text-white transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-user-astronaut text-orange-400"></i>
                    {currentUser ? currentUser.username : '账户验证'}
                  </button>
                  <button
                    onClick={() => fetchLeaderboard('score', undefined, gameDifficulty)}
                    className="flex-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm text-[10px] font-black text-white transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-trophy text-yellow-400"></i>
                    全服排行
                  </button>
                </div>
              </div>
            </div>

            {/* 模式选择 - 位于右上角 */}
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

              {/* 仅在普通模式下显示难度选择 */}
              {gameMode === GameMode.NORMAL && (
                <div className="mt-4 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-right duration-500">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mr-1">选择难度</span>
                  <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 backdrop-blur-sm">
                    {[
                      { id: Difficulty.NORMAL, label: '普通' },
                      { id: Difficulty.EASY, label: '简单 (3命)' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setGameDifficulty(d.id)}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${gameDifficulty === d.id
                          ? 'bg-orange-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 主标题 */}
            <h1 className="text-3xl md:text-7xl font-black mb-0 md:mb-2 tracking-tighter italic text-orange-500 uppercase drop-shadow-[0_4px_4px_rgba(0,0,0,1)]">
              LAVA DASH
            </h1>
            <p className="text-[10px] md:text-xl mb-2 md:mb-4 text-slate-300">跳跃，生存，收集宝石！</p>

            {/* 游戏规则展示 */}
            <div className="relative group max-w-xs md:max-w-xl w-full mb-3 px-2">
              <div
                ref={rulesContainerRef}
                className="bg-slate-900/90 p-3 md:p-8 rounded-2xl md:rounded-3xl border-2 border-slate-700 backdrop-blur-md overflow-y-auto max-h-[100px] md:max-h-[55vh] shadow-2xl transition-all custom-scrollbar relative"
              >
                <h3 className="text-orange-400 font-bold mb-2 border-b border-slate-700 pb-1 text-xs md:text-lg flex justify-between items-center sticky top-0 bg-slate-900/40 backdrop-blur-sm z-10">
                  <span>游戏规则</span>
                  <span className="text-[9px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30 md:hidden">
                    横屏最佳
                  </span>
                </h3>
                <ul className="text-xs md:text-sm space-y-3 md:space-y-4 text-slate-200 pb-4">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 flex-shrink-0 bg-cyan-500/20 rounded flex items-center justify-center">
                      <i className="fa-solid fa-cloud-arrow-up text-[10px] text-cyan-400"></i>
                    </div>
                    <span>按住 <span className="text-yellow-400 font-bold">右键</span> 或 <span className="text-yellow-400 font-bold">空格</span> 越升越高。</span>
                  </li>
                  {gameMode === GameMode.COLOR_SHIFT ? (
                    <li className="flex items-start gap-3 border-l-2 border-indigo-500 pl-3 py-1 bg-indigo-500/10">
                      <div className="w-5 h-5 flex-shrink-0 bg-indigo-500/20 rounded flex items-center justify-center">
                        <i className="fa-solid fa-palette text-[10px] text-indigo-400"></i>
                      </div>
                      <span>按 <span className="text-yellow-400 font-bold">左键 / Shift / Z</span> 变色，必须与地面一致。</span>
                    </li>
                  ) : (
                    <li className="flex items-start gap-3 text-slate-400">
                      <div className="w-5 h-5 flex-shrink-0 bg-slate-500/20 rounded flex items-center justify-center">
                        <i className="fa-solid fa-mouse text-[10px]"></i>
                      </div>
                      <span>两边按钮均可跳跃，支持二段跳。</span>
                    </li>
                  )}
                  <li className="flex items-start gap-3 text-red-300">
                    <div className="w-5 h-5 flex-shrink-0 bg-red-500/20 rounded flex items-center justify-center">
                      <i className="fa-solid fa-skull text-[10px]"></i>
                    </div>
                    <span>避开 <span className="font-bold underline decoration-red-500">岩浆</span> 与平台侧面。</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 flex-shrink-0 bg-yellow-500/20 rounded flex items-center justify-center">
                      <i className="fa-solid fa-gem text-[10px] text-yellow-400"></i>
                    </div>
                    <span>收集宝石提升积分，彩色大宝石加成丰厚。</span>
                  </li>
                </ul>
              </div>
              {/* 仅在溢出时显示滚动指引提示 */}
              {showScrollHint && (
                <>
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none rounded-b-3xl"></div>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-orange-500/80 flex flex-col items-center animate-bounce-subtle pointer-events-none z-20">
                    <span className="uppercase tracking-widest font-black text-[8px]">下滑查看更多</span>
                    <i className="fa-solid fa-chevron-down text-[8px]"></i>
                  </div>
                </>
              )}
            </div>

            {/* 开始按钮 */}
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={startGame}
                className="px-12 py-3 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 transition-colors rounded-full text-xl md:text-2xl font-bold uppercase tracking-widest shadow-xl transform hover:scale-105 active:scale-95 touch-manipulation z-[70] cursor-pointer"
              >
                立刻开跑
              </button>

              <div className="flex items-center gap-2 text-slate-400 text-xs mt-2 animate-pulse overflow-hidden bg-black/40 px-3 py-1 rounded-full border border-slate-700">
                <i className="fa-solid fa-sync fa-spin"></i>
                <span>建议锁定屏幕自动旋转，获得最佳全屏体验</span>
              </div>

              {/* 版本号显示 */}
              <div className="mt-8 flex flex-col items-center gap-1">
                <div
                  onClick={handleVersionClick}
                  className="text-slate-600 text-[10px] font-mono tracking-widest uppercase cursor-default select-none active:text-slate-500"
                >
                  Version {CONFIG.VERSION}
                </div>
                <div className="text-slate-500 text-[10px] md:text-xs font-medium tracking-widest uppercase">
                  开发者：高阶方陈（Nick）
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 登录/注册 模态框 */}
        {showLoginModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border-2 border-orange-500 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 text-white">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">玩家验证</h2>
                <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
              </div>
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">用户名</label>
                  <input
                    type="text"
                    value={authForm.username}
                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                    className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-500 transition-all outline-none"
                    placeholder="输入名字（不存在则自动创建）"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">密码</label>
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-orange-500 transition-all outline-none"
                    placeholder="••••••••"
                  />
                </div>
                {authError && <p className="text-red-500 text-xs font-bold text-center">{authError}</p>}
                <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95">确认进入</button>
                <div className="text-center">
                  <button type="button" onClick={() => setShowLoginModal(false)} className="text-slate-500 text-xs hover:text-slate-300">先不登录了，匿名游玩</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 排行榜 模态框 */}
        {showLeaderboard && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border-2 border-yellow-500 rounded-3xl p-4 md:p-8 w-full max-w-2xl shadow-2xl animate-in zoom-in duration-200 max-h-[85vh] flex flex-col text-white">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter">全球英雄榜</h2>
                  <div className="flex flex-col gap-1">
                    <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                      {[
                        { id: 'score', label: '最高分数' },
                        { id: 'mileage', label: '最远里程' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => fetchLeaderboard(t.id as any)}
                          className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${rankType === t.id ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400'}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowLeaderboard(false)} className="text-slate-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
              </div>

              {/* 模式过滤标签 */}
              <div className="flex gap-2 mb-4">
                {[
                  { id: GameMode.NORMAL, label: '普通模式' },
                  { id: GameMode.COLOR_SHIFT, label: '变色模式' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => fetchLeaderboard(rankType, m.id as any, rankFilterDiff)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black border transition-all ${rankFilterMode === m.id ? 'bg-cyan-600/20 border-cyan-500 text-cyan-400' : 'border-white/10 text-slate-500 hover:border-white/30'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* 难度过滤标签 */}
              <div className="flex gap-2 mb-6 animate-in fade-in slide-in-from-top duration-300">
                {[
                  { id: Difficulty.NORMAL, label: '普通难度' },
                  { id: Difficulty.EASY, label: '简单难度' },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => fetchLeaderboard(rankType, rankFilterMode, d.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black border transition-all ${rankFilterDiff === d.id
                      ? 'bg-green-600/20 border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                      : 'border-white/10 text-slate-500 hover:border-white/30'
                      }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[300px] md:max-h-[50vh]">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-900 text-slate-500 text-[10px] uppercase font-black border-b border-slate-800">
                    <tr>
                      <th className="py-2 pl-2">排名</th>
                      <th className="py-2">玩家</th>
                      <th className="py-2">{rankType === 'score' ? '最高总分' : '最远里程'}</th>
                      <th className="py-2">模式</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {leaderboardData.map((item, idx) => (
                      <tr key={idx} className={`border-b border-slate-800/50 ${idx < 3 ? 'bg-white/5' : ''}`}>
                        <td className="py-3 pl-2">
                          <span className={`w-6 h-6 rounded flex items-center justify-center font-black ${idx === 0 ? 'bg-yellow-400 text-black' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-orange-400 text-black' : 'text-slate-500'}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 font-bold">{item.username}</td>
                        <td className="py-3 text-orange-400 font-mono">{rankType === 'score' ? Math.floor(item.score).toLocaleString() : Math.floor(item.mileage).toLocaleString() + 'm'}</td>
                        <td className="py-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`text-[8px] px-2 py-0.5 rounded border uppercase font-black tracking-tighter ${item.mode == 1 || item.mode === 'COLOR_SHIFT' ? 'border-indigo-500/50 text-indigo-400 bg-indigo-500/10' : 'border-slate-500/50 text-slate-400 bg-slate-500/10'}`}>
                              {item.mode == 1 || item.mode === 'COLOR_SHIFT' ? '变色模式' : '普通模式'}
                            </span>
                            <span className={`text-[7px] font-bold mt-0.5 italic ${item.difficulty === 'EASY' ? 'text-green-500' : 'text-slate-600'}`}>
                              {item.difficulty === 'EASY' ? '简单难度' : '普通难度'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 游戏结束界面 */}
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
                  className="w-full py-4 bg-orange-600 hover:bg-orange-500 transition-colors rounded-xl text-xl font-bold uppercase shadow-lg transform active:scale-95"
                >
                  再次挑战
                </button>
                <button
                  onClick={goToMainMenu}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-lg font-bold text-slate-300 transform active:scale-95"
                >
                  返回主页
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 游戏进行中操作键 */}
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
                className={`pointer-events-auto w-24 h-24 md:w-36 md:h-36 border-4 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl backdrop-blur-sm select-none active:scale-95 text-white ${gameMode === GameMode.COLOR_SHIFT ? 'border-indigo-400 bg-indigo-600/30' : 'border-white/30 bg-white/10'} ${isPaused ? 'opacity-20' : ''}`}
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
                className={`pointer-events-auto w-24 h-24 md:w-36 md:h-36 bg-white/10 hover:bg-white/20 active:bg-white/40 border-4 border-white/30 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl backdrop-blur-sm select-none active:scale-95 text-white ${isPaused ? 'opacity-20' : ''}`}
              >
                <i className="fa-solid fa-angles-up text-2xl md:text-3xl mb-1"></i>
                <span className="text-xs md:text-xl font-black uppercase tracking-widest">跳跃</span>
              </button>
            </div>
          </>
        )}
        {/* 管理员登录弹窗 */}
        {showAdminLogin && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-red-500 rounded-2xl p-6 w-full max-w-xs shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              <h3 className="text-red-500 font-black mb-4 uppercase tracking-widest text-center">系统终端访问</h3>
              <input
                type="password"
                placeholder="ENTER MASTER KEY"
                className="w-full bg-black border border-slate-700 rounded px-3 py-2 text-white mb-4 outline-none focus:border-red-500 font-mono text-sm"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAllScores()}
              />
              {adminError && <div className="text-red-500 text-[10px] mb-2 text-center font-bold italic">{adminError}</div>}
              <div className="flex gap-2">
                <button onClick={fetchAllScores} className="flex-1 bg-red-600 py-2 rounded font-bold text-white text-xs">执行</button>
                <button onClick={() => setShowAdminLogin(false)} className="flex-1 bg-slate-800 py-2 rounded font-bold text-slate-400 text-xs text-center">取消</button>
              </div>
            </div>
          </div>
        )}

        {/* 管理员面板 */}
        {showAdminPanel && (
          <div className="absolute inset-0 bg-slate-950 z-[210] flex flex-col p-4 md:p-8 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-white text-2xl font-black italic">ADMIN CONSOLE</h2>
                <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest italic">Live Data Moderation</span>
              </div>
              <button onClick={() => setShowAdminPanel(false)} className="bg-white/10 w-10 h-10 rounded-full text-white hover:bg-white/20">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs text-slate-300">
                <thead className="sticky top-0 bg-slate-950 text-slate-500 uppercase font-black text-[10px] border-b border-white/5">
                  <tr>
                    <th className="py-2 text-left">ID</th>
                    <th className="py-2 text-left">Player</th>
                    <th className="py-2 text-right">Score/m</th>
                    <th className="py-2 text-center">Mode</th>
                    <th className="py-2 text-center">Date</th>
                    <th className="py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {allScores.map(s => (
                    <tr key={s.id} className="hover:bg-white/5">
                      <td className="py-3 font-mono text-slate-600">{s.id}</td>
                      <td className="py-3 font-bold text-white">{s.username}</td>
                      <td className="py-3 text-right">
                        <span className="text-cyan-400">{s.score}</span> / <span className="text-yellow-500">{s.mileage}m</span>
                      </td>
                      <td className="py-3 text-center opacity-60 font-mono text-[9px]">{s.mode}</td>
                      <td className="py-3 text-center opacity-40 text-[9px]">{new Date(s.timestamp).toLocaleDateString()}</td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => deleteScore(s.id)}
                          className="bg-red-500/20 text-red-400 px-3 py-1 rounded hover:bg-red-500 hover:text-white transition-all text-[10px] font-bold"
                        >
                          DELETE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div >
    </div >
  );
};

export default App;
