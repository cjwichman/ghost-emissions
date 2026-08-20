# Ghost Emissions

A semester-long climate economics game for an undergraduate class loosely inspired by Ghost Busters. We're here to save the world. Teams run boroughs of one city, each student runs a business, and everyone shares the sky. Ghost emissions stand in for greenhouse gases, the Ether for global temperature, hauntings for damages. The model underneath is a stock pollutant with linear marginal abatement costs, quadratic damages, and a $200 per ton optimum.

Built by Casey Wichman (with the help of Claude) for ECON 4210 at Georgia Tech.

## What it is

- One decision per week for each team (the rotating mayor submits) and one short mission for each student's business.
- Twelve rounds that add one lever at a time: containment target, discount rate, budget, price vote, tax vs cap vs standard, cost shock, revenue recycling, R&D, adaptation and the Breach, the Dimmer (geoengineering), the Accord (treaty).
- A public Monday dashboard: Ether path against the cooperative path, a city map, a leaderboard.
- An instructor page: close, resolve, open, a generated summary, pre-written teaching tips and worked examples, participation and outcome exports.

## Layout

    model/        core model (pure JS) + tests + calibration report
    supabase/     schema migration, edge functions (preview, resolve_round), seed script
    web/          static front end (GitHub Pages)
    content/      rounds.json: decisions, briefings, tips, examples per round
    docs/         world sheet and calibration note

## Setup

See SETUP.md. Roughly: create the schema, deploy two edge functions, seed a class, publish `web/` to GitHub Pages, hand out the class code.

## License

MIT.
