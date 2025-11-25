import { TFunction } from 'i18next';

const monthKeysShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const monthKeysFull = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const weekdayKeysShort = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const weekdayKeysFull = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function formatMonthShort(date: Date, t: TFunction): string {
  const monthKey = monthKeysShort[date.getMonth()];
  return t(`months.short.${monthKey}`, monthKey);
}

export function formatMonthFull(date: Date, t: TFunction): string {
  const monthKey = monthKeysFull[date.getMonth()];
  return t(`months.full.${monthKey}`, monthKey);
}

export function formatWeekdayShort(date: Date, t: TFunction): string {
  const weekdayKey = weekdayKeysShort[date.getDay()];
  return t(`weekdays.short.${weekdayKey}`, weekdayKey);
}

export function formatWeekdayFull(date: Date, t: TFunction): string {
  const weekdayKey = weekdayKeysFull[date.getDay()];
  return t(`weekdays.full.${weekdayKey}`, weekdayKey);
}

export function formatDateShort(date: Date, t: TFunction): string {
  return `${formatMonthShort(date, t)} ${date.getDate()}`;
}

export function formatDateShortWithYear(date: Date, t: TFunction): string {
  return `${formatMonthShort(date, t)} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatDateLongWithYear(date: Date, t: TFunction): string {
  return `${formatMonthFull(date, t)} ${date.getFullYear()}`;
}

export function formatDateMediumWithYear(date: Date, t: TFunction): string {
  return `${formatMonthShort(date, t)} ${date.getDate()}, ${date.getFullYear()}`;
}

