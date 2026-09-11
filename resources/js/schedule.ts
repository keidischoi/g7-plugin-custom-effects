import type { EffectConfig } from './config';

interface ZonedClock {
    date: string;
    time: string;
    day: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

export function getZonedClock(
    now: Date,
    timezone: string,
): ZonedClock {
    let formatter: Intl.DateTimeFormat;

    try {
        formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        });
    } catch {
        formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        });
    }

    const parts = Object.fromEntries(
        formatter.formatToParts(now).map((part) => [part.type, part.value]),
    );

    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${parts.hour}:${parts.minute}`,
        day: WEEKDAY_INDEX[parts.weekday ?? ''] ?? now.getUTCDay(),
    };
}

function matchesDay(config: EffectConfig, day: number): boolean {
    if (config.scheduleDays === 'weekdays') return day >= 1 && day <= 5;
    if (config.scheduleDays === 'weekends') return day === 0 || day === 6;
    return true;
}

function matchesTimeRange(current: string, start: string, end: string): boolean {
    if (!start && !end) return true;
    if (start && !end) return current >= start;
    if (!start && end) return current < end;
    if (start === end) return true;
    if (start < end) return current >= start && current < end;
    return current >= start || current < end;
}

function previousDate(date: string): string {
    const previous = new Date(`${date}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    return previous.toISOString().slice(0, 10);
}

export function isScheduleActive(
    config: EffectConfig,
    now: Date = new Date(),
): boolean {
    if (!config.scheduleEnabled) return true;

    const clock = getZonedClock(now, config.scheduleTimezone);
    const overnightCarry = Boolean(
        config.scheduleStartTime
        && config.scheduleEndTime
        && config.scheduleStartTime > config.scheduleEndTime
        && clock.time < config.scheduleEndTime,
    );
    const scheduleDate = overnightCarry ? previousDate(clock.date) : clock.date;
    const scheduleDay = overnightCarry ? (clock.day + 6) % 7 : clock.day;

    if (config.scheduleStartDate && scheduleDate < config.scheduleStartDate) return false;
    if (config.scheduleEndDate && scheduleDate > config.scheduleEndDate) return false;
    if (!matchesDay(config, scheduleDay)) return false;

    return matchesTimeRange(
        clock.time,
        config.scheduleStartTime,
        config.scheduleEndTime,
    );
}
