import { RAIL_MODES, STATION_ID_PREFIXES } from './constants.js';
import { createAppError } from './errors.js';

import type { LocationCandidate, ResolvedLocation } from './types.js';
import type { PostcodesClient } from '../providers/postcodesClient.js';
import type { TflClient } from '../providers/tflClient.js';

type ResolutionPurpose = 'arrivals' | 'bikes' | 'route' | 'search';

type RouteResolution = {
  location: ResolvedLocation;
  queryValue: string;
};

type ArrivalResolution = {
  location: ResolvedLocation;
  stopPointId: string;
};

const POSTCODE_PATTERN =
  /^(([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})|GIR\s*0AA)$/i;

const COORDINATE_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

const STOP_POINT_PATTERN = /^(HUB[A-Z0-9]+|(?:490|910|930|940)[A-Z0-9]+|\d{6,})$/i;

export const searchStopCandidates = async (
  tflClient: TflClient,
  query: string,
  purpose: ResolutionPurpose,
): Promise<LocationCandidate[]> => {
  const response = await tflClient.searchStopPoints(query);
  const normalizedQuery = normalizeText(query);

  return response.matches
    .map((match, index) => ({
      id: match.id,
      lat: match.lat,
      lon: match.lon,
      modes: match.modes,
      name: match.name,
      rawScore: scoreCandidate(match, index, normalizedQuery, purpose),
      zone: match.zone,
    }))
    .sort((left, right) => right.rawScore - left.rawScore);
};

export const resolveRouteLocation = async (
  tflClient: TflClient,
  postcodesClient: PostcodesClient,
  input: string,
): Promise<RouteResolution> => {
  const coordinateMatch = input.match(COORDINATE_PATTERN);

  if (coordinateMatch) {
    const [, lat, lon] = coordinateMatch;
    return {
      location: {
        isStation: false,
        label: `${Number(lat)},${Number(lon)}`,
        lat: Number(lat),
        lon: Number(lon),
        modes: [],
        source: 'coordinates',
      },
      queryValue: `${Number(lat)},${Number(lon)}`,
    };
  }

  if (POSTCODE_PATTERN.test(input)) {
    const postcodeResult = await postcodesClient.lookupPostcode(input);
    const queryValue = compactPostcode(postcodeResult.postcode);

    return {
      location: {
        isStation: false,
        label: postcodeResult.postcode,
        lat: postcodeResult.latitude,
        lon: postcodeResult.longitude,
        modes: [],
        source: 'postcode',
      },
      queryValue,
    };
  }

  if (STOP_POINT_PATTERN.test(input)) {
    const stopPoint = await tflClient.getStopPoint(input);
    const queryValue = selectRouteQueryValue(stopPoint);

    return {
      location: stopPointToResolvedLocation(stopPoint, 'stop-point'),
      queryValue,
    };
  }

  const candidates = await searchStopCandidates(tflClient, input, 'route');

  if (candidates.length === 0) {
    return {
      location: {
        isStation: false,
        label: input,
        modes: [],
        source: 'journey-fallback',
      },
      queryValue: input,
    };
  }

  const candidate = selectStrongCandidate(input, candidates);
  const stopPoint = await tflClient.getStopPoint(candidate.id);

  return {
    location: stopPointToResolvedLocation(stopPoint, 'stop-point'),
    queryValue: selectRouteQueryValue(stopPoint),
  };
};

export const resolveArrivalLocation = async (
  tflClient: TflClient,
  input: string,
  lineId?: string,
): Promise<ArrivalResolution> => {
  if (STOP_POINT_PATTERN.test(input)) {
    const stopPoint = await tflClient.getStopPoint(input);
    const stopPointId = selectArrivalStopPointId(stopPoint, lineId);

    return {
      location: stopPointToResolvedLocation(stopPoint, 'stop-point'),
      stopPointId,
    };
  }

  const candidates = await searchStopCandidates(tflClient, input, 'arrivals');
  const candidate = selectStrongCandidate(input, candidates);
  const stopPoint = await tflClient.getStopPoint(candidate.id);

  return {
    location: stopPointToResolvedLocation(stopPoint, 'stop-point'),
    stopPointId: selectArrivalStopPointId(stopPoint, lineId),
  };
};

