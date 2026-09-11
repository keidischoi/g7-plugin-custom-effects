import type { EffectConfig, EffectKind, WindDirection } from './config';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    phase: number;
    phaseSpeed: number;
    rotation: number;
    rotationSpeed: number;
    colorIndex: number;
    alpha: number;
}

const EFFECT_DENSITY: Record<EffectKind, number> = {
    snow: 1,
    rain: 1.25,
    leaves: 0.45,
    stars: 0.55,
    hearts: 0.4,
    petals: 0.65,
    confetti: 0.75,
    bubbles: 0.4,
    fireflies: 0.3,
};

const EFFECT_PALETTES: Partial<Record<EffectKind, readonly string[]>> = {
    leaves: ['#d97706', '#dc2626', '#ca8a04', '#65a30d'],
    hearts: ['#fb7185', '#f43f5e', '#ec4899'],
    petals: ['#fbcfe8', '#f9a8d4', '#fda4af', '#ffffff'],
    confetti: ['#f43f5e', '#facc15', '#22c55e', '#38bdf8', '#a855f7'],
    bubbles: ['#bae6fd', '#ddd6fe', '#fbcfe8'],
    fireflies: ['#fef08a', '#fde047', '#bef264'],
};

export function signedWind(strength: number, direction: WindDirection): number {
    if (direction === 'none') return 0;
    return Math.abs(strength) * (direction === 'left' ? -1 : 1);
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
    }

    private newParticle(randomPosition: boolean): Particle {
        const speed = this.config.speed / 100;
        const effect = this.config.effect;
        const rain = effect === 'rain';
        const bubbles = effect === 'bubbles';
        const fireflies = effect === 'fireflies';
        const speedRange = this.speedRange(effect);
        const wind = signedWind(this.config.wind, this.config.windDirection);

        return {
            x: Math.random() * this.width,
            y: randomPosition
                ? Math.random() * this.height
                : bubbles ? this.height + 20 : -(Math.random() * 40 + 10),
            vx: fireflies
                ? (Math.random() - 0.5) * 30 * speed
                : wind * (rain ? 0.8 : 0.35) + (Math.random() - 0.5) * 18,
            vy: (bubbles ? -1 : 1)
                * (speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]))
                * speed,
            size: this.sizeRange(effect),
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
            hearts: [26, 62],
            petals: [24, 58],
            confetti: [70, 145],
            bubbles: [22, 55],
            fireflies: [8, 24],
        };
        return ranges[effect];
    }

    private sizeRange(effect: EffectKind): number {
        const ranges: Record<EffectKind, readonly [number, number]> = {
            snow: [1.2, 4.4],
            rain: [10, 28],
            leaves: [7, 13],
            stars: [3.5, 7],
            hearts: [5, 10],
            petals: [5, 10],
            confetti: [4, 9],
            bubbles: [5, 14],
            fireflies: [1.5, 3.5],
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
            case 'hearts': this.drawHearts(delta); break;
            case 'petals': this.drawPetals(delta); break;
            case 'confetti': this.drawConfetti(delta); break;
            case 'bubbles': this.drawBubbles(delta); break;
            case 'fireflies': this.drawFireflies(delta); break;
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
            this.advanceFalling(particle, delta, 12);
            this.prepareParticle(particle);
            this.context.beginPath();
            this.context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.context.fill();
        }
    }

    private drawRain(delta: number): void {
        this.context.lineWidth = 1.25;
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 0);
            this.prepareParticle(particle);
            const slant = particle.vx * 0.025;
            this.context.beginPath();
            this.context.moveTo(particle.x, particle.y);
            this.context.lineTo(particle.x - slant, particle.y - particle.size);
            this.context.stroke();
        }
    }

    private drawLeaves(delta: number): void {
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 32);
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
        for (const particle of this.particles) {
            this.advanceFalling(particle, delta, 14);
            this.prepareParticle(particle);
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

    private withTransform(particle: Particle, draw: () => void): void {
        this.context.save();
        this.context.translate(particle.x, particle.y);
        this.context.rotate(particle.rotation);
        draw();
        this.context.restore();
    }
}
