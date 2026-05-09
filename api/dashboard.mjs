import { calculateSeason } from "../src/calculate.mjs";
import { getRuntimeData } from "./_runtime-data.mjs";

export default async function handler(_request, response) {
  const { data, importPolicy } = await getRuntimeData();
  const season = calculateSeason(data.matches);
  response.status(200).json({
    generatedAt: data.generatedAt,
    sourcePolicy: data.sourcePolicy,
    importPolicy,
    importStatus: data.importStatus,
    totals: season.totals,
    players: season.players,
    matches: season.matches.map(({ playerStats, ...match }) => match)
  });
}
