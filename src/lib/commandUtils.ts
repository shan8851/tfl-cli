import { createAppError } from './errors.js';

export const parseCsvOption = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

export const parseIntegerOption = (value: string): number => {
  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue)) {
    throw createAppError('INVALID_INPUT', `Expected a whole number but received "${value}".`);
  }

  return parsedValue;
};

export const ensurePositiveInteger = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value <= 0) {
    throw createAppError('INVALID_INPUT', `${label} must be a positive whole number.`);
  }

  return value;
};

export const validateAllowedValues = (
  values: string[],
  allowedValues: readonly string[],
  label: string,
): string[] => {
  const invalidValues = values.filter((value) => !allowedValues.includes(value));

  if (invalidValues.length > 0) {
    throw createAppError(
      'INVALID_INPUT',
      `${label} contains unsupported values: ${invalidValues.join(', ')}. Valid values: ${allowedValues.join(', ')}.`,
    );
  }

  return values;
};

export const formatDurationMinutes = (value: number): string => `${value}m`;

export const formatPence = (value: number): string => `GBP ${(value / 100).toFixed(2)}`;

export const formatEta = (seconds: number): string => {
  if (seconds < 60) {
    return '<1m';
  }

  return `${Math.round(seconds / 60)}m`;
};

export const formatIsoTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const normalizeDateInput = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createAppError('INVALID_INPUT', 'Date must use YYYY-MM-DD format.');
  }

  return value.replaceAll('-', '');
};

export const normalizeTimeInput = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw createAppError('INVALID_INPUT', 'Time must use HH:MM format.');
  }

  return value.replace(':', '');
};
