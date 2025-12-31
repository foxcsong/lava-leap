
import { CONFIG } from './Config';
import { Player, Platform, Gem, Particle, GemType, PlayerSkin, GameMode, ColorType, Difficulty } from './Entities';
import { sounds } from './SoundManager';

export class GameEngine {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private animationId: number | null = null;

    private player: Player;
    private platforms: Platform[] = [];
    private gems: Gem[] = [];
    private particles: Particle[] = [];

    private lastTime: number = 0;
    private distance: number = 0;
    private speedPenalty: number = 0;
    private score: number = 0;
    private speedMultiplier: number = 1.0;
    private isRunning: boolean = false;
    private isPaused: boolean = false;
    private maxSpeedReached: number = 1.0;
    private skin: PlayerSkin = PlayerSkin.DEFAULT;
    private mode: GameMode = GameMode.NORMAL;

    private cameraY: number = 0;
    private lastX: number = 0;
    private lastY: number = 0;
    private difficulty: Difficulty = Difficulty.NORMAL;
    private respawnTimer: number = 0;

    constructor(
        canvas: HTMLCanvasElement,
        private onGameOver: (score: number, distance: number, maxSpeed: number) => void,
        private onUpdateStats: (score: number, distance: number, speedMult: number, lives: number, countdown: number) => void,
        initialSkin: PlayerSkin = PlayerSkin.DEFAULT,
        initialMode: GameMode = GameMode.NORMAL,
        initialDifficulty: Difficulty = Difficulty.NORMAL
    ) {
        this.canvas = canvas;
        this.skin = initialSkin;
        this.mode = initialMode;
        this.difficulty = initialDifficulty;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        this.ctx = ctx;

        this.player = new Player(this.canvas.clientWidth * 0.3, this.canvas.clientHeight / 2, this.skin, this.mode);
        this.resize();
        window.addEventListener('resize', this.resize);
    }

    public setSkin(skin: PlayerSkin) {
        this.skin = skin;
        if (this.player) this.player.skin = skin;
    }

    public setMode(mode: GameMode) {
        this.mode = mode;
        if (this.player) this.player.mode = mode;
    }

    public setDifficulty(difficulty: Difficulty) {
        this.difficulty = difficulty;
        if (this.player) {
            this.player.difficulty = difficulty;
            this.player.lives = difficulty === Difficulty.EASY ? 3 : 1;
        }
    }

    public switchPlayerColor() {
        if (this.player) this.player.switchColor();
    }

    private resize = () => {
        // 使用 clientWidth 和 clientHeight 获取旋转前的布局尺寸
        // 避开 getBoundingClientRect() 在 CSS transform 后的旋转包围盒尺寸
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        // 计算全局缩放比例，以 1080px 高度为基准
        CONFIG.GLOBAL_SCALE = Math.max(0.35, this.canvas.height / CONFIG.REFERENCE_HEIGHT);

        // 同步物理参数缩放
        CONFIG.RUN_SPEED = CONFIG.BASE_RUN_SPEED * CONFIG.GLOBAL_SCALE;
        CONFIG.GRAVITY = CONFIG.BASE_GRAVITY * CONFIG.GLOBAL_SCALE;
        CONFIG.JUMP_FORCE_INITIAL = CONFIG.BASE_JUMP_FORCE_INITIAL * CONFIG.GLOBAL_SCALE;
        CONFIG.JUMP_FORCE_HOLD = CONFIG.BASE_JUMP_FORCE_HOLD * CONFIG.GLOBAL_SCALE;

        // 自动生成参数缩放
        CONFIG.MAX_PLATFORM_GAP = CONFIG.BASE_MAX_PLATFORM_GAP * CONFIG.GLOBAL_SCALE;
        CONFIG.MAX_PLATFORM_STEP = CONFIG.BASE_MAX_PLATFORM_STEP * CONFIG.GLOBAL_SCALE;
        CONFIG.MIN_PLATFORM_WIDTH = CONFIG.BASE_MIN_PLATFORM_WIDTH * CONFIG.GLOBAL_SCALE;

        // 动态高度限制
        CONFIG.GROUND_Y = this.canvas.height * 0.5;
        CONFIG.WORLD_HEIGHT_LIMIT_UP = -this.canvas.height * 0.8;
        CONFIG.WORLD_HEIGHT_LIMIT_DOWN = this.canvas.height * 0.6;
        CONFIG.LAVA_WORLD_Y = CONFIG.GROUND_Y + this.canvas.height * 1.2;

        if (this.player) {
            this.player.x = this.canvas.width * 0.3;
            this.player.updateSize();
        }
    };

