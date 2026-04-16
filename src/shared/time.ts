const DATE_PARTS_LOCALE = 'en-CA';

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const getDateTimeFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cachedFormatter = dateTimeFormatterCache.get(timeZone);

  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat(DATE_PARTS_LOCALE, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  dateTimeFormatterCache.set(timeZone, formatter);
  return formatter;
};

const getNumericPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number => {
  const value = parts.find((part) => part.type === type)?.value ?? '0';
  return Number(value);
};

export const getDatePartsInTimeZone = (date: Date, timeZone: string): DateParts => {
  const parts = getDateTimeFormatter(timeZone).formatToParts(date);

  return {
    year: getNumericPart(parts, 'year'),
    month: getNumericPart(parts, 'month'),
    day: getNumericPart(parts, 'day'),
    hour: getNumericPart(parts, 'hour'),
    minute: getNumericPart(parts, 'minute'),
    second: getNumericPart(parts, 'second')
  };
};

export const formatDateValueInTimeZone = (date: Date, timeZone: string): string => {
  const parts = getDatePartsInTimeZone(date, timeZone);

  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day
  ).padStart(2, '0')}`;
};

export const getTimeMinutesInTimeZone = (date: Date, timeZone: string): number => {
  const parts = getDatePartsInTimeZone(date, timeZone);
  return parts.hour * 60 + parts.minute;
};

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string): number => {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const utcTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return Math.round((utcTimestamp - date.getTime()) / 60000);
};

export const createUtcDateFromTimeZone = (
  dateValue: string,
  timeValue: string,
  timeZone: string
): Date => {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, 0);

  let offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcTimestamp), timeZone);
  let utcDate = new Date(utcTimestamp - offsetMinutes * 60 * 1000);

  const correctedOffsetMinutes = getTimeZoneOffsetMinutes(utcDate, timeZone);

  if (correctedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = correctedOffsetMinutes;
    utcDate = new Date(utcTimestamp - offsetMinutes * 60 * 1000);
  }

  return utcDate;
};

export const formatInTimeZone = (
  date: Date,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string => new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
