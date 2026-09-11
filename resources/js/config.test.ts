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
import { particleCount, resolveBubbleCollision, signedWind } from './engine';

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
                    'g7-plugin-custom-effects': { effect: 'rain' },
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
