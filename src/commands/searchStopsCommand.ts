import type { Command } from 'commander';

import { ensurePositiveInteger, parseIntegerOption } from '../lib/commandUtils.js';
import { searchStopCandidates } from '../lib/locationResolver.js';
import { runCommand } from '../lib/output.js';

import type { SearchStopsData } from '../lib/types.js';
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
    .action(async (query: string, options: SearchStopsCommandOptions) => {
      await runCommand(
        'search stops',
        options,
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

const formatSearchStopsText = (data: SearchStopsData): string => {
  if (data.candidates.length === 0) {
    return `No stop matches for "${data.query}".`;
  }

  return data.candidates
    .map((candidate) => {
      const zone = candidate.zone ? ` zone ${candidate.zone}` : '';
      return `${candidate.name} (${candidate.id}) [${candidate.modes.join(', ')}]${zone}`;
    })
    .join('\n');
};
