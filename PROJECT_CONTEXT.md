# maccabicheck Context

- Local-only dashboard, no deploy and no paid services.
- Port: `3005`.
- Runtime: Node.js + Express backend, Vanilla HTML/CSS/JS frontend.
- Data storage: local JSON at `data/matches.json`.
- Automated source: Maccabi Tel Aviv official website results, fixtures, match, and lineups pages.
- IFA pages are treated as manual verification source because local direct fetches return Cloudflare `403`.
- Accuracy policy: do not infer missing lineups, substitutions, or goal minutes. Flag incomplete data and exclude it from plus/minus totals.
