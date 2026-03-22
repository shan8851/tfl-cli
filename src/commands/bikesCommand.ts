import type { Command } from 'commander';

import { createAppError } from '../lib/errors.js';
import { ensurePositiveInteger, parseIntegerOption } from '../lib/commandUtils.js';
import { resolveBikeOrigin } from '../lib/locationResolver.js';
import { runCommand, withGlobalOutputOptions } from '../lib/output.js';

import type { BikesData } from '../lib/types.js';
import type { TextFormatterContext } from '../lib/output.js';
import type { PostcodesClient } from '../providers/postcodesClient.js';
import type { TflClient } from '../providers/tflClient.js';

type BikesCommandOptions = {
  json?: boolean;
  limit?: number;
  radius?: number;
  text?: boolean;
};

export const registerBikesCommand = (
  program: Command,
  tflClient: TflClient,
  postcodesClient: PostcodesClient,
): void => {
  program
    .command('bikes')
    .description('Find nearby Santander bike points.')
    .argument('<location>', 'Postcode, stop, station, id, or coordinates')
    .option('--radius <metres>', 'Search radius in metres', parseIntegerOption, 500)
    .option('--limit <count>', 'Maximum number of bike points to return', parseIntegerOption, 10)
    .option('--json', 'Force JSON output')
    .option('--text', 'Force text output')
    .action(async (location: string, options: BikesCommandOptions, command: Command) => {
      await runCommand(
        'bikes',
        withGlobalOutputOptions(command, options),
        async () => {
          const radiusMeters = ensurePositiveInteger(options.radius ?? 500, 'radius');
          const limit = ensurePositiveInteger(options.limit ?? 10, 'limit');
          const origin = await resolveBikeOrigin(tflClient, postcodesClient, location);

          if (typeof origin.lat !== 'number' || typeof origin.lon !== 'number') {
            throw createAppError('NOT_FOUND', `Could not determine coordinates for "${location}".`);
          }

          const bikePoints = await tflClient.getNearbyBikePoints({
            lat: origin.lat,
            limit,
            lon: origin.lon,
            radius: radiusMeters,
          });

          return {
            bikePoints: bikePoints.places.map((place) => {
              const propertyMap = new Map(
                place.additionalProperties.map((property) => [property.key.toLowerCase(), property.value]),
              );

              return {
                bikes: toOptionalNumber(propertyMap.get('nbbikes')),
                distanceMeters: place.distance,
                docks: toOptionalNumber(propertyMap.get('nbdocks')),
                ebikes: toOptionalNumber(propertyMap.get('nbebikes')),
                emptyDocks: toOptionalNumber(propertyMap.get('nbemptydocks')),
                id: place.id,
                installed: toOptionalBoolean(propertyMap.get('installed')),
                locked: toOptionalBoolean(propertyMap.get('locked')),
                name: place.commonName,
                standardBikes: toOptionalNumber(propertyMap.get('nbstandardbikes')),
              };
            }),
            origin,
            radiusMeters,
          } satisfies BikesData;
        },
        formatBikesText,
      );
    });
};

const toOptionalNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isNaN(parsedValue) ? undefined : parsedValue;
};

const toOptionalBoolean = (value: string | undefined): boolean | undefined => {
  if (!value) {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
};

const formatBikesText = (data: BikesData, context: TextFormatterContext): string => {
  if (data.bikePoints.length === 0) {
    return `No bike points found within ${data.radiusMeters}m of ${data.origin.label}.`;
  }

  const nameWidth = Math.max(...data.bikePoints.map((bikePoint) => bikePoint.name.length));

  return data.bikePoints
    .map((bikePoint) => {
      const distance = typeof bikePoint.distanceMeters === 'number' ? `${Math.round(bikePoint.distanceMeters)}m` : 'distance unknown';
      const name = context.text.style.white(context.text.padVisibleEnd(bikePoint.name, nameWidth));
      const distanceLabel = context.text.style.dim(`(${distance})`);
      const bikes = formatBikeAvailability(bikePoint.bikes, 'bikes', context);
      const docks = formatBikeAvailability(bikePoint.emptyDocks, 'empty docks', context);

      return `${name} ${distanceLabel}  ${bikes}  ${docks}`;
    })
    .join('\n');
};

const formatBikeAvailability = (
  count: number | undefined,
  label: string,
  context: TextFormatterContext,
): string => {
  if (typeof count !== 'number') {
    return context.text.style.dim(`${label} unknown`);
  }

  const value = `${count} ${label}`;

  if (count === 0) {
    return context.text.style.danger(value);
  }

  if (count <= 5) {
    return context.text.style.warning(value);
  }

  return context.text.style.success(value);
};
