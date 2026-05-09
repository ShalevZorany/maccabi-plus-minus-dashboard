import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateSeason } from "../src/calculate.mjs";

export default function handler(_request, response) {
  const data = JSON.parse(readFileSync(resolve(process.cwd(), "data", "matches.json"), "utf8"));
  const season = calculateSeason(data.matches);
  response.status(200).json(season.matches.map(({ playerStats, ...match }) => match));
}
