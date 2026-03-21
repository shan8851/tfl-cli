import { createAppError } from '../lib/errors.js';

import type { ZodType } from 'zod';

type RequestJsonOptions<TData> = {
  label: string;
  schema: ZodType<TData>;
  url: URL;
};

export const requestJson = async <TData>({
  label,
  schema,
  url,
}: RequestJsonOptions<TData>): Promise<TData> => {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    const bodyText = await response.text();
    const parsedBody = bodyText === '' ? undefined : safeJsonParse(bodyText);

    if (!response.ok) {
      throw createStatusError(response.status, label, parsedBody);
    }

    return schema.parse(parsedBody);
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw createAppError('TIMEOUT', `${label} timed out.`);
    }

    if (error instanceof TypeError) {
      throw createAppError('UPSTREAM_API_ERROR', `${label} could not be reached.`);
    }

    throw error;
  }
};

const safeJsonParse = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw createAppError('UPSTREAM_API_ERROR', 'Received malformed JSON from an upstream API.', {
      bodyPreview: value.slice(0, 250),
      reason: error instanceof Error ? error.message : String(error),
    });
  }
};

const createStatusError = (status: number, label: string, body: unknown): Error => {
  const upstreamMessage = extractUpstreamMessage(body);
  const message = upstreamMessage ? `${label}: ${upstreamMessage}` : `${label} failed with HTTP ${status}.`;

  if (status === 401 || status === 403) {
    return createAppError('AUTH_ERROR', message, {
      status,
    });
  }

  if (status === 404) {
    return createAppError('NOT_FOUND', message, {
      status,
    });
  }

  if (status === 429) {
    return createAppError('RATE_LIMITED', message, {
      status,
    });
  }

  return createAppError('UPSTREAM_API_ERROR', message, {
    status,
  });
};

const extractUpstreamMessage = (body: unknown): string | undefined => {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const message = 'message' in body ? body.message : undefined;
  return typeof message === 'string' ? message : undefined;
};
