import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

const overlayHtml = readFileSync(path.join(process.cwd(), "src/overlay/index.html"), "utf8");
const overlayCss = readFileSync(path.join(process.cwd(), "src/overlay/styles.css"), "utf8");
const overlayApp = readFileSync(path.join(process.cwd(), "src/overlay/app.ts"), "utf8");
const popupPresenter = readFileSync(path.join(process.cwd(), "src/overlay/popup-presenter.ts"), "utf8");

function extractOverlayDeclaration(source: string, declarationName: string): string {
  const sourceFile = ts.createSourceFile("app.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === declarationName) {
      return statement.getText(sourceFile);
    }

    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === declarationName) {
        return statement.getText(sourceFile);
      }
    }
  }

  throw new Error(`Could not find ${declarationName} in overlay/app.ts`);
}

type OverlayHelperModule = {
  buildCpuSparklinePaths: (
    samples: number[],
    geometry: { width: number; height: number; topPadding: number; singleSampleWidth: number },
  ) => { fillPath: string; linePath: string };
  readCpuSparklineGeometry: (element: {
    dataset: Record<string, string | undefined>;
    querySelector: (selector: string) => { getAttribute: (name: string) => string | null } | null;
  }) => { width: number; height: number; topPadding: number; singleSampleWidth: number };
  batteryCapacityUsageHint: (maxCapacityPercent: number | null | undefined, loading: boolean) => string;
  batteryCycleUsageHint: (cycleCount: number | null | undefined, loading: boolean) => string;
  batteryTemperatureUsageHint: (temperatureCelsius: number | null | undefined, loading: boolean) => string;
  isLoadingState: (state: {
    popup: {
      isStale?: boolean;
      observationMode?: "watch" | "passive";
      observationSourceLabel?: string;
      contextPercent: number | null;
      tokenEtaMinutes: number | null;
      cpuDetail?: object;
      memoryDetail?: object;
      storageDetail?: object;
      batteryDetail?: object;
    };
  }) => boolean;
};

