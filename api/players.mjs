import { calculateSeason } from "../src/calculate.mjs";
import { getRuntimeData } from "./_runtime-data.mjs";

export default async function handler(_request, response) {
  const { data } = await getRuntimeData();
  response.status(200).json(calculateSeason(data.matches).players);
}
