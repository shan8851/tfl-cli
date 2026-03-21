import { STATUS_LINE_ALIASES } from './constants.js';
import { createAppError } from './errors.js';

const normalizeAlias = (value: string): string =>
  value.trim().toLowerCase().replaceAll('&', 'and').replaceAll(/\s+/g, ' ');

export const resolveStatusLineInput = (value: string): string[] => {
  const normalizedValue = normalizeAlias(value);
  const directMatch = STATUS_LINE_ALIASES[normalizedValue];

  if (directMatch) {
    return directMatch;
  }

  throw createAppError(
    'INVALID_INPUT',
    `Unsupported line "${value}". Supported values include named rail lines, Overground lines, DLR, and Elizabeth line aliases.`,
  );
};
