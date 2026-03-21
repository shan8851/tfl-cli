import type { Command } from 'commander';

import { VALID_ROUTE_ACCESSIBILITY, VALID_ROUTE_ACCESSIBILITY_QUERY_VALUES, VALID_ROUTE_MODES, VALID_ROUTE_PREFERENCES, VALID_ROUTE_PREFERENCE_QUERY_VALUES } from '../lib/constants.js';
import { createAppError } from '../lib/errors.js';
import { ensurePositiveInteger, formatDurationMinutes, formatIsoTime, formatPence, normalizeDateInput, normalizeTimeInput, parseCsvOption, parseIntegerOption, validateAllowedValues } from '../lib/commandUtils.js';
import { resolveRouteLocation } from '../lib/locationResolver.js';
import { runCommand } from '../lib/output.js';

import type { RouteData } from '../lib/types.js';
import type { PostcodesClient } from '../providers/postcodesClient.js';
import type { TflClient } from '../providers/tflClient.js';

type RouteCommandOptions = {
  accessibility?: string[];
  arriveBy?: boolean;
  date?: string;
  json?: boolean;
  maxWalkMinutes?: number;
  mode?: string[];
  preference?: string;
  text?: boolean;
  time?: string;
  via?: string;
};

export const registerRouteCommand = (
  program: Command,
  tflClient: TflClient,
  postcodesClient: PostcodesClient,
): void => {
  program
    .command('route')
    .description('Plan a journey through TfL Journey Planner.')
    .argument('<from>', 'Origin')
    .argument('<to>', 'Destination')
    .option('--via <location>', 'Optional via point')
    .option('--arrive-by', 'Treat the supplied time as an arrival time')
    .option('--date <date>', 'Journey date in YYYY-MM-DD format')
    .option('--time <time>', 'Journey time in HH:MM format')
    .option('--mode <modes>', `Comma-separated journey modes. Common values: ${VALID_ROUTE_MODES.join(', ')}`, parseCsvOption)
    .option(
      '--preference <preference>',
      `Journey preference. Valid values: ${VALID_ROUTE_PREFERENCES.join(', ')}`,
    )
    .option(
      '--accessibility <values>',
      `Comma-separated accessibility preferences. Valid values: ${VALID_ROUTE_ACCESSIBILITY.join(', ')}`,
      parseCsvOption,
    )
    .option('--max-walk-minutes <minutes>', 'Maximum walking minutes', parseIntegerOption)
    .option('--json', 'Force JSON output')
    .option('--text', 'Force text output')
    .action(async (from: string, to: string, options: RouteCommandOptions) => {
      await runCommand(
        'route',
        options,
        async () => {
          const routeModes = options.mode
            ? validateAllowedValues(options.mode, VALID_ROUTE_MODES, 'mode')
            : undefined;
          const preference = options.preference
            ? validateAllowedValues([options.preference], VALID_ROUTE_PREFERENCES, 'preference')[0]
            : undefined;
          const accessibilityPreferences = options.accessibility
            ? validateAllowedValues(options.accessibility, VALID_ROUTE_ACCESSIBILITY, 'accessibility')
            : undefined;
          const maxWalkingMinutes =
            typeof options.maxWalkMinutes === 'number'
              ? ensurePositiveInteger(options.maxWalkMinutes, 'max-walk-minutes')
              : undefined;
          const fromLocation = await resolveRouteLocation(tflClient, postcodesClient, from);
          const toLocation = await resolveRouteLocation(tflClient, postcodesClient, to);
          const viaLocation = options.via
            ? await resolveRouteLocation(tflClient, postcodesClient, options.via)
            : undefined;
          const accessibilityPreferenceValues = accessibilityPreferences?.map(
            (value) =>
              VALID_ROUTE_ACCESSIBILITY_QUERY_VALUES[
                value as keyof typeof VALID_ROUTE_ACCESSIBILITY_QUERY_VALUES
              ],
          );
          const preferenceValue = preference
            ? VALID_ROUTE_PREFERENCE_QUERY_VALUES[
                preference as keyof typeof VALID_ROUTE_PREFERENCE_QUERY_VALUES
              ]
            : undefined;
          const normalizedDate = normalizeDateInput(options.date);
          const normalizedTime = normalizeTimeInput(options.time);
          const journeyResult = await tflClient.getJourneyResults({
            ...(accessibilityPreferenceValues ? { accessibilityPreferences: accessibilityPreferenceValues } : {}),
            ...(normalizedDate ? { date: normalizedDate } : {}),
            timeIs: options.arriveBy ? 'Arriving' : 'Departing',
            ...(maxWalkingMinutes ? { maxWalkingMinutes } : {}),
            ...(routeModes ? { modes: routeModes } : {}),
            ...(preferenceValue ? { preference: preferenceValue } : {}),
            ...(normalizedTime ? { time: normalizedTime } : {}),
            to: toLocation.queryValue,
            ...(viaLocation ? { via: viaLocation.queryValue } : {}),
            from: fromLocation.queryValue,
          });

          if (journeyResult.kind === 'disambiguation') {
            const toDisambiguation = journeyResult.result.toLocationDisambiguation;
            const fromDisambiguation = journeyResult.result.fromLocationDisambiguation;
            const viaDisambiguation = journeyResult.result.viaLocationDisambiguation;
            const activeDisambiguation =
              fromDisambiguation?.disambiguationOptions.length
                ? { query: from, result: fromDisambiguation }
                : toDisambiguation?.disambiguationOptions.length
                  ? { query: to, result: toDisambiguation }
                  : viaDisambiguation?.disambiguationOptions.length
                    ? { query: options.via ?? 'via point', result: viaDisambiguation }
                    : undefined;

            if (!activeDisambiguation) {
              throw createAppError('NOT_FOUND', `No journey found from "${from}" to "${to}".`);
            }

            throw createAppError('AMBIGUOUS_LOCATION', `Could not confidently resolve "${activeDisambiguation.query}".`, {
              candidates: activeDisambiguation.result.disambiguationOptions.slice(0, 5).map((candidate) => ({
                id: candidate.parameterValue,
                modes: [candidate.place.placeType ?? 'unknown'],
                name: candidate.place.commonName,
              })),
              query: activeDisambiguation.query,
            });
          }

          return {
            from: fromLocation.location,
            journeys: journeyResult.result.journeys.map((journey) => ({
              arrivalTime: journey.arrivalDateTime,
              departureTime: journey.startDateTime,
              durationMinutes: journey.duration,
              farePence: journey.fare?.totalCost ?? journey.fare?.fares.at(0)?.cost,
              legs: journey.legs.map((leg) => ({
                arrivalTime: leg.arrivalTime,
                departureTime: leg.departureTime,
                destination: leg.arrivalPoint.commonName,
                direction: leg.routeOptions.at(0)?.direction,
                distanceMeters: leg.distance,
                durationMinutes: leg.duration,
                lineName: leg.routeOptions.find((routeOption) => Boolean(routeOption.name))?.name,
                mode: leg.mode.name ?? leg.mode.id,
                origin: leg.departurePoint.commonName,
                summary: leg.instruction.summary,
              })),
            })),
            stopMessages: journeyResult.result.stopMessages,
            to: toLocation.location,
          } satisfies RouteData;
        },
        formatRouteText,
      );
    });
};

const formatRouteText = (data: RouteData): string => {
  if (data.journeys.length === 0) {
    return `No journeys found from ${data.from.label} to ${data.to.label}.`;
  }

  return data.journeys
    .slice(0, 3)
    .map((journey, index) => {
      const header = [
        `Option ${index + 1}`,
        `${formatDurationMinutes(journey.durationMinutes)}`,
        `${formatIsoTime(journey.departureTime)} to ${formatIsoTime(journey.arrivalTime)}`,
        journey.farePence ? formatPence(journey.farePence) : undefined,
      ]
        .filter(Boolean)
        .join(' | ');

      const legs = journey.legs.map((leg) => {
        const direction = leg.direction ? ` | ${leg.direction}` : '';
        return `- ${leg.summary} | ${leg.origin} to ${leg.destination} | ${formatDurationMinutes(leg.durationMinutes)}${direction}`;
      });

      return [header, ...legs].join('\n');
    })
    .join('\n\n');
};
