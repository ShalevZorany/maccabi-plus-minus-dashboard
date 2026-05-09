export default function handler(_request, response) {
  response.status(409).json({
    error: "Manual import is disabled in production. Data updates automatically on each dashboard reload."
  });
}
