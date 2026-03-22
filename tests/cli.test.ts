import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCli } from '../src/buildCli.js';

import type { CliDependencies } from '../src/buildCli.js';
import type { PostcodesClient } from '../src/providers/postcodesClient.js';
import type { TflClient } from '../src/providers/tflClient.js';

const ESCAPE_CHARACTER = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, 'g');

const notImplemented = (label: string): never => {
  throw new Error(`${label} was not stubbed for this test.`);
};

const createStubTflClient = (overrides: Partial<TflClient> = {}): TflClient => ({
  getDisruptionsByIds: vi.fn(async () => notImplemented('getDisruptionsByIds')),
  getDisruptionsByModes: vi.fn(async () => notImplemented('getDisruptionsByModes')),
  getJourneyResults: vi.fn(async () => notImplemented('getJourneyResults')),
  getLineStatusesByIds: vi.fn(async () => notImplemented('getLineStatusesByIds')),
  getLineStatusesByModes: vi.fn(async () => notImplemented('getLineStatusesByModes')),
  getNearbyBikePoints: vi.fn(async () => notImplemented('getNearbyBikePoints')),
  getStopPoint: vi.fn(async () => notImplemented('getStopPoint')),
  getStopPointArrivals: vi.fn(async () => notImplemented('getStopPointArrivals')),
  getStopPointArrivalsByLines: vi.fn(async () => notImplemented('getStopPointArrivalsByLines')),
  searchStopPoints: vi.fn(async () => notImplemented('searchStopPoints')),
  ...overrides,
});

const createStubPostcodesClient = (
  overrides: Partial<PostcodesClient> = {},
): PostcodesClient => ({
  lookupPostcode: vi.fn(async () => notImplemented('lookupPostcode')),
  ...overrides,
});

type CliEnvironment = {
  columns?: number | undefined;
  env?: Record<string, string | undefined> | undefined;
  isTTY?: boolean | undefined;
};

const runCli = async (
  args: string[],
  dependencies?: CliDependencies,
  environment: CliEnvironment = {},
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const stdoutSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stdoutChunks.push(String(chunk));
      return true;
    });
  const stderrSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  const priorExitCode = process.exitCode;
  const previousEnvironment = Object.fromEntries(
    Object.keys(environment.env ?? {}).map((key) => [key, process.env[key]]),
  );
  const previousIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  const previousColumnsDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'columns');

  process.exitCode = undefined;
  Object.entries(environment.env ?? {}).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  });

  if (environment.isTTY !== undefined) {
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: environment.isTTY,
    });
  }

  if (environment.columns !== undefined) {
    Object.defineProperty(process.stdout, 'columns', {
      configurable: true,
      value: environment.columns,
    });
  }

  try {
    const cli = buildCli(dependencies);
    cli.exitOverride();

    try {
      await cli.parseAsync(args, {
        from: 'user',
      });
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error)) {
        throw error;
      }
    }

    return {
      exitCode: process.exitCode ?? 0,
      stderr: stderrChunks.join(''),
      stdout: stdoutChunks.join(''),
    };
  } finally {
    process.exitCode = priorExitCode;
    Object.entries(previousEnvironment).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
        return;
      }

      process.env[key] = value;
    });
    if (previousColumnsDescriptor) {
      Object.defineProperty(process.stdout, 'columns', previousColumnsDescriptor);
    } else {
      delete (process.stdout as Partial<typeof process.stdout> & { columns?: number }).columns;
    }
    if (previousIsTTYDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', previousIsTTYDescriptor);
    } else {
      delete (process.stdout as Partial<typeof process.stdout> & { isTTY?: boolean }).isTTY;
    }
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  }
};

const stripAnsi = (value: string): string => value.replaceAll(ANSI_PATTERN, '');

