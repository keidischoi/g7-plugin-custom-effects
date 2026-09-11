import type { EffectConfig } from './config';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    phase: number;
    phaseSpeed: number;
}

export function particleCount(width: number, height: number, intensity: number): number {
    const scaled = (Math.max(1, width) * Math.max(1, height) / 16000) * (intensity / 100);
    return Math.min(300, Math.max(12, Math.round(scaled)));
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
        engine.createParticles();
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

        const desiredCount = particleCount(this.width, this.height, this.config.intensity);
        if (desiredCount !== this.particles.length) this.createParticles(desiredCount);
    };

    private createParticles(count = particleCount(
        this.width,
        this.height,
        this.config.intensity,
    )): void {
        this.particles = Array.from({ length: count }, () => this.newParticle(true));
    }

    private newParticle(randomY: boolean): Particle {
        const speedScale = this.config.speed / 100;
        const isRain = this.config.effect === 'rain';

        return {
            x: Math.random() * this.width,
            y: randomY ? Math.random() * this.height : -(Math.random() * 40 + 10),
            vx: (isRain ? this.config.wind * 0.8 : this.config.wind * 0.35)
                + (isRain ? 0 : (Math.random() - 0.5) * 18),
            vy: (isRain ? 520 + Math.random() * 360 : 28 + Math.random() * 62) * speedScale,
            size: isRain ? 10 + Math.random() * 18 : 1.2 + Math.random() * 3.2,
            phase: Math.random() * Math.PI * 2,
            phaseSpeed: 0.6 + Math.random() * 1.4,
        };
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
        if (this.target.document.hidden) {
            this.pause();
        } else {
            this.resume();
        }
    };

    private readonly render = (time: number): void => {
        const delta = Math.min(0.05, Math.max(0, (time - this.previousTime) / 1000));
        this.previousTime = time;

        this.context.clearRect(0, 0, this.width, this.height);
        this.context.globalAlpha = this.config.opacity / 100;
        this.context.fillStyle = this.config.color;
        this.context.strokeStyle = this.config.color;

        if (this.config.effect === 'rain') {
            this.drawRain(delta);
        } else {
            this.drawSnow(delta);
        }

        this.context.globalAlpha = 1;
        this.frameId = this.target.requestAnimationFrame(this.render);
    };

    private drawSnow(delta: number): void {
        this.context.beginPath();

        for (const particle of this.particles) {
            particle.phase += particle.phaseSpeed * delta;
            particle.x += (particle.vx + Math.sin(particle.phase) * 12) * delta;
            particle.y += particle.vy * delta;

            if (particle.y > this.height + particle.size) this.resetParticle(particle);
            if (particle.x > this.width + particle.size) particle.x = -particle.size;
            if (particle.x < -particle.size) particle.x = this.width + particle.size;

            this.context.moveTo(particle.x + particle.size, particle.y);
            this.context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        }

        this.context.fill();
    }

    private drawRain(delta: number): void {
        this.context.lineWidth = 1.25;
        this.context.beginPath();

        for (const particle of this.particles) {
            particle.x += particle.vx * delta;
            particle.y += particle.vy * delta;

            if (
                particle.y > this.height + particle.size
                || particle.x > this.width + 50
                || particle.x < -50
            ) {
                this.resetParticle(particle);
            }

            const slant = particle.vx * 0.025;
            this.context.moveTo(particle.x, particle.y);
            this.context.lineTo(particle.x - slant, particle.y - particle.size);
        }

        this.context.stroke();
    }
}
