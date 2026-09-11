import type { EffectConfig, EffectKind, WindDirection } from './config';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    baseSize: number;
    sparkle: number;
    explode: number;
    settled: number;
    phase: number;
    phaseSpeed: number;
    rotation: number;
    rotationSpeed: number;
    colorIndex: number;
    alpha: number;
}

export interface CollisionBody {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
}

const EFFECT_DENSITY: Record<EffectKind, number> = {
    snow: 1,
    rain: 1.25,
    leaves: 0.45,
    stars: 0.55,
    stars_multicolor: 0.55,
    hearts: 0.4,
    petals: 0.65,
    confetti: 0.75,
    bubbles: 0.4,
    bouncing_bubbles: 0.35,
    fireflies: 0.3,
    cheese: 0.4,
    poop: 0.5,
    ice_cream: 0.36,
    bills: 0.42,
    coins: 0.45,
    alarm_clock: 0.34,
    maple_leaves: 0.42,
};

const EFFECT_PALETTES: Partial<Record<EffectKind, readonly string[]>> = {
    leaves: ['#d97706', '#dc2626', '#ca8a04', '#65a30d'],
    stars_multicolor: ['#f87171', '#fb923c', '#fde047', '#86efac', '#38bdf8', '#c4b5fd', '#f9a8d4'],
    hearts: ['#fb7185', '#f43f5e', '#ec4899'],
    petals: ['#fbcfe8', '#f9a8d4', '#fda4af', '#ffffff'],
    confetti: ['#f43f5e', '#facc15', '#22c55e', '#38bdf8', '#a855f7'],
    bubbles: ['#bae6fd', '#ddd6fe', '#fbcfe8'],
    bouncing_bubbles: ['#bae6fd', '#ddd6fe', '#fbcfe8', '#86efac'],
    fireflies: ['#fef08a', '#fde047', '#bef264'],
    cheese: ['#facc15', '#fde047', '#fbbf24', '#f59e0b'],
    poop: ['#92400e', '#a16207', '#78350f', '#b45309'],
    ice_cream: ['#fda4af', '#f9a8d4', '#fed7aa', '#fef3c7'],
    bills: ['#86efac', '#4ade80', '#bbf7d0', '#22c55e'],
    coins: ['#facc15', '#eab308', '#fde68a', '#d97706'],
    alarm_clock: ['#f87171', '#fb7185', '#fda4af', '#e11d48'],
    maple_leaves: ['#dc2626', '#ea580c', '#ca8a04', '#b45309'],
};

export function signedWind(
    strength: number,
    direction: WindDirection,
    random: () => number = Math.random,
): number {
    if (direction === 'none') return 0;
    const sign = direction === 'random'
        ? (random() < 0.5 ? -1 : 1)
        : direction === 'left' ? -1 : 1;
    return Math.abs(strength) * sign;
}

export function resolveBubbleCollision(
    first: CollisionBody,
    second: CollisionBody,
): boolean {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const minimumDistance = first.size + second.size;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= minimumDistance * minimumDistance) return false;

    const distance = Math.sqrt(distanceSquared);
    const normalX = distance > 0 ? dx / distance : 1;
    const normalY = distance > 0 ? dy / distance : 0;
    const overlap = minimumDistance - distance;

    first.x -= normalX * overlap * 0.5;
    first.y -= normalY * overlap * 0.5;
    second.x += normalX * overlap * 0.5;
    second.y += normalY * overlap * 0.5;

    const relativeVelocity = (second.vx - first.vx) * normalX
        + (second.vy - first.vy) * normalY;
    if (relativeVelocity < 0) {
        first.vx += relativeVelocity * normalX;
        first.vy += relativeVelocity * normalY;
        second.vx -= relativeVelocity * normalX;
        second.vy -= relativeVelocity * normalY;
    }

    return true;
}

export const POOP_GROWTH = 1.22;
export const POOP_MAX_SCALE = 2.6;
export const POOP_HIT_RADIUS = 0.88;

export interface PoopBody extends CollisionBody {
    baseSize: number;
    sparkle: number;
}

export function resolvePoopCollision(
    first: PoopBody,
    second: PoopBody,
): boolean {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const minimumDistance = (first.size + second.size) * POOP_HIT_RADIUS;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= minimumDistance * minimumDistance) return false;

    const distance = Math.sqrt(distanceSquared);
    const normalX = distance > 0 ? dx / distance : 1;
    const normalY = distance > 0 ? dy / distance : 0;
    const overlap = minimumDistance - distance;

    first.x -= normalX * overlap * 0.5;
    first.y -= normalY * overlap * 0.5;
    second.x += normalX * overlap * 0.5;
    second.y += normalY * overlap * 0.5;

    const relativeVelocity = (second.vx - first.vx) * normalX
        + (second.vy - first.vy) * normalY;
    if (relativeVelocity >= 0) return false;

    first.vx += relativeVelocity * normalX * 0.7;
    first.vy += relativeVelocity * normalY * 0.35;
    second.vx -= relativeVelocity * normalX * 0.7;
    second.vy -= relativeVelocity * normalY * 0.35;
    return true;
}

export function growPoopOnHit(particle: PoopBody): void {
    if (particle.sparkle > 0.45) return;
    particle.size = Math.min(particle.baseSize * POOP_MAX_SCALE, particle.size * POOP_GROWTH);
    particle.sparkle = 1;
}

export const CHEESE_HIT_RADIUS = 0.9;
export const CHEESE_EXPLODE_DECAY = 2.15;

export interface CheeseBody extends CollisionBody {
    explode: number;
}

export function resolveCheeseCollision(
    first: CheeseBody,
    second: CheeseBody,
): boolean {
    if (first.explode > 0 || second.explode > 0) return false;

    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const minimumDistance = (first.size + second.size) * CHEESE_HIT_RADIUS;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= minimumDistance * minimumDistance) return false;

    const distance = Math.sqrt(distanceSquared);
    const normalX = distance > 0 ? dx / distance : 1;
    const normalY = distance > 0 ? dy / distance : 0;
    const overlap = minimumDistance - distance;

    first.x -= normalX * overlap * 0.5;
    first.y -= normalY * overlap * 0.5;
    second.x += normalX * overlap * 0.5;
    second.y += normalY * overlap * 0.5;

    const relativeVelocity = (second.vx - first.vx) * normalX
        + (second.vy - first.vy) * normalY;
    if (relativeVelocity >= 0) return false;

    first.vx += relativeVelocity * normalX * 0.45;
    first.vy += relativeVelocity * normalY * 0.45;
    second.vx -= relativeVelocity * normalX * 0.45;
    second.vy -= relativeVelocity * normalY * 0.45;
    return true;
}

export function explodeCheeseOnHit(particle: CheeseBody): void {
    if (particle.explode > 0) return;
    particle.explode = 1;
    particle.vx *= 0.18;
    particle.vy *= 0.12;
}

export const STAR_HIT_RADIUS = 2.85;
export const STAR_BURST_DECAY = 1.15;

export interface StarBody extends CollisionBody {
    sparkle: number;
}

