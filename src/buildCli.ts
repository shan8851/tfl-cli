import { createRequire } from 'node:module';

import { Command } from 'commander';

import { registerArrivalsCommand } from './commands/arrivalsCommand.js';
import { registerBikesCommand } from './commands/bikesCommand.js';
import { registerDisruptionsCommand } from './commands/disruptionsCommand.js';
import { registerRouteCommand } from './commands/routeCommand.js';
import { registerSearchStopsCommand } from './commands/searchStopsCommand.js';
import { registerStatusCommand } from './commands/statusCommand.js';
import { loadConfig } from './lib/config.js';
import { createPostcodesClient } from './providers/postcodesClient.js';
import { createTflClient } from './providers/tflClient.js';

import type { PostcodesClient } from './providers/postcodesClient.js';
import type { TflClient } from './providers/tflClient.js';

export type CliDependencies = {
  postcodesClient: PostcodesClient;
  tflClient: TflClient;
};

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };
const TOP_LEVEL_HELP_EXAMPLES = [
  'tfl status jubilee',
  'tfl route "SE1 9SG" "king\'s cross"',
  'tfl route "waterloo" "bank" --arrive-by --time 09:00',
  'tfl arrivals "waterloo" --limit 5',
  'tfl bikes "SE1 9SG" --radius 750',
  'tfl route "SE1 9SG" "EC2R 8AH" --output journeys.0.durationMinutes',
].join('\n  ');

export const buildCli = (dependencies?: CliDependencies): Command => {
  const config = loadConfig();
  const tflClient = dependencies?.tflClient ?? createTflClient(config);
  const postcodesClient = dependencies?.postcodesClient ?? createPostcodesClient();
  const program = new Command();

  program
    .name('tfl')
    .description('Transport for London CLI for agents and humans')
    .option('--no-color', 'Disable ANSI colours in text output')
    .showHelpAfterError()
    .showSuggestionAfterError()
    .version(packageJson.version);

  registerStatusCommand(program, tflClient);
  registerDisruptionsCommand(program, tflClient);
  registerRouteCommand(program, tflClient, postcodesClient);
  registerArrivalsCommand(program, tflClient);
  registerSearchStopsCommand(program, tflClient);
  registerBikesCommand(program, tflClient, postcodesClient);

  program.addHelpText(
    'after',
    `\nOutput defaults to text in a TTY and JSON when piped. Use --json or --text to override.\n\nExamples:\n  ${TOP_LEVEL_HELP_EXAMPLES}`,
  );

  return program;
};
