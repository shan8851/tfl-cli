import { z } from 'zod';

export const AdditionalPropertySchema = z
  .object({
    category: z.string().optional(),
    key: z.string(),
    value: z.string().optional(),
  })
  .passthrough();

export const IdentifierSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
  })
  .passthrough();

export const DisruptionSchema = z
  .object({
    category: z.string().optional(),
    closureText: z.string().optional(),
    created: z.string().optional(),
    description: z.string(),
    lastUpdate: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

export const LineStatusSchema = z
  .object({
    lineId: z.string().optional(),
    reason: z.string().optional(),
    statusSeverity: z.number().optional(),
    statusSeverityDescription: z.string(),
    validityPeriods: z
      .array(
        z
          .object({
            fromDate: z.string().optional(),
            isNow: z.boolean().optional(),
            toDate: z.string().optional(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
  })
  .passthrough();

export const LineSchema = z
  .object({
    disruptions: z.array(DisruptionSchema).optional().default([]),
    id: z.string(),
    lineStatuses: z.array(LineStatusSchema).optional().default([]),
    modeName: z.string(),
    name: z.string(),
  })
  .passthrough();

export const MatchedStopSchema = z
  .object({
    icsId: z.string().optional(),
    id: z.string(),
    lat: z.number(),
    lon: z.number(),
    modes: z.array(z.string()).optional().default([]),
    name: z.string(),
    topMostParentId: z.string().optional(),
    zone: z.string().optional(),
  })
  .passthrough();

export const StopSearchResponseSchema = z
  .object({
    matches: z.array(MatchedStopSchema),
    query: z.string(),
    total: z.number(),
  })
  .passthrough();

export const StopPointChildSchema = z
  .object({
    commonName: z.string(),
    hubNaptanCode: z.string().optional(),
    icsCode: z.string().optional(),
    id: z.string(),
    lat: z.number().optional(),
    lines: z.array(IdentifierSchema).optional().default([]),
    lon: z.number().optional(),
    modes: z.array(z.string()).optional().default([]),
    naptanId: z.string().optional(),
    placeType: z.string().optional(),
    stationNaptan: z.string().optional(),
    stopType: z.string().optional(),
  })
  .passthrough();

export const StopPointSchema = z
  .object({
    children: z.array(StopPointChildSchema).optional().default([]),
    commonName: z.string(),
    hubNaptanCode: z.string().optional(),
    icsCode: z.string().optional(),
    id: z.string(),
    lat: z.number().optional(),
    lines: z.array(IdentifierSchema).optional().default([]),
    lon: z.number().optional(),
    modes: z.array(z.string()).optional().default([]),
    naptanId: z.string().optional(),
    placeType: z.string().optional(),
    stationNaptan: z.string().optional(),
    stopType: z.string().optional(),
  })
  .passthrough();

export const PredictionSchema = z
  .object({
    currentLocation: z.string().optional(),
    destinationName: z.string().optional(),
    direction: z.string().optional(),
    expectedArrival: z.string(),
    lineId: z.string(),
    lineName: z.string(),
    modeName: z.string().optional(),
    naptanId: z.string(),
    platformName: z.string().optional(),
    stationName: z.string(),
    timeToStation: z.number(),
    towards: z.string().optional(),
  })
  .passthrough();

export const JourneyPointSchema = z
  .object({
    commonName: z.string(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    naptanId: z.string().optional(),
  })
  .passthrough();

export const JourneyRouteOptionSchema = z
  .object({
    direction: z.string().optional(),
    directions: z.array(z.string()).optional().default([]),
    name: z.string().optional(),
  })
  .passthrough();

export const JourneyLegSchema = z
  .object({
    arrivalPoint: JourneyPointSchema,
    arrivalTime: z.string(),
    departurePoint: JourneyPointSchema,
    departureTime: z.string(),
    distance: z.number().optional(),
    disruptions: z.array(DisruptionSchema).optional().default([]),
    duration: z.number(),
    instruction: z
      .object({
        detailed: z.string().optional(),
        summary: z.string(),
      })
      .passthrough(),
    mode: z
      .object({
        id: z.string(),
        name: z.string().optional(),
      })
      .passthrough(),
    plannedWorks: z.array(DisruptionSchema).optional().default([]),
    routeOptions: z.array(JourneyRouteOptionSchema).optional().default([]),
  })
  .passthrough();

export const JourneyFareSchema = z
  .object({
    fares: z
      .array(
        z
          .object({
            cost: z.number(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
    totalCost: z.number().optional(),
  })
  .passthrough();

export const JourneySchema = z
  .object({
    arrivalDateTime: z.string(),
    duration: z.number(),
    fare: JourneyFareSchema.optional(),
    journeys: z.never().optional(),
    legs: z.array(JourneyLegSchema),
    startDateTime: z.string(),
  })
  .passthrough();

export const ItineraryResultSchema = z
  .object({
    journeys: z.array(JourneySchema),
    lines: z.array(LineSchema).optional().default([]),
    stopMessages: z.array(z.string()).optional().default([]),
  })
  .passthrough();

export const DisambiguationOptionSchema = z
  .object({
    matchQuality: z.number().optional(),
    parameterValue: z.string(),
    place: z
      .object({
        commonName: z.string(),
        lat: z.number().optional(),
        lon: z.number().optional(),
        placeType: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const DisambiguationSchema = z
  .object({
    disambiguationOptions: z.array(DisambiguationOptionSchema).optional().default([]),
    matchStatus: z.string().optional(),
  })
  .passthrough();

export const DisambiguationResultSchema = z
  .object({
    fromLocationDisambiguation: DisambiguationSchema.optional(),
    toLocationDisambiguation: DisambiguationSchema.optional(),
    viaLocationDisambiguation: DisambiguationSchema.optional(),
  })
  .passthrough();

export const PlacesResponseSchema = z
  .object({
    centrePoint: z.array(z.number()).optional(),
    places: z.array(
      z
        .object({
          additionalProperties: z.array(AdditionalPropertySchema).optional().default([]),
          commonName: z.string(),
          distance: z.number().optional(),
          id: z.string(),
          lat: z.number().optional(),
          lon: z.number().optional(),
          placeType: z.string().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const PostcodeLookupSchema = z
  .object({
    result: z.object({
      latitude: z.number(),
      longitude: z.number(),
      postcode: z.string(),
    }),
    status: z.number(),
  })
  .passthrough();