    public togglePause() {
        if (!this.isRunning) return;
        this.isPaused = !this.isPaused;
        if (!this.isPaused) {
            this.lastTime = performance.now();
        }
    }

    public reset() {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        this.platforms = [];
        this.gems = [];
        this.particles = [];
        this.distance = 0;
        this.speedPenalty = 0;
        this.score = 0;
        this.speedMultiplier = 1.0;
        this.maxSpeedReached = 1.0;
        this.isPaused = false;

        this.resize();

        const startX = -1000 * CONFIG.GLOBAL_SCALE;
        const startWidth = 3500 * CONFIG.GLOBAL_SCALE;
        const startY = CONFIG.GROUND_Y;
        // 变色模式下，首张平台的颜色决定玩家初始颜色
        let startColor = ColorType.NONE;
        if (this.mode === GameMode.COLOR_SHIFT) {
            startColor = Math.random() > 0.5 ? ColorType.RED : ColorType.BLUE;
        }

        const startPlatform = new Platform(startX, startWidth, startY, startColor);
        this.platforms.push(startPlatform);

        this.lastX = startX + startWidth;
        this.lastY = startY;

        this.player = new Player(this.canvas.width * 0.3, startY - 250 * CONFIG.GLOBAL_SCALE, this.skin, this.mode, this.difficulty);
        if (this.mode === GameMode.COLOR_SHIFT) {
            this.player.colorType = startColor;
        }
        this.player.vy = 0;
        this.player.resetJump();
        this.respawnTimer = 0;

        this.cameraY = this.player.y - this.canvas.height * 0.5;

        this.isRunning = true;
        this.lastTime = performance.now();

        this.fillRoadBuffer();
        this.gameLoop(this.lastTime);
    }

