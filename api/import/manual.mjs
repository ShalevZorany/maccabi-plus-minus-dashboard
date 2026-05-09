export default function handler(_request, response) {
  response.status(501).json({
    error: "Manual import is local-only in this Vercel build. Import locally, verify the data, then commit data/matches.json."
  });
}
