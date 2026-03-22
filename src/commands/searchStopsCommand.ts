import type { Command } from 'commander';

import { RAIL_MODES } from '../lib/constants.js';
import { ensurePositiveInteger, parseIntegerOption } from '../lib/commandUtils.js';
import { searchStopCandidates } from '../lib/locationResolver.js';
import { runCommand, withGlobalOutputOptions } from '../lib/output.js';

import type { SearchStopsData } from '../lib/types.js';
import type { TextFormatterContext } from '../lib/output.js';
import type { TflClient } from '../providers/tflClient.js';

type SearchStopsCommandOptions = {
  json?: boolean;
  limit?: number;
  text?: boolean;
};

export const registerSearchStopsCommand = (program: Command, tflClient: TflClient): void => {
  const searchCommand = program.command('search').description('Search transport entities.');

  searchCommand
    .command('stops')
    .description('Search stops and stations by name.')
    .argument('<query>', 'Stop or station query')
    .option('--limit <count>', 'Maximum number of candidates to return', parseIntegerOption, 10)
    .option('--json', 'Force JSON output')
    .option('--text', 'Force text output')
    .action(async (query: string, options: SearchStopsCommandOptions, command: Command) => {
      await runCommand(
        'search stops',
        withGlobalOutputOptions(command, options),
        async () => {
          const limit = ensurePositiveInteger(options.limit ?? 10, 'limit');
          const candidates = await searchStopCandidates(tflClient, query, 'search');

          return {
            candidates: candidates.slice(0, limit).map((candidate) => ({
              id: candidate.id,
              lat: candidate.lat,
              lon: candidate.lon,
              modes: candidate.modes,
              name: candidate.name,
              score: candidate.rawScore,
              zone: candidate.zone,
            })),
            query,
          } satisfies SearchStopsData;
        },
        formatSearchStopsText,
      );
    });
};

const formatSearchStopsText = (data: SearchStopsData, context: TextFormatterContext): string => {
  if (data.candidates.length === 0) {
    return `No stop matches for "${data.query}".`;
  }

  return data.candidates
    .map((candidate) => {
      const isStationOrHub =
        candidate.id.startsWith('HUB') || candidate.modes.some((mode) => RAIL_MODES.has(mode));
      const name = isStationOrHub
        ? context.text.style.bold(candidate.name)
        : context.text.style.dim(candidate.name);
      const stopId = context.text.style.dim(`(${candidate.id})`);
      const modeTags = candidate.modes
        .map((mode) => context.text.style.mode(`[${mode}]`, mode))
        .join(' ');
      const zone = candidate.zone ? context.text.style.dim(` zone ${candidate.zone}`) : '';

      return [name, stopId, modeTags, zone].filter(Boolean).join(' ');
    })
    .join('\n');
};