    private fillRoadBuffer() {
        const spawnThreshold = this.canvas.width + 3000 * CONFIG.GLOBAL_SCALE;
        const minY = CONFIG.GROUND_Y + CONFIG.WORLD_HEIGHT_LIMIT_UP;
        const maxY = CONFIG.GROUND_Y + CONFIG.WORLD_HEIGHT_LIMIT_DOWN;

        while (this.lastX < spawnThreshold) {
            const rand = Math.random();
            const maxUpStep = CONFIG.MAX_PLATFORM_STEP;
            const maxDownStep = CONFIG.MAX_PLATFORM_STEP * 1.5;

            if (rand < 0.7) {
                let gap = (160 * CONFIG.GLOBAL_SCALE) + Math.random() * (CONFIG.MAX_PLATFORM_GAP - 160 * CONFIG.GLOBAL_SCALE);
                let diffY = (Math.random() - 0.5) * 500 * CONFIG.GLOBAL_SCALE;
                if (this.lastY < minY + 200 * CONFIG.GLOBAL_SCALE) diffY = Math.random() * 300 * CONFIG.GLOBAL_SCALE;
                if (this.lastY > maxY - 200 * CONFIG.GLOBAL_SCALE) diffY = -Math.random() * 300 * CONFIG.GLOBAL_SCALE;

                if (diffY < -maxUpStep) diffY = -maxUpStep;
                if (diffY > maxDownStep) diffY = maxDownStep;

                if (diffY < -100 * CONFIG.GLOBAL_SCALE) gap = Math.min(gap, 350 * CONFIG.GLOBAL_SCALE);

                const nextY = Math.max(minY, Math.min(maxY, this.lastY + diffY));
                const width = CONFIG.MIN_PLATFORM_WIDTH + Math.random() * 600 * CONFIG.GLOBAL_SCALE;

                let pColor = ColorType.NONE;
                if (this.mode === GameMode.COLOR_SHIFT) {
                    pColor = Math.random() > 0.5 ? ColorType.RED : ColorType.BLUE;
                }

                const p = new Platform(this.lastX + gap, width, nextY, pColor);
                this.platforms.push(p);
                this.addGemsToPlatform(p);

                this.lastX = p.x + p.w;
                this.lastY = p.y;
            } else {
                const baseGap = (180 * CONFIG.GLOBAL_SCALE) + Math.random() * 100 * CONFIG.GLOBAL_SCALE;
                const widthHigh = CONFIG.MIN_PLATFORM_WIDTH + (300 * CONFIG.GLOBAL_SCALE) + Math.random() * 400 * CONFIG.GLOBAL_SCALE;
                const widthLow = CONFIG.MIN_PLATFORM_WIDTH + (300 * CONFIG.GLOBAL_SCALE) + Math.random() * 400 * CONFIG.GLOBAL_SCALE;

                const splitYDiff = (350 * CONFIG.GLOBAL_SCALE) + Math.random() * 100 * CONFIG.GLOBAL_SCALE;
                let centerY = this.lastY + (Math.random() - 0.5) * 200 * CONFIG.GLOBAL_SCALE;
                centerY = Math.max(minY + 300 * CONFIG.GLOBAL_SCALE, Math.min(maxY - 300 * CONFIG.GLOBAL_SCALE, centerY));

                let pHighColor = ColorType.NONE;
                let pLowColor = ColorType.NONE;
                if (this.mode === GameMode.COLOR_SHIFT) {
                    pHighColor = Math.random() > 0.5 ? ColorType.RED : ColorType.BLUE;
                    pLowColor = Math.random() > 0.5 ? ColorType.RED : ColorType.BLUE;
                }

                const pHigh = new Platform(this.lastX + baseGap, widthHigh, centerY - splitYDiff / 2, pHighColor);
                const pLow = new Platform(this.lastX + baseGap + Math.random() * 150 * CONFIG.GLOBAL_SCALE, widthLow, centerY + splitYDiff / 2, pLowColor);

                this.platforms.push(pHigh, pLow);
                this.addGemsToPlatform(pHigh);
                this.addGemsToPlatform(pLow);

                this.lastX = Math.max(pHigh.x + pHigh.w, pLow.x + pLow.w);
                this.lastY = Math.random() > 0.5 ? pHigh.y : pLow.y;
            }
        }
    }

    private addGemsToPlatform(p: Platform) {
        const onTop = Math.random() > 0.3;
        const numGems = Math.floor(Math.random() * 4) + 2;

        const largeGemChance = !onTop ? 0.45 : 0.10;
        const isLargeSet = Math.random() < largeGemChance;
        const rareColors = ['#f43f5e', '#fbbf24', '#a855f7', '#10b981'];

        for (let i = 0; i < numGems; i++) {
            const step = (p.w - 120 * CONFIG.GLOBAL_SCALE) / numGems;
            const gx = p.x + 60 * CONFIG.GLOBAL_SCALE + i * step;

            let setType = isLargeSet ? GemType.LARGE : GemType.SMALL;
            let setColor = isLargeSet ? rareColors[Math.floor(Math.random() * rareColors.length)] : '#22d3ee';

            if (!isLargeSet && this.speedMultiplier > 1.5 && Math.random() < 0.08) {
                setType = GemType.SLOW;
                setColor = '#ef4444';
            }

            // 简单模式生命宝石补给
            if (this.difficulty === Difficulty.EASY && Math.random() < 0.05) {
                setType = GemType.LIFE;
                setColor = '#22c55e'; // 绿色心形
            }

            const waveOffset = Math.sin(i * 1.0) * (setType === GemType.LARGE ? 40 : 30) * CONFIG.GLOBAL_SCALE;
            const gy = onTop ? p.y - 110 * CONFIG.GLOBAL_SCALE + waveOffset : p.y + p.h + 110 * CONFIG.GLOBAL_SCALE + waveOffset;
            this.gems.push(new Gem(gx, gy, setType, setColor));
        }
    }

