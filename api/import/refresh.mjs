export default function handler(_request, response) {
  response.status(501).json({
    error: "Production import is read-only on Vercel. Run npm run import locally and commit data/matches.json to publish a refreshed snapshot."
  });
}
