# Contrast Validation Suite

This tutorial builds a TypeScript contrast-validation suite for CSS colors, including OKLCH. It reports WCAG 2.1 results separately from APCA contrast and typography results, and shows how to run the checks in tests, a CLI, and a browser tool.

## Run this project

This repository includes the Vite app, shared validation engine, design-system contracts, tests, and CLI described below. From the repository root:

```bash
npm install
npm run dev             # Start the browser checker
npm run contrast:check  # Run design-system contracts from the CLI
npm test                # Run the contrast specification tests
npm run build           # Type-check and build the production app
```

## The problem

WCAG 2.1 defines contrast-ratio thresholds for its AA and AAA conformance levels. APCA is the proposed contrast algorithm for WCAG 3; it evaluates lightness contrast in relation to text size and weight. Because they measure contrast differently, a color pair can pass WCAG 2.1 and fail APCA, so the suite reports their results separately.

The examples use CSS color strings with Color.js's APCA contrast method. Color.js parses supported color spaces and handles conversion internally for both WCAG and APCA calculations, so input is not limited to OKLCH. `apca-w3`'s font lookup table checks text-size requirements. The result does not claim to measure native Display-P3 output. WCAG and APCA outcomes are checked against their respective criteria, not against project-defined thresholds.

The validator requires opaque colors and rejects CSS colors with alpha; it does not composite them automatically. Before evaluation, composite translucent text over its actual background, and composite a translucent background over its canvas. Pass the resulting opaque colors to the validator.

## Create the Vite app

```bash
npm create vite@latest contrast-validation -- --template vanilla-ts
cd contrast-validation
npm install
```

The `vanilla-ts` template provides the Vite and TypeScript project configuration. Add the validation engine, shared contracts, tests, CLI, and browser interface to the generated `src/` directory.

### Install dependencies

```bash
npm install colorjs.io apca-w3
npm install -D vitest tsx @types/apca-w3
```

## Core validation engine (`contrast-validator.ts`)

Create `src/contrast/contrast-validator.ts` in the Vite app and place the following code there. This module accepts a text color, a background color, and an optional font size and weight. It calculates the WCAG 2.1 ratio and one APCA result through Color.js, then uses the APCA font lookup table to check whether the requested typography meets its contrast requirement. The report exposes WCAG AA and AAA outcomes separately from the APCA typography outcome; a pair can pass one criterion and fail the other. If typography is omitted, it reports whether APCA meets the Lc 60 baseline.

The APCA font lookup uses `777` for non-text-only contrast and `999` when contrast is insufficient; neither value is a font size.

Here, `fontSizePx` means CSS pixels, a layout unit rather than a physical screen pixel. Device-pixel ratio and browser zoom determine how CSS pixels map to screen pixels; WCAG's text-size thresholds use CSS pixels.

The `validateScaleSteps` helper applies the same evaluation to every color in a named scale against one background, making it useful for checking a palette of design tokens. The tests, CLI, and browser interface shown below all call `evaluateContrast`.