    public startJump() {
        if (!this.isRunning || this.isPaused) return;
        const jumped = this.player.startJump();
        if (jumped) sounds.playJump();
    }

    public stopJump() {
        if (!this.isRunning || this.isPaused) return;
        this.player.stopJump();
    }

    private update(deltaTime: number) {
        if (!this.isRunning || this.isPaused) return;

        const baseDt = Math.min(deltaTime / 16.67, 2.5);

        const effectiveDistanceForSpeed = Math.max(0, this.distance - this.speedPenalty);
        if (this.mode === GameMode.COLOR_SHIFT) {
            this.speedMultiplier = 1.5; // 变色模式恒定 1.5x 速度
        } else {
            const slope = this.difficulty === Difficulty.EASY ? 5600 : 2800; // 简单模式速度增加慢一倍
            this.speedMultiplier = Math.min(4.5, 1 + (effectiveDistanceForSpeed / slope));
        }

        // 倒计时逻辑
        if (this.respawnTimer > 0) {
            const oldSec = Math.ceil(this.respawnTimer);
            this.respawnTimer -= deltaTime / 1000;
            const newSec = Math.ceil(this.respawnTimer);
            if (oldSec !== newSec && newSec > 0) sounds.playGem(); // 用音效提示倒计时

            if (this.respawnTimer <= 0) {
                this.respawnTimer = 0;
            }
            this.onUpdateStats(this.score, this.distance, this.speedMultiplier, this.player.lives, Math.ceil(this.respawnTimer));
            return;
        }
        this.maxSpeedReached = Math.max(this.maxSpeedReached, this.speedMultiplier);

        const effectiveDt = baseDt * this.speedMultiplier;
        const moveX = CONFIG.RUN_SPEED * effectiveDt;
        const gravity = CONFIG.GRAVITY;

        this.distance += (moveX / (10 * CONFIG.GLOBAL_SCALE));

        // --- 子步物理系统: 解决高速穿透 (Tunneling) 问题 ---
        const SUB_STEPS = 4;
        const stepDt = effectiveDt / SUB_STEPS;
        const stepMoveX = moveX / SUB_STEPS;

        let dead = false;

        for (let s = 0; s < SUB_STEPS; s++) {
            // A. 位置更新
            this.player.update(stepDt, gravity);
            this.platforms.forEach(p => p.x -= stepMoveX);
            this.gems.forEach(g => g.x -= stepMoveX);
            this.particles.forEach(p => {
                p.update(stepDt);
                p.x -= stepMoveX;
            });
            this.lastX -= stepMoveX;

            // B. 平台碰撞检测 (每个子步检测一次)
            this.player.isOnGround = false;
            for (const p of this.platforms) {
                if (this.player.x < p.x + p.w &&
                    this.player.x + this.player.size > p.x &&
                    this.player.y < p.y + p.h &&
                    this.player.y + this.player.size > p.y) {

                    const overlapTop = (this.player.y + this.player.size) - p.y;
                    const overlapBottom = (p.y + p.h) - this.player.y;
                    const overlapLeft = (this.player.x + this.player.size) - p.x;
                    const overlapRight = (p.x + p.w) - this.player.x;

                    const minOverlap = Math.min(overlapTop, overlapBottom, overlapLeft, overlapRight);

                    // 侧面撞墙判定
                    if (minOverlap === overlapLeft && overlapTop > 10 * CONFIG.GLOBAL_SCALE && overlapBottom > 10 * CONFIG.GLOBAL_SCALE) {
                        dead = true;
                        this.shatterPlayer();
                        break;
                    }
                    // 踩在地上
                    else if (minOverlap === overlapTop) {
                        // 变色模式颜色校验
                        if (this.mode === GameMode.COLOR_SHIFT && p.colorType !== ColorType.NONE && p.colorType !== this.player.colorType) {
                            dead = true;
                            this.shatterPlayer();
                            break;
                        }

                        this.player.y = p.y - this.player.size;
                        this.player.vy = 0;
                        this.player.resetJump();
                        this.player.isOnGround = true;
                    }
                    // 撞到头
                    else if (minOverlap === overlapBottom) {
                        // 变色模式颜色校验 (撞天花板也要算)
                        if (this.mode === GameMode.COLOR_SHIFT && p.colorType !== ColorType.NONE && p.colorType !== this.player.colorType) {
                            dead = true;
                            this.shatterPlayer();
                            break;
                        }

                        this.player.y = p.y + p.h;
                        if (this.player.vy < 0) this.player.vy = 0;
                        this.player.resetJump();
                    }
                }
            }
            if (dead) break;

            // 跑动时产生粒子效果
            if (this.player.isOnGround && Math.random() < 0.2) {
                this.particles.push(new Particle(
                    this.player.x, this.player.y + this.player.size,
                    'rgba(255,255,255,0.4)',
                    { x: -5 * CONFIG.GLOBAL_SCALE - Math.random() * 5 * CONFIG.GLOBAL_SCALE, y: -Math.random() * 2 * CONFIG.GLOBAL_SCALE }
                ));
            }
        }

        // --- 逻辑更新 (每帧执行一次) ---
        // 提升摄像机高度基准，保证跑道在移动端有更好的视角
        const targetCameraY = this.player.y - this.canvas.height * 0.55;
        const cameraSmooth = 0.12 * this.speedMultiplier;
        this.cameraY += (targetCameraY - this.cameraY) * Math.min(0.3, cameraSmooth) * baseDt;

        this.fillRoadBuffer();

        this.platforms = this.platforms.filter(p => p.x + p.w > -1000 * CONFIG.GLOBAL_SCALE);
        this.gems = this.gems.filter(g => g.x > -500 * CONFIG.GLOBAL_SCALE && !g.collected);
        this.particles = this.particles.filter(p => p.life > 0);

        for (const g of this.gems) {
            const hitZone = (g.type === GemType.LARGE ? 100 : 80) * CONFIG.GLOBAL_SCALE;
            if (!g.collected && Math.abs(this.player.x - g.x) < hitZone && Math.abs(this.player.y - g.y) < hitZone) {
                g.collected = true;

                if (g.type === GemType.SLOW) {
                    sounds.playSlow();
                    this.speedPenalty += 600 * CONFIG.GLOBAL_SCALE;
                    for (let i = 0; i < 30; i++) {
                        this.particles.push(new Particle(g.x, g.y, '#ef4444', {
                            x: (Math.random() - 0.5) * 35 * CONFIG.GLOBAL_SCALE,
                            y: (Math.random() - 0.5) * 35 * CONFIG.GLOBAL_SCALE
                        }, 1.5));
                    }
                } else if (g.type === GemType.LIFE) {
                    sounds.playSpecialGem();
                    this.player.lives = Math.min(5, this.player.lives + 1); // 最多5条命
                    for (let i = 0; i < 20; i++) {
                        this.particles.push(new Particle(g.x, g.y, '#4ade80', {
                            x: (Math.random() - 0.5) * 25 * CONFIG.GLOBAL_SCALE,
                            y: (Math.random() - 0.5) * 25 * CONFIG.GLOBAL_SCALE
                        }, 1.2));
                    }
                } else {
                    if (g.type === GemType.LARGE) sounds.playSpecialGem();
                    else sounds.playGem();

                    this.score += g.score;
                    const burstCount = g.type === GemType.LARGE ? 25 : 10;
                    for (let i = 0; i < burstCount; i++) {
                        this.particles.push(new Particle(g.x, g.y, g.color, {
                            x: (Math.random() - 0.5) * (g.type === GemType.LARGE ? 25 : 15) * CONFIG.GLOBAL_SCALE,
                            y: (Math.random() - 0.5) * (g.type === GemType.LARGE ? 25 : 15) * CONFIG.GLOBAL_SCALE
                        }));
                    }
                }
            }
        }

        if (this.player.y + this.player.size > CONFIG.LAVA_WORLD_Y || this.player.y > this.cameraY + this.canvas.height + 1500 * CONFIG.GLOBAL_SCALE) {
            dead = true;
            this.shatterPlayer();
        }

        if (dead) {
            if (this.player.lives > 1) {
                this.player.lives--;
                this.triggerRespawn();
                dead = false; // 拦截死亡，进入复活流程
            } else {
                this.isRunning = false;
                setTimeout(() => this.onGameOver(this.score, this.distance, this.maxSpeedReached), 800);
            }
        }

        this.onUpdateStats(this.score, this.distance, this.speedMultiplier, this.player.lives, Math.ceil(this.respawnTimer));
    }

