export const DSUM_RANGE = 256;

export type Game = "RED" | "BLUE" | "YELLOW";

export interface Encounter {
  species: string;
  dex: number;
  level: number;
}

export interface RouteData {
  id: string;
  name: string;
  isBlinds: boolean;
  games: Game[];
  encounterRates: Partial<Record<Game, number>>;
  encounters: Partial<Record<Game, Encounter[]>>;
}

export interface SelectionConfig {
  game: Game;
  routeId: string;
  targets: Set<number>;
  leadLevel: number;
  threshold: number;
  pikaLead: boolean;
}

export const GAMES: Array<{ id: Game; name: string }> = [
  { id: "RED", name: "Red" },
  { id: "BLUE", name: "Blue" },
  { id: "YELLOW", name: "Yellow" },
];

export const ENCOUNTER_SLOTS = [
  { id: 0, label: "1", min: 0, max: 50 },
  { id: 1, label: "2", min: 51, max: 101 },
  { id: 2, label: "3", min: 102, max: 140 },
  { id: 3, label: "4", min: 141, max: 165 },
  { id: 4, label: "5", min: 166, max: 190 },
  { id: 5, label: "6", min: 191, max: 215 },
  { id: 6, label: "7", min: 216, max: 228 },
  { id: 7, label: "8", min: 229, max: 241 },
  { id: 8, label: "9", min: 242, max: 252 },
  { id: 9, label: "10", min: 253, max: 255 },
] as const;

export type EncounterExitStrategy =
  | "PLAYER_GOT_AWAY"
  | "POKEMON_RAN"
  | "POKEMON_JOINED_PARTY"
  | "POKEMON_NICKNAMED_JOINED_PARTY"
  | "POKEMON_SENT_TO_BOX";
