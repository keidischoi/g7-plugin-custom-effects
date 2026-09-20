import { describe, expect, it } from 'vitest';
import {
    COLOR_OPTIONS,
    DEFAULT_CONFIG,
    EFFECT_KINDS,
    TIMEZONE_OPTIONS,
    normalizeConfig,
    readInlineConfig,
    readSiteTimezone,
    shouldStart,
} from './config';
import {
    particleCount,
    resolveBubbleCollision,
    signedWind,
    growPoopOnHit,
    resolvePoopCollision,
    explodeCheeseOnHit,
    resolveCheeseCollision,
    burstStarOnHit,
    resolveStarCollision,
    bounceRainAtFloor,
    isUnsupported,
    settleWhereHit,
<<<<<<< HEAD
=======
    snowSpawnY,
    parkSettledFlake,
    ageSnowPiles,
>>>>>>> c296cf2d90e83e047cf94ead1b1c993fb02b9ad7
} from './engine';

describe('normalizeConfig', () => {
    it('uses safe defaults for a missing payload', () => {
        expect(normalizeConfig(undefined)).toEqual(DEFAULT_CONFIG);
    });

    it('normalizes booleans and clamps numeric settings', () => {
        expect(normalizeConfig({
            enabled: '0',
            effect: 'rain',
            intensity: 999,
            speed: '10',
            opacity: 44.6,
            wind: -500,
            mobile_enabled: '1',
            admin_enabled: true,
            respect_reduced_motion: false,
        })).toMatchObject({
            enabled: false,
            effect: 'rain',
            intensity: 200,
            speed: 25,
            opacity: 45,
            wind: 100,
            windDirection: 'left',
            mobileEnabled: true,
            adminEnabled: true,
            respectReducedMotion: false,
        });
    });

    it('accepts preset colors and rejects values outside the dropdown', () => {
        for (const color of COLOR_OPTIONS) {
            expect(normalizeConfig({ color }).color).toBe(color);
        }
        expect(normalizeConfig({ color: 'red; display:none' }).color).toBe('#ffffff');
        expect(normalizeConfig({ color: '#123456' }).color).toBe('#ffffff');
    });

    it('uses an explicit wind direction with a positive strength', () => {
        expect(normalizeConfig({
            wind: 60,
            wind_direction: 'right',
        })).toMatchObject({
            wind: 60,
            windDirection: 'right',
        });
    });

    it('converts legacy signed wind values into the new direction model', () => {
        expect(normalizeConfig({ wind: -40 })).toMatchObject({
            wind: 40,
            windDirection: 'left',
        });
        expect(normalizeConfig({ wind: 40 })).toMatchObject({
            wind: 40,
            windDirection: 'right',
        });
    });

    it.each(EFFECT_KINDS)('accepts the %s effect', (effect) => {
        expect(normalizeConfig({ effect }).effect).toBe(effect);
    });

    it('falls back to snow for an unknown effect', () => {
        expect(normalizeConfig({ effect: 'unknown' }).effect).toBe('snow');
    });

    it('normalizes scheduling fields and rejects malformed values', () => {
        expect(normalizeConfig({
            schedule_enabled: '1',
            schedule_start_date: '2026-12-01',
            schedule_end_date: '2026-99-99',
            schedule_start_time: '22:30',
            schedule_end_time: '27:00',
            schedule_days: 'weekends',
            schedule_timezone: 'America/New_York',
        })).toMatchObject({
            scheduleEnabled: true,
            scheduleStartDate: '2026-12-01',
            scheduleEndDate: '',
            scheduleStartTime: '22:30',
            scheduleEndTime: '',
            scheduleDays: 'weekends',
            scheduleTimezone: 'America/New_York',
            schedules: [
                expect.objectContaining({
                    enabled: true,
                    startDate: '2026-12-01',
                    endDate: '',
                    startTime: '22:30',
                    endTime: '',
                    timezone: 'America/New_York',
                    days: [0, 6],
                }),
            ],
        });
    });

    it('keeps an explicit empty schedule list instead of migrating legacy fields', () => {
        expect(normalizeConfig({
            schedules: [],
            schedule_start_date: '2026-12-01',
            schedule_days: 'weekends',
        }).schedules).toEqual([]);
    });

    it('normalizes per-schedule effects and weekday flags', () => {
        const config = normalizeConfig({
            schedules: [{
                enabled: '1',
                effect: 'hearts',
                start_date: '2026-12-24',
                end_date: '2026-12-25',
                start_time: '18:00',
                end_time: '23:00',
                timezone: 'Asia/Tokyo',
                sun: false,
                mon: true,
                tue: 'false',
                wed: true,
                thu: 0,
                fri: true,
                sat: '1',
            }],
        });

        expect(config.schedules[0]).toMatchObject({
            enabled: true,
            effect: 'hearts',
            startDate: '2026-12-24',
            endDate: '2026-12-25',
            startTime: '18:00',
            endTime: '23:00',
            timezone: 'Asia/Tokyo',
            days: [1, 3, 5, 6],
            intensity: 100,
            speed: 100,
            opacity: 75,
            wind: 0,
            windDirection: 'none',
            color: '#ffffff',
        });
    });

    it('lets a schedule override the default visual settings', () => {
        const config = normalizeConfig({
            intensity: 150,
            speed: 80,
            opacity: 40,
            wind: 20,
            wind_direction: 'left',
            color: '#f87171',
            schedules: [{
                effect: 'rain',
                intensity: 60,
                speed: 200,
                opacity: 90,
                wind: 10,
                wind_direction: 'right',
                color: '#bae6fd',
            }],
        });

        expect(config.schedules[0]).toMatchObject({
            effect: 'rain',
            intensity: 60,
            speed: 200,
            opacity: 90,
            wind: 10,
            windDirection: 'right',
            color: '#bae6fd',
        });
    });

    it('inherits visual settings when a schedule omits them', () => {
        expect(normalizeConfig({
            intensity: 150,
            wind: 40,
            wind_direction: 'left',
            color: '#86efac',
            schedules: [{ effect: 'rain' }],
        }).schedules[0]).toMatchObject({
            intensity: 150,
            wind: 40,
            windDirection: 'left',
            color: '#86efac',
        });
    });

    it('keeps native time-picker values that include seconds', () => {
        expect(normalizeConfig({
            schedules: [{ start_time: '09:00:00', end_time: '18:30:59' }],
        }).schedules[0]).toMatchObject({
            startTime: '09:00',
            endTime: '18:30',
        });
    });

    it('accepts IANA timezones and rejects invalid zones', () => {
        for (const timezone of TIMEZONE_OPTIONS) {
            expect(normalizeConfig({ schedule_timezone: timezone }).scheduleTimezone)
                .toBe(timezone);
        }
        expect(normalizeConfig({ schedule_timezone: 'Pacific/Auckland' }).scheduleTimezone)
            .toBe('Pacific/Auckland');
        expect(normalizeConfig({ schedule_timezone: 'Invalid/Zone' }).scheduleTimezone)
            .toBe('Asia/Seoul');
    });
});

