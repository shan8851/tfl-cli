export type OutputMode = 'json' | 'text';

type SchemaVersion = '1';

export type EnvelopeError = {
  code: string;
  details?: unknown;
  message: string;
  retryable: boolean;
};

export type ErrorEnvelope = {
  command: string;
  error: EnvelopeError;
  ok: false;
  requestedAt: string;
  schemaVersion: SchemaVersion;
};

export type SuccessEnvelope<TData> = {
  command: string;
  data: TData;
  ok: true;
  requestedAt: string;
  schemaVersion: SchemaVersion;
};

export type OutputOptions = {
  color?: boolean | undefined;
  json?: boolean | undefined;
  output?: string | undefined;
  text?: boolean | undefined;
};

export type LineStatusSummary = {
  description: string;
  lineId?: string | undefined;
  reason?: string | undefined;
  severity?: number | undefined;
  validFrom?: string | undefined;
  validTo?: string | undefined;
};

export type StatusData = {
  lines: Array<{
    id: string;
    mode: string;
    name: string;
    statuses: LineStatusSummary[];
  }>;
  requestedLines?: string[] | undefined;
  requestedModes?: string[] | undefined;
};

export type DisruptionData = {
  disruptions: Array<{
    category?: string | undefined;
    closureText?: string | undefined;
    description: string;
    lastUpdated?: string | undefined;
    type?: string | undefined;
  }>;
  requestedLines?: string[] | undefined;
  requestedModes?: string[] | undefined;
};

export type ResolvedLocation = {
  id?: string | undefined;
  isStation: boolean;
  label: string;
  lat?: number | undefined;
  lon?: number | undefined;
  modes: string[];
  source: 'coordinates' | 'journey-fallback' | 'postcode' | 'stop-point';
};

export type RouteData = {
  from: ResolvedLocation;
  journeys: Array<{
    arrivalTime: string;
    departureTime: string;
    durationMinutes: number;
    farePence?: number | undefined;
    legs: Array<{
      arrivalTime: string;
      departureTime: string;
      destination: string;
      direction?: string | undefined;
      distanceMeters?: number | undefined;
      durationMinutes: number;
      lineName?: string | undefined;
      mode: string;
      origin: string;
      summary: string;
    }>;
  }>;
  stopMessages: string[];
  to: ResolvedLocation;
};

export type ArrivalData = {
  arrivals: Array<{
    currentLocation?: string | undefined;
    destinationName?: string | undefined;
    direction?: string | undefined;
    expectedArrival: string;
    lineId: string;
    lineName: string;
    platformName?: string | undefined;
    timeToStationSeconds: number;
    towards?: string | undefined;
  }>;
  filters: {
    direction?: string | undefined;
    line?: string | undefined;
  };
  stop: ResolvedLocation;
};

export type SearchStopsData = {
  candidates: Array<{
    id: string;
    lat: number;
    lon: number;
    modes: string[];
    name: string;
    score: number;
    zone?: string | undefined;
  }>;
  query: string;
};

export type BikesData = {
  bikePoints: Array<{
    bikes?: number | undefined;
    distanceMeters?: number | undefined;
    docks?: number | undefined;
    ebikes?: number | undefined;
    emptyDocks?: number | undefined;
    id: string;
    installed?: boolean | undefined;
    locked?: boolean | undefined;
    name: string;
    standardBikes?: number | undefined;
  }>;
  origin: ResolvedLocation;
  radiusMeters: number;
};

export type LocationCandidate = {
  id: string;
  lat: number;
  lon: number;
  modes: string[];
  name: string;
  rawScore: number;
  zone?: string | undefined;
};
