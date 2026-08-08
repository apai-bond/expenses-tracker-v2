"use strict";

/**
 * Pure salary-cycle date helpers.
 *
 * A budget month is named after the month in which most of the spending
 * happens. For example, the August budget starts on the July salary date.
 */
const BudgetCycle = (() => {
  const DEFAULT_SALARY_DAY = 27;
  const DAY_MS = 24 * 60 * 60 * 1000;

  function parseMonth(monthValue) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(monthValue || ""));
    if (!match) throw new Error("Invalid month value.");
    return { year: Number(match[1]), month: Number(match[2]) };
  }

  function parseDate(dateValue) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
    if (!match) throw new Error("Invalid date value.");
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  function formatMonth(year, monthIndex) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  }

  function toDateString(dateValue) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, "0");
    const day = String(dateValue.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function toUtcDate(dateValue) {
    const { year, month, day } = parseDate(dateValue);
    return new Date(Date.UTC(year, month - 1, day));
  }

  function addMonths(monthValue, offset) {
    const { year, month } = parseMonth(monthValue);
    const dateValue = new Date(year, month - 1 + Number(offset || 0), 1);
    return formatMonth(dateValue.getFullYear(), dateValue.getMonth());
  }

  function addDays(dateValue, offset) {
    const { year, month, day } = parseDate(dateValue);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + Number(offset || 0));
    return toDateString(date);
  }

  function daysInMonth(monthValue) {
    const { year, month } = parseMonth(monthValue);
    return new Date(year, month, 0).getDate();
  }

  function calculateAutomaticStart(budgetMonth, salaryDay = DEFAULT_SALARY_DAY) {
    const salaryMonth = addMonths(budgetMonth, -1);
    const { year, month } = parseMonth(salaryMonth);
    const day = Math.min(Math.max(Number(salaryDay) || DEFAULT_SALARY_DAY, 1), daysInMonth(salaryMonth));
    const date = new Date(year, month - 1, day);

    // Saturday or Sunday salary dates move to the previous Friday.
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() - 1);
    }

    return toDateString(date);
  }

  function isValidCycleStart(budgetMonth, dateValue) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ""))
      && String(dateValue).slice(0, 7) === addMonths(budgetMonth, -1);
  }

  function resolveStart(budgetMonth, monthRecord) {
    const override = monthRecord?.cycleStartDate;
    return isValidCycleStart(budgetMonth, override)
      ? override
      : calculateAutomaticStart(budgetMonth);
  }

  function getRange(budgetMonth, monthRecord, nextMonthRecord) {
    const nextMonth = addMonths(budgetMonth, 1);
    const startDate = resolveStart(budgetMonth, monthRecord);
    const nextStartDate = resolveStart(nextMonth, nextMonthRecord);
    const endDate = addDays(nextStartDate, -1);

    return {
      budgetMonth,
      startDate,
      endDate,
      nextStartDate,
      totalDays: daysBetweenInclusive(startDate, endDate)
    };
  }

  function budgetMonthForDate(dateValue, nextMonthRecord) {
    const calendarMonth = String(dateValue).slice(0, 7);
    const nextBudgetMonth = addMonths(calendarMonth, 1);
    const nextCycleStart = resolveStart(nextBudgetMonth, nextMonthRecord);
    return String(dateValue) >= nextCycleStart ? nextBudgetMonth : calendarMonth;
  }

  function isWithinRange(dateValue, startDate, endDate) {
    return Boolean(dateValue && startDate && endDate)
      && String(dateValue) >= String(startDate)
      && String(dateValue) <= String(endDate);
  }

  function daysBetweenInclusive(startDate, endDate) {
    const start = toUtcDate(startDate);
    const end = toUtcDate(endDate);
    return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  }

  function previousMonthBounds(budgetMonth) {
    const previousMonth = addMonths(budgetMonth, -1);
    return {
      min: `${previousMonth}-01`,
      max: `${previousMonth}-${String(daysInMonth(previousMonth)).padStart(2, "0")}`
    };
  }

  return {
    DEFAULT_SALARY_DAY,
    addMonths,
    addDays,
    daysInMonth,
    calculateAutomaticStart,
    isValidCycleStart,
    resolveStart,
    getRange,
    budgetMonthForDate,
    isWithinRange,
    daysBetweenInclusive,
    previousMonthBounds
  };
})();
