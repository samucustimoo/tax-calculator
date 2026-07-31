# Global Tax & Duty Calculator

React app that estimates, for 142 countries, in USD:

- **VAT / GST / sales tax** — standard + reduced rates, add-tax or extract-tax modes
- **Import charges** — duty estimate by product category, import VAT on (value + duty), de minimis warnings, landed cost

## Data & honesty rules

- Rates come from `src/data/rates.json`, compiled 2026-07-17 from: VATupdate global VAT table (Jan 2026), PwC Worldwide Tax Summaries, EY Worldwide VAT/GST Guide 2026, Zonos & Avalara de minimis tables, and the US CBP/White House de minimis suspension notices. Sources are listed inside the app footer.
- Anything that can't be exact (customs duty without an HS code, US/Canada/Brazil/India/China consumption taxes) is **flagged with an "Estimate" badge** and has a custom-rate override field.
- Duty is HS-code dependent in reality. The app uses typical category rates (e.g. apparel ~12%, electronics ~0–5%) and always shows the range.

## Online updates

The app works offline with its built-in rates. To enable the "always connected" update check:

1. Host a copy of `rates.json` anywhere public (GitHub repo raw URL or a Gist).
2. Paste that URL into the update field in the app footer and click **Check for updates**. The URL is remembered and checked automatically on every launch.
3. To publish new rates, edit the hosted file and bump `"version"` (it's a date string — newer date wins). Every open app picks it up next launch.

You can ask Claude anytime to re-verify rates and produce an updated `rates.json`.

## Run it

```bash
npm install
npm run dev     # development server
npm run build   # produces dist/index.html — a single self-contained file
```

The build is configured with `vite-plugin-singlefile`, so `dist/index.html` is one double-clickable file that works offline — easy to share or drop on any static host.

## Disclaimer

Estimates for planning only — actual charges depend on HS code, origin, trade agreements, carrier fees, and current surcharges (notably the 2025–26 US tariff changes). Not tax advice.