export function resolveStarCollision(
    first: StarBody,
    second: StarBody,
): boolean {
    if (first.sparkle > 0.4 || second.sparkle > 0.4) return false;

    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const minimumDistance = (first.size + second.size) * STAR_HIT_RADIUS;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= minimumDistance * minimumDistance) return false;

    const distance = Math.sqrt(distanceSquared);
    const normalX = distance > 0 ? dx / distance : 1;
    const normalY = distance > 0 ? dy / distance : 0;
    const overlap = minimumDistance - distance;

    first.x -= normalX * overlap * 0.5;
    first.y -= normalY * overlap * 0.5;
    second.x += normalX * overlap * 0.5;
    second.y += normalY * overlap * 0.5;

    const relativeVelocity = (second.vx - first.vx) * normalX
        + (second.vy - first.vy) * normalY;
    if (relativeVelocity >= 0) return false;

    first.vx += relativeVelocity * normalX * 0.55;
    first.vy += relativeVelocity * normalY * 0.55;
    second.vx -= relativeVelocity * normalX * 0.55;
    second.vy -= relativeVelocity * normalY * 0.55;
    return true;
}

export function burstStarOnHit(particle: StarBody): void {
    if (particle.sparkle > 0.4) return;
    particle.sparkle = 1;
}

export const PILE_CELL = 8;
export const PILE_MAX_HEIGHT = 110;
export const PILE_RECYCLE_AGE = 18;
export const RAIN_GRAVITY = 1700;
export const RAIN_MAX_BOUNCES = 3;

export function pileColumn(
    x: number,
    columns: number,
    cellWidth: number = PILE_CELL,
): number {
    return Math.min(columns - 1, Math.max(0, Math.floor(x / cellWidth)));
}

export function heightAtPile(
    pile: ArrayLike<number>,
    x: number,
    cellWidth: number = PILE_CELL,
): number {
    return pile[pileColumn(x, pile.length, cellWidth)] ?? 0;
}

export function addToPile(
    pile: Float32Array,
    x: number,
    amount: number,
    maxHeight: number = PILE_MAX_HEIGHT,
    cellWidth: number = PILE_CELL,
): void {
    const center = pileColumn(x, pile.length, cellWidth);
    const weights = [0.12, 0.76, 0.12] as const;
    for (let offset = -1; offset <= 1; offset += 1) {
        const column = center + offset;
        if (column < 0 || column >= pile.length) continue;
        pile[column] = Math.min(maxHeight, pile[column] + amount * weights[offset + 1]);
    }
}

export function removeFromPile(
    pile: Float32Array,
    x: number,
    amount: number,
    cellWidth: number = PILE_CELL,
): void {
    const center = pileColumn(x, pile.length, cellWidth);
    const weights = [0.12, 0.76, 0.12] as const;
    for (let offset = -1; offset <= 1; offset += 1) {
        const column = center + offset;
        if (column < 0 || column >= pile.length) continue;
        pile[column] = Math.max(0, pile[column] - amount * weights[offset + 1]);
    }
}

export interface SettlingBody {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    rotationSpeed: number;
    settled: number;
}

export function settleOnPile(
    particle: SettlingBody,
    floorY: number,
    pile: ArrayLike<number>,
    restInset: number,
): boolean {
    const restY = floorY - heightAtPile(pile, particle.x) - restInset;
    if (particle.settled > 0) {
        particle.vx = 0;
        particle.vy = 0;
        particle.rotationSpeed = 0;
        return false;
    }
    if (particle.y < restY) return false;
    particle.y = restY;
    particle.vx = 0;
    particle.vy = 0;
    particle.rotationSpeed = 0;
    particle.settled = 1;
    return true;
}

export interface RainBody {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    sparkle: number;
}

export function bounceRainAtFloor(
    particle: RainBody,
    floorY: number,
    random: () => number = Math.random,
): boolean {
    const droplet = particle.sparkle > 0;
    const radius = droplet ? Math.max(2.4, particle.size * 0.26) : 0;
    if (particle.y + radius < floorY) return false;
    particle.y = floorY - radius;
    if (particle.vy <= 0) return false;

    particle.sparkle += 1;
    if (particle.sparkle === 1) {
        particle.vy = -(150 + random() * 160);
        particle.vx += (random() - 0.5) * 120;
        return false;
    }

    particle.vy = -Math.abs(particle.vy) * 0.42;
    particle.vx *= 0.7;
    return particle.sparkle >= RAIN_MAX_BOUNCES || Math.abs(particle.vy) < 55;
}

export function particleCount(
    width: number,
    height: number,
    intensity: number,
    effect: EffectKind = 'snow',
): number {
    const scaled = (Math.max(1, width) * Math.max(1, height) / 16000)
        * (intensity / 100)
        * EFFECT_DENSITY[effect];
    return Math.min(300, Math.max(8, Math.round(scaled)));
}

export class EffectsEngine {
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;
    private particles: Particle[] = [];
    private pile = new Float32Array(1);
    private grounded = 0;
    private frameId: number | null = null;
    private previousTime = 0;
    private width = 1;
    private height = 1;

    private constructor(
        private readonly config: EffectConfig,
        private readonly target: Window,
        canvas: HTMLCanvasElement,
        context: CanvasRenderingContext2D,
    ) {
        this.canvas = canvas;
        this.context = context;
    }

    static start(config: EffectConfig, target: Window = window): EffectsEngine | null {
        const canvas = target.document.createElement('canvas');
        canvas.className = 'g7-custom-effects-canvas';
        canvas.dataset.effect = config.effect;
        canvas.dataset.respectReducedMotion = String(config.respectReducedMotion);
        canvas.setAttribute('aria-hidden', 'true');

        const context = canvas.getContext('2d');
        if (!context || !target.document.body) return null;

        target.document.body.append(canvas);
        const engine = new EffectsEngine(config, target, canvas, context);
        engine.resize();
        target.addEventListener('resize', engine.resize, { passive: true });
        target.document.addEventListener('visibilitychange', engine.handleVisibility);
        engine.resume();
        return engine;
    }

    stop(): void {
        this.pause();
        this.target.removeEventListener('resize', this.resize);
        this.target.document.removeEventListener('visibilitychange', this.handleVisibility);
        this.canvas.remove();
        this.particles = [];
    }

    private readonly resize = (): void => {
        this.width = Math.max(1, this.target.innerWidth);
        this.height = Math.max(1, this.target.innerHeight);

        const ratio = Math.min(2, Math.max(1, this.target.devicePixelRatio || 1));
        this.canvas.width = Math.round(this.width * ratio);
        this.canvas.height = Math.round(this.height * ratio);
        this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.resizePile();

        const desiredCount = particleCount(
            this.width,
            this.height,
            this.config.intensity,
            this.config.effect,
        );
        if (desiredCount !== this.particles.length) this.createParticles(desiredCount);
    };

    private createParticles(count: number): void {
        this.particles = Array.from({ length: count }, () => this.newParticle(true));
        this.pile.fill(0);
        this.grounded = 0;
    }

