import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateSeason } from "../src/calculate.mjs";

export default function handler(_request, response) {
  const data = JSON.parse(readFileSync(resolve(process.cwd(), "data", "matches.json"), "utf8"));
  response.status(200).json(calculateSeason(data.matches).players);
}
