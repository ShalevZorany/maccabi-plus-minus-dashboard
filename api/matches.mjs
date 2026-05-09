import { calculateSeason } from "../src/calculate.mjs";
import { getRuntimeData } from "./_runtime-data.mjs";

export default async function handler(_request, response) {
  const { data } = await getRuntimeData();
  const season = calculateSeason(data.matches);
  response.status(200).json(season.matches.map(({ playerStats, ...match }) => match));
}
