import type { Command } from 'commander';

import { resolveLineHex } from '../lib/colours.js';
import { DEFAULT_STATUS_MODES, VALID_STATUS_MODES } from '../lib/constants.js';
import { parseCsvOption, validateAllowedValues } from '../lib/commandUtils.js';
import { resolveStatusLineInput } from '../lib/lineAliases.js';
import { runCommand, withGlobalOutputOptions } from '../lib/output.js';

import type { DisruptionData } from '../lib/types.js';
import type { TextFormatterContext } from '../lib/output.js';
import type { TflClient } from '../providers/tflClient.js';

type DisruptionsCommandOptions = {
  json?: boolean;
  mode?: string[];
  text?: boolean;
};

export const registerDisruptionsCommand = (program: Command, tflClient: TflClient): void => {
  program
    .command('disruptions')
    .description('List current rail disruptions for supported TfL modes.')
    .argument('[line]', 'Optional line alias, for example "victoria" or "elizabeth"')
    .option(
      '--mode <modes>',
      `Comma-separated rail modes. Valid values: ${VALID_STATUS_MODES.join(', ')}`,
      parseCsvOption,
    )
    .option('--json', 'Force JSON output')
    .option('--text', 'Force text output')
    .addHelpText('after', '\nOnly rail modes are supported here in v1. Bus service status is out of scope.')
    .action(async (line: string | undefined, options: DisruptionsCommandOptions, command: Command) => {
      await runCommand(
        'disruptions',
        withGlobalOutputOptions(command, options),
        async () => {
          if (line) {
            const lineIds = resolveStatusLineInput(line);
            const disruptions = deduplicateDisruptions(await tflClient.getDisruptionsByIds(lineIds));

            return {
              disruptions: disruptions.map((disruption) => ({
                category: disruption.category,
                closureText: disruption.closureText,
                description: disruption.description,
                lastUpdated: disruption.lastUpdate ?? disruption.created,
                type: disruption.type,
              })),
              requestedLines: lineIds,
            } satisfies DisruptionData;
          }

          const requestedModes = validateAllowedValues(
            options.mode ?? [...DEFAULT_STATUS_MODES],
            VALID_STATUS_MODES,
            'mode',
          );
          const disruptions = deduplicateDisruptions(await tflClient.getDisruptionsByModes(requestedModes));

          return {
            disruptions: disruptions.map((disruption) => ({
              category: disruption.category,
              closureText: disruption.closureText,
              description: disruption.description,
              lastUpdated: disruption.lastUpdate ?? disruption.created,
              type: disruption.type,
            })),
            requestedModes,
          } satisfies DisruptionData;
        },
        formatDisruptionsText,
      );
    });
};

const deduplicateDisruptions = <
  TDisruption extends {
    category?: string | undefined;
    closureText?: string | undefined;
    created?: string | undefined;
    description: string;
    lastUpdate?: string | undefined;
    type?: string | undefined;
  },
>(
  disruptions: TDisruption[],
): TDisruption[] =>
  Array.from(
    new Map(
      disruptions.map((disruption) => [
        [disruption.category, disruption.closureText, disruption.description, disruption.type].join('|'),
        disruption,
      ]),
    ).values(),
  );

const formatDisruptionsText = (data: DisruptionData, context: TextFormatterContext): string => {
  if (data.disruptions.length === 0) {
    return 'No current disruptions.';
  }

  return data.disruptions
    .map((disruption) => {
      const parsedDisruption = parseDisruptionDescription(disruption.description);

      if (!parsedDisruption) {
        return context.text
          .wrapText(disruption.description, {
            continuationIndent: '  ',
            firstIndent: '',
            width: context.terminalWidth,
          })
          .map((line) => context.text.style.dim(line))
          .join('\n');
      }

      const label = context.text.style.line(
        context.text.style.bold(parsedDisruption.lineLabel),
        parsedDisruption.lineLabel,
      );
      const descriptionLines = context.text
        .wrapText(parsedDisruption.description, {
          continuationIndent: '  ',
          firstIndent: '  ',
          width: context.terminalWidth,
        })
        .map((line) => context.text.style.dim(line));

      return [label, ...descriptionLines].join('\n');
    })
    .join('\n\n');
};

const parseDisruptionDescription = (
  value: string,
): { description: string; lineLabel: string } | undefined => {
  const match = value.match(/^(?<lineLabel>.+?)(?:\s+Line)?:\s+(?<description>.+)$/i);
  const lineLabel = match?.groups?.['lineLabel']?.trim();
  const description = match?.groups?.['description']?.trim();

  if (!lineLabel || !description || !resolveLineHex(lineLabel)) {
    return undefined;
  }

  return {
    description,
    lineLabel,
  };
};
