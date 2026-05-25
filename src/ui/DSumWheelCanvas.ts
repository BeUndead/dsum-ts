import { ENCOUNTER_SLOTS, type SelectionConfig } from "../model/types";
import { DSUM_RANGE } from "../sim/constants";
import { DSumDriver } from "../sim/DSumDriver";

const SLOT_COLORS = [
  "#ff8296",
  "#ffb464",
  "#ffdc64",
  "#78dc96",
  "#64d2e6",
  "#78aaff",
  "#d282dc",
  "#ff96c8",
  "#959595",
  "#717d97",
];

export class DSumWheelCanvas {
  constructor(
    private canvas: HTMLCanvasElement,
    private driver: DSumDriver,
    private config: SelectionConfig,
  ) {}

  render() {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const targetWidth = Math.max(1, Math.round(rect.width * dpr));
    const targetHeight = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    this.draw(ctx, rect.width, rect.height);
    ctx.restore();
  }

  private draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const bg = this.backgroundColor();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const pointerHeight = 32;
    const topGap = 10;
    const radius = Math.max(70, Math.min(width * 0.43, height * 0.43, (height - pointerHeight - topGap - 10) / 2));
    const cy = radius + pointerHeight + topGap;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((this.driver.dsum / DSUM_RANGE) * Math.PI * 2);
    this.drawProbabilityWheel(ctx, radius);
    ctx.restore();

    this.drawUncertaintyWedge(ctx, cx, cy, radius);
    this.drawPointer(ctx, cx, cy, radius);
    this.drawCenterChip(ctx, cx, cy);
    this.drawInstructionChip(ctx, width, height);
  }

  private drawProbabilityWheel(ctx: CanvasRenderingContext2D, radius: number) {
    const table = this.driver.slotComputer.snapshot();
    const slice = (Math.PI * 2) / DSUM_RANGE;
    const overlap = (0.15 * Math.PI) / 180;

    for (let dsum = 0; dsum < DSUM_RANGE; dsum++) {
      let height = 1;
      const start = -Math.PI / 2 - (dsum + 1) * slice - overlap;
      const end = -Math.PI / 2 - dsum * slice + overlap;

      for (let slot = 9; slot >= 0; slot--) {
        const probability = table[dsum][slot];
        if (probability <= 0) {
          continue;
        }

        const outer = radius * Math.sqrt(height);
        const inner = radius * Math.sqrt(Math.max(0, height - probability));
        this.drawAnnularSlice(ctx, inner, outer, start, end, SLOT_COLORS[slot]);

        if (this.config.targets.has(slot)) {
          this.drawAnnularSlice(ctx, inner, outer, start, end, "rgba(128, 220, 36, 0.56)");
        }
        if (this.driver.suggested?.has(slot)) {
          this.drawAnnularSlice(ctx, inner, outer, start, end, "rgba(255, 149, 11, 0.56)");
        }

        height -= probability;
      }
    }

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.stroke();
  }

  private drawAnnularSlice(
    ctx: CanvasRenderingContext2D,
    inner: number,
    outer: number,
    start: number,
    end: number,
    fill: string,
  ) {
    ctx.beginPath();
    ctx.arc(0, 0, outer, start, end);
    ctx.arc(0, 0, inner, end, start, true);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  private drawUncertaintyWedge(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
    const u = Math.max(1, this.driver.uncertainty);
    const span = 2 * u + 1;
    const half = ((span / DSUM_RANGE) * Math.PI * 2) / 2;
    const outer = radius * 1.08;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outer, -Math.PI / 2 - half, -Math.PI / 2 + half);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    ctx.stroke();
  }

  private drawPointer(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius - 32);
    ctx.lineTo(cx - 13, cy - radius - 7);
    ctx.lineTo(cx + 13, cy - radius - 7);
    ctx.closePath();
    ctx.fillStyle = "#e94545";
    ctx.fill();
  }

  private drawCenterChip(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    const state = this.driver.stateText();
    const sub = this.driver.stateSubText();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(238, 242, 247, 0.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(40, 48, 58, 0.45)";
    ctx.stroke();

    ctx.fillStyle = "#18202a";
    ctx.font = "700 16px Arial";
    ctx.fillText(state, cx, cy - 9);
    ctx.font = "700 12px Arial";
    ctx.fillText(sub, cx, cy + 12);
    ctx.restore();
  }

  private drawInstructionChip(ctx: CanvasRenderingContext2D, width: number, height: number) {
    let lines: string[] = [];
    if (!this.driver.isInBattle() && this.driver.firstCalibration) {
      lines = ["Get an encounter", "tap wheel at black screen"];
    } else if (this.driver.isInBattle()) {
      lines = ["Press slot 1-9 or 0", "T/N/B/R sets battle exit"];
    }
    if (lines.length === 0) {
      return;
    }

    ctx.save();
    ctx.font = "700 12px Arial";
    const lineHeight = 16;
    const pad = 8;
    const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
    const boxWidth = textWidth + pad * 2;
    const boxHeight = lines.length * lineHeight + pad * 2;
    const x = 18;
    const y = height - boxHeight - 18;

    ctx.fillStyle = "rgba(238, 242, 247, 0.86)";
    roundRect(ctx, x, y, boxWidth, boxHeight, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(40, 48, 58, 0.25)";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#243040";
    lines.forEach((line, index) => {
      ctx.fillText(line, x + boxWidth / 2, y + pad + lineHeight * index + lineHeight / 2);
    });
    ctx.restore();
  }

  private backgroundColor(): string {
    if (this.driver.isUncalibrated()) {
      return "rgba(251, 227, 94, 0.5)";
    }

    const probability = this.driver.getTargetCumulativeProbability();
    if (probability >= this.config.threshold) {
      return `rgba(103, 207, 103, ${Math.min(0.85, Math.max(0.25, probability))})`;
    }

    return "#28303a";
  }
}

export { SLOT_COLORS };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