describe('readSiteTimezone', () => {
    it('uses the environment general timezone from G7Config', () => {
        const target = {
            G7Config: {
                settings: {
                    general: {
                        timezone: 'Europe/Paris',
                    },
                },
                plugins: {
<<<<<<< HEAD
                    'custom-effects': { effect: 'rain' },
=======
                    'g7-plugin-custom-effects': { effect: 'rain' },
>>>>>>> c296cf2d90e83e047cf94ead1b1c993fb02b9ad7
                },
            },
        } as unknown as Window;

        expect(readSiteTimezone(target)).toBe('Europe/Paris');
        expect(readInlineConfig(target).scheduleTimezone).toBe('Europe/Paris');
    });
});

describe('shouldStart', () => {
    const enabled = normalizeConfig({});

    it('skips admin, mobile, and reduced-motion visitors by default', () => {
        expect(shouldStart(enabled, {
            pathname: '/admin/plugins',
            mobile: false,
            reducedMotion: false,
        })).toBe(false);
        expect(shouldStart(enabled, {
            pathname: '/',
            mobile: true,
            reducedMotion: false,
        })).toBe(false);
        expect(shouldStart(enabled, {
            pathname: '/',
            mobile: false,
            reducedMotion: true,
        })).toBe(false);
    });

    it('starts on an eligible visitor page', () => {
        expect(shouldStart(enabled, {
            pathname: '/board/free',
            mobile: false,
            reducedMotion: false,
        })).toBe(true);
    });
});

