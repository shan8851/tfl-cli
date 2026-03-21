# tfl-cli — Transport for London CLI for AI Agents

## What

A CLI that gives agents (and humans) fast access to TfL data: journey planning, live tube/bus status, disruptions, bike availability. No browser, no app — just structured commands.

## Why

Every Londoner checks TfL daily. No agent skill exists for it. The API is completely open, free, no auth required, instant JSON responses. Verified working 2026-03-21.

## API

- **Base:** `https://api.tfl.gov.uk`
- **Auth:** Optional (register for app_id + app_key for higher rate limits, but works without)
- **Docs:** https://api.tfl.gov.uk/swagger/ui/index.html
- **Portal:** https://api-portal.tfl.gov.uk/

### Key endpoints (all verified working)

| Endpoint | Purpose |
|----------|---------|
| `GET /Journey/JourneyResults/{from}/to/{to}` | Route planning (lat/lon or postcode) |
| `GET /Line/Mode/tube/Status` | Live tube line status |
| `GET /Line/Mode/tube,overground,dlr,elizabeth-line/Status` | All rail status |
| `GET /Line/Mode/tube/Disruption` | Current disruptions |
| `GET /StopPoint/{id}/Arrivals` | Live arrivals at a stop |
| `GET /BikePoint` | Santander bike dock availability |
| `GET /Line/{lineId}/StopPoints` | Stops on a line |
| `GET /StopPoint/Search/{query}` | Search for stations/stops |

## Commands

```
tfl status                          # All tube lines — good service / delays / closures
tfl status northern                 # Specific line
tfl route "waterloo" "kings cross"  # Journey plan
tfl route "SE1 9SG" "EC2R 8AH"     # Postcode to postcode
tfl disruptions                     # What's broken right now
tfl arrivals "waterloo"             # Next arrivals at a station
tfl bikes near "SE1 9SG"           # Nearest bikes available
```

All commands support `--json` for agent consumption.

## Audience

- Agent operators (OpenClaw skill)
- London devs who want TfL in terminal
- Anyone building agent workflows that involve travel

## Ship plan

- core commands (status, route, disruptions, arrivals)
- saved locations, bikes, polish, npm publish, SKILL.md for OpenClaw/ClawHub
