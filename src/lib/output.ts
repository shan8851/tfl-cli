import { JSON_SCHEMA_VERSION } from './constants.js';
import { formatAppError, toAppError } from './errors.js';

import type { ErrorEnvelope, OutputMode, OutputOptions, SuccessEnvelope } from './types.js';

export const getOutputMode = (options: OutputOptions): OutputMode => {
  if (options.json && options.text) {
    throw toAppError(new Error('Choose either --json or --text, not both.'));
  }

  if (options.json) {
    return 'json';
  }

  if (options.text) {
    return 'text';
  }

  return process.stdout.isTTY ? 'text' : 'json';
};

export const runCommand = async <TData>(
  commandName: string,
  options: OutputOptions,
  handler: () => Promise<TData>,
  formatText: (data: TData) => string,
): Promise<void> => {
  const requestedAt = new Date().toISOString();
  const outputMode = getOutputMode(options);

  try {
    const data = await handler();
    const envelope: SuccessEnvelope<TData> = {
      command: commandName,
      data,
      ok: true,
      requestedAt,
      schemaVersion: JSON_SCHEMA_VERSION,
    };

    if (outputMode === 'json') {
      writeJson(envelope);
      return;
    }

    process.stdout.write(`${formatText(data)}\n`);
  } catch (error) {
    const appError = toAppError(error);
    const envelope: ErrorEnvelope = {
      command: commandName,
      error: {
        code: appError.code,
        details: appError.details,
        message: appError.message,
        retryable: appError.retryable,
      },
      ok: false,
      requestedAt,
      schemaVersion: JSON_SCHEMA_VERSION,
    };

    process.exitCode = appError.exitCode;

    if (outputMode === 'json') {
      writeJson(envelope);
      return;
    }

    process.stderr.write(`${formatAppError(appError)}\n`);
  }
};

const writeJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};
