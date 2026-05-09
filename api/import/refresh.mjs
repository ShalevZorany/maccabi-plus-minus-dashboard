export default function handler(_request, response) {
  response.status(409).json({
    error: "Auto-refresh is enabled in production. Data updates automatically on every dashboard reload."
  });
}
