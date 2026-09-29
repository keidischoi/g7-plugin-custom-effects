import type { MouseConfig, MouseEffectKind } from './mouse-config';

/**
 * Lightweight mouse-follow effects.
 *
 * - One fixed full-screen canvas with `pointer-events: none`.
 * - `requestAnimationFrame` only while something is moving; idles otherwise.
 * - Hard particle cap scaled by the admin "amount" setting.
 * - Paused while the tab is hidden. Touch pointers are ignored.
 */

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    rotation: number;
    spin: number;
    color: string;
    phase: number;
    glyph: string;
    gravity: number;
    drag: number;
}

interface TrailPoint {
    x: number;
    y: number;
    age: number;
}

interface Follower {
    x: number;
    y: number;
}

const BASE_CAP = 160;
const TRAIL_LIFE = 0.45;
const TWO_PI = Math.PI * 2;

const PALETTES: Record<MouseEffectKind, readonly string[]> = {
    sparkle_stars: ['#fde047', '#fef08a', '#facc15', '#ffffff'],
    hearts: ['#f472b6', '#fb7185', '#ec4899', '#f9a8d4'],
    petals: ['#fbcfe8', '#f9a8d4', '#fce7f3', '#f472b6'],
    snowflakes: ['#93c5fd', '#bae6fd', '#e0f2fe', '#7dd3fc'],
    bubbles: ['#7dd3fc', '#a5b4fc', '#99f6e4', '#f0abfc'],
    rainbow_tail: ['#ef4444'],
    neon_line: ['#22d3ee'],
    ring_cursor: ['#6366f1'],
    dot_follow: ['#6366f1'],
    embers: ['#f97316', '#fb923c', '#facc15', '#ef4444'],
    click_fireworks: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'],
    emoji: ['#000000'],
    fireflies: ['#fde047', '#bef264', '#fef9c3'],
    butterflies: ['#f472b6', '#a78bfa', '#60a5fa', '#fbbf24', '#34d399'],
    ripple: ['#60a5fa'],
    text_trail: ['#6366f1', '#8b5cf6', '#ec4899'],
    spotlight: ['#000000'],
    confetti: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'],
    comet: ['#a78bfa'],
};

/** Effects drawn from a trail of pointer positions instead of particles. */
const TRAIL_EFFECTS = new Set<MouseEffectKind>(['rainbow_tail', 'neon_line', 'comet']);
/** Effects that keep an eased cursor overlay on screen. */
const CURSOR_EFFECTS = new Set<MouseEffectKind>(['ring_cursor', 'dot_follow', 'spotlight']);
/** Effects that emit shaped particles along the pointer path. */
const PARTICLE_EFFECTS = new Set<MouseEffectKind>([
    'sparkle_stars',
    'hearts',
    'petals',
    'snowflakes',
    'bubbles',
    'embers',
    'emoji',
    'fireflies',
    'butterflies',
    'confetti',
]);