    private resizePile(): void {
        const columns = Math.max(1, Math.ceil(this.width / PILE_CELL) + 1);
        if (this.pile.length === columns) return;
        this.pile = new Float32Array(columns);
    }

    private newParticle(randomPosition: boolean): Particle {
        const speed = this.config.speed / 100;
        const effect = this.config.effect;
        const rain = effect === 'rain';
        const bubbles = effect === 'bubbles';
        const bouncingBubbles = effect === 'bouncing_bubbles';
        const fireflies = effect === 'fireflies';
        const speedRange = this.speedRange(effect);
        const wind = signedWind(this.config.wind, this.config.windDirection);
        const size = this.sizeRange(effect);

        return {
            x: Math.random() * this.width,
            y: randomPosition
                ? Math.random() * this.height
                : bubbles ? this.height + 20 : -(Math.random() * 40 + 10),
            vx: fireflies || bouncingBubbles
                ? (Math.random() - 0.5) * 30 * speed
                    + wind * (bouncingBubbles ? 0.35 : 0)
                : wind * (rain ? 0.8 : 0.35) + (Math.random() - 0.5) * 18,
            vy: (bubbles ? -1 : bouncingBubbles && Math.random() < 0.5 ? -1 : 1)
                * (speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]))
                * speed,
            size,
            baseSize: size,
            sparkle: 0,
            explode: 0,
            settled: 0,
            phase: Math.random() * Math.PI * 2,
            phaseSpeed: 0.6 + Math.random() * 1.8,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 3,
            colorIndex: Math.floor(Math.random() * 8),
            alpha: 0.55 + Math.random() * 0.45,
        };
    }

    private speedRange(effect: EffectKind): readonly [number, number] {
        const ranges: Record<EffectKind, readonly [number, number]> = {
            snow: [28, 90],
            rain: [520, 880],
            leaves: [38, 82],
            stars: [24, 58],
            stars_multicolor: [24, 58],
            hearts: [26, 62],
            petals: [24, 58],
            confetti: [70, 145],
            bubbles: [22, 55],
            bouncing_bubbles: [28, 65],
            fireflies: [8, 24],
            cheese: [32, 70],
            poop: [30, 68],
            ice_cream: [28, 64],
            bills: [36, 78],
            coins: [40, 88],
            alarm_clock: [30, 66],
            maple_leaves: [34, 76],
        };
        return ranges[effect];
    }

    private sizeRange(effect: EffectKind): number {
        const ranges: Record<EffectKind, readonly [number, number]> = {
            snow: [1.2, 4.4],
            rain: [10, 28],
            leaves: [7, 13],
            stars: [3.5, 7],
            stars_multicolor: [3.5, 7],
            hearts: [5, 10],
            petals: [5, 10],
            confetti: [4, 9],
            bubbles: [5, 14],
            bouncing_bubbles: [5, 14],
            fireflies: [1.5, 3.5],
            cheese: [11, 20],
            poop: [11, 19],
            ice_cream: [11, 20],
            bills: [8, 14],
            coins: [6, 12],
            alarm_clock: [8, 15],
            maple_leaves: [11, 20],
        };
        const [min, max] = ranges[effect];
        return min + Math.random() * (max - min);
    }

    private resetParticle(particle: Particle): void {
        Object.assign(particle, this.newParticle(false));
        particle.x = Math.random() * (this.width + 80) - 40;
    }

    private resume(): void {
        if (this.frameId !== null || this.target.document.hidden) return;
        this.previousTime = this.target.performance.now();
        this.frameId = this.target.requestAnimationFrame(this.render);
    }

    private pause(): void {
        if (this.frameId === null) return;
        this.target.cancelAnimationFrame(this.frameId);
        this.frameId = null;
    }

    private readonly handleVisibility = (): void => {
        if (this.target.document.hidden) this.pause();
        else this.resume();
    };

    private readonly render = (time: number): void => {
        const delta = Math.min(0.05, Math.max(0, (time - this.previousTime) / 1000));
        this.previousTime = time;
        this.context.clearRect(0, 0, this.width, this.height);

        switch (this.config.effect) {
            case 'rain': this.drawRain(delta); break;
            case 'leaves': this.drawLeaves(delta); break;
            case 'stars': this.drawStars(delta); break;
            case 'stars_multicolor': this.drawStars(delta); break;
            case 'hearts': this.drawHearts(delta); break;
            case 'petals': this.drawPetals(delta); break;
            case 'confetti': this.drawConfetti(delta); break;
            case 'bubbles': this.drawBubbles(delta); break;
            case 'bouncing_bubbles': this.drawBouncingBubbles(delta); break;
            case 'fireflies': this.drawFireflies(delta); break;
            case 'cheese': this.drawCheese(delta); break;
            case 'poop': this.drawPoop(delta); break;
            case 'ice_cream': this.drawIceCream(delta); break;
            case 'bills': this.drawBills(delta); break;
            case 'coins': this.drawCoins(delta); break;
            case 'alarm_clock': this.drawAlarmClock(delta); break;
            case 'maple_leaves': this.drawMapleLeaves(delta); break;
            default: this.drawSnow(delta);
        }

        this.context.globalAlpha = 1;
        this.frameId = this.target.requestAnimationFrame(this.render);
    };

    private advanceFalling(particle: Particle, delta: number, sway: number): void {
        particle.phase += particle.phaseSpeed * delta;
        particle.rotation += particle.rotationSpeed * delta;
        particle.x += (particle.vx + Math.sin(particle.phase) * sway) * delta;
        particle.y += particle.vy * delta;

        if (particle.y > this.height + particle.size * 3) this.resetParticle(particle);
        this.wrapHorizontally(particle);
    }

    private pileRestInset(particle: Particle): number {
        if (this.config.effect === 'leaves') return particle.size * 0.58;
        if (this.config.effect === 'maple_leaves') return particle.size * 0.82;
        return particle.size;
    }

    private pileDeposit(particle: Particle): number {
        if (this.config.effect === 'leaves') return particle.size * 2.4;
        if (this.config.effect === 'maple_leaves') return particle.size * 2.2;
        return Math.max(8, particle.size * 9.5);
    }

    private advancePiling(particle: Particle, delta: number, sway: number): void {
        if (particle.settled > 0) {
            particle.settled += delta;
            settleOnPile(particle, this.height, this.pile, this.pileRestInset(particle));
            if (particle.settled >= PILE_RECYCLE_AGE) {
                removeFromPile(this.pile, particle.x, this.pileDeposit(particle));
                this.grounded = Math.max(0, this.grounded - 1);
                this.resetParticle(particle);
            }
            return;
        }

        particle.phase += particle.phaseSpeed * delta;
        particle.rotation += particle.rotationSpeed * delta;
        particle.x += (particle.vx + Math.sin(particle.phase) * sway) * delta;
        particle.y += particle.vy * delta;
        this.wrapHorizontally(particle);

        const restY = this.height - heightAtPile(this.pile, particle.x) - this.pileRestInset(particle);
        if (particle.y < restY) return;

        const maxSettled = Math.max(4, Math.floor(this.particles.length * 0.72));
        const pileFull = heightAtPile(this.pile, particle.x) >= PILE_MAX_HEIGHT - 0.5;
        if (pileFull || this.grounded >= maxSettled) {
            this.resetParticle(particle);
            return;
        }

        if (!settleOnPile(particle, this.height, this.pile, this.pileRestInset(particle))) return;
        addToPile(this.pile, particle.x, this.pileDeposit(particle));
        this.grounded += 1;
        if (this.config.effect !== 'snow') {
            particle.rotation = (Math.random() - 0.5) * 0.8;
        }
    }

    private wrapHorizontally(particle: Particle): void {
        if (particle.x > this.width + particle.size * 2) particle.x = -particle.size;
        if (particle.x < -particle.size * 2) particle.x = this.width + particle.size;
    }

    private colorFor(particle: Particle): string {
        const palette = EFFECT_PALETTES[this.config.effect];
        if (!palette || particle.colorIndex % (palette.length + 1) === 0) return this.config.color;
        return palette[particle.colorIndex % palette.length] ?? this.config.color;
    }

    private prepareParticle(particle: Particle): void {
        this.context.globalAlpha = (this.config.opacity / 100) * particle.alpha;
        this.context.fillStyle = this.colorFor(particle);
        this.context.strokeStyle = this.colorFor(particle);
    }

    private drawSnow(delta: number): void {
        for (const particle of this.particles) {
            this.advancePiling(particle, delta, 12);
            this.prepareParticle(particle);
            this.context.beginPath();
            this.context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.context.fill();
        }
    }

    private drawRain(delta: number): void {
        this.context.lineWidth = 1.25;
        for (const particle of this.particles) {
            if (particle.sparkle > 0) particle.vy += RAIN_GRAVITY * delta;
            particle.x += particle.vx * delta;
            particle.y += particle.vy * delta;
            this.wrapHorizontally(particle);
            if (bounceRainAtFloor(particle, this.height)) this.resetParticle(particle);
            this.prepareParticle(particle);
            if (particle.sparkle > 0) {
                const radius = Math.max(2.4, particle.size * 0.26);
                this.context.beginPath();
                this.context.ellipse(
                    particle.x,
                    particle.y,
                    radius * 0.72,
                    radius,
                    0,
                    0,
                    Math.PI * 2,
                );
                this.context.fill();
                continue;
            }
            const slant = particle.vx * 0.025;
            this.context.beginPath();
            this.context.moveTo(particle.x, particle.y);
            this.context.lineTo(particle.x - slant, particle.y - particle.size);
            this.context.stroke();
        }
    }

    private drawLeaves(delta: number): void {
        for (const particle of this.particles) {
            this.advancePiling(particle, delta, 32);
            this.prepareParticle(particle);
            this.withTransform(particle, () => {
                const size = particle.size;
                this.context.beginPath();
                this.context.moveTo(0, -size);
                this.context.bezierCurveTo(size, -size * 0.4, size, size * 0.5, 0, size);
                this.context.bezierCurveTo(-size, size * 0.5, -size, -size * 0.4, 0, -size);
                this.context.fill();
                this.context.lineWidth = 0.7;
                this.context.beginPath();
                this.context.moveTo(0, -size * 0.75);
                this.context.lineTo(0, size * 1.25);
                this.context.stroke();
            });
        }
    }

    private drawStars(delta: number): void {
        const fireworks = this.config.effect === 'stars_multicolor';
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 14);
            if (fireworks) {
                particle.sparkle = Math.max(0, particle.sparkle - delta * STAR_BURST_DECAY);
            }
        }
        if (fireworks) this.resolveStarCollisions();
        for (const particle of this.particles) {
            if (fireworks && particle.sparkle > 0) this.drawStarFirework(particle);
            this.prepareParticle(particle);
            if (fireworks && particle.sparkle > 0) {
                this.context.globalAlpha = Math.min(
                    1,
                    this.context.globalAlpha * (1 + particle.sparkle * 0.5),
                );
            }
            this.withTransform(particle, () => {
                this.context.beginPath();
                for (let point = 0; point < 10; point += 1) {
                    const radius = point % 2 === 0 ? particle.size : particle.size * 0.42;
                    const angle = -Math.PI / 2 + point * Math.PI / 5;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    if (point === 0) this.context.moveTo(x, y);
                    else this.context.lineTo(x, y);
                }
                this.context.closePath();
                this.context.fill();
            });
        }
    }

    private drawStarFirework(particle: Particle): void {
        const palette = EFFECT_PALETTES.stars_multicolor ?? [];
        if (palette.length === 0) return;

        const fade = particle.sparkle;
        const progress = 1 - fade;
        const size = particle.size;
        const opacity = (this.config.opacity / 100) * particle.alpha;
        const rays = 14;
        const burst = size * (2.4 + progress * 8.2);

        this.context.save();
        this.context.translate(particle.x, particle.y);
        this.context.globalAlpha = opacity;

        const flashRadius = size * (2.1 + progress * 3.4);
        const flash = this.context.createRadialGradient(0, 0, 0, 0, 0, flashRadius);
        flash.addColorStop(0, `rgba(255, 255, 255, ${0.9 * fade})`);
        flash.addColorStop(0.22, this.hexAlpha(palette[particle.colorIndex % palette.length], 0.5 * fade));
        flash.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.context.fillStyle = flash;
        this.context.beginPath();
        this.context.arc(0, 0, flashRadius, 0, Math.PI * 2);
        this.context.fill();

        this.context.lineCap = 'round';
        for (let ray = 0; ray < rays; ray += 1) {
            const angle = particle.phase + ray * (Math.PI * 2 / rays);
            const inner = size * (0.45 + progress * 1.1);
            const length = burst * (0.7 + (ray % 3) * 0.12);
            const color = palette[(particle.colorIndex + ray) % palette.length];
            this.context.strokeStyle = color;
            this.context.lineWidth = Math.max(1.15, size * (0.26 + fade * 0.28));
            this.context.globalAlpha = opacity * (0.45 + fade * 0.55);
            this.context.beginPath();
            this.context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
            this.context.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
            this.context.stroke();

            this.context.fillStyle = ray % 2 === 0 ? '#fff7ed' : color;
            this.fillCircle(
                Math.cos(angle) * length,
                Math.sin(angle) * length,
                size * (0.2 + fade * 0.18),
            );

            const sparkAngle = angle + Math.PI / rays;
            const sparkLength = burst * 0.48;
            this.context.strokeStyle = palette[(particle.colorIndex + ray + 3) % palette.length];
            this.context.lineWidth = Math.max(0.8, size * 0.18);
            this.context.globalAlpha = opacity * fade * 0.75;
            this.context.beginPath();
            this.context.moveTo(Math.cos(sparkAngle) * inner * 0.7, Math.sin(sparkAngle) * inner * 0.7);
            this.context.lineTo(Math.cos(sparkAngle) * sparkLength, Math.sin(sparkAngle) * sparkLength);
            this.context.stroke();
            this.context.fillStyle = '#fffbeb';
            this.fillCircle(
                Math.cos(sparkAngle) * sparkLength,
                Math.sin(sparkAngle) * sparkLength,
                size * 0.14 * fade,
            );
        }

        this.context.restore();
    }

    private resolveStarCollisions(): void {
        const largestDiameter = Math.max(
            1,
            ...this.particles.map((particle) => particle.size * 2 * STAR_HIT_RADIUS),
        );
        const grid = new Map<string, Particle[]>();

        for (const particle of this.particles) {
            const cellX = Math.floor(particle.x / largestDiameter);
            const cellY = Math.floor(particle.y / largestDiameter);

            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    const nearby = grid.get(`${cellX + offsetX}:${cellY + offsetY}`);
                    if (!nearby) continue;
                    for (const other of nearby) {
                        if (!resolveStarCollision(other, particle)) continue;
                        burstStarOnHit(other);
                        burstStarOnHit(particle);
                    }
                }
            }

            const key = `${cellX}:${cellY}`;
            const bucket = grid.get(key);
            if (bucket) bucket.push(particle);
            else grid.set(key, [particle]);
        }
    }

    private hexAlpha(hex: string, alpha: number): string {
        const value = hex.replace('#', '');
        const red = Number.parseInt(value.slice(0, 2), 16);
        const green = Number.parseInt(value.slice(2, 4), 16);
        const blue = Number.parseInt(value.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    private drawHearts(delta: number): void {
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 18);
            this.prepareParticle(particle);
            this.withTransform(particle, () => {
                const size = particle.size;
                this.context.beginPath();
                this.context.moveTo(0, size * 0.85);
                this.context.bezierCurveTo(-size * 1.4, 0, -size, -size, -size * 0.45, -size * 0.65);
                this.context.bezierCurveTo(0, -size * 0.35, 0, -size * 0.35, size * 0.45, -size * 0.65);
                this.context.bezierCurveTo(size, -size, size * 1.4, 0, 0, size * 0.85);
                this.context.fill();
            });
        }
    }

    private drawPetals(delta: number): void {
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 25);
            this.prepareParticle(particle);
            this.withTransform(particle, () => {
                this.context.beginPath();
                this.context.ellipse(
                    0,
                    0,
                    particle.size * 0.55,
                    particle.size,
                    0,
                    0,
                    Math.PI * 2,
                );
                this.context.fill();
            });
        }
    }

    private drawConfetti(delta: number): void {
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 8);
            this.prepareParticle(particle);
            this.withTransform(particle, () => {
                const width = particle.size;
                const height = particle.size * (1.2 + Math.abs(Math.sin(particle.phase)));
                this.context.fillRect(-width / 2, -height / 2, width, height);
            });
        }
    }

    private drawBubbles(delta: number): void {
        for (const particle of this.particles) {
            particle.phase += particle.phaseSpeed * delta;
            particle.x += (particle.vx + Math.sin(particle.phase) * 12) * delta;
            particle.y += particle.vy * delta;
            if (particle.y < -particle.size * 3) this.resetParticle(particle);
            this.wrapHorizontally(particle);
            this.prepareParticle(particle);
            this.context.lineWidth = 1;
            this.context.beginPath();
            this.context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.context.stroke();
            this.context.globalAlpha *= 0.65;
            this.context.beginPath();
            this.context.arc(
                particle.x - particle.size * 0.3,
                particle.y - particle.size * 0.3,
                particle.size * 0.16,
                0,
                Math.PI * 2,
            );
            this.context.fill();
        }
    }

    private drawBouncingBubbles(delta: number): void {
        for (const particle of this.particles) {
            particle.phase += particle.phaseSpeed * delta;
            particle.x += particle.vx * delta;
            particle.y += particle.vy * delta;
        }

        this.resolveBouncingBubbleCollisions();

        for (const particle of this.particles) {
            if (particle.x <= particle.size || particle.x >= this.width - particle.size) {
                particle.x = Math.min(
                    this.width - particle.size,
                    Math.max(particle.size, particle.x),
                );
                particle.vx *= -1;
            }
            if (particle.y <= particle.size || particle.y >= this.height - particle.size) {
                particle.y = Math.min(
                    this.height - particle.size,
                    Math.max(particle.size, particle.y),
                );
                particle.vy *= -1;
            }

            this.prepareParticle(particle);
            this.context.lineWidth = 1;
            this.context.beginPath();
            this.context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.context.stroke();
            this.context.globalAlpha *= 0.65;
            this.context.beginPath();
            this.context.arc(
                particle.x - particle.size * 0.3,
                particle.y - particle.size * 0.3,
                particle.size * 0.16,
                0,
                Math.PI * 2,
            );
            this.context.fill();
        }
    }

    private resolveBouncingBubbleCollisions(): void {
        const largestDiameter = Math.max(
            1,
            ...this.particles.map((particle) => particle.size * 2),
        );
        const grid = new Map<string, Particle[]>();

        for (const particle of this.particles) {
            const cellX = Math.floor(particle.x / largestDiameter);
            const cellY = Math.floor(particle.y / largestDiameter);

            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    const nearby = grid.get(`${cellX + offsetX}:${cellY + offsetY}`);
                    if (!nearby) continue;
                    for (const other of nearby) resolveBubbleCollision(other, particle);
                }
            }

            const key = `${cellX}:${cellY}`;
            const bucket = grid.get(key);
            if (bucket) bucket.push(particle);
            else grid.set(key, [particle]);
        }
    }

    private drawFireflies(delta: number): void {
        for (const particle of this.particles) {
            particle.phase += particle.phaseSpeed * delta;
            particle.x += (particle.vx + Math.sin(particle.phase) * 8) * delta;
            particle.y += (particle.vy + Math.cos(particle.phase * 0.7) * 10) * delta;

            if (particle.y > this.height + 10) particle.y = -10;
            if (particle.y < -10) particle.y = this.height + 10;
            this.wrapHorizontally(particle);
            this.prepareParticle(particle);
            this.context.globalAlpha *= 0.45 + (Math.sin(particle.phase * 2) + 1) * 0.275;
            this.context.beginPath();
            this.context.arc(particle.x, particle.y, particle.size * 2.2, 0, Math.PI * 2);
            this.context.fill();
            this.context.globalAlpha = Math.min(1, this.context.globalAlpha * 1.8);
            this.context.beginPath();
            this.context.arc(particle.x, particle.y, particle.size * 0.65, 0, Math.PI * 2);
            this.context.fill();
        }
    }

    private drawCheese(delta: number): void {
        for (const particle of this.particles) {
            if (particle.explode > 0) {
                particle.explode = Math.max(0, particle.explode - delta * CHEESE_EXPLODE_DECAY);
                particle.x += particle.vx * delta * 0.4;
                particle.y += particle.vy * delta * 0.4;
                particle.rotation += particle.rotationSpeed * delta * 2.4;
                if (particle.explode === 0) this.resetParticle(particle);
                continue;
            }
            this.advanceFalling(particle, delta, 16);
        }
        this.resolveCheeseCollisions();
        for (const particle of this.particles) {
            if (particle.explode > 0) this.drawCheeseExplosion(particle);
            else this.drawCheeseWedge(particle);
        }
    }

    private drawCheeseWedge(particle: Particle): void {
        this.withTransform(particle, () => {
            const size = particle.size;
            const body = this.fixedPaletteColor(particle, '#facc15');
            const crust = '#d97706';
            const side = '#f59e0b';
            const hole = '#b45309';
            const holeInner = '#78350f';
            this.context.globalAlpha = (this.config.opacity / 100) * particle.alpha;

            this.context.fillStyle = crust;
            this.context.beginPath();
            this.context.moveTo(-size * 1.05, size * 0.78);
            this.context.lineTo(size * 0.98, size * 0.78);
            this.context.lineTo(size * 0.18, -size * 1.05);
            this.context.closePath();
            this.context.fill();

            this.context.fillStyle = side;
            this.context.beginPath();
            this.context.moveTo(size * 0.82, size * 0.62);
            this.context.lineTo(size * 1.08, size * 0.38);
            this.context.lineTo(size * 0.32, -size * 0.92);
            this.context.lineTo(size * 0.12, -size * 0.78);
            this.context.closePath();
            this.context.fill();

            this.context.fillStyle = body;
            this.context.beginPath();
            this.context.moveTo(-size * 0.92, size * 0.62);
            this.context.lineTo(size * 0.82, size * 0.62);
            this.context.lineTo(size * 0.12, -size * 0.78);
            this.context.closePath();
            this.context.fill();

            this.drawCheeseHole(-size * 0.28, size * 0.22, size * 0.2, hole, holeInner);
            this.drawCheeseHole(size * 0.22, size * 0.28, size * 0.16, hole, holeInner);
            this.drawCheeseHole(size * 0.02, -size * 0.18, size * 0.14, hole, holeInner);
            this.drawCheeseHole(-size * 0.08, size * 0.48, size * 0.1, hole, holeInner);
        });
    }

    private drawCheeseExplosion(particle: Particle): void {
        const progress = 1 - particle.explode;
        this.withTransform(particle, () => {
            const size = particle.size;
            const fade = Math.max(0, particle.explode);
            this.context.globalAlpha = (this.config.opacity / 100) * particle.alpha * fade;

            const flashRadius = size * (1.15 + progress * 2.35);
            const flash = this.context.createRadialGradient(0, 0, 0, 0, 0, flashRadius);
            flash.addColorStop(0, `rgba(255, 248, 180, ${0.62 * fade})`);
            flash.addColorStop(0.45, `rgba(250, 204, 21, ${0.28 * fade})`);
            flash.addColorStop(1, 'rgba(217, 119, 6, 0)');
            this.context.fillStyle = flash;
            this.context.beginPath();
            this.context.arc(0, 0, flashRadius, 0, Math.PI * 2);
            this.context.fill();

            const crumbs = 11;
            for (let crumb = 0; crumb < crumbs; crumb += 1) {
                const angle = particle.phase + crumb * 0.73;
                const distance = size * (0.22 + progress * (1.55 + (crumb % 3) * 0.38));
                const crumbSize = size * (0.16 + (crumb % 4) * 0.035) * (1 - progress * 0.42);
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                this.context.fillStyle = crumb % 2 === 0 ? '#facc15' : '#eab308';
                this.context.beginPath();
                this.context.moveTo(x, y - crumbSize);
                this.context.lineTo(x + crumbSize * 0.92, y + crumbSize * 0.52);
                this.context.lineTo(x - crumbSize * 0.72, y + crumbSize * 0.58);
                this.context.closePath();
                this.context.fill();

                if (crumb % 3 === 0) {
                    this.context.fillStyle = '#d97706';
                    this.context.beginPath();
                    this.context.arc(x, y + crumbSize * 0.12, crumbSize * 0.22, 0, Math.PI * 2);
                    this.context.fill();
                }
            }
        });
    }

    private resolveCheeseCollisions(): void {
        const largestDiameter = Math.max(
            1,
            ...this.particles.map((particle) => particle.size * 2),
        );
        const grid = new Map<string, Particle[]>();

        for (const particle of this.particles) {
            if (particle.explode > 0) continue;
            const cellX = Math.floor(particle.x / largestDiameter);
            const cellY = Math.floor(particle.y / largestDiameter);

            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    const nearby = grid.get(`${cellX + offsetX}:${cellY + offsetY}`);
                    if (!nearby) continue;
                    for (const other of nearby) {
                        if (!resolveCheeseCollision(other, particle)) continue;
                        explodeCheeseOnHit(other);
                        explodeCheeseOnHit(particle);
                    }
                }
            }

            const key = `${cellX}:${cellY}`;
            const bucket = grid.get(key);
            if (bucket) bucket.push(particle);
            else grid.set(key, [particle]);
        }
    }

    private drawCheeseHole(
        x: number,
        y: number,
        radius: number,
        hole: string,
        holeInner: string,
    ): void {
        this.context.fillStyle = hole;
        this.fillEllipse(x, y, radius, radius * 0.78);
        this.context.fillStyle = holeInner;
        this.fillEllipse(x + radius * 0.12, y + radius * 0.1, radius * 0.55, radius * 0.42);
        this.context.fillStyle = 'rgba(254, 243, 199, 0.55)';
        this.fillEllipse(x - radius * 0.28, y - radius * 0.22, radius * 0.22, radius * 0.16);
    }

    private drawPoop(delta: number): void {
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 14);
            particle.sparkle = Math.max(0, particle.sparkle - delta * 2.6);
        }
        this.resolvePoopCollisions();
        for (const particle of this.particles) {
            this.drawPoopParticle(particle);
        }
    }

    private drawPoopParticle(particle: Particle): void {
        this.withTransform(particle, () => {
            const size = particle.size;
            const body = this.fixedPaletteColor(particle, '#92400e');
            const shade = '#78350f';
            const flash = particle.sparkle;
            this.context.globalAlpha = (this.config.opacity / 100) * particle.alpha;

            this.context.fillStyle = shade;
            this.fillEllipse(size * 0.08, size * 0.5, size * 0.92, size * 0.42);
            this.context.fillStyle = body;
            this.fillEllipse(0, size * 0.42, size * 0.95, size * 0.48);

            this.context.fillStyle = shade;
            this.fillEllipse(size * 0.06, size * 0.02, size * 0.68, size * 0.34);
            this.context.fillStyle = body;
            this.fillEllipse(-size * 0.04, -size * 0.08, size * 0.72, size * 0.4);

            this.context.fillStyle = shade;
            this.fillEllipse(size * 0.18, -size * 0.5, size * 0.4, size * 0.24);
            this.context.fillStyle = body;
            this.fillEllipse(size * 0.06, -size * 0.58, size * 0.46, size * 0.3);
            this.fillEllipse(size * 0.28, -size * 0.82, size * 0.18, size * 0.14);

            this.context.fillStyle = 'rgba(254, 243, 199, 0.28)';
            this.fillEllipse(-size * 0.28, size * 0.28, size * 0.22, size * 0.14);
            this.fillEllipse(-size * 0.22, -size * 0.18, size * 0.16, size * 0.1);

            if (flash > 0) {
                this.context.fillStyle = `rgba(253, 224, 71, ${0.32 * flash})`;
                this.fillEllipse(0, 0, size * 1.05, size * 1.15);
            }

            this.context.fillStyle = '#fff7ed';
            this.fillCircle(-size * 0.18, -size * 0.16, size * 0.16);
            this.fillCircle(size * 0.2, -size * 0.12, size * 0.16);
            this.context.fillStyle = '#1f2937';
            this.fillCircle(-size * 0.14, -size * 0.14, size * 0.075);
            this.fillCircle(size * 0.24, -size * 0.1, size * 0.075);

            this.context.strokeStyle = '#1f2937';
            this.context.lineWidth = Math.max(0.8, size * 0.08);
            this.context.lineCap = 'round';
            this.context.beginPath();
            this.context.arc(size * 0.02, size * 0.08, size * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
            this.context.stroke();

            if (flash > 0) {
                this.drawPoopSparkles(size, particle.phase, flash);
            }
        });
    }

    private drawPoopSparkles(size: number, phase: number, flash: number): void {
        const count = 7;
        this.context.fillStyle = `rgba(254, 240, 138, ${0.35 + flash * 0.65})`;
        for (let point = 0; point < count; point += 1) {
            const angle = phase + point * (Math.PI * 2 / count);
            const distance = size * (1.15 + (1 - flash) * 0.55);
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            const spark = size * (0.14 + flash * 0.12);
            this.context.beginPath();
            this.context.moveTo(x, y - spark);
            this.context.lineTo(x + spark * 0.28, y);
            this.context.lineTo(x, y + spark);
            this.context.lineTo(x - spark * 0.28, y);
            this.context.closePath();
            this.context.fill();
        }
    }

    private resolvePoopCollisions(): void {
        const largestDiameter = Math.max(
            1,
            ...this.particles.map((particle) => particle.size * 2),
        );
        const grid = new Map<string, Particle[]>();

        for (const particle of this.particles) {
            const cellX = Math.floor(particle.x / largestDiameter);
            const cellY = Math.floor(particle.y / largestDiameter);

            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    const nearby = grid.get(`${cellX + offsetX}:${cellY + offsetY}`);
                    if (!nearby) continue;
                    for (const other of nearby) {
                        if (!resolvePoopCollision(other, particle)) continue;
                        growPoopOnHit(other);
                        growPoopOnHit(particle);
                    }
                }
            }

            const key = `${cellX}:${cellY}`;
            const bucket = grid.get(key);
            if (bucket) bucket.push(particle);
            else grid.set(key, [particle]);
        }
    }

    private fixedPaletteColor(particle: Particle, fallback: string): string {
        const palette = EFFECT_PALETTES[this.config.effect];
        if (!palette) return fallback;
        return palette[particle.colorIndex % palette.length] ?? fallback;
    }

    private fillEllipse(x: number, y: number, rx: number, ry: number): void {
        this.context.beginPath();
        this.context.ellipse(x, y, Math.max(0.35, rx), Math.max(0.35, ry), 0, 0, Math.PI * 2);
        this.context.fill();
    }

    private drawIceCream(delta: number): void {
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 18);
            this.withTransform(particle, () => {
                const size = particle.size;
                const scoop = this.fixedPaletteColor(particle, '#fda4af');
                this.context.globalAlpha = (this.config.opacity / 100) * particle.alpha;

                this.context.fillStyle = '#b45309';
                this.context.beginPath();
                this.context.moveTo(-size * 0.5, size * 0.08);
                this.context.lineTo(size * 0.5, size * 0.08);
                this.context.lineTo(size * 0.08, size * 1.08);
                this.context.lineTo(-size * 0.08, size * 1.08);
                this.context.closePath();
                this.context.fill();

                this.context.fillStyle = '#d97706';
                this.context.beginPath();
                this.context.moveTo(-size * 0.44, size * 0.04);
                this.context.lineTo(size * 0.44, size * 0.04);
                this.context.lineTo(size * 0.05, size);
                this.context.lineTo(-size * 0.05, size);
                this.context.closePath();
                this.context.fill();

                this.context.save();
                this.context.beginPath();
                this.context.moveTo(-size * 0.44, size * 0.04);
                this.context.lineTo(size * 0.44, size * 0.04);
                this.context.lineTo(size * 0.05, size);
                this.context.lineTo(-size * 0.05, size);
                this.context.closePath();
                this.context.clip();
                this.context.strokeStyle = 'rgba(120, 53, 15, 0.55)';
                this.context.lineWidth = Math.max(0.7, size * 0.06);
                for (let line = -4; line <= 6; line += 1) {
                    this.context.beginPath();
                    this.context.moveTo(-size * 0.55 + line * size * 0.18, size * 0.02);
                    this.context.lineTo(-size * 0.1 + line * size * 0.18, size * 1.05);
                    this.context.stroke();
                    this.context.beginPath();
                    this.context.moveTo(size * 0.55 - line * size * 0.18, size * 0.02);
                    this.context.lineTo(size * 0.1 - line * size * 0.18, size * 1.05);
                    this.context.stroke();
                }
                this.context.restore();

                this.context.fillStyle = scoop;
                this.fillCircle(0, -size * 0.28, size * 0.58);
                this.fillCircle(-size * 0.28, -size * 0.12, size * 0.28);
                this.fillCircle(size * 0.28, -size * 0.1, size * 0.26);
                this.context.fillStyle = 'rgba(255, 255, 255, 0.38)';
                this.fillEllipse(-size * 0.16, -size * 0.42, size * 0.18, size * 0.12);
                this.context.fillStyle = scoop;
                this.fillEllipse(size * 0.12, size * 0.08, size * 0.1, size * 0.16);

                this.context.strokeStyle = '#b91c1c';
                this.context.lineWidth = Math.max(0.8, size * 0.07);
                this.context.lineCap = 'round';
                this.context.beginPath();
                this.context.moveTo(size * 0.02, -size * 0.92);
                this.context.quadraticCurveTo(size * 0.12, -size * 1.12, size * 0.22, -size * 1.05);
                this.context.stroke();
                this.context.fillStyle = '#ef4444';
                this.fillCircle(0, -size * 0.82, size * 0.16);
                this.context.fillStyle = 'rgba(254, 226, 226, 0.7)';
                this.fillCircle(-size * 0.05, -size * 0.88, size * 0.055);
            });
        }
    }

    private drawMapleLeaves(delta: number): void {
        for (const particle of this.particles) {
            this.advancePiling(particle, delta, 28);
            this.withTransform(particle, () => {
                const size = particle.size;
                const body = this.fixedPaletteColor(particle, '#dc2626');
                this.context.globalAlpha = (this.config.opacity / 100) * particle.alpha;
                this.drawMapleLeafPath(size);
                this.context.fillStyle = body;
                this.context.fill();
                this.context.fillStyle = '#78350f';
                this.context.fillRect(-size * 0.055, size * 0.46, size * 0.11, size * 0.58);
                this.context.strokeStyle = 'rgba(69, 26, 3, 0.45)';
                this.context.lineWidth = Math.max(0.7, size * 0.05);
                this.context.stroke();

                this.context.strokeStyle = 'rgba(69, 26, 3, 0.7)';
                this.context.lineWidth = Math.max(0.8, size * 0.07);
                this.context.lineCap = 'round';
                this.context.beginPath();
                this.context.moveTo(0, -size * 0.62);
                this.context.lineTo(0, size * 1.12);
                this.context.moveTo(0, -size * 0.18);
                this.context.quadraticCurveTo(size * 0.22, -size * 0.05, size * 0.62, -size * 0.28);
                this.context.moveTo(0, -size * 0.18);
                this.context.quadraticCurveTo(-size * 0.22, -size * 0.05, -size * 0.62, -size * 0.28);
                this.context.moveTo(0, size * 0.12);
                this.context.quadraticCurveTo(size * 0.18, size * 0.28, size * 0.42, size * 0.48);
                this.context.moveTo(0, size * 0.12);
                this.context.quadraticCurveTo(-size * 0.18, size * 0.28, -size * 0.42, size * 0.48);
                this.context.stroke();
            });
        }
    }

    private drawMapleLeafPath(size: number): void {
        const s = size;
        this.context.beginPath();
        this.context.moveTo(0, -s);
        this.context.quadraticCurveTo(s * 0.12, -s * 0.72, s * 0.22, -s * 0.58);
        this.context.lineTo(s * 0.38, -s * 0.92);
        this.context.quadraticCurveTo(s * 0.52, -s * 0.48, s * 0.4, -s * 0.22);
        this.context.lineTo(s * 0.92, -s * 0.42);
        this.context.quadraticCurveTo(s * 0.7, -s * 0.02, s * 0.48, s * 0.06);
        this.context.lineTo(s * 0.82, s * 0.38);
        this.context.quadraticCurveTo(s * 0.42, s * 0.32, s * 0.22, s * 0.2);
        this.context.lineTo(s * 0.34, s * 0.62);
        this.context.quadraticCurveTo(s * 0.1, s * 0.42, s * 0.06, s * 0.28);
        this.context.lineTo(0, s * 0.52);
        this.context.lineTo(-s * 0.06, s * 0.28);
        this.context.quadraticCurveTo(-s * 0.1, s * 0.42, -s * 0.34, s * 0.62);
        this.context.lineTo(-s * 0.22, s * 0.2);
        this.context.quadraticCurveTo(-s * 0.42, s * 0.32, -s * 0.82, s * 0.38);
        this.context.lineTo(-s * 0.48, s * 0.06);
        this.context.quadraticCurveTo(-s * 0.7, -s * 0.02, -s * 0.92, -s * 0.42);
        this.context.lineTo(-s * 0.4, -s * 0.22);
        this.context.quadraticCurveTo(-s * 0.52, -s * 0.48, -s * 0.38, -s * 0.92);
        this.context.lineTo(-s * 0.22, -s * 0.58);
        this.context.quadraticCurveTo(-s * 0.12, -s * 0.72, 0, -s);
        this.context.closePath();
    }

    private drawBills(delta: number): void {
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 10);
            this.prepareParticle(particle);
            this.withTransform(particle, () => {
                const width = particle.size * 1.8;
                const height = particle.size * 0.95;
                this.roundRect(-width / 2, -height / 2, width, height, height * 0.12);
                this.context.fill();
                this.context.strokeStyle = 'rgba(21, 128, 61, 0.85)';
                this.context.lineWidth = 0.8;
                this.context.stroke();
                this.context.fillStyle = 'rgba(21, 128, 61, 0.9)';
                this.fillCircle(0, 0, Math.min(width, height) * 0.22);
                this.context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                this.context.beginPath();
                this.context.moveTo(-width * 0.32, -height * 0.18);
                this.context.lineTo(-width * 0.32, height * 0.18);
                this.context.moveTo(width * 0.32, -height * 0.18);
                this.context.lineTo(width * 0.32, height * 0.18);
                this.context.stroke();
            });
        }
    }

    private drawCoins(delta: number): void {
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 8);
            this.prepareParticle(particle);
            this.withTransform(particle, () => {
                const size = particle.size;
                this.fillCircle(0, 0, size);
                this.context.strokeStyle = 'rgba(146, 64, 14, 0.8)';
                this.context.lineWidth = 1.1;
                this.context.beginPath();
                this.context.arc(0, 0, size * 0.72, 0, Math.PI * 2);
                this.context.stroke();
                this.context.beginPath();
                this.context.moveTo(0, -size * 0.32);
                this.context.lineTo(0, size * 0.32);
                this.context.moveTo(-size * 0.18, -size * 0.12);
                this.context.lineTo(size * 0.18, -size * 0.12);
                this.context.stroke();
            });
        }
    }

    private drawAlarmClock(delta: number): void {
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 12);
            this.prepareParticle(particle);
            this.withTransform(particle, () => {
                const size = particle.size;
                this.fillCircle(-size * 0.42, -size * 0.72, size * 0.28);
                this.fillCircle(size * 0.42, -size * 0.72, size * 0.28);
                this.fillCircle(0, 0, size * 0.72);
                this.context.fillStyle = '#fff7ed';
                this.fillCircle(0, 0, size * 0.5);
                this.context.strokeStyle = '#1f2937';
                this.context.lineWidth = 1;
                this.context.beginPath();
                this.context.moveTo(0, 0);
                this.context.lineTo(0, -size * 0.32);
                this.context.moveTo(0, 0);
                this.context.lineTo(size * 0.28, size * 0.12);
                this.context.stroke();
                this.context.strokeStyle = this.colorFor(particle);
                this.context.beginPath();
                this.context.moveTo(-size * 0.22, size * 0.62);
                this.context.lineTo(-size * 0.38, size * 0.92);
                this.context.moveTo(size * 0.22, size * 0.62);
                this.context.lineTo(size * 0.38, size * 0.92);
                this.context.stroke();
            });
        }
    }

    private fillCircle(x: number, y: number, radius: number): void {
        this.context.beginPath();
        this.context.arc(x, y, Math.max(0.35, radius), 0, Math.PI * 2);
        this.context.fill();
    }

    private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
        const corner = Math.min(radius, width / 2, height / 2);
        this.context.beginPath();
        this.context.moveTo(x + corner, y);
        this.context.arcTo(x + width, y, x + width, y + height, corner);
        this.context.arcTo(x + width, y + height, x, y + height, corner);
        this.context.arcTo(x, y + height, x, y, corner);
        this.context.arcTo(x, y, x + width, y, corner);
        this.context.closePath();
    }

    private withTransform(particle: Particle, draw: () => void): void {
        this.context.save();
        this.context.translate(particle.x, particle.y);
        this.context.rotate(particle.rotation);
        draw();
        this.context.restore();
    }
}
