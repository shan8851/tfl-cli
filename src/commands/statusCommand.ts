import type { Command } from 'commander';

import { DEFAULT_STATUS_MODES, VALID_STATUS_MODES } from '../lib/constants.js';
import { parseCsvOption, validateAllowedValues } from '../lib/commandUtils.js';
import { resolveStatusLineInput } from '../lib/lineAliases.js';
import { runCommand, withGlobalOutputOptions } from '../lib/output.js';

import type { StatusData } from '../lib/types.js';
import type { TextFormatterContext } from '../lib/output.js';
import type { TflClient } from '../providers/tflClient.js';

type StatusCommandOptions = {
  detail?: boolean;
  json?: boolean;
  mode?: string[];
  text?: boolean;
};

export const registerStatusCommand = (program: Command, tflClient: TflClient): void => {
  program
    .command('status')
    .description('Get current rail status for supported TfL modes.')
    .argument('[line]', 'Optional line alias, for example "northern" or "overground"')
    .option(
      '--mode <modes>',
      `Comma-separated rail modes. Valid values: ${VALID_STATUS_MODES.join(', ')}`,
      parseCsvOption,
    )
    .option('--detail', 'Include TfL status detail when available')
    .option('--json', 'Force JSON output')
    .option('--text', 'Force text output')
    .addHelpText('after', '\nOnly rail modes are supported here in v1. Bus service status is out of scope.')
    .action(async (line: string | undefined, options: StatusCommandOptions, command: Command) => {
      await runCommand(
        'status',
        withGlobalOutputOptions(command, options),
        async () => {
          if (line) {
            const lineIds = resolveStatusLineInput(line);
            const lines = await tflClient.getLineStatusesByIds(lineIds, options.detail);

            return {
              lines: lines
                .map((lineStatus) => ({
                  id: lineStatus.id,
                  mode: lineStatus.modeName,
                  name: lineStatus.name,
                  statuses: lineStatus.lineStatuses.map((status) => ({
                    description: status.statusSeverityDescription,
                    lineId: status.lineId,
                    reason: status.reason,
                    severity: status.statusSeverity,
                    validFrom: status.validityPeriods.at(0)?.fromDate,
                    validTo: status.validityPeriods.at(0)?.toDate,
                  })),
                }))
                .sort((left, right) => left.name.localeCompare(right.name)),
              requestedLines: lineIds,
            } satisfies StatusData;
          }

          const requestedModes = validateAllowedValues(
            options.mode ?? [...DEFAULT_STATUS_MODES],
            VALID_STATUS_MODES,
            'mode',
          );
          const lines = await tflClient.getLineStatusesByModes(requestedModes, options.detail);

          return {
            lines: lines
              .map((lineStatus) => ({
                id: lineStatus.id,
                mode: lineStatus.modeName,
                name: lineStatus.name,
                statuses: lineStatus.lineStatuses.map((status) => ({
                  description: status.statusSeverityDescription,
                  lineId: status.lineId,
                  reason: status.reason,
                  severity: status.statusSeverity,
                  validFrom: status.validityPeriods.at(0)?.fromDate,
                  validTo: status.validityPeriods.at(0)?.toDate,
                })),
              }))
              .sort((left, right) => left.name.localeCompare(right.name)),
            requestedModes,
          } satisfies StatusData;
        },
        formatStatusText,
      );
    });
};

const formatStatusText = (data: StatusData, context: TextFormatterContext): string => {
  if (data.lines.length === 0) {
    return 'No line status data returned.';
  }

  return data.lines
    .map((line) => {
      const lineLabel = context.text.style.bold(context.text.style.line(line.name, line.id));
      const statusLines = line.statuses.flatMap((status) => {
        const description = `${getStatusEmoji(status.description)} ${status.description}`;
        const statusLine = `  ${context.text.style.status(description, status.description)}`;
        const reasonLines = status.reason
          ? context.text
              .wrapText(status.reason.trim(), {
                continuationIndent: '    ',
                firstIndent: '    ',
                width: context.terminalWidth,
              })
              .map((reasonLine) => context.text.style.dim(reasonLine))
          : [];

        return [statusLine, ...reasonLines];
      });

      return [lineLabel, ...statusLines].join('\n');
    })
    .join('\n\n');
};

const getStatusEmoji = (value: string): string => {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'good service') {
    return '✅';
  }

  if (
    normalizedValue === 'part closure' ||
    normalizedValue === 'part suspended' ||
    normalizedValue === 'severe delays' ||
    normalizedValue === 'suspended'
  ) {
    return '🔴';
  }

  return '⚠️';
};
