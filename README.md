# tfl-cli

Transport for London in your terminal, built for agents first and still pleasant for humans.

```bash
tfl status
tfl route "waterloo" "king's cross"
tfl arrivals "waterloo"
tfl bikes "SE1 9SG"
```

## Install

```bash
npm install
npm run build
```

For local development:

```bash
npm run dev -- --help
```

## Env Setup

Create a local `.env` with:

```bash
TFL_APP_KEY=your_tfl_primary_key
```

## Auth And Rate Limits

`tfl-cli` works without any credentials. If no `TFL_APP_KEY` is present, it falls back to anonymous TfL API requests.

That is enough for casual use and local testing. If you want higher rate limits, register for your own TfL API credentials and set your primary key as `TFL_APP_KEY` locally:

https://api-portal.tfl.gov.uk/

## Commands

| Command | Purpose |
| --- | --- |
| `tfl status [line]` | Rail line status snapshot |
| `tfl disruptions [line]` | Current rail disruptions |
| `tfl route <from> <to>` | Journey planning |
| `tfl arrivals <stop>` | Live arrivals for a stop or station |
| `tfl search stops <query>` | Explicit stop and station lookup |
| `tfl bikes <location>` | Nearby Santander bike points |

`status` and `disruptions` are rail-focused in v1 and support `tube`, `overground`, `dlr`, and `elizabeth-line`.

## Agent Usage

The CLI defaults to text in a TTY and JSON when piped.

```bash
tfl route "SE1 9SG" "EC2R 8AH" --json
tfl arrivals "king's cross" | jq
```

Every JSON response uses a stable envelope with `ok`, `schemaVersion`, `command`, `requestedAt`, and either `data` or `error`.

## OpenClaw Note

The future OpenClaw skill should call this CLI rather than reimplement the transport logic.
