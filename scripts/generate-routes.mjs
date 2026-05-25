import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const sourcePath = resolve("C:/Users/cmcga/IdeaProjects/dsum-timer/src/main/java/com/com/dsum/model/Route.java");
const speciesPath = resolve("C:/Users/cmcga/IdeaProjects/dsum-timer/src/main/java/com/com/dsum/model/Species.java");
const outputPath = resolve("src/data/routes.ts");

const speciesDex = loadSpeciesDex();
const raw = readFileSync(sourcePath, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

const enumStart = raw.indexOf("public enum Route");
const bodyStart = raw.indexOf("{", enumStart);
const fieldsStart = raw.search(/;\s*private final String name/);
if (enumStart < 0 || bodyStart < 0 || fieldsStart < 0) {
  throw new Error("Could not find Route enum body.");
}

const enumBody = raw.slice(bodyStart + 1, fieldsStart);
const routes = [];
let cursor = 0;

while (cursor < enumBody.length) {
  const match = /\b([A-Z][A-Z0-9_]*)\s*\(/g;
  match.lastIndex = cursor;
  const idMatch = match.exec(enumBody);
  if (!idMatch) {
    break;
  }

  const id = idMatch[1];
  const openParen = enumBody.indexOf("(", idMatch.index);
  let depth = 0;
  let end = -1;
  for (let i = openParen; i < enumBody.length; i++) {
    const ch = enumBody[i];
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) {
    throw new Error(`Could not parse route ${id}.`);
  }

  const args = enumBody.slice(openParen + 1, end);
  routes.push(parseRoute(id, args));
  cursor = end + 1;
}

const source = `import type { RouteData } from "../model/types";

// Generated from C:/Users/cmcga/IdeaProjects/dsum-timer/src/main/java/com/com/dsum/model/Route.java
// Re-run \`node scripts/generate-routes.mjs\` after changing the Java route table.
export const ROUTES: RouteData[] = ${JSON.stringify(routes, null, 2)};

export const ROUTES_BY_ID = new Map(ROUTES.map((route) => [route.id, route]));
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, source);

function parseRoute(id, args) {
  const nameMatch = args.match(/^\s*"([^"]*)"\s*,\s*/);
  if (!nameMatch) {
    throw new Error(`Route ${id} has no display name.`);
  }

  let rest = args.slice(nameMatch[0].length);
  let isBlinds = false;
  let encounterRate = 25;

  const settingsMatch = rest.match(/^\s*(true|false)\s*,\s*(\d+)\s*,\s*/);
  if (settingsMatch) {
    isBlinds = settingsMatch[1] === "true";
    encounterRate = Number(settingsMatch[2]);
    rest = rest.slice(settingsMatch[0].length);
  }

  const encounters = [];
  for (const match of rest.matchAll(/of\(\s*([A-Za-z0-9_]+)\s*,\s*(\d+)\s*\)/g)) {
    const rawSpecies = match[1];
    const dex = speciesDex.get(rawSpecies);
    if (dex == null) {
      throw new Error(`Unknown species ${rawSpecies} in route ${id}.`);
    }
    encounters.push({ species: displaySpecies(rawSpecies), dex, level: Number(match[2]) });
  }
  if (![10, 20, 30].includes(encounters.length)) {
    throw new Error(`Route ${id} has ${encounters.length} encounters; expected 10, 20, or 30.`);
  }

  const first = encounters.slice(0, 10);
  const second = encounters.slice(10, 20);
  const third = encounters.slice(20, 30);

  return {
    id,
    name: nameMatch[1],
    isBlinds,
    encounterRate,
    encounters: {
      BLUE: encounters.length === 30 ? first : first,
      RED: encounters.length === 30 ? second : first,
      YELLOW: encounters.length === 10 ? [] : encounters.length === 20 ? second : third,
    },
  };
}

function displaySpecies(species) {
  return species
    .replace("NidoranF", "Nidoran F")
    .replace("NidoranM", "Nidoran M")
    .replace("Mr_Mime", "Mr. Mime")
    .replace("Farfetchd", "Farfetch'd");
}

function loadSpeciesDex() {
  const speciesRaw = readFileSync(speciesPath, "utf8");
  const bodyStart = speciesRaw.indexOf("{");
  const bodyEnd = speciesRaw.indexOf("}", bodyStart);
  if (bodyStart < 0 || bodyEnd < 0) {
    throw new Error("Could not find Species enum body.");
  }

  const names = speciesRaw
    .slice(bodyStart + 1, bodyEnd)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/;.*/, "").trim())
    .filter(Boolean);

  return new Map(names.map((name, index) => [name, index + 1]));
}