describe('particleCount', () => {
    it('scales with area and density while enforcing limits', () => {
        expect(particleCount(1, 1, 10)).toBe(8);
        expect(particleCount(1920, 1080, 200)).toBe(259);
        expect(particleCount(10000, 10000, 200)).toBe(300);
    });

    it('uses effect-specific density profiles', () => {
        expect(particleCount(1920, 1080, 100, 'rain')).toBeGreaterThan(
            particleCount(1920, 1080, 100, 'snow'),
        );
        expect(particleCount(1920, 1080, 100, 'fireflies')).toBeLessThan(
            particleCount(1920, 1080, 100, 'snow'),
        );
        expect(particleCount(1920, 1080, 100, 'sunflowers')).toBeLessThan(
            particleCount(1920, 1080, 100, 'snow'),
        );
        expect(particleCount(1920, 1080, 100, 'cherry_blossoms')).toBeLessThan(
            particleCount(1920, 1080, 100, 'rain'),
        );
    });
});

describe('signedWind', () => {
    it('maps explicit directions to horizontal velocity', () => {
        expect(signedWind(50, 'left')).toBe(-50);
        expect(signedWind(50, 'right')).toBe(50);
        expect(signedWind(50, 'none')).toBe(0);
    });

    it('chooses a deterministic direction for random wind per particle', () => {
        expect(signedWind(50, 'random', () => 0.2)).toBe(-50);
        expect(signedWind(50, 'random', () => 0.8)).toBe(50);
    });
});

describe('resolveBubbleCollision', () => {
    it('separates overlapping bubbles and exchanges approaching velocity', () => {
        const first = { x: 0, y: 0, vx: 10, vy: 0, size: 5 };
        const second = { x: 8, y: 0, vx: -10, vy: 0, size: 5 };

        expect(resolveBubbleCollision(first, second)).toBe(true);
        expect(second.x - first.x).toBe(10);
        expect(first.vx).toBe(-10);
        expect(second.vx).toBe(10);
    });

    it('ignores bubbles that do not overlap', () => {
        const first = { x: 0, y: 0, vx: 1, vy: 0, size: 5 };
        const second = { x: 12, y: 0, vx: -1, vy: 0, size: 5 };

        expect(resolveBubbleCollision(first, second)).toBe(false);
        expect(first).toEqual({ x: 0, y: 0, vx: 1, vy: 0, size: 5 });
        expect(second).toEqual({ x: 12, y: 0, vx: -1, vy: 0, size: 5 });
    });
});

describe('poop collisions', () => {
    it('grows and sparkles on a first hit, then ignores overlapping flashes', () => {
        const particle = { x: 0, y: 0, vx: 0, vy: 0, size: 10, baseSize: 10, sparkle: 0 };
        growPoopOnHit(particle);
        expect(particle.sparkle).toBe(1);
        expect(particle.size).toBe(12.2);

        growPoopOnHit(particle);
        expect(particle.size).toBe(12.2);
    });

    it('caps growth at a multiple of the original size', () => {
        const particle = { x: 0, y: 0, vx: 0, vy: 0, size: 10, baseSize: 10, sparkle: 0 };
        for (let hit = 0; hit < 12; hit += 1) {
            particle.sparkle = 0;
            growPoopOnHit(particle);
        }
        expect(particle.size).toBe(26);
    });

    it('sparkles after two approaching poops collide', () => {
        const first = { x: 0, y: 0, vx: 12, vy: 0, size: 10, baseSize: 10, sparkle: 0 };
        const second = { x: 16, y: 0, vx: -12, vy: 0, size: 10, baseSize: 10, sparkle: 0 };

        expect(resolvePoopCollision(first, second)).toBe(true);
        growPoopOnHit(first);
        growPoopOnHit(second);
        expect(first.sparkle).toBe(1);
        expect(second.sparkle).toBe(1);
        expect(first.size).toBeGreaterThan(10);
        expect(second.x - first.x).toBeCloseTo(17.6);
    });
});

