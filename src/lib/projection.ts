import { createAppError } from './errors.js';

type ProjectionErrorDetails = {
  examples?: string[] | undefined;
  hint?: string | undefined;
  path: string;
};

const ARRAY_INDEX_PATTERN = /^\d+$/;

export const projectOutputValue = (
  value: unknown,
  path: string,
  examples: string[] = [],
): unknown => {
  const segments = parseOutputPath(path, examples);

  return segments.reduce<unknown>(
    (currentValue, segment) => resolvePathSegment(currentValue, segment, path, examples),
    value,
  );
};

const parseOutputPath = (path: string, examples: string[]): string[] => {
  if (path.trim().length === 0) {
    throw createInvalidOutputPathError(path, examples);
  }

  const segments = path.split('.');

  if (segments.some((segment) => segment.length === 0)) {
    throw createInvalidOutputPathError(path, examples);
  }

  return segments;
};

const resolvePathSegment = (
  currentValue: unknown,
  segment: string,
  path: string,
  examples: string[],
): unknown => {
  if (isUnknownArray(currentValue)) {
    if (!ARRAY_INDEX_PATTERN.test(segment)) {
      throw createInvalidOutputPathError(path, examples);
    }

    const arrayValue = currentValue[Number.parseInt(segment, 10)];

    if (arrayValue === undefined) {
      throw createMissingOutputPathError(path, examples);
    }

    return arrayValue;
  }

  if (isRecord(currentValue)) {
    const nextValue = currentValue[segment];

    if (nextValue === undefined) {
      throw createMissingOutputPathError(path, examples);
    }

    return nextValue;
  }

  throw createMissingOutputPathError(path, examples);
};

const createInvalidOutputPathError = (path: string, examples: string[]) =>
  createAppError('INVALID_INPUT', `Invalid output path "${path}".`, {
    ...createProjectionErrorDetails(path, examples),
  });

const createMissingOutputPathError = (path: string, examples: string[]) =>
  createAppError('NOT_FOUND', `Output path "${path}" did not match any value.`, {
    ...createProjectionErrorDetails(path, examples),
  });

const createProjectionErrorDetails = (
  path: string,
  examples: string[],
): ProjectionErrorDetails => ({
  ...(examples.length > 0 ? { examples } : {}),
  ...(examples.length > 0 ? { hint: `Try paths like: ${examples.join(', ')}` } : {}),
  path,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);