export const resolveBikeOrigin = async (
  tflClient: TflClient,
  postcodesClient: PostcodesClient,
  input: string,
): Promise<ResolvedLocation> => {
  const coordinateMatch = input.match(COORDINATE_PATTERN);

  if (coordinateMatch) {
    const [, lat, lon] = coordinateMatch;
    return {
      isStation: false,
      label: `${Number(lat)},${Number(lon)}`,
      lat: Number(lat),
      lon: Number(lon),
      modes: [],
      source: 'coordinates',
    };
  }

  if (POSTCODE_PATTERN.test(input)) {
    const postcodeResult = await postcodesClient.lookupPostcode(input);
    return {
      isStation: false,
      label: postcodeResult.postcode,
      lat: postcodeResult.latitude,
      lon: postcodeResult.longitude,
      modes: [],
      source: 'postcode',
    };
  }

  if (STOP_POINT_PATTERN.test(input)) {
    const stopPoint = await tflClient.getStopPoint(input);
    return stopPointToResolvedLocation(stopPoint, 'stop-point');
  }

  const candidates = await searchStopCandidates(tflClient, input, 'bikes');
  const candidate = selectStrongCandidate(input, candidates);
  const stopPoint = await tflClient.getStopPoint(candidate.id);

  return stopPointToResolvedLocation(stopPoint, 'stop-point');
};

const compactPostcode = (value: string): string => value.replaceAll(/\s+/g, '').toUpperCase();

const scoreCandidate = (
  candidate: { id: string; modes: string[]; name: string },
  index: number,
  normalizedQuery: string,
  purpose: ResolutionPurpose,
): number => {
  const normalizedName = normalizeText(candidate.name);
  const railModeCount = candidate.modes.filter((mode) => RAIL_MODES.has(mode)).length;
  const exactNameMatch = normalizedName === normalizedQuery;
  const startsWithMatch = normalizedName.startsWith(normalizedQuery);
  const includesMatch = normalizedName.includes(normalizedQuery);
  const baseScore = Math.max(10, 100 - index * 9);
  const railScore = railModeCount * 14;
  const stationBonus = candidate.id.startsWith('HUB') ? 18 : 0;
  const explicitStationBonus = STATION_ID_PREFIXES.some((prefix) => candidate.id.startsWith(prefix))
    ? 16
    : 0;
  const busOnlyPenalty = candidate.modes.length === 1 && candidate.modes[0] === 'bus' ? 24 : 0;
  const purposeBonus = purpose === 'search' ? 0 : railModeCount > 0 ? 8 : -6;
  const textScore = exactNameMatch ? 30 : startsWithMatch ? 18 : includesMatch ? 8 : 0;

  return baseScore + railScore + stationBonus + explicitStationBonus + purposeBonus + textScore - busOnlyPenalty;
};