describe('cheese collisions', () => {
    it('explodes two approaching cheeses and ignores later overlapping bursts', () => {
        const first = { x: 0, y: 0, vx: 12, vy: 0, size: 10, explode: 0 };
        const second = { x: 16, y: 0, vx: -12, vy: 0, size: 10, explode: 0 };

        expect(resolveCheeseCollision(first, second)).toBe(true);
        explodeCheeseOnHit(first);
        explodeCheeseOnHit(second);
        expect(first.explode).toBe(1);
        expect(second.explode).toBe(1);
        expect(first.vx).toBeLessThan(12);
        expect(resolveCheeseCollision(first, second)).toBe(false);
    });

    it('does not explode cheeses that are not overlapping', () => {
        const first = { x: 0, y: 0, vx: 8, vy: 0, size: 10, explode: 0 };
        const second = { x: 40, y: 0, vx: -8, vy: 0, size: 10, explode: 0 };

        expect(resolveCheeseCollision(first, second)).toBe(false);
        expect(first.explode).toBe(0);
        expect(second.explode).toBe(0);
    });

    it('keeps an already exploding cheese from bursting again', () => {
        const particle = { x: 0, y: 0, vx: 20, vy: 10, size: 10, explode: 0 };
        explodeCheeseOnHit(particle);
        const velocityX = particle.vx;
        explodeCheeseOnHit(particle);
        expect(particle.explode).toBe(1);
        expect(particle.vx).toBe(velocityX);
    });
});

describe('multicolor star collisions', () => {
    it('bursts fireworks when two approaching stars collide', () => {
        const first = { x: 0, y: 0, vx: 14, vy: 0, size: 5, sparkle: 0 };
        const second = { x: 24, y: 0, vx: -14, vy: 0, size: 5, sparkle: 0 };

        expect(resolveStarCollision(first, second)).toBe(true);
        burstStarOnHit(first);
        burstStarOnHit(second);
        expect(first.sparkle).toBe(1);
        expect(second.sparkle).toBe(1);
        expect(resolveStarCollision(first, second)).toBe(false);
    });

    it('does not burst stars that are far apart', () => {
        const first = { x: 0, y: 0, vx: 8, vy: 0, size: 5, sparkle: 0 };
        const second = { x: 80, y: 0, vx: -8, vy: 0, size: 5, sparkle: 0 };

        expect(resolveStarCollision(first, second)).toBe(false);
        expect(first.sparkle).toBe(0);
        expect(second.sparkle).toBe(0);
    });

    it('keeps an already bursting star from firing again', () => {
        const particle = { x: 0, y: 0, vx: 10, vy: 4, size: 5, sparkle: 0 };
        burstStarOnHit(particle);
        burstStarOnHit(particle);
        expect(particle.sparkle).toBe(1);
    });
});