```typescript
import Color from "colorjs.io";
import * as apcaW3 from "apca-w3";

const { fontLookupAPCA } = apcaW3 as unknown as {
  fontLookupAPCA: (contrast: number) => Array<number | string>;
};

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export const APCA_FONT_SIZE_SENTINELS = {
  nonTextOnly: 777,
  insufficientContrast: 999,
} as const;

export interface TypographyRequirement {
  fontSizePx: number;
  fontWeight: FontWeight;
}

export interface ColorPairCheck {
  textColor: string;
  backgroundColor: string;
  description: string;
  typography?: TypographyRequirement;
}

export interface WcagEvaluation {
  ratio: number;
  isLargeText: boolean;
  passAa: boolean;
  passAaa: boolean;
  passAaNormal: boolean;  // >= 4.5:1 (Body text < 18pt or < 14pt bold)
  passAaLarge: boolean;   // >= 3.0:1 (Large text >= 18pt or >= 14pt bold)
  passAaaNormal: boolean; // >= 7.0:1
  passAaaLarge: boolean;  // >= 4.5:1
}

export interface ApcaEvaluation {
  lightnessContrast: number; // Signed Lc (-108 to +106)
  absLc: number;
  minFontSizeForWeight?: number; // Minimum px size required for the requested font weight
  passTypography?: boolean;      // True if requested fontSize >= required minimum
  passLc60: boolean;             // APCA Lc meets the 60 baseline when typography is omitted
  recommendedSizes: Record<FontWeight, number>; // Full weight-to-size threshold map from apca-w3
  nonTextUi: {
    passFineDetailOrOutline: boolean;
    passLargeSolidSemantic: boolean;
    passNonSemantic: boolean;
  };
}

export interface ValidationReport {
  pair: ColorPairCheck;
  wcag: WcagEvaluation;
  apca: ApcaEvaluation;
}

/**
 * Calculates APCA contrast for Color.js colors and checks typography requirements.
 */
function evaluateApca(
  pair: ColorPairCheck,
  textColor: Color,
  backgroundColor: Color
): ApcaEvaluation {
  if (textColor.alpha !== 1 || backgroundColor.alpha !== 1) {
    throw new Error("APCA checks require opaque colors; composite alpha first.");
  }

  const rawLc = backgroundColor.contrast(textColor, "APCA");
  const signedLc = typeof rawLc === "number" ? rawLc : parseFloat(String(rawLc));
  const absLc = Math.abs(signedLc);

  const lookupRaw = fontLookupAPCA(signedLc);
  const weights: FontWeight[] = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const recommendedSizes = {} as Record<FontWeight, number>;

  weights.forEach((w, idx) => {
    recommendedSizes[w] = lookupRaw
      ? Number(lookupRaw[idx + 1])
      : APCA_FONT_SIZE_SENTINELS.insufficientContrast;
  });

  let minFontSizeForWeight: number | undefined;
  let passTypography: boolean | undefined;

  if (pair.typography) {
    minFontSizeForWeight = recommendedSizes[pair.typography.fontWeight];
    passTypography =
      minFontSizeForWeight !== undefined &&
      minFontSizeForWeight !== APCA_FONT_SIZE_SENTINELS.nonTextOnly &&
      minFontSizeForWeight !== APCA_FONT_SIZE_SENTINELS.insufficientContrast &&
      minFontSizeForWeight > 0 &&
      minFontSizeForWeight <= pair.typography.fontSizePx;
  }

  return {
    lightnessContrast: Number(signedLc.toFixed(1)),
    absLc: Number(absLc.toFixed(1)),
    minFontSizeForWeight,
    passTypography,
    passLc60: absLc >= 60,
    recommendedSizes,
    nonTextUi: {
      passFineDetailOrOutline: absLc >= 45,
      passLargeSolidSemantic: absLc >= 30,
      passNonSemantic: absLc >= 15,
    },
  };
}

/**
 * Validates WCAG 2.1 and APCA contrast for Color.js color inputs.
 */
export function evaluateContrast(pair: ColorPairCheck): ValidationReport {
  const textColor = new Color(pair.textColor);
  const backgroundColor = new Color(pair.backgroundColor);
  const wcagRatio = backgroundColor.contrast(textColor, "WCAG21");
  const isLargeText = Boolean(pair.typography && (
    pair.typography.fontSizePx >= 24 ||
    (pair.typography.fontWeight >= 700 && pair.typography.fontSizePx >= (14 * 96) / 72)
  ));

  const wcag: WcagEvaluation = {
    ratio: Number(wcagRatio.toFixed(2)),
    isLargeText,
    passAa: wcagRatio >= (isLargeText ? 3 : 4.5),
    passAaa: wcagRatio >= (isLargeText ? 4.5 : 7),
    passAaNormal: wcagRatio >= 4.5,
    passAaLarge: wcagRatio >= 3.0,
    passAaaNormal: wcagRatio >= 7.0,
    passAaaLarge: wcagRatio >= 4.5,
  };

  const apca = evaluateApca(pair, textColor, backgroundColor);

  return {
    pair,
    wcag,
    apca,
  };
}

/**
 * Evaluates an entire scale against a target background token.
 */
export function validateScaleSteps(
  scale: Record<string, string>,
  background: string,
  typography?: TypographyRequirement
): ValidationReport[] {
  return Object.entries(scale).map(([step, colorValue]) => {
    return evaluateContrast({
      textColor: colorValue,
      backgroundColor: background,
      description: `Step ${step} against ${background}`,
      typography,
    });
  });
}
```

