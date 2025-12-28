
import { CONFIG } from './Config';

export enum GemType {
    SMALL,
    LARGE,
    SLOW
}

export enum PlayerSkin {
    DEFAULT = 'DEFAULT',
    FROG = 'FROG',
    CHICKEN = 'CHICKEN'
}

export enum GameMode {
    NORMAL,
    COLOR_SHIFT
}

export enum ColorType {
    NONE,
    RED,
    BLUE
}

export class Player {
    public x: number = 0;
    public y: number = 0;
    public size: number = 56;
    public vy: number = 0;
    public jumpCount: number = 0;
    public isHoldingJump: boolean = false;
    public jumpTimer: number = 0;
    public isOnGround: boolean = false;
    private hasReleasedSinceLastJump: boolean = true;
    public skin: PlayerSkin = PlayerSkin.DEFAULT;
    public mode: GameMode = GameMode.NORMAL;
    public colorType: ColorType = ColorType.NONE;
    private animationFrame: number = 0;

    constructor(startX: number, startY: number, skin: PlayerSkin = PlayerSkin.DEFAULT, mode: GameMode = GameMode.NORMAL) {
        this.x = startX;
        this.y = startY;
        this.skin = skin;
        this.mode = mode;
        this.updateSize();
    }

    public switchColor() {
        if (this.mode !== GameMode.COLOR_SHIFT) return;
        this.colorType = this.colorType === ColorType.RED ? ColorType.BLUE : ColorType.RED;
    }

    public updateSize() {
        this.size = 56 * CONFIG.GLOBAL_SCALE;
    }

    public update(dt: number, gravity: number) {
        this.vy += gravity * dt;

        if (this.isHoldingJump && this.jumpTimer > 0) {
            this.vy -= CONFIG.JUMP_FORCE_HOLD * dt;
            this.jumpTimer -= dt;
        }

        this.y += this.vy * dt;
    }

    public startJump(): boolean {
        if (this.jumpCount < CONFIG.MAX_JUMPS && this.hasReleasedSinceLastJump) {
            this.vy = CONFIG.JUMP_FORCE_INITIAL;
            this.jumpCount++;
            this.isHoldingJump = true;
            this.jumpTimer = CONFIG.JUMP_HOLD_MAX_TIME;
            this.hasReleasedSinceLastJump = false;
            return true;
        }
        return false;
    }

    public stopJump() {
        this.isHoldingJump = false;
        this.jumpTimer = 0;
        this.hasReleasedSinceLastJump = true;
    }

    public resetJump() {
        this.jumpCount = 0;
        this.isHoldingJump = false;
        this.jumpTimer = 0;
    }

    public draw(ctx: CanvasRenderingContext2D, cameraY: number) {
        ctx.save();

        // 动画逻辑：跳跃时拉伸，下降时拉长，空闲时微动
        const jumpStretch = Math.min(0.3, Math.abs(this.vy) * 0.015);
        const stretchX = this.vy < 0 ? 1 - jumpStretch : 1 + jumpStretch * 0.5;
        const stretchY = this.vy < 0 ? 1 + jumpStretch * 1.5 : 1 - jumpStretch * 0.5;

        ctx.translate(this.x + this.size / 2, this.y - cameraY + this.size / 2);

        // 旋转效果（仅默认方块）
        if (this.skin === PlayerSkin.DEFAULT) {
            ctx.rotate(this.vy * 0.015 / CONFIG.GLOBAL_SCALE);
        }

        ctx.scale(stretchX, stretchY);

        if (this.skin === PlayerSkin.DEFAULT) {
            // --- 默认方块皮肤 ---
            ctx.fillStyle = CONFIG.COLORS.PLAYER;
            ctx.shadowBlur = 20 * CONFIG.GLOBAL_SCALE;
            ctx.shadowColor = CONFIG.COLORS.PLAYER;
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);

            // 眼睛
            ctx.fillStyle = '#fff';
            const eyeSize = 12 * CONFIG.GLOBAL_SCALE;
            ctx.fillRect(this.size / 6, -this.size / 3, eyeSize, eyeSize);
            ctx.fillStyle = '#000';
            ctx.fillRect(this.size / 4, -this.size / 3 + 2, eyeSize / 2, eyeSize / 2);

        } else if (this.skin === PlayerSkin.FROG) {
            // --- 像素青蛙皮肤 ---
            const s = this.size;
            ctx.fillStyle = '#4ade80'; // 绿色主体
            ctx.fillRect(-s / 2, -s / 4, s, s / 2); // 身体
            ctx.fillRect(-s / 2.5, -s / 2, s / 4, s / 4); // 左眼座
            ctx.fillRect(s / 2.5 - s / 4, -s / 2, s / 4, s / 4); // 右眼座

            // 眼睛
            ctx.fillStyle = '#fff';
            ctx.fillRect(-s / 3, -s / 2.2, s / 6, s / 6);
            ctx.fillRect(s / 6, -s / 2.2, s / 6, s / 6);
            ctx.fillStyle = '#000';
            ctx.fillRect(-s / 4, -s / 2.2 + 2, s / 12, s / 12);
            ctx.fillRect(s / 4 - s / 12, -s / 2.2 + 2, s / 12, s / 12);

            // 嘴巴/红晕
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(-s / 4, 0, s / 2, 4 * CONFIG.GLOBAL_SCALE);

        } else if (this.skin === PlayerSkin.CHICKEN) {
            // --- 像素小鸡皮肤 ---
            const s = this.size;
            ctx.fillStyle = '#ffffff'; // 白色身体
            ctx.fillRect(-s / 2, -s / 3, s, s / 1.5);

            // 鸡冠
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(-s / 6, -s / 2, s / 3, s / 6);

            // 嘴
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(s / 4, -s / 10, s / 4, s / 4);

            // 眼睛
            ctx.fillStyle = '#000';
            ctx.fillRect(s / 8, -s / 4, 6 * CONFIG.GLOBAL_SCALE, 6 * CONFIG.GLOBAL_SCALE);

            // 翅膀
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(-s / 2 - 4, -s / 6, s / 4, s / 3);
        }

