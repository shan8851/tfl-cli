import { z } from 'zod';

import { DisambiguationResultSchema, DisruptionSchema, ItineraryResultSchema, LineSchema, PlacesResponseSchema, PredictionSchema, StopPointSchema, StopSearchResponseSchema } from '../lib/schemas.js';

import { requestJson } from './requestJson.js';

import type { AppConfig } from '../lib/config.js';

export type JourneyResult =
  | {
      kind: 'disambiguation';
      result: z.infer<typeof DisambiguationResultSchema>;
    }
  | {
      kind: 'itinerary';
      result: z.infer<typeof ItineraryResultSchema>;
    };

export type TflClient = {
  getDisruptionsByIds: (lineIds: string[]) => Promise<Array<z.infer<typeof DisruptionSchema>>>;
  getDisruptionsByModes: (modes: string[]) => Promise<Array<z.infer<typeof DisruptionSchema>>>;
  getJourneyResults: (options: {
    accessibilityPreferences?: string[];
    date?: string;
    from: string;
    maxWalkingMinutes?: number;
    modes?: string[];
    preference?: string;
    time?: string;
    timeIs: 'Arriving' | 'Departing';
    to: string;
    toName?: string;
    via?: string;
  }) => Promise<JourneyResult>;
  getLineStatusesByIds: (lineIds: string[], detail?: boolean) => Promise<Array<z.infer<typeof LineSchema>>>;
  getLineStatusesByModes: (modes: string[], detail?: boolean) => Promise<Array<z.infer<typeof LineSchema>>>;
  getNearbyBikePoints: (options: {
    lat: number;
    limit: number;
    lon: number;
    radius: number;
  }) => Promise<z.infer<typeof PlacesResponseSchema>>;
  getStopPoint: (id: string) => Promise<z.infer<typeof StopPointSchema>>;
  getStopPointArrivals: (stopPointId: string) => Promise<Array<z.infer<typeof PredictionSchema>>>;
  getStopPointArrivalsByLines: (lineIds: string[], stopPointId: string, direction?: string) => Promise<Array<z.infer<typeof PredictionSchema>>>;
  searchStopPoints: (query: string) => Promise<z.infer<typeof StopSearchResponseSchema>>;
};

export const createTflClient = (config: AppConfig): TflClient => {
  const withAuth = (url: URL): URL => {
    if (config.tflAppKey) {
      url.searchParams.set('app_key', config.tflAppKey);
    }

    return url;
  };

  const buildUrl = (path: string): URL => withAuth(new URL(path, 'https://api.tfl.gov.uk'));

  return {
    getDisruptionsByIds: async (lineIds) => {
      const url = buildUrl(`/Line/${lineIds.join(',')}/Disruption`);
      return requestJson({
        label: 'TfL disruptions lookup',
        schema: z.array(DisruptionSchema),
        url,
      });
    },
    getDisruptionsByModes: async (modes) => {
      const url = buildUrl(`/Line/Mode/${modes.join(',')}/Disruption`);
      return requestJson({
        label: 'TfL disruptions lookup',
        schema: z.array(DisruptionSchema),
        url,
      });
    },
    getJourneyResults: async ({
      accessibilityPreferences,
      date,
      from,
      maxWalkingMinutes,
      modes,
      preference,
      time,
      timeIs,
      to,
      toName,
      via,
    }) => {
      const url = buildUrl(`/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}`);
      url.searchParams.set('timeIs', timeIs);

      if (date) {
        url.searchParams.set('date', date);
      }

      if (time) {
        url.searchParams.set('time', time);
      }

      if (preference) {
        url.searchParams.set('journeyPreference', preference);
      }

      if (via) {
        url.searchParams.set('via', via);
      }

      if (toName) {
        url.searchParams.set('toName', toName);
      }

      if (typeof maxWalkingMinutes === 'number') {
        url.searchParams.set('maxWalkingMinutes', String(maxWalkingMinutes));
      }

      modes?.forEach((mode) => {
        url.searchParams.append('mode', mode);
      });

      accessibilityPreferences?.forEach((value) => {
        url.searchParams.append('accessibilityPreference', value);
      });

      const rawResponse = await requestJson({
        label: `TfL journey lookup from "${from}" to "${to}"`,
        schema: z.unknown(),
        url,
      });

      const itineraryResult = ItineraryResultSchema.safeParse(rawResponse);

      if (itineraryResult.success) {
        return {
          kind: 'itinerary',
          result: itineraryResult.data,
        };
      }

      return {
        kind: 'disambiguation',
        result: DisambiguationResultSchema.parse(rawResponse),
      };
    },
    getLineStatusesByIds: async (lineIds, detail) => {
      const url = buildUrl(`/Line/${lineIds.join(',')}/Status`);

      if (detail) {
        url.searchParams.set('detail', 'true');
      }

      return requestJson({
        label: 'TfL line status lookup',
        schema: z.array(LineSchema),
        url,
      });
    },
    getLineStatusesByModes: async (modes, detail) => {
      const url = buildUrl(`/Line/Mode/${modes.join(',')}/Status`);

      if (detail) {
        url.searchParams.set('detail', 'true');
      }

      return requestJson({
        label: 'TfL line status lookup',
        schema: z.array(LineSchema),
        url,
      });
    },
    getNearbyBikePoints: async ({ lat, limit, lon, radius }) => {
      const url = buildUrl('/Place');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      url.searchParams.set('type', 'BikePoint');
      url.searchParams.set('radius', String(radius));
      url.searchParams.set('numberOfPlacesToReturn', String(limit));

      return requestJson({
        label: 'TfL bike point lookup',
        schema: PlacesResponseSchema,
        url,
      });
    },
    getStopPoint: async (id) => {
      const url = buildUrl(`/StopPoint/${encodeURIComponent(id)}`);
      return requestJson({
        label: `TfL stop point lookup for "${id}"`,
        schema: StopPointSchema,
        url,
      });
    },
    getStopPointArrivals: async (stopPointId) => {
      const url = buildUrl(`/StopPoint/${encodeURIComponent(stopPointId)}/Arrivals`);
      return requestJson({
        label: `TfL arrivals lookup for "${stopPointId}"`,
        schema: z.array(PredictionSchema),
        url,
      });
    },
    getStopPointArrivalsByLines: async (lineIds, stopPointId, direction) => {
      const url = buildUrl(`/Line/${lineIds.join(',')}/Arrivals/${encodeURIComponent(stopPointId)}`);

      if (direction && direction !== 'all') {
        url.searchParams.set('direction', direction);
      }

      return requestJson({
        label: `TfL arrivals lookup for "${stopPointId}"`,
        schema: z.array(PredictionSchema),
        url,
      });
    },
    searchStopPoints: async (query) => {
      const url = buildUrl(`/StopPoint/Search/${encodeURIComponent(query)}`);
      return requestJson({
        label: `TfL stop search for "${query}"`,
        schema: StopSearchResponseSchema,
        url,
      });
    },
  };
};
