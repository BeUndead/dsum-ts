import { ROUTES } from "./data/routes";
import { ENCOUNTER_SLOTS, GAMES, type EncounterExitStrategy, type SelectionConfig } from "./model/types";
import { DSumDriver } from "./sim/DSumDriver";
import { DSumWheelCanvas, SLOT_COLORS } from "./ui/DSumWheelCanvas";

// @ts-ignore
const assetBase = import.meta.env.BASE_URL;
const initialGame: SelectionConfig["game"] = "RED";
const defaultRoute = routeForGame("SAFARI_ZONE_CENTER", initialGame);
const config: SelectionConfig = {
  game: initialGame,
  routeId: defaultRoute.id,
  targets: new Set([8]),
  leadLevel: 70,
  threshold: 0.1,
  pikaLead: false,
  pikaFollow: false,
  npcOnScreen: false,
};

const driver = new DSumDriver(config, (routeId) => routeForGame(routeId, config.game));
const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing #app");
}

app.innerHTML = `
  <main class="shell" id="shell">
    <details class="settings-panel" id="settings-panel" open>
      <summary>Settings</summary>
      <section class="topbar">
        <div class="field">
          <label for="game">Game</label>
          <select id="game"></select>
        </div>
        <div class="field field-route">
          <label for="route">Route</label>
          <select id="route"></select>
        </div>
        <div class="field compact">
          <label for="lead-level">Lead Lv.</label>
          <input id="lead-level" type="number" min="1" max="100" value="${config.leadLevel}">
        </div>
        <div class="field compact">
          <label for="threshold">Threshold</label>
          <input id="threshold" type="number" min="0" max="1" step="0.01" value="${config.threshold}">
        </div>
        <div class="field compact" id="pika-lead-field">
          <label>Yellow</label>
          <div class="pika-toggle-row">
            <button id="pika-lead" class="pika-lead-toggle pika-half" type="button" aria-pressed="${config.pikaLead}" title="Pika Lead">
              <img src="${assetBase}sprites/y/25.png" alt="">
              <span>Lead</span>
            </button>
            <button id="pika-follow" class="pika-lead-toggle pika-half" type="button" aria-pressed="${config.pikaFollow}" title="Pika Follow">
              <img src="${assetBase}sprites/y/25.png" alt="">
              <span>Follow</span>
            </button>
          </div>
          <button id="npc-on-screen" class="pika-lead-toggle" type="button" aria-pressed="${config.npcOnScreen}" title="On-Screen NPC">
            <span>On-Screen NPC</span>
          </button>
        </div>
      </section>
    </details>

    <section class="touch-actions">
      <button id="mobile-pause" type="button">Pause</button>
      <button id="mobile-reset" type="button">Reset</button>
    </section>

    <section class="slot-strip" id="slot-strip"></section>

    <section class="stage">
      <div class="wheel-viewport" id="wheel-viewport" title="Tap to enter battle">
        <canvas id="wheel"></canvas>
      </div>
      <aside class="panel">
        <div class="readout">
          <span>DSum</span>
          <strong id="dsum-value">0</strong>
        </div>
        <div class="readout">
          <span>Target Odds</span>
          <strong id="target-odds">0%</strong>
        </div>
        <div class="readout">
          <span>Uncertainty</span>
          <strong id="uncertainty">1</strong>
        </div>
        <div class="exit-grid">
          <button type="button" data-exit="POKEMON_JOINED_PARTY"><span class="exit-key">T</span> <span>Joined Party</span></button>
          <button type="button" data-exit="POKEMON_NICKNAMED_JOINED_PARTY"><span class="exit-key">N</span> <span>Nicknamed (party)</span></button>
          <button type="button" data-exit="POKEMON_SENT_TO_BOX"><span class="exit-key">B</span> <span>Sent to Box</span></button>
          <button type="button" data-exit="POKEMON_RAN"><span class="exit-key">R</span> <span>Pokémon Ran</span></button>
        </div>
        <div class="keys">
          <span>Space / wheel tap battle entry</span>
          <span>1-9 / 0 calibrate slot</span>
          <span>[ / ] step while paused</span>
          <span>Delete clear calibration</span>
        </div>
      </aside>
    </section>
  </main>
`;