const normalizeText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replaceAll('&', 'and')
    .replaceAll(/['.,/()-]/g, ' ')
    .replaceAll(/\s+/g, ' ');

const selectStrongCandidate = (query: string, candidates: LocationCandidate[]): LocationCandidate => {
  const [bestCandidate, secondCandidate] = candidates;

  if (!bestCandidate) {
    throw createAppError('NOT_FOUND', `No stop or station matched "${query}".`);
  }

  if (!secondCandidate) {
    return bestCandidate;
  }

  if (bestCandidate.rawScore - secondCandidate.rawScore >= 15) {
    return bestCandidate;
  }

  const normalizedQuery = normalizeText(query);
  const normalizedBestName = normalizeText(bestCandidate.name);
  const normalizedSecondName = normalizeText(secondCandidate.name);

  if (
    normalizedBestName === normalizedQuery &&
    normalizedSecondName !== normalizedQuery &&
    bestCandidate.rawScore - secondCandidate.rawScore >= 6
  ) {
    return bestCandidate;
  }

  throw createAppError(
    'AMBIGUOUS_LOCATION',
    `Could not confidently resolve "${query}".`,
    {
      candidates: candidates.slice(0, 5).map((candidate) => ({
        id: candidate.id,
        modes: candidate.modes,
        name: candidate.name,
      })),
      query,
    },
  );
};

const stopPointToResolvedLocation = (
  stopPoint: Awaited<ReturnType<TflClient['getStopPoint']>>,
  source: ResolvedLocation['source'],
): ResolvedLocation => ({
  id: stopPoint.id,
  isStation: stopPoint.modes.some((mode) => RAIL_MODES.has(mode)),
  label: stopPoint.commonName,
  lat: stopPoint.lat,
  lon: stopPoint.lon,
  modes: stopPoint.modes,
  source,
});

const selectArrivalStopPointId = (
  stopPoint: Awaited<ReturnType<TflClient['getStopPoint']>>,
  lineId?: string,
): string => {
  if (!stopPoint.id.startsWith('HUB')) {
    return stopPoint.stationNaptan ?? stopPoint.naptanId ?? stopPoint.id;
  }

  const winner = selectPreferredNode(stopPoint, lineId);

  if (!winner) {
    throw createAppError('NOT_FOUND', `No arrival-capable stop point was found for "${stopPoint.commonName}".`);
  }

  return winner.stationNaptan ?? winner.naptanId ?? winner.id;
};

const selectRouteQueryValue = (stopPoint: Awaited<ReturnType<TflClient['getStopPoint']>>): string => {
  if (!stopPoint.id.startsWith('HUB')) {
    return stopPoint.stationNaptan ?? stopPoint.naptanId ?? stopPoint.id;
  }

  const winner = selectPreferredNode(stopPoint);

  if (winner) {
    return winner.stationNaptan ?? winner.naptanId ?? winner.id;
  }

  if (typeof stopPoint.lat === 'number' && typeof stopPoint.lon === 'number') {
    return `${stopPoint.lat},${stopPoint.lon}`;
  }

  return stopPoint.id;
};

const selectPreferredNode = (
  stopPoint: Awaited<ReturnType<TflClient['getStopPoint']>>,
  lineId?: string,
): (typeof stopPoint.children)[number] | typeof stopPoint | undefined => {
  const nodes = [stopPoint, ...stopPoint.children];

  return nodes
    .map((node) => ({
      node,
      score: scorePreferredNode(node, lineId),
    }))
    .sort((left, right) => right.score - left.score)
    .at(0)?.node;
};

const scorePreferredNode = (
  node: Awaited<ReturnType<TflClient['getStopPoint']>> | Awaited<ReturnType<TflClient['getStopPoint']>>['children'][number],
  lineId?: string,
): number => {
  const candidateId = node.stationNaptan ?? node.naptanId ?? node.id;
  const railModeCount = node.modes.filter((mode) => RAIL_MODES.has(mode)).length;
  const lineMatch = lineId ? node.lines.some((line) => line.id === lineId) : false;
  const isHub = node.id.startsWith('HUB');
  const stationPrefixMatch = STATION_ID_PREFIXES.some((prefix) => candidateId.startsWith(prefix));
  const busOnly = node.modes.length === 1 && node.modes[0] === 'bus';
  const stopTypeBonus = node.stopType?.toLowerCase().includes('station') ? 10 : 0;

  return (
    (lineMatch ? 50 : 0) +
    (stationPrefixMatch ? 40 : 0) +
    railModeCount * 12 +
    (node.stationNaptan ? 12 : 0) +
    stopTypeBonus -
    (isHub ? 30 : 0) -
    (busOnly ? 25 : 0)
  );
};
