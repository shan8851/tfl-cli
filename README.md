# 🚇 tfl-cli

[![npm version](https://img.shields.io/npm/v/@shan8851/tfl-cli.svg)](https://www.npmjs.com/package/@shan8851/tfl-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)

Transport for London in your terminal. Built for AI agents, still pleasant for humans.

```bash
tfl status                          # Is the Northern line running?
tfl route "waterloo" "king's cross" # How do I get there?
tfl arrivals "waterloo"             # What's coming next?
tfl disruptions                     # What's broken right now?
tfl bikes "SE1 9SG"                 # Any bikes nearby?
```

## Install

```bash
npm install -g tfl-cli
```

Or from source:

```bash
git clone https://github.com/shan8851/tfl-cli.git
cd tfl-cli
npm install && npm run build
npm link
```

## API Key (optional)

**tfl-cli works without any credentials.** Anonymous TfL API access is enough for casual use.

For higher rate limits, grab a free key from the [TfL API Portal](https://api-portal.tfl.gov.uk/) and set it:

```bash
export TFL_APP_KEY=your_key
# or add to .env in your project directory
```

## Commands

| Command | What it does |
| --- | --- |
| `tfl status [line]` | Live line status — good service, delays, closures |
| `tfl disruptions [line]` | Current disruptions with detail |
| `tfl route <from> <to>` | Journey planning between stations, postcodes, or coordinates |
| `tfl arrivals <stop>` | Next arrivals at any stop or station |
| `tfl search stops <query>` | Find stops and stations by name |
| `tfl bikes <location>` | Santander bike availability nearby |

Supports station names, postcodes (`SE1 9SG`), coordinates (`51.50,-0.12`), and TfL stop IDs.

`status` and `disruptions` cover tube, overground, DLR, and Elizabeth line.

## Agent Integration

The CLI defaults to **text in a TTY** and **JSON when piped** — no flag needed.

```bash
tfl route "SE1 9SG" "EC2R 8AH" --json    # Explicit JSON
tfl arrivals "king's cross" | jq           # Auto-JSON when piped
```

Every response uses a stable envelope:

```json
{
  "ok": true,
  "schemaVersion": 1,
  "command": "status",
  "requestedAt": "2026-03-21T22:00:00.000Z",
  "data": { ... }
}
```

Errors return `ok: false` with structured `error.code`, `error.message`, and `error.retryable` fields. Exit codes: `0` success, `2` bad input/ambiguity, `3` upstream failure, `4` internal error.

Works with [OpenClaw](https://github.com/openclaw/openclaw), Claude Desktop MCP, or any agent that can shell out.

## Examples

```bash
# Is the Jubilee line ok?
$ tfl status jubilee
Jubilee: Good Service

# Route from postcode to station
$ tfl route "SE1 9SG" "kings cross"
Walk to Waterloo (11 min)
Jubilee line to King's Cross St. Pancras (8 min)
Total: 19 min

# Next trains at Waterloo
$ tfl arrivals waterloo --limit 5
Northern  | Edgware via CX      | 2 min
Jubilee   | Stanmore             | 3 min
Bakerloo  | Harrow & Wealdstone  | 4 min
...

# Bikes near a postcode
$ tfl bikes "SE1 9SG"
Waterloo Station 3    | 15 bikes | 13 empty docks | 245m
Baylis Road           | 8 bikes  | 22 empty docks | 310m
...
```

## License

MIT
