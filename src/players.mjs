export function normalizeName(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function playerKey(name) {
  return normalizeName(name).toLocaleLowerCase("en-US");
}

export function playerId(name) {
  const normalized = normalizeName(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "unknown-player";
}

export function playerFrom(value) {
  if (typeof value === "string") {
    return { name: normalizeName(value), id: playerId(value) };
  }

  const name = normalizeName(value?.name);
  return {
    ...value,
    name,
    id: value?.id || playerId(name)
  };
}

export function uniquePlayers(players) {
  const byKey = new Map();
  for (const player of players.map(playerFrom)) {
    if (!player.name) continue;
    const key = playerKey(player.name);
    byKey.set(key, { ...byKey.get(key), ...player });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}