        // 变色模式下的颜色叠加层 (蒙版效果)
        if (this.mode === GameMode.COLOR_SHIFT) {
            ctx.scale(1 / stretchX, 1 / stretchY); // 抵消缩放，使蒙版覆盖整个区域
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = this.colorType === ColorType.RED ? 'rgba(239, 68, 68, 0.6)' : 'rgba(59, 130, 246, 0.6)';
            ctx.fillRect(-this.size * 2, -this.size * 2, this.size * 4, this.size * 4);

            // 外框强化
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = this.colorType === ColorType.RED ? '#ef4444' : '#3b82f6';
            ctx.lineWidth = 4 * CONFIG.GLOBAL_SCALE;
            ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
        }

        ctx.restore();
    }
}

export class Platform {
    public h: number = 44;
    constructor(
        public x: number,
        public w: number,
        public y: number,
        public colorType: ColorType = ColorType.NONE
    ) {
        this.h = 44 * CONFIG.GLOBAL_SCALE;
    }

    public draw(ctx: CanvasRenderingContext2D, cameraY: number) {
        const drawY = this.y - cameraY;
        const grad = ctx.createLinearGradient(this.x, drawY, this.x, drawY + this.h);

        if (this.colorType === ColorType.RED) {
            grad.addColorStop(0, '#ef4444');
            grad.addColorStop(1, '#991b1b');
        } else if (this.colorType === ColorType.BLUE) {
            grad.addColorStop(0, '#3b82f6');
            grad.addColorStop(1, '#1e3a8a');
        } else {
            grad.addColorStop(0, '#475569');
            grad.addColorStop(0.5, '#334155');
            grad.addColorStop(1, '#1e293b');
        }

        ctx.fillStyle = grad;
        ctx.fillRect(this.x, drawY, this.w, this.h);

        ctx.fillStyle = this.colorType === ColorType.NONE ? '#94a3b8' : 'rgba(255,255,255,0.4)';
        ctx.fillRect(this.x, drawY, this.w, 6 * CONFIG.GLOBAL_SCALE);

        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        const step = 80 * CONFIG.GLOBAL_SCALE;
        for (let i = 0; i < this.w; i += step) {
            ctx.strokeRect(this.x + i, drawY + 10 * CONFIG.GLOBAL_SCALE, 2, this.h - 20 * CONFIG.GLOBAL_SCALE);
        }
    }
}

export class Gem {
    public collected: boolean = false;
    private floatOffset: number = Math.random() * Math.PI * 2;
    public size: number;

    constructor(
        public x: number,
        public y: number,
        public type: GemType = GemType.SMALL,
        public color: string = '#22d3ee'
    ) {
        const baseSize = type === GemType.LARGE ? 38 : (type === GemType.SLOW ? 32 : 22);
        this.size = baseSize * CONFIG.GLOBAL_SCALE;
    }

    public get score(): number {
        if (this.type === GemType.LARGE) return 100;
        if (this.type === GemType.SLOW) return 0;
        return 20;
    }

    public draw(ctx: CanvasRenderingContext2D, cameraY: number) {
        if (this.collected) return;

        const time = performance.now() / 250;
        const floatAmp = (this.type === GemType.LARGE ? 20 : 14) * CONFIG.GLOBAL_SCALE;
        const fy = (this.y - cameraY) + Math.sin(time + this.floatOffset) * floatAmp;

        ctx.save();
        ctx.translate(this.x, fy);

        if (this.type === GemType.SLOW) {
            ctx.rotate(Math.sin(time * 0.5) * 0.5);
        } else {
            ctx.rotate(time * (this.type === GemType.LARGE ? 0.6 : 0.4));
        }

        ctx.fillStyle = this.color;
        ctx.shadowBlur = (this.type === GemType.LARGE ? 35 : 20) * CONFIG.GLOBAL_SCALE;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        if (this.type === GemType.LARGE) {
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI * 2) / 6;
                const r = this.size;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
        } else if (this.type === GemType.SLOW) {
            ctx.moveTo(0, this.size);
            ctx.lineTo(-this.size, -this.size);
            ctx.lineTo(this.size, -this.size);
        } else {
            ctx.moveTo(0, -this.size);
            ctx.lineTo(this.size, 0);
            ctx.lineTo(0, this.size);
            ctx.lineTo(-this.size, 0);
        }
        ctx.closePath();
        ctx.fill();

        if (this.type === GemType.LARGE) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(-this.size / 4, -this.size / 4, this.size / 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === GemType.SLOW) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillRect(-this.size / 2, -2 * CONFIG.GLOBAL_SCALE, this.size, 4 * CONFIG.GLOBAL_SCALE);
        }

        ctx.restore();
    }
}

export class Particle {
    public life: number = 1.0;
    public opacity: number = 1.0;

    constructor(
        public x: number,
        public y: number,
        public color: string,
        public velocity: { x: number, y: number },
        public scale: number = 1.0
    ) { }

    public update(dt: number) {
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
        this.life -= 0.02 * dt;
        this.opacity = Math.max(0, this.life);
    }

    public draw(ctx: CanvasRenderingContext2D, cameraY: number) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        const s = (5 + Math.random() * 5) * this.scale * this.life * CONFIG.GLOBAL_SCALE;
        ctx.fillRect(this.x - s / 2, (this.y - cameraY) - s / 2, s, s);
        ctx.restore();
    }
}
