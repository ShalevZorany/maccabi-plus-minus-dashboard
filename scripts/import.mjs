import { importFromMaccabi } from "../src/importers/maccabi-importer.mjs";
import { writeData } from "../src/storage.mjs";
import { calculateSeason } from "../src/calculate.mjs";

const data = await importFromMaccabi();
await writeData(data);
const totals = calculateSeason(data.matches).totals;

console.log(`Imported ${totals.matches} league matches.`);
console.log(`Finished: ${totals.finished}. Complete for calculation: ${totals.complete}. Players: ${totals.players}.`);
if (data.importStatus.warnings?.length) {
  console.log("Warnings:");
  for (const warning of data.importStatus.warnings) console.log(`- ${warning}`);
}