describe('ground piles', () => {
    it('lands a falling flake on the floor when nothing is in the way', () => {
        const flake = {
            x: 16,
            y: 200,
            vx: 8,
            vy: 40,
            size: 4,
            rotationSpeed: 2,
            settled: 0,
        };

        expect(settleWhereHit(flake, 200, 4, [])).toBe(true);
        expect(flake.settled).toBe(1);
        expect(flake.vy).toBe(0);
        expect(flake.x).toBe(16);
        expect(flake.y).toBe(196);
    });

    it('rests on a particle it hits, overlapping without moving sideways', () => {
        const lower = { x: 40, y: 196, size: 4 };
        const falling = {
            x: 40,
            y: 196,
            vx: 0,
            vy: 20,
            size: 4,
            rotationSpeed: 0,
            settled: 0,
        };

        expect(settleWhereHit(falling, 200, 4, [lower])).toBe(true);
        expect(falling.x).toBe(40);
        expect(falling.y).toBeLessThan(lower.y);
        expect(falling.y + 4).toBeGreaterThan(lower.y - 4);
    });

    it('does not pull a flake toward a distant pile', () => {
        const lower = { x: 200, y: 160, size: 8 };
        const falling = {
            x: 10,
            y: 200,
            vx: 0,
            vy: 20,
            size: 4,
            rotationSpeed: 0,
            settled: 0,
        };

        expect(settleWhereHit(falling, 200, 4, [lower])).toBe(true);
        expect(falling.x).toBe(10);
        expect(falling.y).toBe(196);
    });

    it('lets a stacked flake fall when its support is gone', () => {
        const lower = { x: 40, y: 196, size: 4 };
        const upper = { x: 40, y: 191, size: 4 };

        expect(isUnsupported(upper, 200, 4, [lower])).toBe(false);
        expect(isUnsupported(upper, 200, 4, [])).toBe(true);
    });

    it('leaves airborne flakes falling', () => {
        const flake = {
            x: 8,
            y: 20,
            vx: 0,
            vy: 30,
            size: 4,
            rotationSpeed: 1,
            settled: 0,
        };

        expect(settleWhereHit(flake, 200, 4, [])).toBe(false);
        expect(flake.settled).toBe(0);
        expect(flake.vy).toBe(30);
    });
<<<<<<< HEAD
=======

    it('fills the opening flurry across the viewport and respawns from above', () => {
        expect(snowSpawnY(400, true, () => 0)).toBe(0);
        expect(snowSpawnY(400, true, () => 1)).toBe(400);
        expect(snowSpawnY(400, false, () => 0.5)).toBe(-30);
    });

    it('keeps the falling count when a flake is parked in a pile', () => {
        const falling = {
            x: 16,
            y: 196,
            vx: 0,
            vy: 40,
            size: 4,
            rotationSpeed: 0,
            settled: 0,
        };
        const piles: typeof falling[] = [];

        expect(settleWhereHit(falling, 200, 4, [])).toBe(true);
        const parked = parkSettledFlake(falling, piles);
        falling.settled = 0;
        falling.y = snowSpawnY(200, false, () => 0);

        expect(piles).toHaveLength(1);
        expect(parked.settled).toBe(1);
        expect(falling.settled).toBe(0);
        expect(falling.y).toBeLessThan(0);
        expect(piles[0]).not.toBe(falling);
    });

    it('removes aged pile flakes instead of turning them back into falling snow', () => {
        const young = { settled: 2 };
        const old = { settled: 17.5 };
        const collapsing = { settled: 0 };

        expect(ageSnowPiles([young, old, collapsing], 1)).toEqual([
            { settled: 3 },
            { settled: 0 },
        ]);
    });
>>>>>>> c296cf2d90e83e047cf94ead1b1c993fb02b9ad7
});

describe('rain bouncing', () => {
    it('turns a hitting drop into an upward bounce instead of resetting', () => {
        const drop = { x: 10, y: 100, vx: 0, vy: 400, size: 16, sparkle: 0 };
        expect(bounceRainAtFloor(drop, 100, () => 0.5)).toBe(false);
        expect(drop.sparkle).toBe(1);
        expect(drop.vy).toBeLessThan(0);
        expect(drop.y).toBeLessThanOrEqual(100);
    });

    it('ignores rain that has not reached the floor', () => {
        const drop = { x: 0, y: 20, vx: 0, vy: 400, size: 16, sparkle: 0 };
        expect(bounceRainAtFloor(drop, 100)).toBe(false);
        expect(drop.vy).toBe(400);
        expect(drop.sparkle).toBe(0);
    });

    it('resets after the last bounce', () => {
        const drop = { x: 0, y: 100, vx: 12, vy: 180, size: 16, sparkle: 2 };
        expect(bounceRainAtFloor(drop, 100, () => 0.5)).toBe(true);
        expect(drop.sparkle).toBe(3);
        expect(drop.vy).toBeLessThan(0);
    });
});