function random(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function pick<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

function withAlpha(color: string, alpha: number): string {
    const value = Math.max(0, Math.min(1, alpha));
    if (color.startsWith('hsl(')) return color.replace('hsl(', 'hsla(').replace(')', `, ${value})`);
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((char) => char + char).join('');
    const number = Number.parseInt(hex, 16);
    if (!Number.isFinite(number)) return `rgba(255, 255, 255, ${value})`;
    return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${value})`;
}

export class MouseEffectsEngine {
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;
    private readonly particles: Particle[] = [];
    private readonly trail: TrailPoint[] = [];
    private readonly followers: Follower[] = [];
    private readonly cap: number;
    private readonly scale: number;
    private frameId: number | null = null;
    private lastFrame = 0;
    private width = 0;
    private height = 0;
    private pointerX = -1;
    private pointerY = -1;
    private lastSpawnX = -1;
    private lastSpawnY = -1;
    private pointerInside = false;
    private pressed = false;
    private sinceRipple = 0;
    private textIndex = 0;
    private hue = 0;
    private stopped = false;

    private constructor(
        private readonly config: MouseConfig,
        private readonly target: Window,
        canvas: HTMLCanvasElement,
        context: CanvasRenderingContext2D,
    ) {
        this.canvas = canvas;
        this.context = context;
        this.cap = Math.max(20, Math.round(BASE_CAP * (config.amount / 100)));
        this.scale = config.size / 100;
        const chain = config.effect === 'dot_follow' ? 10 : 1;
        for (let index = 0; index < chain; index += 1) this.followers.push({ x: -100, y: -100 });
    }

    static start(config: MouseConfig, target: Window = window): MouseEffectsEngine | null {
        const canvas = target.document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return null;

        canvas.className = 'g7-custom-effects-canvas g7-custom-effects-mouse-canvas';
        canvas.dataset.mouseEffect = config.effect;
        canvas.setAttribute('aria-hidden', 'true');
        target.document.body.append(canvas);

        const engine = new MouseEffectsEngine(config, target, canvas, context);
        engine.resize();
        target.addEventListener('resize', engine.handleResize, { passive: true });
        target.addEventListener('pointermove', engine.handlePointerMove, { passive: true });
        target.addEventListener('pointerdown', engine.handlePointerDown, { passive: true });
        target.addEventListener('pointerup', engine.handlePointerUp, { passive: true });
        target.document.addEventListener('mouseleave', engine.handleLeave);
        target.addEventListener('blur', engine.handleLeave);
        target.document.addEventListener('visibilitychange', engine.handleVisibility);
        return engine;
    }

    stop(): void {
        if (this.stopped) return;
        this.stopped = true;
        if (this.frameId !== null) this.target.cancelAnimationFrame(this.frameId);
        this.frameId = null;
        this.target.removeEventListener('resize', this.handleResize);
        this.target.removeEventListener('pointermove', this.handlePointerMove);
        this.target.removeEventListener('pointerdown', this.handlePointerDown);
        this.target.removeEventListener('pointerup', this.handlePointerUp);
        this.target.document.removeEventListener('mouseleave', this.handleLeave);
        this.target.removeEventListener('blur', this.handleLeave);
        this.target.document.removeEventListener('visibilitychange', this.handleVisibility);
        this.canvas.remove();
        this.particles.length = 0;
        this.trail.length = 0;
    }

    private readonly handleResize = (): void => {
        this.resize();
        this.wake();
    };

    private resize(): void {
        const ratio = Math.min(2, Math.max(1, this.target.devicePixelRatio || 1));
        this.width = this.target.innerWidth;
        this.height = this.target.innerHeight;
        this.canvas.width = Math.round(this.width * ratio);
        this.canvas.height = Math.round(this.height * ratio);
        this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    private readonly handleVisibility = (): void => {
        if (this.target.document.hidden) {
            if (this.frameId !== null) this.target.cancelAnimationFrame(this.frameId);
            this.frameId = null;
            return;
        }
        this.wake();
    };

    private readonly handleLeave = (): void => {
        this.pointerInside = false;
        this.pressed = false;
        this.wake();
    };

    private readonly handlePointerMove = (event: PointerEvent): void => {
        if (event.pointerType === 'touch') return;
        const firstMove = !this.pointerInside;
        this.pointerInside = true;
        this.pointerX = event.clientX;
        this.pointerY = event.clientY;
        if (firstMove || this.lastSpawnX < 0) {
            this.lastSpawnX = this.pointerX;
            this.lastSpawnY = this.pointerY;
            this.followers.forEach((item) => {
                if (item.x < 0) {
                    item.x = this.pointerX;
                    item.y = this.pointerY;
                }
            });
        }
        this.onMove();
        this.wake();
    };

    private readonly handlePointerDown = (event: PointerEvent): void => {
        if (event.pointerType === 'touch') return;
        this.pressed = true;
        this.pointerX = event.clientX;
        this.pointerY = event.clientY;
        this.pointerInside = true;
        const effect = this.config.effect;
        if (effect === 'click_fireworks') {
            this.burst(event.clientX, event.clientY, Math.round(36 * this.amountFactor()), true);
        } else if (effect === 'ripple') {
            this.spawnRipple(event.clientX, event.clientY, 1.8);
        } else if (this.config.clickBurst && PARTICLE_EFFECTS.has(effect)) {
            this.burst(event.clientX, event.clientY, Math.round(14 * this.amountFactor()), false);
        } else if (this.config.clickBurst) {
            this.burst(event.clientX, event.clientY, Math.round(18 * this.amountFactor()), true);
        }
        this.wake();
    };

    private readonly handlePointerUp = (): void => {
        this.pressed = false;
        this.wake();
    };

    private amountFactor(): number {
        return this.config.amount / 100;
    }

    private color(index = -1): string {
        if (this.config.customColor) return this.config.customColor;
        if (this.config.color === 'rainbow') {
            const hue = index >= 0 ? (this.hue + index * 24) % 360 : Math.floor(Math.random() * 360);
            return `hsl(${hue}, 90%, 62%)`;
        }
        if (this.config.color !== 'default') return this.config.color;
        return pick(PALETTES[this.config.effect]);
    }

    private wake(): void {
        if (this.stopped || this.frameId !== null || this.target.document.hidden) return;
        this.lastFrame = 0;
        this.frameId = this.target.requestAnimationFrame(this.render);
    }

    private onMove(): void {
        const effect = this.config.effect;
        const dx = this.pointerX - this.lastSpawnX;
        const dy = this.pointerY - this.lastSpawnY;
        const distance = Math.hypot(dx, dy);

        if (TRAIL_EFFECTS.has(effect)) {
            this.trail.push({ x: this.pointerX, y: this.pointerY, age: 0 });
            const maxPoints = Math.round(40 * Math.max(0.5, this.amountFactor()));
            while (this.trail.length > maxPoints) this.trail.shift();
            return;
        }
        if (CURSOR_EFFECTS.has(effect) || effect === 'click_fireworks') return;

        if (effect === 'ripple') {
            if (distance > 36 && this.sinceRipple > 0.08) {
                this.spawnRipple(this.pointerX, this.pointerY, 1);
                this.lastSpawnX = this.pointerX;
                this.lastSpawnY = this.pointerY;
                this.sinceRipple = 0;
            }
            return;
        }

        if (effect === 'text_trail') {
            const glyphs = Array.from(this.config.text);
            const spacing = 16 * this.scale;
            let steps = Math.min(6, Math.floor(distance / spacing));
            if (steps <= 0) return;
            const angle = Math.atan2(dy, dx);
            let x = this.lastSpawnX;
            let y = this.lastSpawnY;
            while (steps > 0) {
                x += Math.cos(angle) * spacing;
                y += Math.sin(angle) * spacing;
                const glyph = glyphs[this.textIndex % glyphs.length] ?? '';
                this.textIndex += 1;
                if (glyph.trim()) {
                    this.add({
                        x,
                        y,
                        vx: random(-6, 6),
                        vy: random(-14, -4),
                        maxLife: 1.1,
                        size: 16 * this.scale,
                        rotation: angle,
                        spin: 0,
                        color: this.color(this.textIndex),
                        glyph,
                        gravity: 0,
                        drag: 0.9,
                    });
                }
                steps -= 1;
            }
            this.lastSpawnX = x;
            this.lastSpawnY = y;
            return;
        }

        const spacing = effect === 'fireflies' || effect === 'butterflies' ? 42 : 14;
        const perStep = this.amountFactor();
        const steps = Math.min(4, distance / spacing);
        if (steps < 1) return;
        const count = Math.max(1, Math.round(steps * perStep));
        for (let index = 0; index < count; index += 1) {
            const t = (index + 1) / count;
            this.spawnTrailParticle(
                this.lastSpawnX + dx * t,
                this.lastSpawnY + dy * t,
                dx / Math.max(1, distance),
                dy / Math.max(1, distance),
            );
        }
        this.lastSpawnX = this.pointerX;
        this.lastSpawnY = this.pointerY;
    }

    private add(partial: Omit<Particle, 'life' | 'phase'> & { phase?: number }): void {
        if (this.particles.length >= this.cap) this.particles.shift();
        this.particles.push({ life: 0, phase: partial.phase ?? random(0, TWO_PI), ...partial });
    }

    private spawnRipple(x: number, y: number, strength: number): void {
        this.add({
            x,
            y,
            vx: 0,
            vy: 0,
            maxLife: 0.9 * strength,
            size: 44 * this.scale * strength,
            rotation: 0,
            spin: 0,
            color: this.color(),
            glyph: '',
            gravity: 0,
            drag: 1,
        });
    }

    private spawnTrailParticle(x: number, y: number, dirX: number, dirY: number): void {
        const effect = this.config.effect;
        const s = this.scale;
        const base = {
            x: x + random(-4, 4),
            y: y + random(-4, 4),
            rotation: random(0, TWO_PI),
            spin: random(-3, 3),
            color: this.color(),
            glyph: '',
            gravity: 0,
            drag: 0.96,
        };

        switch (effect) {
            case 'sparkle_stars':
                this.add({ ...base, vx: random(-20, 20), vy: random(-20, 20), maxLife: random(0.5, 0.9), size: random(4, 9) * s });
                break;
            case 'hearts':
                this.add({ ...base, vx: random(-15, 15), vy: random(-50, -25), maxLife: random(0.8, 1.2), size: random(7, 12) * s, spin: random(-1, 1) });
                break;
            case 'petals':
                this.add({ ...base, vx: random(-25, 25) - dirX * 20, vy: random(10, 40), maxLife: random(1, 1.6), size: random(5, 9) * s, gravity: 25 });
                break;
            case 'snowflakes':
                this.add({ ...base, vx: random(-15, 15), vy: random(15, 45), maxLife: random(1, 1.5), size: random(4, 8) * s, spin: random(-1.5, 1.5) });
                break;
            case 'bubbles':
                this.add({ ...base, vx: random(-15, 15), vy: random(-45, -20), maxLife: random(0.9, 1.5), size: random(4, 11) * s });
                break;
            case 'embers':
                this.add({ ...base, vx: random(-20, 20) - dirX * 15, vy: random(-70, -30), maxLife: random(0.5, 1), size: random(1.5, 3.5) * s, drag: 0.94 });
                break;
            case 'emoji':
                this.add({ ...base, vx: random(-30, 30), vy: random(-40, 10), maxLife: random(0.8, 1.2), size: random(14, 22) * s, spin: random(-2, 2), glyph: pick(this.config.emojis), gravity: 60 });
                break;
            case 'fireflies':
                this.add({ ...base, x: x + random(-18, 18), y: y + random(-18, 18), vx: random(-18, 18), vy: random(-18, 18), maxLife: random(1.6, 2.6), size: random(1.5, 3) * s, drag: 0.99 });
                break;
            case 'butterflies':
                this.add({ ...base, vx: random(-25, 25), vy: random(-55, -25), maxLife: random(1.6, 2.4), size: random(6, 10) * s, rotation: random(-0.4, 0.4), drag: 0.995 });
                break;
            case 'confetti':
                this.add({ ...base, vx: random(-60, 60), vy: random(-90, -30), maxLife: random(0.9, 1.4), size: random(4, 7) * s, spin: random(-8, 8), gravity: 220, drag: 0.97 });
                break;
            default:
                break;
        }
    }

    private burst(x: number, y: number, count: number, sparks: boolean): void {
        const s = this.scale;
        for (let index = 0; index < count; index += 1) {
            const angle = (index / count) * TWO_PI + random(-0.15, 0.15);
            const speed = random(90, 260) * s;
            if (sparks) {
                this.add({
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    maxLife: random(0.6, 1.1),
                    size: random(1.5, 3) * s,
                    rotation: angle,
                    spin: 0,
                    color: this.config.color === 'default' && !this.config.customColor
                        ? pick(PALETTES.click_fireworks)
                        : this.color(index),
                    glyph: 'spark',
                    gravity: 140,
                    drag: 0.94,
                });
            } else {
                const before = this.particles.length;
                this.spawnTrailParticle(x, y, Math.cos(angle), Math.sin(angle));
                const last = this.particles[this.particles.length - 1];
                if (last && (this.particles.length > before || this.particles.length >= this.cap)) {
                    last.vx = Math.cos(angle) * speed * 0.6;
                    last.vy = Math.sin(angle) * speed * 0.6;
                }
            }
        }
    }

    private readonly render = (time: number): void => {
        this.frameId = null;
        if (this.stopped) return;
        const dt = this.lastFrame ? Math.min(0.05, (time - this.lastFrame) / 1000) : 1 / 60;
        this.lastFrame = time;
        this.sinceRipple += dt;
        this.hue = (this.hue + dt * 120) % 360;

        const busy = this.update(dt);
        this.draw(time / 1000);

        if (busy) this.frameId = this.target.requestAnimationFrame(this.render);
    };

    /** Advances the simulation. Returns true while another frame is needed. */
    private update(dt: number): boolean {
        for (let index = this.particles.length - 1; index >= 0; index -= 1) {
            const item = this.particles[index];
            item.life += dt;
            if (item.life >= item.maxLife) {
                this.particles.splice(index, 1);
                continue;
            }
            const drag = Math.pow(item.drag, dt * 60);
            item.vx *= drag;
            item.vy = item.vy * drag + item.gravity * dt;
            if (this.config.effect === 'fireflies' || this.config.effect === 'butterflies') {
                item.vx += Math.cos(item.phase + item.life * 3) * 30 * dt;
            }
            if (this.config.effect === 'petals' || this.config.effect === 'snowflakes') {
                item.vx += Math.sin(item.phase + item.life * 4) * 20 * dt;
            }
            item.x += item.vx * dt;
            item.y += item.vy * dt;
            item.rotation += item.spin * dt;
        }

        for (let index = this.trail.length - 1; index >= 0; index -= 1) {
            this.trail[index].age += dt;
        }
        while (this.trail.length > 0 && this.trail[0].age > TRAIL_LIFE) this.trail.shift();

        let followersMoving = false;
        if (CURSOR_EFFECTS.has(this.config.effect) && this.pointerX >= 0) {
            const ease = 1 - Math.pow(1 - (this.config.effect === 'spotlight' ? 0.25 : 0.18), dt * 60);
            let leaderX = this.pointerX;
            let leaderY = this.pointerY;
            this.followers.forEach((item) => {
                const dx = leaderX - item.x;
                const dy = leaderY - item.y;
                if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) followersMoving = true;
                item.x += dx * ease;
                item.y += dy * ease;
                leaderX = item.x;
                leaderY = item.y;
            });
        }

        return this.particles.length > 0 || this.trail.length > 0 || followersMoving;
    }

    private draw(seconds: number): void {
        const ctx = this.context;
        ctx.clearRect(0, 0, this.width, this.height);
        const effect = this.config.effect;

        if (effect === 'spotlight') {
            this.drawSpotlight();
            return;
        }
        if (effect === 'ring_cursor') {
            this.drawRing();
        }
        if (effect === 'dot_follow') {
            this.drawDots();
        }
        if (TRAIL_EFFECTS.has(effect)) {
            this.drawTrail();
        }

        for (const item of this.particles) {
            const progress = item.life / item.maxLife;
            const alpha = 1 - progress;
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.rotation);
            if (item.glyph === 'spark') {
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = withAlpha(item.color, alpha);
                ctx.lineWidth = item.size;
                ctx.lineCap = 'round';
                const length = Math.min(18, Math.hypot(item.vx, item.vy) * 0.06) * this.scale + 1;
                ctx.rotate(Math.atan2(item.vy, item.vx) - item.rotation);
                ctx.beginPath();
                ctx.moveTo(-length, 0);
                ctx.lineTo(0, 0);
                ctx.stroke();
                ctx.restore();
                continue;
            }
            this.drawParticle(item, alpha, progress, seconds);
            ctx.restore();
        }
    }

    private drawParticle(item: Particle, alpha: number, progress: number, seconds: number): void {
        const ctx = this.context;
        const size = item.size;
        switch (this.config.effect) {
            case 'sparkle_stars': {
                const twinkle = 0.6 + 0.4 * Math.sin(item.phase + seconds * 18);
                const r = size * twinkle * (1 - progress * 0.4);
                ctx.fillStyle = withAlpha(item.color, alpha);
                ctx.beginPath();
                for (let point = 0; point < 8; point += 1) {
                    const radius = point % 2 === 0 ? r : r * 0.28;
                    const angle = (point / 8) * TWO_PI;
                    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
                }
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'hearts': {
                const r = size / 2;
                ctx.fillStyle = withAlpha(item.color, alpha);
                ctx.beginPath();
                ctx.moveTo(0, r * 0.6);
                ctx.bezierCurveTo(-r * 2, -r * 0.6, -r * 0.8, -r * 2, 0, -r * 0.8);
                ctx.bezierCurveTo(r * 0.8, -r * 2, r * 2, -r * 0.6, 0, r * 0.6);
                ctx.fill();
                break;
            }
            case 'petals': {
                ctx.fillStyle = withAlpha(item.color, alpha * 0.95);
                ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(item.phase + item.life * 5)));
                ctx.beginPath();
                ctx.ellipse(0, 0, size, size * 0.55, 0, 0, TWO_PI);
                ctx.fill();
                break;
            }
            case 'snowflakes': {
                ctx.strokeStyle = withAlpha(item.color, alpha);
                ctx.lineWidth = Math.max(1, size * 0.18);
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (let arm = 0; arm < 6; arm += 1) {
                    const angle = (arm / 6) * TWO_PI;
                    const cx = Math.cos(angle);
                    const cy = Math.sin(angle);
                    ctx.moveTo(0, 0);
                    ctx.lineTo(cx * size, cy * size);
                    ctx.moveTo(cx * size * 0.55, cy * size * 0.55);
                    ctx.lineTo(
                        cx * size * 0.55 + Math.cos(angle + 0.8) * size * 0.3,
                        cy * size * 0.55 + Math.sin(angle + 0.8) * size * 0.3,
                    );
                }
                ctx.stroke();
                break;
            }
            case 'bubbles': {
                const r = size * (0.7 + progress * 0.4);
                ctx.strokeStyle = withAlpha(item.color, alpha * 0.9);
                ctx.lineWidth = 1.2;
                ctx.fillStyle = withAlpha(item.color, alpha * 0.12);
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, TWO_PI);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
                ctx.beginPath();
                ctx.arc(-r * 0.35, -r * 0.35, r * 0.22, 0, TWO_PI);
                ctx.fill();
                break;
            }
            case 'embers': {
                ctx.globalCompositeOperation = 'lighter';
                const flicker = 0.7 + 0.3 * Math.sin(item.phase + seconds * 30);
                ctx.fillStyle = withAlpha(item.color, alpha * 0.35 * flicker);
                ctx.beginPath();
                ctx.arc(0, 0, size * 2.6, 0, TWO_PI);
                ctx.fill();
                ctx.fillStyle = withAlpha(item.color, alpha * flicker);
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, TWO_PI);
                ctx.fill();
                break;
            }
            case 'emoji': {
                ctx.globalAlpha = alpha;
                ctx.font = `${Math.round(size)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.glyph, 0, 0);
                break;
            }
            case 'fireflies': {
                ctx.globalCompositeOperation = 'lighter';
                const blink = Math.max(0, Math.sin(item.phase + item.life * 4));
                const fade = Math.min(1, item.life * 3) * alpha * blink;
                ctx.fillStyle = withAlpha(item.color, fade * 0.25);
                ctx.beginPath();
                ctx.arc(0, 0, size * 4, 0, TWO_PI);
                ctx.fill();
                ctx.fillStyle = withAlpha(item.color, fade);
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, TWO_PI);
                ctx.fill();
                break;
            }
            case 'butterflies': {
                const flap = Math.abs(Math.sin(item.phase + item.life * 14));
                ctx.fillStyle = withAlpha(item.color, alpha * 0.9);
                ctx.save();
                ctx.scale(0.25 + flap * 0.75, 1);
                ctx.beginPath();
                ctx.ellipse(-size * 0.55, -size * 0.25, size * 0.6, size * 0.45, -0.5, 0, TWO_PI);
                ctx.ellipse(size * 0.55, -size * 0.25, size * 0.6, size * 0.45, 0.5, 0, TWO_PI);
                ctx.ellipse(-size * 0.4, size * 0.35, size * 0.35, size * 0.3, 0.4, 0, TWO_PI);
                ctx.ellipse(size * 0.4, size * 0.35, size * 0.35, size * 0.3, -0.4, 0, TWO_PI);
                ctx.fill();
                ctx.restore();
                ctx.fillStyle = `rgba(55, 65, 81, ${alpha})`;
                ctx.fillRect(-size * 0.07, -size * 0.5, size * 0.14, size);
                break;
            }
            case 'ripple': {
                const r = size * (0.15 + progress);
                ctx.strokeStyle = withAlpha(item.color, alpha * 0.8);
                ctx.lineWidth = Math.max(1, 2.5 * (1 - progress) * this.scale);
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, TWO_PI);
                ctx.stroke();
                if (r > 14) {
                    ctx.strokeStyle = withAlpha(item.color, alpha * 0.35);
                    ctx.beginPath();
                    ctx.arc(0, 0, r * 0.6, 0, TWO_PI);
                    ctx.stroke();
                }
                break;
            }
            case 'text_trail': {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = item.color;
                ctx.font = `600 ${Math.round(size)}px system-ui, -apple-system, "Malgun Gothic", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.glyph, 0, 0);
                break;
            }
            case 'confetti': {
                ctx.fillStyle = withAlpha(item.color, alpha);
                ctx.scale(1, Math.cos(item.phase + item.life * 10));
                ctx.fillRect(-size / 2, -size / 4, size, size / 2);
                break;
            }
            default:
                break;
        }
    }

    private drawTrail(): void {
        const ctx = this.context;
        const points = this.trail;
        if (points.length < 2) return;
        const effect = this.config.effect;
        const baseWidth = (effect === 'neon_line' ? 4 : effect === 'comet' ? 9 : 7) * this.scale;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (effect !== 'rainbow_tail') ctx.globalCompositeOperation = 'lighter';
        const color = this.color();

        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1];
            const point = points[index];
            const freshness = 1 - point.age / TRAIL_LIFE;
            const position = index / points.length;
            const strength = Math.max(0, Math.min(freshness, position));
            if (strength <= 0) continue;
            ctx.beginPath();
            ctx.moveTo(previous.x, previous.y);
            ctx.lineTo(point.x, point.y);
            if (effect === 'rainbow_tail') {
                const fixedColor = Boolean(this.config.customColor)
                    || (this.config.color !== 'default' && this.config.color !== 'rainbow');
                const hue = fixedColor
                    ? null
                    : (this.hue + index * 9) % 360;
                ctx.strokeStyle = hue === null
                    ? withAlpha(color, strength)
                    : `hsla(${hue}, 95%, 60%, ${strength})`;
                ctx.lineWidth = baseWidth * strength;
                ctx.stroke();
            } else if (effect === 'neon_line') {
                ctx.strokeStyle = withAlpha(color, strength * 0.25);
                ctx.lineWidth = baseWidth * 3.5 * strength;
                ctx.stroke();
                ctx.strokeStyle = withAlpha(color, strength);
                ctx.lineWidth = baseWidth * strength;
                ctx.stroke();
                ctx.strokeStyle = `rgba(255, 255, 255, ${strength * 0.8})`;
                ctx.lineWidth = Math.max(1, baseWidth * 0.35 * strength);
                ctx.stroke();
            } else {
                ctx.strokeStyle = withAlpha(color, strength * 0.6);
                ctx.lineWidth = baseWidth * strength * strength;
                ctx.stroke();
            }
        }

        if (effect === 'comet') {
            const head = points[points.length - 1];
            const freshness = 1 - head.age / TRAIL_LIFE;
            if (freshness > 0) {
                ctx.fillStyle = withAlpha(color, 0.3 * freshness);
                ctx.beginPath();
                ctx.arc(head.x, head.y, baseWidth * 1.6, 0, TWO_PI);
                ctx.fill();
                ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * freshness})`;
                ctx.beginPath();
                ctx.arc(head.x, head.y, baseWidth * 0.55, 0, TWO_PI);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    private drawRing(): void {
        if (!this.pointerInside) return;
        const ctx = this.context;
        const ring = this.followers[0];
        const color = this.color(0);
        const radius = (this.pressed ? 12 : 18) * this.scale;
        ctx.save();
        ctx.strokeStyle = withAlpha(color, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, radius, 0, TWO_PI);
        ctx.stroke();
        ctx.fillStyle = withAlpha(color, 0.9);
        ctx.beginPath();
        ctx.arc(this.pointerX, this.pointerY, 3 * this.scale, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
    }

    private drawDots(): void {
        if (!this.pointerInside) return;
        const ctx = this.context;
        const count = this.followers.length;
        ctx.save();
        for (let index = count - 1; index >= 0; index -= 1) {
            const item = this.followers[index];
            const ratio = 1 - index / count;
            ctx.fillStyle = withAlpha(this.color(index), 0.25 + ratio * 0.65);
            ctx.beginPath();
            ctx.arc(item.x, item.y, (2 + ratio * 5) * this.scale, 0, TWO_PI);
            ctx.fill();
        }
        ctx.restore();
    }

    private drawSpotlight(): void {
        if (!this.pointerInside) return;
        const ctx = this.context;
        const spot = this.followers[0];
        const radius = 130 * this.scale;
        const darkness = Math.min(0.75, 0.2 + 0.3 * this.amountFactor());
        const gradient = ctx.createRadialGradient(spot.x, spot.y, radius * 0.35, spot.x, spot.y, radius);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(0, 0, 0, ${darkness})`);
        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);
        const tint = this.config.customColor || (this.config.color !== 'default' ? this.color() : '');
        if (tint) {
            ctx.globalCompositeOperation = 'lighter';
            const glow = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, radius * 0.6);
            glow.addColorStop(0, withAlpha(tint, 0.12));
            glow.addColorStop(1, withAlpha(tint, 0));
            ctx.fillStyle = glow;
            ctx.fillRect(spot.x - radius, spot.y - radius, radius * 2, radius * 2);
        }
        ctx.restore();
    }
}