function loadOverlayHelpers(): OverlayHelperModule {
  const declarations = [
    "DEFAULT_CPU_SPARKLINE_GEOMETRY",
    "readCpuSparklineGeometry",
    "parseSparklineNumber",
    "renderCpuSparkline",
    "buildCpuSparklinePaths",
    "valueToSparklineY",
    "roundSparkline",
    "formatLoadingDetail",
    "batteryCapacityUsageHint",
    "batteryCycleUsageHint",
    "batteryTemperatureUsageHint",
    "isLoadingState",
  ].map((name) => extractOverlayDeclaration(overlayApp, name));

  const transpiled = ts.transpileModule(
    `
${declarations.join("\n\n")}
exports.readCpuSparklineGeometry = readCpuSparklineGeometry;
exports.buildCpuSparklinePaths = buildCpuSparklinePaths;
exports.batteryCapacityUsageHint = batteryCapacityUsageHint;
exports.batteryCycleUsageHint = batteryCycleUsageHint;
exports.batteryTemperatureUsageHint = batteryTemperatureUsageHint;
exports.isLoadingState = isLoadingState;
`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;

  const exportsObject: Record<string, unknown> = {};
  const executeModule = new Function("exports", `"use strict";\n${transpiled}`) as (exports: Record<string, unknown>) => void;
  executeModule(exportsObject);
  return exportsObject as OverlayHelperModule;
}

describe("overlay markup", () => {
  it("starts with the status bubble hidden", () => {
    expect(overlayHtml).toContain('class="bubble hidden"');
  });

  it("keeps the popup before the dog so the status panel opens above it", () => {
    expect(overlayHtml.indexOf('id="popup"')).toBeLessThan(overlayHtml.indexOf('id="pet"'));
  });

  it("renders a compact status panel with the approved two-column stats", () => {
    expect(overlayHtml).toContain('id="issueTitle"');
    expect(overlayHtml).toContain('id="issueDetail"');
    expect(overlayHtml).toContain('id="loadingState"');
    expect(overlayHtml).toContain('id="loadingLabel"');
    expect(overlayHtml).toContain('id="sessionMeta"');
    expect(overlayHtml).toContain('class="stat-grid"');
    expect(overlayHtml).toContain('id="context"');
    expect(overlayHtml).toContain('id="tokenEta"');
    expect(overlayHtml).toContain('id="cpu"');
    expect(overlayHtml).toContain('id="memory"');
    expect(overlayHtml).toContain('id="storage"');
    expect(overlayHtml).toContain('id="battery"');
    expect(overlayHtml).toContain('id="contextBar"');
    expect(overlayHtml).toContain('id="tokenBar"');
    expect(overlayHtml).toContain('id="cpuBar"');
    expect(overlayHtml).toContain('id="memoryBar"');
    expect(overlayHtml).toContain('id="storageBar"');
    expect(overlayHtml).toContain('id="ctaActivity"');
    expect(overlayHtml).toContain('id="ctaStorage"');
    expect(overlayHtml).toContain('id="ctaNetwork"');
    expect(overlayHtml).toContain('id="ctaArtifacts"');
    expect(overlayHtml).not.toContain('id="ctaWatchGuide"');
    expect(overlayHtml).not.toContain('id="loop"');
    expect(overlayHtml).not.toContain('id="sessionMetaUpdatedAt"');
    expect(overlayHtml).not.toContain('id="sessionMetaConfidence"');
  });

  it("renders an area sparkline container for CPU history", () => {
    expect(overlayHtml).toContain('id="cpuSparkline"');
    expect(overlayHtml).toContain('id="cpuSparklineFill"');
    expect(overlayHtml).toContain('id="cpuSparklineLine"');
    expect(overlayHtml).toContain('class="sparkline-area"');
    expect(overlayApp).toContain("renderCpuSparkline");
    expect(overlayCss).toContain(".sparkline-area");
  });

  it("renders battery detail rows for capacity, cycle count, and temperature", () => {
    expect(overlayHtml).toContain('id="batteryCapacityHint"');
    expect(overlayHtml).toContain('id="batteryCycleHint"');
    expect(overlayHtml).toContain('id="batteryTemperatureHint"');
    expect(overlayApp).toContain("batteryCapacityHint");
    expect(overlayApp).toContain("batteryCycleHint");
    expect(overlayApp).toContain("batteryTemperatureHint");
  });

  it("builds separate fill and line paths so the CPU sparkline line stays open", () => {
    const helpers = loadOverlayHelpers();
    const geometry = helpers.readCpuSparklineGeometry({
      dataset: {
        chartWidth: "120",
        chartHeight: "28",
        chartTopPadding: "2",
        singleSampleWidth: "10",
      },
      querySelector: () => ({ getAttribute: () => "0 0 120 28" }),
    });
    const multiSample = helpers.buildCpuSparklinePaths([10, 40, 25], geometry);
    const singleSample = helpers.buildCpuSparklinePaths([42], geometry);

    expect(multiSample.fillPath).toContain("Z");
    expect(multiSample.linePath).toMatch(/^M /);
    expect(multiSample.linePath).not.toContain("Z");
    expect(singleSample.fillPath).not.toBe("");
    expect(singleSample.linePath).toBe("");
  });

  it("keeps battery detail rows loading-aware before falling back to unavailable copy", () => {
    const helpers = loadOverlayHelpers();

    expect(helpers.batteryCapacityUsageHint(undefined, true)).toBe("최대 성능: 로딩 중");
    expect(helpers.batteryCycleUsageHint(undefined, true)).toBe("사이클 수: 로딩 중");
    expect(helpers.batteryTemperatureUsageHint(undefined, true)).toBe("온도: 로딩 중");

    expect(helpers.batteryCapacityUsageHint(undefined, false)).toBe("최대 성능: 알 수 없음");
    expect(helpers.batteryCycleUsageHint(undefined, false)).toBe("사이클 수: 알 수 없음");
    expect(helpers.batteryTemperatureUsageHint(undefined, false)).toBe("온도: 알 수 없음");
  });

  it("treats the loading row as a readiness transition from waiting passive state to ready details", () => {
    const helpers = loadOverlayHelpers();

    const loadingState = {
      popup: {
        isStale: false,
        observationMode: "passive" as const,
        observationSourceLabel: "waiting-for-agent",
        contextPercent: null,
        tokenEtaMinutes: null,
      },
    };

    const readyState = {
      popup: {
        isStale: false,
        observationMode: "passive" as const,
        observationSourceLabel: "summary:session-plan.md",
        contextPercent: null,
        tokenEtaMinutes: null,
        cpuDetail: { userPercent: 23, systemPercent: 6, idlePercent: 71, samples: [21, 25, 29] },
        memoryDetail: { appUsedGb: 7.1, wiredGb: 2.4, compressedGb: 1.1 },
        storageDetail: { usedPercent: 78, usedGb: 384.8, totalGb: 494.4 },
        batteryDetail: { percent: 96.8, powerSource: "배터리", isCharging: false },
      },
    };

    expect(helpers.isLoadingState(loadingState)).toBe(true);
    expect(helpers.isLoadingState(readyState)).toBe(false);
  });

  it("treats missing battery telemetry as ready once the rest of the system details are present", () => {
    const helpers = loadOverlayHelpers();

    const readyWithoutBatteryState = {
      popup: {
        isStale: false,
        observationMode: "passive" as const,
        observationSourceLabel: "summary:session-plan.md",
        contextPercent: null,
        tokenEtaMinutes: null,
        cpuDetail: { userPercent: 23, systemPercent: 6, idlePercent: 71, samples: [21, 25, 29] },
        memoryDetail: { appUsedGb: 7.1, wiredGb: 2.4, compressedGb: 1.1 },
        storageDetail: { usedPercent: 78, usedGb: 384.8, totalGb: 494.4 },
      },
    };

    expect(helpers.isLoadingState(readyWithoutBatteryState)).toBe(false);
  });

  it("falls back to explicit unknown-state copy once passive sampling has settled without detail objects", () => {
    const helpers = loadOverlayHelpers();

    const settledWithoutDetailsState = {
      popup: {
        isStale: false,
        observationMode: "passive" as const,
        observationSourceLabel: "summary:session-plan.md",
        contextPercent: null,
        tokenEtaMinutes: null,
        cpuDetail: undefined,
        memoryDetail: undefined,
        storageDetail: undefined,
      },
    };

    expect(helpers.isLoadingState(settledWithoutDetailsState)).toBe(false);
  });

  it("renders raster pet and house sprite layers", () => {
    expect(overlayHtml).toContain(
      '<span class="pet-stage" id="petArt" role="img" aria-label="Pawtrol dog companion">',
    );
    expect(overlayHtml).toContain('id="houseFrame" src="./assets/house-small.png"');
    expect(overlayHtml).toContain('id="petFrame" src="./assets/bori-walking.png"');
    expect(overlayHtml).toContain('id="petHit"');
    expect(overlayHtml).toContain('id="heartBurst"');
    expect(overlayHtml).toContain("💗");
    expect(overlayHtml).toContain('id="kennelHouseFrame" src="./assets/house-small.png"');
    expect(overlayHtml).toContain('class="kennel-zzz"');
  });

  it("removes old inline dog illustration artifacts", () => {
    expect(overlayHtml).not.toContain('class="pet-soft-outline"');
    expect(overlayHtml).not.toContain('class="sweater"');
    expect(overlayHtml).not.toContain('class="cheek left-cheek"');
    expect(overlayCss).not.toContain(".pet-art");
    expect(overlayCss).not.toContain(".sweater");
  });

  it("does not draw a grey backing or shadow behind Bori", () => {
    expect(overlayHtml).not.toContain("softFurShadow");
    expect(overlayHtml).not.toContain('class="pet-shadow"');
    expect(overlayCss).not.toContain("drop-shadow");
  });

  it("removes floating shadows from bubble, popup, and kennel panels", () => {
    expect(overlayCss.match(/box-shadow: none/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps pose animation transforms from squashing Bori", () => {
    expect(overlayCss).not.toMatch(/scale[XY]\(/);
    expect(overlayCss.match(/@keyframes (sit-settle|lie-down|sleepy-body|stretch-body)[\s\S]*?}/g)?.join("\n")).not.toMatch(
      /scale[XY]\(/,
    );
  });

  it("styles sprite layers and keeps pose keyframes for whole-sprite animation", () => {
    expect(overlayCss).toContain(".pet-stage");
    expect(overlayCss).toContain(".pet-hit");
    expect(overlayCss).toContain(".pet {");
    expect(overlayCss).toContain("order: 4;");
    expect(overlayCss).toContain("position: relative;");
    expect(overlayCss).toContain("background: transparent;");
    expect(overlayCss).toContain(".kennel-stage");
    expect(overlayCss).toContain("width: min(360px");
    expect(overlayCss).toContain("object-fit: contain");
    expect(overlayCss).toContain("object-position: center bottom");
    expect(overlayCss).toContain(".session-meta");
    expect(overlayCss).toContain(".stat-grid");
    expect(overlayCss).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(overlayCss).toContain(".stat-card");
    expect(overlayCss).toContain(".stat-bar");
    expect(overlayCss).toContain(".stat-bar-fill");
    expect(overlayCss).toContain(".loading-state");
    expect(overlayCss).toContain(".loading-spinner");
    expect(overlayCss).toContain(".popup.is-stale");
    expect(overlayCss).toContain(".cta-row");
    expect(overlayCss).toContain(".cta-chip");
    expect(overlayCss).toContain(".pet-layer");
    expect(overlayCss).toContain(".house-layer");
    expect(overlayCss).toContain("@keyframes walk-body");
    expect(overlayCss).toContain("@keyframes sit-settle");
    expect(overlayCss).toContain("@keyframes lie-down");
    expect(overlayCss).toContain("@keyframes sprite-alert");
    expect(overlayCss).toContain("@keyframes sprite-wag");
    expect(overlayCss).toContain("@keyframes heart-float");
    expect(overlayCss).toContain("@keyframes kennel-zzz");
  });

  it("includes a kennel button for minimized companion mode", () => {
    expect(overlayHtml).toContain('id="kennel"');
    expect(overlayHtml).toContain('class="kennel hidden"');
  });

  it("keeps desktop app controls out of the overlay because they live in the menu bar", () => {
    expect(overlayHtml).not.toContain('id="desktopControls"');
    expect(overlayHtml).not.toContain('id="desktopPanel"');
  });

  it("starts on the default Bori walking image", () => {
    expect(overlayHtml).toContain('id="petFrame" src="./assets/bori-walking.png"');
  });

  it("includes stationary lying and sitting animation states", () => {
    expect(overlayCss).toContain(".pet.sitting");
    expect(overlayCss).toContain(".pet.lying");
    expect(overlayCss).toContain("@keyframes lie-down");
  });

  it("shows the kennel before Bori walks into it", () => {
    expect(overlayCss).toContain(".kennel.entering");
    expect(overlayCss).toContain(".pet.kennel-entering");
    expect(overlayCss).toContain("position: absolute");
    expect(overlayCss).toContain("@keyframes kennel-walk-in");
    expect(overlayCss).toContain("@keyframes kennel-door-wait");
  });

  it("walks Bori out of the kennel instead of popping out", () => {
    expect(overlayCss).toContain(".kennel.exiting");
    expect(overlayCss).toContain(".pet.kennel-exiting");
    expect(overlayCss).toContain("@keyframes kennel-walk-out");
  });

  it("keeps unknown values and stale passive state explicit in overlay copy", () => {
    expect(overlayApp).toContain('return "unknown";');
    expect(popupPresenter).toContain("관측 모드: passive detect");
    expect(popupPresenter).toContain("stale passive data");
    expect(overlayApp).toContain('popup.classList.toggle("is-stale"');
    expect(overlayApp).toContain("storageUsageHint");
    expect(overlayApp).toContain("batteryUsageHint");
    expect(overlayApp).toContain("isLoadingState");
  });
});
