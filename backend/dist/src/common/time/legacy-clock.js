"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.durationHours = exports.addMonths = exports.daysInMonth = exports.startOfNextMonth = exports.monthPeriodBounds = exports.formatWallClockPtBr = exports.formatWallClockIso = exports.nowWallClock = exports.instantToWallClockParts = exports.instantToWallClockStorage = exports.parseWallClockInput = exports.storageToWallClock = exports.wallClockToStorage = exports.LEGACY_TIMEZONE = void 0;
exports.LEGACY_TIMEZONE = 'America/Sao_Paulo';
const ISO_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/;
function wallClockToStorage(parts) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond));
}
exports.wallClockToStorage = wallClockToStorage;
function storageToWallClock(stored) {
    return {
        year: stored.getUTCFullYear(),
        month: stored.getUTCMonth() + 1,
        day: stored.getUTCDate(),
        hour: stored.getUTCHours(),
        minute: stored.getUTCMinutes(),
        second: stored.getUTCSeconds(),
        millisecond: stored.getUTCMilliseconds(),
    };
}
exports.storageToWallClock = storageToWallClock;
function parseWallClockInput(raw) {
    const value = raw.trim();
    if (!value) {
        throw new RangeError('Data/hora vazia.');
    }
    const local = ISO_LOCAL_PATTERN.exec(value);
    if (local) {
        const parts = {
            year: Number(local[1]),
            month: Number(local[2]),
            day: Number(local[3]),
            hour: Number(local[4]),
            minute: Number(local[5]),
            second: Number(local[6] ?? 0),
            millisecond: Number((local[7] ?? '0').padEnd(3, '0')),
        };
        const stored = wallClockToStorage(parts);
        const roundTrip = storageToWallClock(stored);
        if (roundTrip.year !== parts.year ||
            roundTrip.month !== parts.month ||
            roundTrip.day !== parts.day ||
            roundTrip.hour !== parts.hour ||
            roundTrip.minute !== parts.minute) {
            throw new RangeError(`Data/hora inexistente: "${raw}".`);
        }
        return stored;
    }
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) {
        throw new RangeError(`Data/hora inválida: "${raw}".`);
    }
    return instantToWallClockStorage(instant);
}
exports.parseWallClockInput = parseWallClockInput;
function instantToWallClockStorage(instant) {
    return wallClockToStorage(instantToWallClockParts(instant));
}
exports.instantToWallClockStorage = instantToWallClockStorage;
const WALL_CLOCK_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    timeZone: exports.LEGACY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});
function instantToWallClockParts(instant) {
    const fields = new Map(WALL_CLOCK_FORMATTER.formatToParts(instant)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]));
    const hour = Number(fields.get('hour'));
    return {
        year: Number(fields.get('year')),
        month: Number(fields.get('month')),
        day: Number(fields.get('day')),
        hour: hour === 24 ? 0 : hour,
        minute: Number(fields.get('minute')),
        second: Number(fields.get('second')),
        millisecond: instant.getUTCMilliseconds(),
    };
}
exports.instantToWallClockParts = instantToWallClockParts;
function nowWallClock(now = new Date()) {
    return instantToWallClockStorage(now);
}
exports.nowWallClock = nowWallClock;
function formatWallClockIso(stored) {
    const p = storageToWallClock(stored);
    const pad = (value, size = 2) => String(value).padStart(size, '0');
    return (`${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}` +
        `T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`);
}
exports.formatWallClockIso = formatWallClockIso;
function formatWallClockPtBr(stored) {
    const p = storageToWallClock(stored);
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}
exports.formatWallClockPtBr = formatWallClockPtBr;
function monthPeriodBounds(year, month) {
    const start = wallClockToStorage({
        year,
        month,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
    });
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const end = wallClockToStorage({
        year: nextYear,
        month: nextMonth,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
    });
    return [start, end];
}
exports.monthPeriodBounds = monthPeriodBounds;
function startOfNextMonth(stored) {
    const { year, month } = storageToWallClock(stored);
    return monthPeriodBounds(year, month)[1];
}
exports.startOfNextMonth = startOfNextMonth;
function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
exports.daysInMonth = daysInMonth;
function addMonths(stored, months) {
    const parts = storageToWallClock(stored);
    const monthIndex = parts.month - 1 + months;
    const targetYear = parts.year + Math.floor(monthIndex / 12);
    const targetMonth = (((monthIndex % 12) + 12) % 12) + 1;
    const targetDay = Math.min(parts.day, daysInMonth(targetYear, targetMonth));
    return wallClockToStorage({
        ...parts,
        year: targetYear,
        month: targetMonth,
        day: targetDay,
    });
}
exports.addMonths = addMonths;
function durationHours(start, end) {
    return Math.max((end.getTime() - start.getTime()) / 3_600_000, 0);
}
exports.durationHours = durationHours;
//# sourceMappingURL=legacy-clock.js.map