const canvas = document.getElementById("wheel") as HTMLCanvasElement;
const wheel = new DSumWheelCanvas(canvas, driver, config);
const shell = document.getElementById("shell") as HTMLElement;
const settingsPanel = document.getElementById("settings-panel") as HTMLDetailsElement;
const wheelViewport = document.getElementById("wheel-viewport") as HTMLElement;
const gameSelect = document.getElementById("game") as HTMLSelectElement;
const routeSelect = document.getElementById("route") as HTMLSelectElement;
const leadInput = document.getElementById("lead-level") as HTMLInputElement;
const thresholdInput = document.getElementById("threshold") as HTMLInputElement;
const pikaLeadField = document.getElementById("pika-lead-field") as HTMLElement;
const pikaLeadButton = document.getElementById("pika-lead") as HTMLButtonElement;
const pikaFollowButton = document.getElementById("pika-follow") as HTMLButtonElement;
const npcOnScreenButton = document.getElementById("npc-on-screen") as HTMLButtonElement;
const slotStrip = document.getElementById("slot-strip") as HTMLElement;
const mobilePauseButton = document.getElementById("mobile-pause") as HTMLButtonElement;
const mobileResetButton = document.getElementById("mobile-reset") as HTMLButtonElement;
const dsumValue = document.getElementById("dsum-value") as HTMLElement;
const targetOdds = document.getElementById("target-odds") as HTMLElement;
const uncertainty = document.getElementById("uncertainty") as HTMLElement;

gameSelect.innerHTML = GAMES.map((game) => `<option value="${game.id}">${game.name}</option>`).join("");
gameSelect.value = config.game;

refreshRouteOptions();

gameSelect.addEventListener("change", () => {
  const game = gameSelect.value as SelectionConfig["game"];
  const route = routeForGame(config.routeId, game);
  driver.setGame(game, route.id);
  refreshRouteOptions();
  if (config.game !== "YELLOW") {
    config.pikaLead = false;
    config.pikaFollow = false;
    config.npcOnScreen = false;
  }
  refreshYellowControls();
  renderSlotStrip();
});

routeSelect.addEventListener("change", () => {
  driver.setRoute(routeSelect.value);
  renderSlotStrip();
});

leadInput.addEventListener("input", () => {
  config.leadLevel = clampNumber(leadInput.valueAsNumber, 1, 100, 70);
});

thresholdInput.addEventListener("input", () => {
  config.threshold = clampNumber(thresholdInput.valueAsNumber, 0, 1, 0.1);
});

pikaLeadButton.addEventListener("click", () => {
  if (config.game !== "YELLOW") {
    return;
  }
  config.pikaLead = !config.pikaLead;
  refreshYellowControls();
});

pikaFollowButton.addEventListener("click", () => {
  if (config.game !== "YELLOW") {
    return;
  }
  config.pikaFollow = !config.pikaFollow;
  refreshYellowControls();
});

npcOnScreenButton.addEventListener("click", () => {
  if (config.game !== "YELLOW") {
    return;
  }
  config.npcOnScreen = !config.npcOnScreen;
  refreshYellowControls();
});

const togglePause = () => driver.togglePause();
const resetCalibration = () => driver.reset();
const enterBattle = () => {
  if (driver.isInBattle()) {
    driver.calibrate(-1);
    return;
  }
  driver.battleEntered();
};
mobilePauseButton.addEventListener("click", togglePause);
mobileResetButton.addEventListener("click", resetCalibration);
wheelViewport.addEventListener("pointerdown", enterBattle);

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-exit]")) {
  button.addEventListener("click", () => driver.primeEncounterExitStrategy(button.dataset.exit as EncounterExitStrategy));
}

window.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.tagName === "INPUT" || target?.tagName === "SELECT") {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    enterBattle();
  } else if (/^Digit[0-9]$/.test(event.code)) {
    const digit = Number(event.code.replace("Digit", ""));
    driver.calibrate(digit === 0 ? 9 : digit - 1);
  } else if (event.key === "Delete") {
    driver.reset();
  } else if (event.key === "p" || event.key === "P") {
    driver.togglePause();
  } else if (event.key === "[") {
    driver.step(-1);
  } else if (event.key === "]") {
    driver.step(1);
  } else if (event.key === "r" || event.key === "R") {
    driver.primeEncounterExitStrategy("POKEMON_RAN");
  } else if (event.key === "b" || event.key === "B") {
    driver.primeEncounterExitStrategy("POKEMON_SENT_TO_BOX");
  } else if (event.key === "n" || event.key === "N") {
    driver.primeEncounterExitStrategy("POKEMON_NICKNAMED_JOINED_PARTY");
  } else if (event.key === "t" || event.key === "T") {
    driver.primeEncounterExitStrategy("POKEMON_JOINED_PARTY");
  }
});

renderSlotStrip();
refreshYellowControls();