describe('tfl cli', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a default rail status snapshot in json mode', async () => {
    const tflClient = createStubTflClient({
      getLineStatusesByModes: vi.fn(async () => [
        {
          disruptions: [],
          id: 'victoria',
          lineStatuses: [
            {
              statusSeverity: 10,
              statusSeverityDescription: 'Good Service',
              validityPeriods: [],
            },
          ],
          modeName: 'tube',
          name: 'Victoria',
        },
      ]),
    });

    const result = await runCli(['status', '--json'], {
      postcodesClient: createStubPostcodesClient(),
      tflClient,
    });

    expect(result.exitCode).toBe(0);
    expect(tflClient.getLineStatusesByModes).toHaveBeenCalledWith(
      ['tube', 'overground', 'dlr', 'elizabeth-line'],
      undefined,
    );
    const payload = JSON.parse(result.stdout);

    expect(payload).toMatchObject({
      command: 'status',
      data: {
        requestedModes: ['tube', 'overground', 'dlr', 'elizabeth-line'],
      },
      ok: true,
    });
    expect(payload.data.lines[0]).toStrictEqual({
      id: 'victoria',
      mode: 'tube',
      name: 'Victoria',
      statuses: [
        {
          description: 'Good Service',
          severity: 10,
        },
      ],
    });
  });

  it('resolves a specific status line alias', async () => {
    const tflClient = createStubTflClient({
      getLineStatusesByIds: vi.fn(async () => [
        {
          disruptions: [],
          id: 'northern',
          lineStatuses: [
            {
              lineId: 'northern',
              statusSeverity: 9,
              statusSeverityDescription: 'Minor Delays',
              validityPeriods: [],
            },
          ],
          modeName: 'tube',
          name: 'Northern',
        },
      ]),
    });

    const result = await runCli(['status', 'northern', '--json'], {
      postcodesClient: createStubPostcodesClient(),
      tflClient,
    });

    expect(result.exitCode).toBe(0);
    expect(tflClient.getLineStatusesByIds).toHaveBeenCalledWith(['northern'], undefined);
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        requestedLines: ['northern'],
      },
      ok: true,
    });
  });

  it('rejects unsupported status modes as structured json errors', async () => {
    const result = await runCli(['status', '--mode', 'bus', '--json'], {
      postcodesClient: createStubPostcodesClient(),
      tflClient: createStubTflClient(),
    });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'status',
      error: {
        code: 'INVALID_INPUT',
      },
      ok: false,
    });
  });

  it('deduplicates disruptions', async () => {
    const tflClient = createStubTflClient({
      getDisruptionsByModes: vi.fn(async () => [
        {
          category: 'RealTime',
          closureText: 'minorDelays',
          description: 'Northern Line: Minor delays due to train cancellations.',
          type: 'lineInfo',
        },
        {
          category: 'RealTime',
          closureText: 'minorDelays',
          description: 'Northern Line: Minor delays due to train cancellations.',
          type: 'lineInfo',
        },
        {
          category: 'Information',
          closureText: 'plannedClosure',
          description: 'Waterloo & City line planned closure.',
          type: 'lineInfo',
        },
      ]),
    });

    const result = await runCli(['disruptions', '--json'], {
      postcodesClient: createStubPostcodesClient(),
      tflClient,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout).data.disruptions).toHaveLength(2);
  });

  it('returns scored stop search results', async () => {
    const tflClient = createStubTflClient({
      searchStopPoints: vi.fn(async () => ({
        matches: [
          {
            id: 'HUBWAT',
            lat: 51.504269,
            lon: -0.113356,
            modes: ['national-rail', 'bus', 'tube'],
            name: 'Waterloo',
            zone: '1',
          },
          {
            id: '490000254Z',
            lat: 51.50365,
            lon: -0.11543,
            modes: ['bus'],
            name: 'Waterloo Station',
            zone: '1',
          },
        ],
        query: 'waterloo',
        total: 2,
      })),
    });

    const result = await runCli(['search', 'stops', 'waterloo', '--json'], {
      postcodesClient: createStubPostcodesClient(),
      tflClient,
    });

    const payload = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(payload.data.candidates[0]).toMatchObject({
      id: 'HUBWAT',
      name: 'Waterloo',
    });
    expect(payload.data.candidates[0].score).toBeGreaterThan(payload.data.candidates[1].score);
  });

  it('resolves a hub stop to a station id for arrivals', async () => {
    const tflClient = createStubTflClient({
      getStopPoint: vi.fn(async () => ({
        children: [
          {
            commonName: 'Waterloo Underground Station',
            id: '940GZZLUWLO',
            lines: [
              {
                id: 'northern',
              },
            ],
            modes: ['tube'],
            naptanId: '940GZZLUWLO',
            stationNaptan: '940GZZLUWLO',
            stopType: 'NaptanMetroStation',
          },
        ],
        commonName: 'Waterloo',
        id: 'HUBWAT',
        lines: [],
        modes: ['bus', 'national-rail', 'tube'],
        naptanId: 'HUBWAT',
      })),
      getStopPointArrivals: vi.fn(async () => [
        {
          expectedArrival: '2026-03-21T22:11:56Z',
          lineId: 'northern',
          lineName: 'Northern',
          naptanId: '940GZZLUWLO',
          stationName: 'Waterloo Underground Station',
          timeToStation: 96,
        },
      ]),
      searchStopPoints: vi.fn(async () => ({
        matches: [
          {
            id: 'HUBWAT',
            lat: 51.504269,
            lon: -0.113356,
            modes: ['national-rail', 'bus', 'tube'],
            name: 'Waterloo',
            zone: '1',
          },
        ],
        query: 'waterloo',
        total: 1,
      })),
    });

    const result = await runCli(['arrivals', 'waterloo', '--json'], {
      postcodesClient: createStubPostcodesClient(),
      tflClient,
    });

    expect(result.exitCode).toBe(0);
    expect(tflClient.getStopPointArrivals).toHaveBeenCalledWith('940GZZLUWLO');
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        stop: {
          id: '940GZZLUWLO',
        },
      },
      ok: true,
    });
  });

  it('routes between exact station ids', async () => {
    const tflClient = createStubTflClient({
      getJourneyResults: vi.fn(async () => ({
        kind: 'itinerary' as const,
        result: {
          journeys: [
            {
              arrivalDateTime: '2026-03-21T22:27:00',
              duration: 15,
              fare: {
                fares: [],
                totalCost: 280,
              },
              legs: [
                {
                  arrivalPoint: {
                    commonName: 'King\'s Cross St. Pancras Underground Station',
                  },
                  arrivalTime: '2026-03-21T22:27:00',
                  departurePoint: {
                    commonName: 'Waterloo Underground Station',
                  },
                  departureTime: '2026-03-21T22:12:00',
                  disruptions: [],
                  duration: 15,
                  instruction: {
                    summary: 'Northern line to Euston',
                  },
                  mode: {
                    id: 'tube',
                    name: 'tube',
                  },
                  plannedWorks: [],
                  routeOptions: [],
                },
              ],
              startDateTime: '2026-03-21T22:12:00',
            },
          ],
          lines: [],
          stopMessages: [],
        },
      })),
      getStopPoint: vi.fn(async (id: string) => ({
        children: [],
        commonName:
          id === '940GZZLUWLO'
            ? 'Waterloo Underground Station'
            : 'King\'s Cross St. Pancras Underground Station',
        id,
        lines: [],
        modes: ['tube'],
        naptanId: id,
        stationNaptan: id,
      })),
    });

    const result = await runCli(['route', '940GZZLUWLO', '940GZZLUKSX', '--json'], {
      postcodesClient: createStubPostcodesClient(),
      tflClient,
    });

    expect(result.exitCode).toBe(0);
    expect(tflClient.getJourneyResults).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '940GZZLUWLO',
        to: '940GZZLUKSX',
      }),
    );
  });

  it('routes between postcodes using postcodes.io', async () => {
    const postcodesClient = createStubPostcodesClient({
      lookupPostcode: vi.fn(async (postcode: string) => ({
        latitude: postcode === 'SE1 9SG' ? 51.5049 : 51.5142,
        longitude: postcode === 'SE1 9SG' ? -0.0877 : -0.0891,
        postcode,
      })),
    });
    const tflClient = createStubTflClient({
      getJourneyResults: vi.fn(async () => ({
        kind: 'itinerary' as const,
        result: {
          journeys: [],
          lines: [],
          stopMessages: [],
        },
      })),
    });

    const result = await runCli(['route', 'SE1 9SG', 'EC2R 8AH', '--json'], {
      postcodesClient,
      tflClient,
    });

    expect(result.exitCode).toBe(0);
    expect(postcodesClient.lookupPostcode).toHaveBeenCalledWith('SE1 9SG');
    expect(postcodesClient.lookupPostcode).toHaveBeenCalledWith('EC2R 8AH');
    expect(tflClient.getJourneyResults).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'SE19SG',
        to: 'EC2R8AH',
      }),
    );
  });

  it('returns ambiguous route matches as a json error', async () => {
    const tflClient = createStubTflClient({
      getStopPoint: vi.fn(async () => ({
        children: [],
        commonName: 'Waterloo Underground Station',
        id: '940GZZLUWLO',
        lines: [],
        modes: ['tube'],
        naptanId: '940GZZLUWLO',
        stationNaptan: '940GZZLUWLO',
      })),
      getJourneyResults: vi.fn(async () => ({
        kind: 'disambiguation' as const,
        result: {
          toLocationDisambiguation: {
            disambiguationOptions: [
              {
                parameterValue: '51.531236092657,-0.117548005162',
                place: {
                  commonName: 'London Borough of Islington, Kings cross',
                  placeType: 'PointOfInterest',
                },
              },
              {
                parameterValue: '1005909',
                place: {
                  commonName: 'Pentonville, Kings Cross / Caledonian Road',
                  placeType: 'StopPoint',
                },
              },
            ],
          },
        },
      })),
      searchStopPoints: vi.fn(async () => ({
        matches: [],
        query: 'kings cross',
        total: 0,
      })),
    });

    const result = await runCli(['route', '940GZZLUWLO', 'kings cross', '--json'], {
      postcodesClient: createStubPostcodesClient(),
      tflClient,
    });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: {
        code: 'AMBIGUOUS_LOCATION',
      },
      ok: false,
    });
  });

  it('looks up bike points by postcode and normalizes occupancy', async () => {
    const postcodesClient = createStubPostcodesClient({
      lookupPostcode: vi.fn(async () => ({
        latitude: 51.5049,
        longitude: -0.0877,
        postcode: 'SE1 9SG',
      })),
    });
    const tflClient = createStubTflClient({
      getNearbyBikePoints: vi.fn(async () => ({
        places: [
          {
            additionalProperties: [
              {
                key: 'NbBikes',
                value: '15',
              },
              {
                key: 'NbDocks',
                value: '35',
              },
              {
                key: 'NbEmptyDocks',
                value: '13',
              },
            ],
            commonName: 'Waterloo Station 3, Waterloo',
            distance: 245,
            id: 'BikePoints_154',
          },
        ],
      })),
    });

    const result = await runCli(['bikes', 'SE1 9SG', '--json'], {
      postcodesClient,
      tflClient,
    });

    expect(result.exitCode).toBe(0);
    expect(tflClient.getNearbyBikePoints).toHaveBeenCalledWith({
      lat: 51.5049,
      limit: 10,
      lon: -0.0877,
      radius: 500,
    });
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        bikePoints: [
          {
            bikes: 15,
            docks: 35,
            emptyDocks: 13,
            id: 'BikePoints_154',
          },
        ],
      },
      ok: true,
    });
  });

  it('renders coloured status text with emojis and wrapped reasons in tty mode', async () => {
    const tflClient = createStubTflClient({
      getLineStatusesByModes: vi.fn(async () => [
        {
          disruptions: [],
          id: 'northern',
          lineStatuses: [
            {
              lineId: 'northern',
              reason: 'Signal failure at Camden Town with a longer explanation that should wrap cleanly onto the next line.',
              statusSeverity: 9,
              statusSeverityDescription: 'Minor Delays',
              validityPeriods: [],
            },
          ],
          modeName: 'tube',
          name: 'Northern',
        },
      ]),
    });

    const result = await runCli(
      ['status'],
      {
        postcodesClient: createStubPostcodesClient(),
        tflClient,
      },
      {
        columns: 52,
        env: {
          NO_COLOR: undefined,
        },
        isTTY: true,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(ANSI_PATTERN);
    expect(stripAnsi(result.stdout)).toContain('⚠️ Minor Delays');
    expect(stripAnsi(result.stdout)).toContain('\n    Signal failure at Camden Town');
  });

  it('disables colour when NO_COLOR is set', async () => {
    const tflClient = createStubTflClient({
      getLineStatusesByModes: vi.fn(async () => [
        {
          disruptions: [],
          id: 'victoria',
          lineStatuses: [
            {
              statusSeverity: 10,
              statusSeverityDescription: 'Good Service',
              validityPeriods: [],
            },
          ],
          modeName: 'tube',
          name: 'Victoria',
        },
      ]),
    });

    const result = await runCli(
      ['status'],
      {
        postcodesClient: createStubPostcodesClient(),
        tflClient,
      },
      {
        env: {
          NO_COLOR: '1',
        },
        isTTY: true,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(ANSI_PATTERN);
    expect(result.stdout).toContain('✅ Good Service');
  });

  it('disables colour with --no-color even when passed after the subcommand', async () => {
    const tflClient = createStubTflClient({
      getLineStatusesByModes: vi.fn(async () => [
        {
          disruptions: [],
          id: 'victoria',
          lineStatuses: [
            {
              statusSeverity: 10,
              statusSeverityDescription: 'Good Service',
              validityPeriods: [],
            },
          ],
          modeName: 'tube',
          name: 'Victoria',
        },
      ]),
    });

    const result = await runCli(
      ['status', '--no-color'],
      {
        postcodesClient: createStubPostcodesClient(),
        tflClient,
      },
      {
        isTTY: true,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(ANSI_PATTERN);
    expect(result.stdout).toContain('✅ Good Service');
  });

  it('keeps text output plain when forced in a non-tty', async () => {
    const tflClient = createStubTflClient({
      getLineStatusesByModes: vi.fn(async () => [
        {
          disruptions: [],
          id: 'victoria',
          lineStatuses: [
            {
              statusSeverity: 10,
              statusSeverityDescription: 'Good Service',
              validityPeriods: [],
            },
          ],
          modeName: 'tube',
          name: 'Victoria',
        },
      ]),
    });

    const result = await runCli(
      ['status', '--text'],
      {
        postcodesClient: createStubPostcodesClient(),
        tflClient,
      },
      {
        isTTY: false,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(ANSI_PATTERN);
    expect(result.stdout.trim()).not.toMatch(/^\{/);
    expect(result.stdout).toContain('✅ Good Service');
  });

  it('renders wrapped disruptions with a generic overground fallback colour', async () => {
    const tflClient = createStubTflClient({
      getDisruptionsByModes: vi.fn(async () => [
        {
          category: 'Information',
          closureText: 'plannedClosure',
          description: 'London Overground: Planned closure between Willesden Junction and Richmond this weekend with replacement buses in operation.',
          type: 'lineInfo',
        },
        {
          category: 'Information',
          closureText: 'minorDelays',
          description: 'Minor delays on other services due to earlier congestion.',
          type: 'lineInfo',
        },
      ]),
    });

    const result = await runCli(
      ['disruptions'],
      {
        postcodesClient: createStubPostcodesClient(),
        tflClient,
      },
      {
        columns: 62,
        env: {
          NO_COLOR: undefined,
        },
        isTTY: true,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(ANSI_PATTERN);
    expect(stripAnsi(result.stdout)).toContain('London Overground\n  Planned closure');
    expect(stripAnsi(result.stdout)).toContain('\n\nMinor delays on other services');
  });

  it('renders route options and leg details in compact text mode', async () => {
    const tflClient = createStubTflClient({
      getJourneyResults: vi.fn(async () => ({
        kind: 'itinerary' as const,
        result: {
          journeys: [
            {
              arrivalDateTime: '2026-03-21T22:27:00',
              duration: 15,
              fare: {
                fares: [],
                totalCost: 280,
              },
              legs: [
                {
                  arrivalPoint: {
                    commonName: 'Bus Stop A',
                  },
                  arrivalTime: '2026-03-21T22:15:00',
                  departurePoint: {
                    commonName: 'Waterloo Underground Station',
                  },
                  departureTime: '2026-03-21T22:12:00',
                  disruptions: [],
                  duration: 3,
                  instruction: {
                    summary: 'Walk to York Road bus stop',
                  },
                  mode: {
                    id: 'walking',
                    name: 'walking',
                  },
                  plannedWorks: [],
                  routeOptions: [],
                },
                {
                  arrivalPoint: {
                    commonName: 'King\'s Cross St. Pancras Underground Station',
                  },
                  arrivalTime: '2026-03-21T22:27:00',
                  departurePoint: {
                    commonName: 'Bus Stop A',
                  },
                  departureTime: '2026-03-21T22:15:00',
                  disruptions: [],
                  duration: 12,
                  instruction: {
                    summary: 'Take the 188 towards Russell Square',
                  },
                  mode: {
                    id: 'bus',
                    name: 'bus',
                  },
                  plannedWorks: [],
                  routeOptions: [
                    {
                      directions: ['Northbound'],
                      direction: 'Northbound',
                      lineIdentifier: {
                        id: '188',
                        name: '188',
                      },
                      name: '188',
                    },
                  ],
                },
              ],
              startDateTime: '2026-03-21T22:12:00',
            },
          ],
          lines: [],
          stopMessages: [],
        },
      })),
      getStopPoint: vi.fn(async (id: string) => ({
        children: [],
        commonName:
          id === '940GZZLUWLO'
            ? 'Waterloo Underground Station'
            : 'King\'s Cross St. Pancras Underground Station',
        id,
        lines: [],
        modes: ['tube'],
        naptanId: id,
        stationNaptan: id,
      })),
    });

    const result = await runCli(
      ['route', '940GZZLUWLO', '940GZZLUKSX', '--text'],
      {
        postcodesClient: createStubPostcodesClient(),
        tflClient,
      },
      {
        columns: 58,
        env: {
          NO_COLOR: undefined,
        },
        isTTY: true,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(ANSI_PATTERN);
    expect(stripAnsi(result.stdout)).toContain('Option 1');
    expect(stripAnsi(result.stdout)).toContain('Walk Waterloo Underground Station -> Bus Stop A');
    expect(stripAnsi(result.stdout)).toContain('Bus 188 Bus Stop A -> King\'s Cross St. Pancras Underground Station');
    expect(stripAnsi(result.stdout)).toContain('  Take the 188 towards Russell Square | Northbound');
  });

  it('renders arrivals in aligned text mode without absolute times', async () => {
    const tflClient = createStubTflClient({
      getStopPoint: vi.fn(async () => ({
        children: [
          {
            commonName: 'Waterloo Underground Station',
            id: '940GZZLUWLO',
            lines: [
              {
                id: 'northern',
              },
            ],
            modes: ['tube'],
            naptanId: '940GZZLUWLO',
            stationNaptan: '940GZZLUWLO',
            stopType: 'NaptanMetroStation',
          },
        ],
        commonName: 'Waterloo',
        id: 'HUBWAT',
        lines: [],
        modes: ['bus', 'national-rail', 'tube'],
        naptanId: 'HUBWAT',
      })),
      getStopPointArrivals: vi.fn(async () => [
        {
          destinationName: 'Edgware via CX',
          expectedArrival: '2026-03-21T22:11:56Z',
          lineId: 'northern',
          lineName: 'Northern',
          naptanId: '940GZZLUWLO',
          platformName: 'Platform 2',
          stationName: 'Waterloo Underground Station',
          timeToStation: 96,
        },
        {
          destinationName: 'Morden',
          expectedArrival: '2026-03-21T22:12:20Z',
          lineId: 'northern',
          lineName: 'Northern',
          naptanId: '940GZZLUWLO',
          platformName: 'Platform 4',
          stationName: 'Waterloo Underground Station',
          timeToStation: 20,
        },
      ]),
      searchStopPoints: vi.fn(async () => ({
        matches: [
          {
            id: 'HUBWAT',
            lat: 51.504269,
            lon: -0.113356,
            modes: ['national-rail', 'bus', 'tube'],
            name: 'Waterloo',
            zone: '1',
          },
        ],
        query: 'waterloo',
        total: 1,
      })),
    });

    const result = await runCli(
      ['arrivals', 'waterloo', '--text'],
      {
        postcodesClient: createStubPostcodesClient(),
        tflClient,
      },
      {
        columns: 64,
        env: {
          NO_COLOR: undefined,
        },
        isTTY: true,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(ANSI_PATTERN);
    expect(stripAnsi(result.stdout)).toContain('Waterloo');
    expect(stripAnsi(result.stdout)).toContain('Northern  Edgware via CX  Platform 2');
    expect(stripAnsi(result.stdout)).toContain('2 min');
    expect(stripAnsi(result.stdout)).toContain('<1 min');
    expect(stripAnsi(result.stdout)).not.toContain('22:11');
  });

  it('renders bike availability with coloured occupancy thresholds', async () => {
    const postcodesClient = createStubPostcodesClient({
      lookupPostcode: vi.fn(async () => ({
        latitude: 51.5049,
        longitude: -0.0877,
        postcode: 'SE1 9SG',
      })),
    });
    const tflClient = createStubTflClient({
      getNearbyBikePoints: vi.fn(async () => ({
        places: [
          {
            additionalProperties: [
              { key: 'NbBikes', value: '0' },
              { key: 'NbEmptyDocks', value: '9' },
            ],
            commonName: 'Dock A',
            distance: 120,
            id: 'BikePoints_1',
          },
          {
            additionalProperties: [
              { key: 'NbBikes', value: '3' },
              { key: 'NbEmptyDocks', value: '1' },
            ],
            commonName: 'Dock B',
            distance: 220,
            id: 'BikePoints_2',
          },
          {
            additionalProperties: [
              { key: 'NbBikes', value: '8' },
              { key: 'NbEmptyDocks', value: '0' },
            ],
            commonName: 'Dock C',
            distance: 320,
            id: 'BikePoints_3',
          },
        ],
      })),
    });

    const result = await runCli(
      ['bikes', 'SE1 9SG', '--text'],
      {
        postcodesClient,
        tflClient,
      },
      {
        env: {
          NO_COLOR: undefined,
        },
        isTTY: true,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(ANSI_PATTERN);
    expect(stripAnsi(result.stdout)).toContain('Dock A (120m)  0 bikes  9 empty docks');
    expect(stripAnsi(result.stdout)).toContain('Dock B (220m)  3 bikes  1 empty docks');
    expect(stripAnsi(result.stdout)).toContain('Dock C (320m)  8 bikes  0 empty docks');
  });

  it('renders stop search results with styled names and mode tags', async () => {
    const tflClient = createStubTflClient({
      searchStopPoints: vi.fn(async () => ({
        matches: [
          {
            id: 'HUBWAT',
            lat: 51.504269,
            lon: -0.113356,
            modes: ['national-rail', 'bus', 'tube'],
            name: 'Waterloo',
            zone: '1',
          },
          {
            id: '490000254Z',
            lat: 51.50365,
            lon: -0.11543,
            modes: ['bus'],
            name: 'Waterloo Station',
            zone: '1',
          },
        ],
        query: 'waterloo',
        total: 2,
      })),
    });

    const result = await runCli(
      ['search', 'stops', 'waterloo', '--text'],
      {
        postcodesClient: createStubPostcodesClient(),
        tflClient,
      },
      {
        env: {
          NO_COLOR: undefined,
        },
        isTTY: true,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(ANSI_PATTERN);
    expect(stripAnsi(result.stdout)).toContain('Waterloo (HUBWAT) [national-rail] [bus] [tube]  zone 1');
    expect(stripAnsi(result.stdout)).toContain('Waterloo Station (490000254Z) [bus]  zone 1');
  });

  it('prints version output', async () => {
    const result = await runCli(['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('0.1.0');
  });

  it('prints help output', async () => {
    const result = await runCli(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--no-color');
    expect(result.stdout).toContain('status');
    expect(result.stdout).toContain('route');
  });
});
