#!/usr/bin/env node

import { buildCli } from './buildCli.js';

await buildCli().parseAsync(process.argv);