let last = performance.now();
let lastBattleState = driver.isInBattle();
function frame(now: number) {
  driver.update(now - last);
  last = now;
  wheel.render();
  refreshReadouts();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

function renderSlotStrip() {
  const route = driver.route;
  const encounters = route.encounters[config.game] ?? [];

  slotStrip.innerHTML = ENCOUNTER_SLOTS.map((slot) => {
    const encounter = encounters[slot.id];
    const selected = config.targets.has(slot.id) ? " selected" : "";
    const species = encounter?.species ?? "Unavailable";
    const level = encounter ? `Lv. ${encounter.level}` : "";
    const spriteSet = config.game === "YELLOW" ? "y" : "rb";
    const spriteSrc = encounter ? `${assetBase}sprites/${spriteSet}/${encounter.dex}.png` : "";
    return `
      <button type="button" class="slot-card${selected}" data-slot="${slot.id}" style="--slot-color:${SLOT_COLORS[slot.id]}">
        <span class="slot-number">${slot.label}</span>
        ${spriteSrc ? `<img class="slot-sprite" src="${spriteSrc}" alt="">` : ""}
        <strong class="species-name">${species}</strong>
        <span>${level}</span>
        <i></i>
      </button>
    `;
  }).join("");

  for (const button of slotStrip.querySelectorAll<HTMLButtonElement>("[data-slot]")) {
    button.addEventListener("click", () => {
      const slot = Number(button.dataset.slot);
      if (driver.isInBattle()) {
        driver.primeCalibrationSlot(slot);
        renderSlotStrip();
        return;
      }

      if (config.targets.has(slot)) {
        config.targets.delete(slot);
      } else {
        config.targets.add(slot);
      }
      renderSlotStrip();
    });
  }

  fitSpeciesLabels();
}

function refreshRouteOptions() {
  const routes = routesForGame(config.game);
  const selectedRoute = routes.find((route) => route.id === config.routeId) ?? routes[0];
  if (selectedRoute == null) {
    throw new Error(`No routes are available for ${config.game}.`);
  }

  routeSelect.innerHTML = routes.map((route) => `<option value="${route.id}">${route.name}</option>`).join("");
  routeSelect.value = selectedRoute.id;
  if (config.routeId !== selectedRoute.id) {
    driver.setRoute(selectedRoute.id);
  }
}

function refreshReadouts() {
  mobilePauseButton.textContent = driver.paused ? "Resume" : "Pause";
  shell.classList.toggle("is-in-battle", driver.isInBattle());
  if (lastBattleState !== driver.isInBattle()) {
    lastBattleState = driver.isInBattle();
    requestAnimationFrame(fitSpeciesLabels);
  }
  // @ts-ignore
  dsumValue.textContent = Math.round(driver.dsum);
  targetOdds.textContent = `${Math.round(driver.getTargetCumulativeProbability() * 100)}%`;
  uncertainty.textContent = String(driver.uncertainty);

  const probabilities = driver.getCurrentEncounterSlotProbabilities();
  for (const button of slotStrip.querySelectorAll<HTMLButtonElement>("[data-slot]")) {
    const slot = Number(button.dataset.slot);
    const bar = button.querySelector("i");
    if (bar) {
      bar.style.height = `${Math.max(2, probabilities[slot] * 100)}%`;
      bar.title = `${Math.round(probabilities[slot] * 100)}%`;
    }
    button.classList.toggle("selected", config.targets.has(slot));
    button.classList.toggle("calibration-choice", driver.isInBattle());
    button.classList.toggle("most-likely", driver.isMostLikely(slot));
  }
}

function routesForGame(game: SelectionConfig["game"]) {
  return ROUTES.filter((route) => route.games.includes(game));
}

function routeForGame(routeId: string, game: SelectionConfig["game"]) {
  const routes = routesForGame(game);
  const route = routes.find((candidate) => candidate.id === routeId) ?? routes[0];
  if (route == null) {
    throw new Error(`No routes are available for ${game}.`);
  }
  return route;
}

function refreshYellowControls() {
  const isYellow = config.game === "YELLOW";
  pikaLeadField.hidden = !isYellow;
  pikaLeadButton.disabled = !isYellow;
  pikaLeadButton.setAttribute("aria-pressed", String(isYellow && config.pikaLead));
  pikaFollowButton.disabled = !isYellow;
  pikaFollowButton.setAttribute("aria-pressed", String(isYellow && config.pikaFollow));
  npcOnScreenButton.disabled = !isYellow;
  npcOnScreenButton.setAttribute("aria-pressed", String(isYellow && config.npcOnScreen));
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function fitSpeciesLabels() {
  for (const label of slotStrip.querySelectorAll<HTMLElement>(".species-name")) {
    label.style.fontSize = "13px";
    while (label.scrollWidth > label.clientWidth && parseFloat(label.style.fontSize) > 8) {
      label.style.fontSize = `${parseFloat(label.style.fontSize) - 0.5}px`;
    }
  }
}

window.addEventListener("resize", fitSpeciesLabels);

if (window.matchMedia("(max-width: 700px)").matches) {
  settingsPanel.open = false;
}