    private triggerRespawn() {
        this.respawnTimer = 3.1; // 3秒倒计时
        // 寻找最近的平台（位于玩家当前 x 后方的第一个平台）
        const safetyPlatform = this.platforms.find(p => p.x + p.w > this.player.x) || this.platforms[0];
        this.player.y = safetyPlatform.y - this.player.size;
        this.player.vy = 0;
        this.player.resetJump();
        // 视角瞬间回正
        this.cameraY = this.player.y - this.canvas.height * 0.55;
    }

    private shatterPlayer() {
        sounds.playDeath();
        for (let i = 0; i < 60; i++) {
            this.particles.push(new Particle(
                this.player.x + this.player.size / 2,
                this.player.y + this.player.size / 2,
                CONFIG.COLORS.PLAYER,
                { x: (Math.random() - 0.5) * 35 * CONFIG.GLOBAL_SCALE, y: (Math.random() - 0.5) * 35 * CONFIG.GLOBAL_SCALE }
            ));
        }
    }

    private draw() {
        const ctx = this.ctx;

        // 还原游戏背景：深空到岩浆的渐变
        const grad = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        grad.addColorStop(0, '#0f172a'); // 深蓝
        grad.addColorStop(1, '#450a0a'); // 暗红
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.platforms.forEach(p => p.draw(ctx, this.cameraY));
        this.gems.forEach(g => g.draw(ctx, this.cameraY));
        this.particles.forEach(p => p.draw(ctx, this.cameraY));

        if (this.isRunning) {
            this.player.draw(ctx, this.cameraY);
        }

        this.drawWorldLava();

        if (this.isPaused) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = 'white';
            ctx.font = `bold ${48 * CONFIG.GLOBAL_SCALE}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('游戏暂停', this.canvas.width / 2, this.canvas.height / 2);
        }

        if (this.respawnTimer > 0) {
            ctx.fillStyle = 'white';
            ctx.font = `black ${160 * CONFIG.GLOBAL_SCALE}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.shadowBlur = 30 * CONFIG.GLOBAL_SCALE;
            ctx.shadowColor = 'rgba(255,165,0,0.8)';
            ctx.fillText(Math.ceil(this.respawnTimer).toString(), this.canvas.width / 2, this.canvas.height * 0.45);
            ctx.shadowBlur = 0;

            ctx.font = `bold ${32 * CONFIG.GLOBAL_SCALE}px sans-serif`;
            ctx.fillText('准备继续...', this.canvas.width / 2, this.canvas.height * 0.45 + 100 * CONFIG.GLOBAL_SCALE);
        }
    }

    private drawWorldLava() {
        const lavaScreenY = CONFIG.LAVA_WORLD_Y - this.cameraY;
        const wave = Math.sin(performance.now() / 500) * 20 * CONFIG.GLOBAL_SCALE;
        this.ctx.fillStyle = '#ff4400';
        this.ctx.fillRect(0, lavaScreenY + wave, this.canvas.width, 2000 * CONFIG.GLOBAL_SCALE);

        const glow = this.ctx.createLinearGradient(0, lavaScreenY + wave - 100 * CONFIG.GLOBAL_SCALE, 0, lavaScreenY + wave);
        glow.addColorStop(0, 'rgba(255,68,0,0)');
        glow.addColorStop(1, 'rgba(255,68,0,0.6)');
        this.ctx.fillStyle = glow;
        this.ctx.fillRect(0, lavaScreenY + wave - 100 * CONFIG.GLOBAL_SCALE, this.canvas.width, 100 * CONFIG.GLOBAL_SCALE);
    }

    private gameLoop = (time: number) => {
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        this.update(deltaTime);
        this.draw();
        this.animationId = requestAnimationFrame(this.gameLoop);
    };

    public destroy() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        window.removeEventListener('resize', this.resize);
    }
}
