export default function handler(_request, response) {
  response.status(200).json({
    ok: true,
    service: "maccabicheck",
    marker: "maccabicheck",
    runtime: "vercel"
  });
}