## How the APCA calculation works

The validator parses each input string with Color.js and passes the resulting color objects to its WCAG and APCA methods. Color.js handles the color-space conversion internally; this example does not calculate or expose luminance Y. The APCA score is then passed to `fontLookupAPCA` to determine the minimum font size for each weight. Callers can provide supported CSS color strings in spaces other than OKLCH and receive contrast results without doing conversion work themselves. The score follows Color.js's APCA implementation and does not claim to represent native Display-P3 output. The code assumes opaque colors because alpha must be composited over the actual background before contrast is calculated.

## APCA Readability Criterion conformance levels

The APCA Readability Criterion (ARC) describes three draft conformance levels. [Bronze Simple Mode](https://readtech.org/ARC/tests/bronze-simple-mode/?tn=intro) uses Lc thresholds by text use case and does not require a font lookup table. [Silver](https://readtech.org/ARC/tests/visual-readability-contrast/?tn=criterion) and [Gold](https://readtech.org/ARC/tests/visual-readability-contrast/?tn=criterion) use font-size and weight lookup tables. Silver covers fluent and sub-fluent text, requires qualified body fonts, and requires at least one additional exchange rule. Gold extends lookup coverage to all text, requires qualified fluent-text fonts, adds stricter body-text requirements, and requires at least two exchange rules.

The browser includes an accordion explaining the levels. In “Set the scene,” check a color pair normally and select its reading purpose to see the corresponding APCA Lc screening target: body/block text Lc 75, other fluent content Lc 60, sub-fluent content Lc 45, and spot/non-fluent text Lc 30. These targets are informed by [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html#use-case--size-ranges), not a complete transcription of draft ARC success criteria. Local font measurement uses the Chromium-only Local Font Access API; it does not work in Firefox or Safari, and this project currently provides no fallback there. In Chromium on a secure context, the API can measure an installed face’s lowercase x-height against a local Arial/Helvetica reference and adjust the APCA font-size lookup. WCAG continues to use the entered CSS font size. X-height measurements stay temporary during ordinary pair checks; they are saved with the review only when the pair is added to a project ARC inventory.

To build a project-wide ARC review, expand the optional review disclosure in the results panel. A checked text use in “Set the scene” is added to that inventory when contrast is checked; giving an existing entry’s name updates it. The disclosure collects scope, inventory, font qualification, body-text, and exchange-rule evidence, then shows the configured Bronze/Silver/Gold project-level checks. It also supports importing and exporting a JSON review packet. Review data is stored in browser local storage until cleared.

The ordinary WCAG/APCA readout evaluates only the current color pair; it remains independent of the optional project review and is not changed by project evidence. “Ready for review” means only that the configured project-level checks and submitted evidence fields are complete. It is not an ARC conformance determination: inventory completeness, the current draft's full criteria, font qualification, and exchange-rule validity still require independent review. Do not present the export as certification.

### Non-text APCA thresholds

The [APCA in a Nutshell use-case guidance](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html#use-case--size-ranges) does not set one threshold for every non-text item. It gives `Lc 45` for pictogram fine details and small outline icons, `Lc 30` for large, solid semantic icons or pictograms, and `Lc 15` for non-semantic items that need to remain discernible. The `Lc 30` and `Lc 15` levels assume the shape is at least 5.5 CSS px and 5 CSS px in its smallest dimension, respectively. The validator reports the Lc thresholds only; it cannot assess an item's rendered dimensions or whether it is semantic.

## Define shared design-system contracts

Put the color pairs and typography requirements in `src/contrast/design-system-contracts.ts`. Keeping these values separate from the test runner lets both Vitest and the CLI apply the same checks.

```typescript
import type { TypographyRequirement } from "./contrast-validator";

export interface SemanticContract {
  name: string;
  text: string;
  background: string;
  typography: TypographyRequirement;
}

export const designSystemContracts: SemanticContract[] = [
  {
    name: "Light mode page title",
    text: "oklch(0.16 0.088 255)",
    background: "oklch(0.98 0.015 255)",
    typography: { fontSizePx: 32, fontWeight: 700 },
  },
  {
    name: "Light mode body text",
    text: "oklch(0.23 0.121 255)",
    background: "oklch(0.98 0.015 255)",
    typography: { fontSizePx: 16, fontWeight: 400 },
  },
  {
    name: "Light mode button label",
    text: "#ffffff",
    background: "oklch(0.49 0.209 255)",
    typography: { fontSizePx: 15, fontWeight: 600 },
  },
  {
    name: "Dark mode page title",
    text: "oklch(0.97 0.033 255)",
    background: "oklch(0.11 0.015 255)",
    typography: { fontSizePx: 32, fontWeight: 700 },
  },
  {
    name: "Dark mode body text",
    text: "oklch(0.86 0.132 255)",
    background: "oklch(0.11 0.015 255)",
    typography: { fontSizePx: 18, fontWeight: 400 },
  },
  {
    name: "Dark mode button label",
    text: "oklch(0.11 0.015 255)",
    background: "oklch(0.82 0.08 255)",
    typography: { fontSizePx: 16, fontWeight: 600 },
  },
];
```

## Specification test suite (`tokens.contrast.spec.ts`)

Create `src/__tests__/tokens.contrast.spec.ts` in the dedicated test directory. Vitest runs one test per color pair, checking WCAG 2.1 AA and APCA typography outcomes independently. This exercises the same light- and dark-mode use cases that the CLI checks. Run the suite locally with `npx vitest run src/__tests__/tokens.contrast.spec.ts`.

```typescript
import { describe, it, expect } from "vitest";
import { APCA_FONT_SIZE_SENTINELS } from "../contrast/contrast-validator";
import { evaluateContrast } from "../contrast/contrast-validator";
import { designSystemContracts } from "../contrast/design-system-contracts";

describe("Design System Color Contrast Compliance (WCAG 2.1 and APCA)", () => {
  for (const contract of designSystemContracts) {
    it(`evaluates ${contract.name}`, () => {
      const evaluation = evaluateContrast({
        textColor: contract.text,
        backgroundColor: contract.background,
        description: contract.name,
        typography: contract.typography,
      });

      // 1. WCAG 2.1 Verification
      expect(
        evaluation.wcag.passAa,
        `WCAG 2.1 AA failed for ${contract.name} (ratio: ${evaluation.wcag.ratio}:1)`
      ).toBe(true);

      // 2. APCA Typography Matrix Verification
      expect(
        evaluation.apca.passTypography,
        `APCA typography failed for ${contract.name} at ${contract.typography.fontSizePx}px and weight ${contract.typography.fontWeight} (Lc: ${evaluation.apca.lightnessContrast})`
      ).toBe(true);
    });
  }

  it("does not treat APCA lookup sentinels as font sizes", () => {
    const nonTextOnly = evaluateContrast({
      textColor: "#cccccc",
      backgroundColor: "#ffffff",
      description: "Non-text-only APCA contrast",
      typography: { fontSizePx: 1000, fontWeight: 400 },
    });
    const insufficient = evaluateContrast({
      textColor: "#f8f8f8",
      backgroundColor: "#ffffff",
      description: "Insufficient APCA contrast",
      typography: { fontSizePx: 1000, fontWeight: 400 },
    });

    expect(nonTextOnly.apca.recommendedSizes[400]).toBe(APCA_FONT_SIZE_SENTINELS.nonTextOnly);
    expect(nonTextOnly.apca.passTypography).toBe(false);
    expect(nonTextOnly.apca.nonTextUi.passFineDetailOrOutline).toBe(false);
    expect(nonTextOnly.apca.nonTextUi.passLargeSolidSemantic).toBe(false);
    expect(nonTextOnly.apca.nonTextUi.passNonSemantic).toBe(true);
    expect(insufficient.apca.recommendedSizes[400]).toBe(APCA_FONT_SIZE_SENTINELS.insufficientContrast);
    expect(insufficient.apca.passTypography).toBe(false);
  });

  it("uses the 14 pt threshold for bold WCAG large text", () => {
    const evaluation = evaluateContrast({
      textColor: "#777777",
      backgroundColor: "#ffffff",
      description: "14 pt bold text",
      typography: { fontSizePx: (14 * 96) / 72, fontWeight: 700 },
    });

    expect(evaluation.wcag.passAa).toBe(true);
    expect(evaluation.wcag.ratio).toBeLessThan(4.5);
    expect(evaluation.apca.passTypography).toBe(true);
  });

  it("reports WCAG and APCA outcomes independently", () => {
    const evaluation = evaluateContrast({
      textColor: "#47083b",
      backgroundColor: "#10c3f0",
      description: "WCAG passes while APCA misses Lc 60",
    });

    expect(evaluation.wcag.passAa).toBe(true);
    expect(evaluation.apca.passLc60).toBe(false);
  });
});
```

## CLI contract check

The CLI runs the shared design-system contracts without a test runner. Use it for an immediate local check. Create `src/cli/contrast-check.ts`:

```typescript
import { evaluateContrast } from "../contrast/contrast-validator";
import { designSystemContracts } from "../contrast/design-system-contracts";

let failed = false;

for (const contract of designSystemContracts) {
  const result = evaluateContrast({
    textColor: contract.text,
    backgroundColor: contract.background,
    description: contract.name,
    typography: contract.typography,
  });
  const wcagPass = result.wcag.passAa;
  const apcaPass = result.apca.passTypography ?? result.apca.passLc60;

  console.log(
    `${contract.name}: WCAG AA ${wcagPass ? "PASS" : "FAIL"} (${result.wcag.ratio}:1), APCA ${apcaPass ? "PASS" : "FAIL"} (Lc ${result.apca.lightnessContrast})`
  );
  if (!wcagPass || !apcaPass) failed = true;
}

if (failed) {
  console.error("One or more contrast contracts failed.");
  process.exitCode = 1;
}
```

Add a script to `package.json`:

```bash
npm pkg set "scripts.contrast:check=tsx src/cli/contrast-check.ts"
```

Run `npm run contrast:check` directly. The nonzero exit status indicates when one or more contracts fail; use the Vitest suite instead if you prefer test-runner output.

## Browser interface

For interactive checks, create `src/web/main.ts` and point the module script in `index.html` to `/src/web/main.ts`. The form accepts CSS color strings and typography, then displays the engine's result. Text fields allow values such as `oklch()` that a native color input cannot represent. The live result region announces updates to assistive technology.

```typescript
import "./style.css";
import {
  evaluateContrast,
  type FontWeight,
} from "../contrast/contrast-validator";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Vite app root #app was not found.");

app.innerHTML = `
  <main class="contrast-tool">
    <p class="eyebrow">Accessibility utility</p>
    <h1>Color contrast checker</h1>
    <p>Check a text and background color against WCAG 2.1 and APCA.</p>
    <form id="contrast-form">
      <label for="text-color">Text color</label>
      <input id="text-color" name="textColor" value="oklch(0.23 0.121 255)" required>
      <label for="background-color">Background color</label>
      <input id="background-color" name="backgroundColor" value="oklch(0.98 0.015 255)" required>
      <label for="font-size">Font size (px)</label>
      <input id="font-size" name="fontSizePx" type="number" min="1" step="1" value="16" required>
      <label for="font-weight">Font weight</label>
      <select id="font-weight" name="fontWeight">
        <option>100</option><option>200</option><option>300</option>
        <option selected>400</option><option>500</option><option>600</option>
        <option>700</option><option>800</option><option>900</option>
      </select>
      <button type="submit">Check contrast</button>
    </form>
    <section id="contrast-result" class="result" role="status" aria-live="polite" aria-atomic="true" hidden></section>
  </main>
`;

const form = document.querySelector<HTMLFormElement>("#contrast-form");
const result = document.querySelector<HTMLElement>("#contrast-result");
if (!form || !result) throw new Error("Contrast checker form could not be initialized.");

function isFontWeight(value: number): value is FontWeight {
  return [100, 200, 300, 400, 500, 600, 700, 800, 900].includes(value);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = new FormData(form);
  const fontSizePx = Number(values.get("fontSizePx"));
  const fontWeight = Number(values.get("fontWeight"));

  if (!Number.isFinite(fontSizePx) || fontSizePx <= 0 || !isFontWeight(fontWeight)) {
    result.hidden = false;
    result.className = "result result--fail";
    result.textContent = "Enter a valid font size and weight.";
    return;
  }

  try {
    const report = evaluateContrast({
      textColor: String(values.get("textColor")),
      backgroundColor: String(values.get("backgroundColor")),
      description: "Browser color check",
      typography: { fontSizePx, fontWeight },
    });
    const rows: [string, string][] = [
      ["WCAG 2.1 AA", report.wcag.passAa ? "Pass" : "Fail"],
      ["WCAG 2.1 AAA", report.wcag.passAaa ? "Pass" : "Fail"],
      ["WCAG 2.1 ratio", `${report.wcag.ratio}:1`],
      ["APCA Lc", String(report.apca.lightnessContrast)],
    ];
    const heading = document.createElement("h2");
    heading.textContent = "Contrast results";
    const details = document.createElement("dl");

    for (const [label, value] of rows) {
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      details.append(term, description);
    }

    result.hidden = false;
    result.className = "result";
    result.replaceChildren(heading, details);
  } catch (error) {
    result.hidden = false;
    result.className = "result result--fail";
    result.textContent = error instanceof Error
      ? `Could not evaluate these colors: ${error.message}`
      : "Could not evaluate these colors.";
  }
});
```

Create `src/web/style.css` with basic styling for a readable single-column form, visible keyboard focus, and distinct pass/fail results:

```css
:root {
  font: 100%/1.5 system-ui, sans-serif;
  color: #172a2a;
  background: #f4f7f6;
}

* { box-sizing: border-box; }
body { margin: 0; }
.contrast-tool {
  max-width: 42rem;
  margin: 4rem auto;
  padding: 2rem;
  background: #fff;
  border: 1px solid #d7e2df;
  border-radius: 0.75rem;
}
.eyebrow { color: #176b5b; font-weight: 700; }
form { display: grid; gap: 0.5rem; }
label { margin-top: 0.75rem; font-weight: 600; }
input, select, button {
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #8b9b97;
  border-radius: 0.375rem;
  font: inherit;
}
input:focus-visible, select:focus-visible, button:focus-visible {
  outline: 3px solid #176b5b;
  outline-offset: 2px;
}
button {
  margin-top: 1rem;
  color: #fff;
  background: #176b5b;
  border-color: #176b5b;
  font-weight: 700;
  cursor: pointer;
}
.result { margin-top: 1.5rem; padding: 1rem; border-left: 4px solid; }
.result--pass { background: #edf7f1; border-color: #247044; }
.result--fail { background: #fff3ef; border-color: #a33b25; }
.result dl { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; }
.result dd { margin: 0; font-variant-numeric: tabular-nums; }
@media (max-width: 36rem) {
  .contrast-tool { margin: 1rem; padding: 1.25rem; }
}
```

## CI

No CI workflow is configured in this project. Run `npm test` to execute the specification suite.
