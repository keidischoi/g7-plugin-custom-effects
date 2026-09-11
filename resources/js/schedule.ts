import type { EffectConfig, EffectKind, EffectSchedule } from './config';

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

function matchesSchedule(
    schedule: EffectSchedule,
    now: Date,
    timezone: string,
): boolean {
    if (!schedule.enabled) return false;

    const clock = getZonedClock(now, timezone);
    const overnightCarry = Boolean(
        schedule.startTime
        && schedule.endTime
        && schedule.startTime > schedule.endTime
        && clock.time < schedule.endTime,
    );
    const scheduleDate = overnightCarry ? previousDate(clock.date) : clock.date;
    const scheduleDay = overnightCarry ? (clock.day + 6) % 7 : clock.day;

    if (schedule.startDate && scheduleDate < schedule.startDate) return false;
    if (schedule.endDate && scheduleDate > schedule.endDate) return false;
    if (!schedule.days.includes(scheduleDay)) return false;

    return matchesTimeRange(
        clock.time,
        schedule.startTime,
        schedule.endTime,
    );
}

export function resolveActiveConfig(
    config: EffectConfig,
    now: Date = new Date(),
): EffectConfig | null {
    if (!config.scheduleEnabled || config.schedules.length === 0) return config;

    const schedule = config.schedules.find((item) => (
        matchesSchedule(item, now, config.scheduleTimezone)
    ));
    if (!schedule) return null;

    return {
        ...config,
        effect: schedule.effect,
        intensity: schedule.intensity,
        speed: schedule.speed,
        opacity: schedule.opacity,
        wind: schedule.wind,
        windDirection: schedule.windDirection,
        color: schedule.color,
    };
}

export function activeScheduledEffect(
    config: EffectConfig,
    now: Date = new Date(),
): EffectKind | null {
    return resolveActiveConfig(config, now)?.effect ?? null;
}

export function isScheduleActive(
    config: EffectConfig,
    now: Date = new Date(),
): boolean {
    return activeScheduledEffect(config, now) !== null;
}
