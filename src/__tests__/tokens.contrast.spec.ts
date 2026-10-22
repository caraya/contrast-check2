import { describe, expect, it } from "vitest";
import {
  APCA_FONT_SIZE_SENTINELS,
  evaluateContrast,
} from "../contrast/contrast-validator";
import { designSystemContracts } from "../contrast/design-system-contracts";

describe("Design system color contrast compliance", () => {
  for (const contract of designSystemContracts) {
    it(`evaluates ${contract.name}`, () => {
      const evaluation = evaluateContrast({
        textColor: contract.text,
        backgroundColor: contract.background,
        description: contract.name,
        typography: contract.typography,
      });

      expect(
        evaluation.wcag.passAa,
        `WCAG 2.1 AA failed for ${contract.name} (ratio: ${evaluation.wcag.ratio}:1)`,
      ).toBe(true);
      expect(
        evaluation.apca.passTypography,
        `APCA typography failed for ${contract.name} at ${contract.typography.fontSizePx}px and weight ${contract.typography.fontWeight} (Lc: ${evaluation.apca.lightnessContrast})`,
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

    expect(nonTextOnly.apca.recommendedSizes[400]).toBe(
      APCA_FONT_SIZE_SENTINELS.nonTextOnly,
    );
    expect(nonTextOnly.apca.passTypography).toBe(false);
    expect(nonTextOnly.apca.nonTextUi.passFineDetailOrOutline).toBe(false);
    expect(nonTextOnly.apca.nonTextUi.passLargeSolidSemantic).toBe(false);
    expect(nonTextOnly.apca.nonTextUi.passNonSemantic).toBe(true);
    expect(insufficient.apca.recommendedSizes[400]).toBe(
      APCA_FONT_SIZE_SENTINELS.insufficientContrast,
    );
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

  it("rejects colors with alpha instead of silently compositing them", () => {
    expect(() =>
      evaluateContrast({
        textColor: "rgb(0 0 0 / 50%)",
        backgroundColor: "#ffffff",
        description: "Translucent text",
      }),
    ).toThrow("Contrast checks require opaque colors; composite alpha first.");
  });

  it("accepts CSS color formats other than OKLCH", () => {
    const evaluation = evaluateContrast({
      textColor: "hsl(0 0% 13.3%)",
      backgroundColor: "rgb(255 255 255)",
      description: "HSL text on RGB background",
    });

    expect(evaluation.wcag.ratio).toBeGreaterThan(15);
    expect(evaluation.apca.lightnessContrast).toBeGreaterThan(90);
  });
});
