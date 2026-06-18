import prisma from '../../config/prisma.js';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

export async function getUserTimezone(userId) {
    const user = await prisma.users.findUnique({
        where: { user_id: userId },
        select: { timezone: true }
    });
    return user?.timezone || 'UTC';
}

export function getStartOfDayInTz(timezone) {
    const zonedNow = toZonedTime(new Date(), timezone);
    const todayStr = format(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
    return new Date(`${todayStr}T00:00:00.000Z`);
}

export function utcToLocalTime(date, timezone) {
    const local = toZonedTime(date, timezone);
    return format(local, 'HH:mm', { timeZone: timezone });
}

export function localToUtc(dateStr, timeStr, timezone) {
    return fromZonedTime(`${dateStr}T${timeStr}:00`, timezone);
}

export function utcToLocalDate(date, timezone) {
    const local = toZonedTime(date, timezone);
    return format(local, 'yyyy-MM-dd', { timeZone: timezone });
}