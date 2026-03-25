import type { Command } from 'commander';

import { ensurePositiveInteger, formatEta, parseIntegerOption, validateAllowedValues } from '../lib/commandUtils.js';
import { VALID_ROUTE_DIRECTIONS } from '../lib/constants.js';
import { resolveStatusLineInput } from '../lib/lineAliases.js';
import { resolveArrivalLocation } from '../lib/locationResolver.js';
import { runCommand, withGlobalOutputOptions } from '../lib/output.js';

import type { ArrivalData } from '../lib/types.js';
import type { TextFormatterContext } from '../lib/output.js';
import type { TflClient } from '../providers/tflClient.js';

const ARRIVALS_OUTPUT_EXAMPLES = ['arrivals.0.lineName', 'arrivals.0.timeToStationSeconds'];
const ARRIVALS_HELP_EXAMPLES = [
  'tfl arrivals "waterloo"',
  'tfl arrivals "king\'s cross" --line northern --limit 5',
  'tfl arrivals "waterloo" --output arrivals.0.timeToStationSeconds',
].join('\n  ');

type ArrivalsCommandOptions = {
  direction?: string;
  json?: boolean;
  limit?: number;
  line?: string;
  output?: string;
  text?: boolean;
};

export const registerArrivalsCommand = (program: Command, tflClient: TflClient): void => {
  program
    .command('arrivals')
    .description('Get live arrivals for a stop or station.')
    .argument('<stop>', 'Stop or station name, id, hub id, postcode, or coordinates')
    .option('--line <line>', 'Optional line alias to filter arrivals')
    .option(
      '--direction <direction>',
      `Optional direction filter. Valid values: ${VALID_ROUTE_DIRECTIONS.join(', ')}`,
    )
    .option('--limit <count>', 'Maximum number of arrivals to return', parseIntegerOption, 10)
    .option('--output <path>', 'Project a single value or subtree by dot path')
    .option('--json', 'Force JSON output')
    .option('--text', 'Force text output')
    .addHelpText('after', `\nExamples:\n  ${ARRIVALS_HELP_EXAMPLES}`)
    .action(async (stop: string, options: ArrivalsCommandOptions, command: Command) => {
      await runCommand(
        'arrivals',
        withGlobalOutputOptions(command, options),
        async () => {
          const limit = ensurePositiveInteger(options.limit ?? 10, 'limit');
          const direction = options.direction
            ? validateAllowedValues([options.direction], VALID_ROUTE_DIRECTIONS, 'direction')[0]
            : undefined;
          const lineIds = options.line ? resolveStatusLineInput(options.line) : undefined;
          const resolvedStop = await resolveArrivalLocation(
            tflClient,
            stop,
            lineIds?.length === 1 ? lineIds[0] : undefined,
          );
          const arrivals = lineIds
            ? await tflClient.getStopPointArrivalsByLines(lineIds, resolvedStop.stopPointId, direction)
            : await tflClient.getStopPointArrivals(resolvedStop.stopPointId);

          return {
            arrivals: arrivals
              .sort((left, right) => left.timeToStation - right.timeToStation)
              .slice(0, limit)
              .map((arrival) => ({
                currentLocation: arrival.currentLocation,
                destinationName: arrival.destinationName,
                direction: arrival.direction,
                expectedArrival: arrival.expectedArrival,
                lineId: arrival.lineId,
                lineName: arrival.lineName,
                platformName: arrival.platformName,
                timeToStationSeconds: arrival.timeToStation,
                towards: arrival.towards,
              })),
            filters: {
              direction,
              line: options.line,
            },
            stop: {
              ...resolvedStop.location,
              id: resolvedStop.stopPointId,
            },
          } satisfies ArrivalData;
        },
        formatArrivalsText,
        {
          projectionExamples: ARRIVALS_OUTPUT_EXAMPLES,
        },
      );
    });
};

const formatArrivalsText = (data: ArrivalData, context: TextFormatterContext): string => {
  if (data.arrivals.length === 0) {
    return `No live arrivals currently available for ${data.stop.label}.`;
  }

  const lineNameWidth = Math.max(...data.arrivals.map((arrival) => arrival.lineName.length));

  const lines = data.arrivals.map((arrival) => {
    const destination = arrival.destinationName ?? arrival.towards ?? 'Unknown destination';
    const lineLabel = context.text.style.line(
      context.text.padVisibleEnd(arrival.lineName, lineNameWidth),
      arrival.lineId,
    );
    const destinationLabel = context.text.style.white(destination);
    const platformLabel = arrival.platformName
      ? context.text.style.dim(`  ${arrival.platformName}`)
      : '';
    const etaLabel = context.text.style.bold(formatEta(arrival.timeToStationSeconds));
    const leftColumn = `${lineLabel}  ${destinationLabel}${platformLabel}`;

    return formatArrivalRow(leftColumn, etaLabel, context);
  });

  return [context.text.style.bold(data.stop.label), ...lines].join('\n');
};

const formatArrivalRow = (
  leftColumn: string,
  etaLabel: string,
  context: TextFormatterContext,
): string => {
  const combinedWidth = context.text.visibleWidth(leftColumn) + context.text.visibleWidth(etaLabel) + 2;

  if (combinedWidth <= context.terminalWidth) {
    return context.text.joinAligned(leftColumn, etaLabel, context.terminalWidth);
  }

  return `${leftColumn}  ${etaLabel}`;
};
