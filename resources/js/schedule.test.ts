import { describe, expect, it } from 'vitest';
import { normalizeConfig } from './config';
import { getZonedClock, isScheduleActive, activeScheduledEffect } from './schedule';

function scheduled(overrides: Record<string, unknown> = {}, timezone = 'Asia/Seoul') {
    return normalizeConfig({
        schedule_enabled: true,
        schedule_timezone: timezone,
        schedules: [{
            enabled: true,
            effect: 'snow',
            sun: true,
            mon: true,
            tue: true,
            wed: true,
            thu: true,
            fri: true,
            sat: true,
            ...overrides,
        }],
    });
}

describe('effect scheduling', () => {
    it('stays active when scheduling is disabled', () => {
        expect(isScheduleActive(normalizeConfig({}), new Date('2026-01-01T00:00:00Z'))).toBe(true);
    });

    it('enforces inclusive start and end dates', () => {
        const config = scheduled({
            start_date: '2026-09-11',
            end_date: '2026-09-12',
        });

        expect(isScheduleActive(config, new Date('2026-09-10T14:59:00Z'))).toBe(false);
        expect(isScheduleActive(config, new Date('2026-09-10T15:00:00Z'))).toBe(true);
        expect(isScheduleActive(config, new Date('2026-09-12T14:59:00Z'))).toBe(true);
        expect(isScheduleActive(config, new Date('2026-09-12T15:00:00Z'))).toBe(false);
    });

    it('supports a daily time window', () => {
        const config = scheduled({
            start_time: '09:00',
            end_time: '18:00',
        });

        expect(isScheduleActive(config, new Date('2026-09-11T00:00:00Z'))).toBe(true);
        expect(isScheduleActive(config, new Date('2026-09-11T08:59:00Z'))).toBe(true);
        expect(isScheduleActive(config, new Date('2026-09-11T09:00:00Z'))).toBe(false);
    });

    it('supports a time window that crosses midnight', () => {
        const config = scheduled({
            start_time: '22:00',
            end_time: '06:00',
        });

        expect(isScheduleActive(config, new Date('2026-09-11T14:00:00Z'))).toBe(true);
        expect(isScheduleActive(config, new Date('2026-09-11T20:00:00Z'))).toBe(true);
        expect(isScheduleActive(config, new Date('2026-09-11T12:00:00Z'))).toBe(false);
    });

    it('attributes an overnight carry to its starting date and weekday', () => {
        const config = scheduled({
            start_date: '2026-09-11',
            end_date: '2026-09-11',
            start_time: '22:00',
            end_time: '06:00',
            sun: false,
            sat: false,
        });

        // Saturday 05:00 in Seoul belongs to Friday's 22:00–06:00 window.
        expect(isScheduleActive(config, new Date('2026-09-11T20:00:00Z'))).toBe(true);
        expect(isScheduleActive(config, new Date('2026-09-12T14:00:00Z'))).toBe(false);
    });

    it('filters weekdays and weekends in the configured timezone', () => {
        const weekday = scheduled({ sun: false, sat: false });
        const weekend = scheduled({
            sun: true,
            mon: false,
            tue: false,
            wed: false,
            thu: false,
            fri: false,
            sat: true,
        });
        const friday = new Date('2026-09-11T03:00:00Z');
        const saturday = new Date('2026-09-12T03:00:00Z');

        expect(isScheduleActive(weekday, friday)).toBe(true);
        expect(isScheduleActive(weekday, saturday)).toBe(false);
        expect(isScheduleActive(weekend, friday)).toBe(false);
        expect(isScheduleActive(weekend, saturday)).toBe(true);
    });

    it('evaluates the same instant in different timezones', () => {
        const now = new Date('2026-09-11T13:30:00Z');

        expect(getZonedClock(now, 'Asia/Seoul')).toMatchObject({
            date: '2026-09-11',
            time: '22:30',
        });
        expect(getZonedClock(now, 'America/New_York')).toMatchObject({
            date: '2026-09-11',
            time: '09:30',
        });
    });

    it('uses the first matching schedule effect', () => {
        const config = normalizeConfig({
            schedule_enabled: true,
            schedule_timezone: 'Asia/Seoul',
            effect: 'snow',
            schedules: [
                {
                    enabled: true,
                    effect: 'rain',
                    start_time: '09:00',
                    end_time: '18:00',
                },
                {
                    enabled: true,
                    effect: 'hearts',
                    start_time: '18:00',
                    end_time: '23:00',
                },
            ],
        });

        expect(activeScheduledEffect(config, new Date('2026-09-11T01:00:00Z'))).toBe('rain');
        expect(activeScheduledEffect(config, new Date('2026-09-11T10:00:00Z'))).toBe('hearts');
        expect(activeScheduledEffect(config, new Date('2026-09-11T15:00:00Z'))).toBeNull();
    });

    it('keeps the default effect when scheduling is on but no rows exist', () => {
        expect(activeScheduledEffect(normalizeConfig({
            schedule_enabled: true,
            effect: 'rain',
            schedules: [],
        }))).toBe('rain');
    });

    it('uses the site timezone instead of a per-schedule zone', () => {
        const config = scheduled({
            start_time: '22:00',
            end_time: '23:00',
            timezone: 'America/New_York',
        }, 'Asia/Seoul');

        expect(isScheduleActive(config, new Date('2026-09-11T13:30:00Z'))).toBe(true);
    });

    it('falls back to Asia/Seoul for an invalid timezone', () => {
        expect(getZonedClock(
            new Date('2026-09-11T13:30:00Z'),
            'Invalid/Timezone',
        )).toMatchObject({
            date: '2026-09-11',
            time: '22:30',
        });
    });
});
