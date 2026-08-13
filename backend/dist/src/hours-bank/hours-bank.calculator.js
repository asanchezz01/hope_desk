"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePaidHoursForMonth = exports.calculateHoursBank = exports.resolveFranchiseHours = exports.resolveHoursBankWindow = exports.DEFAULT_MONTHLY_HOURS_ALLOWANCE = void 0;
const client_1 = require("@prisma/client");
const legacy_clock_1 = require("../common/time/legacy-clock");
exports.DEFAULT_MONTHLY_HOURS_ALLOWANCE = 16;
const MS_PER_HOUR = 3_600_000;
function resolveHoursBankWindow(closingDateRaw, reference) {
    let anchor = parseClosingDate(closingDateRaw, reference);
    while (anchor.getTime() > reference.getTime()) {
        anchor = (0, legacy_clock_1.addMonths)(anchor, -6);
    }
    let nextReset = (0, legacy_clock_1.addMonths)(anchor, 6);
    while (nextReset.getTime() <= reference.getTime()) {
        anchor = nextReset;
        nextReset = (0, legacy_clock_1.addMonths)(anchor, 6);
    }
    return { cycleStart: anchor, cycleEnd: nextReset };
}
exports.resolveHoursBankWindow = resolveHoursBankWindow;
function parseClosingDate(raw, reference) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((raw ?? '').trim());
    if (match) {
        const [year, month, day] = match.slice(1).map(Number);
        const candidate = (0, legacy_clock_1.wallClockToStorage)({
            year,
            month,
            day,
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
        });
        const roundTrip = (0, legacy_clock_1.storageToWallClock)(candidate);
        if (roundTrip.year === year && roundTrip.month === month && roundTrip.day === day) {
            return candidate;
        }
    }
    const referenceParts = (0, legacy_clock_1.storageToWallClock)(reference);
    return (0, legacy_clock_1.wallClockToStorage)({
        year: referenceParts.year,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
    });
}
function resolveFranchiseHours(raw) {
    const normalized = (raw ?? '').trim().replace(',', '.');
    const parsed = Number(normalized);
    if (normalized === '' || !Number.isFinite(parsed)) {
        return exports.DEFAULT_MONTHLY_HOURS_ALLOWANCE;
    }
    return Math.max(parsed, 0);
}
exports.resolveFranchiseHours = resolveFranchiseHours;
function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function calculateHoursBank(input) {
    const franchiseHours = resolveFranchiseHours(input.monthlyHoursAllowanceRaw);
    const { cycleStart, cycleEnd } = resolveHoursBankWindow(input.hoursBankClosingDateRaw, input.reference);
    const monthlyMilliseconds = new Map();
    for (const activity of input.activities) {
        if (activity.endedAt.getTime() <= cycleStart.getTime() ||
            activity.startedAt.getTime() >= input.reference.getTime()) {
            continue;
        }
        const overlapStart = new Date(Math.max(activity.startedAt.getTime(), cycleStart.getTime()));
        const overlapEnd = new Date(Math.min(activity.endedAt.getTime(), input.reference.getTime()));
        if (overlapEnd.getTime() <= overlapStart.getTime())
            continue;
        let cursor = overlapStart;
        while (cursor.getTime() < overlapEnd.getTime()) {
            const nextMonth = (0, legacy_clock_1.startOfNextMonth)(cursor);
            const segmentEnd = new Date(Math.min(overlapEnd.getTime(), nextMonth.getTime()));
            const { year, month } = (0, legacy_clock_1.storageToWallClock)(cursor);
            const key = monthKey(year, month);
            monthlyMilliseconds.set(key, (monthlyMilliseconds.get(key) ?? 0) + (segmentEnd.getTime() - cursor.getTime()));
            cursor = segmentEnd;
        }
    }
    const monthlyBreakdown = Array.from(monthlyMilliseconds.entries())
        .map(([key, milliseconds]) => {
        const [year, month] = key.split('-').map(Number);
        const consumedHours = milliseconds / MS_PER_HOUR;
        return {
            year,
            month,
            consumedHours: round2(consumedHours),
            excessHours: round2(Math.max(consumedHours - franchiseHours, 0)),
        };
    })
        .sort((left, right) => left.year !== right.year ? left.year - right.year : left.month - right.month);
    let grossExcessMilliseconds = 0;
    for (const milliseconds of monthlyMilliseconds.values()) {
        const franchiseMilliseconds = franchiseHours * MS_PER_HOUR;
        grossExcessMilliseconds += Math.max(milliseconds - franchiseMilliseconds, 0);
    }
    const grossExcessHours = grossExcessMilliseconds / MS_PER_HOUR;
    const cycleStartDate = toDateOnlyKey(cycleStart);
    const referenceDate = toDateOnlyKey(input.reference);
    let paidHoursDecimal = new client_1.Prisma.Decimal(0);
    for (const payment of input.payments) {
        const paidAtKey = toDateOnlyKey(payment.paidAt);
        if (paidAtKey >= cycleStartDate && paidAtKey <= referenceDate) {
            paidHoursDecimal = paidHoursDecimal.plus(new client_1.Prisma.Decimal(payment.paidHours));
        }
    }
    const paidHoursInCycle = round2(paidHoursDecimal.toNumber());
    const netAccumulatedHours = Math.max(grossExcessHours - paidHoursInCycle, 0);
    const totalConsumedMilliseconds = Array.from(monthlyMilliseconds.values()).reduce((total, value) => total + value, 0);
    return {
        netAccumulatedHours: round2(netAccumulatedHours),
        grossExcessHours: round2(grossExcessHours),
        paidHoursInCycle,
        franchiseHours: round2(franchiseHours),
        cycleStart,
        cycleEnd,
        monthlyBreakdown,
        totalConsumedHours: round2(totalConsumedMilliseconds / MS_PER_HOUR),
    };
}
exports.calculateHoursBank = calculateHoursBank;
function toDateOnlyKey(date) {
    return (date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate());
}
function calculatePaidHoursForMonth(payments, year, month) {
    const startKey = year * 10000 + month * 100 + 1;
    const endKey = month === 12
        ? (year + 1) * 10000 + 1 * 100 + 1
        : year * 10000 + (month + 1) * 100 + 1;
    let total = new client_1.Prisma.Decimal(0);
    for (const payment of payments) {
        const key = toDateOnlyKey(payment.paidAt);
        if (key >= startKey && key < endKey) {
            total = total.plus(new client_1.Prisma.Decimal(payment.paidHours));
        }
    }
    return round2(total.toNumber());
}
exports.calculatePaidHoursForMonth = calculatePaidHoursForMonth;
//# sourceMappingURL=hours-bank.calculator.js.map