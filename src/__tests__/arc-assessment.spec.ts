import { describe, expect, it } from "vitest";
import {
  EMPTY_ARC_ASSESSMENT,
  assessArc,
  equivalentReferenceFontSize,
  type ArcAssessmentData,
} from "../arc/arc-assessment";

function completeAssessment(): ArcAssessmentData {
  return {
    project: {
      projectName: "Example product",
      scope: "All application screens, light theme, desktop and mobile.",
      inventoryComplete: true,
      inventoryEvidence: "Inventory reviewed 2026-10-22",
      bodyReviewComplete: true,
      bodyReviewEvidence: "Body text checked by reviewer; review note 42",
    },
    textUses: [
      {
        id: "body",
        name: "Article body",
        useCase: "body",
        textColor: "#222222",
        backgroundColor: "#ffffff",
        fontFamily: "Example Sans",
        fontSizePx: 16,
        fontWeight: 400,
      },
      {
        id: "spot",
        name: "Placeholder",
        useCase: "spot",
        textColor: "#222222",
        backgroundColor: "#ffffff",
        fontFamily: "Example Sans",
        fontSizePx: 16,
        fontWeight: 400,
      },
    ],
    fontEvidence: [
      {
        family: "Example Sans",
        qualified: true,
        reviewed: true,
        evidence: "Font qualification test 42",
      },
    ],
    fontTests: [
      {
        family: "Example Sans",
        fullName: "Example Sans Regular",
        postscriptName: "ExampleSans-Regular",
        style: "Regular",
        fontWeight: 400,
        measuredXHeightPx: 50,
        referenceXHeightPx: 50,
        xHeightRatio: 1,
        testedAt: "2026-10-22T00:00:00.000Z",
      },
    ],
    exchangeRules: [
      { name: "User-selected text scale", evidence: "Test 1", reviewed: true },
      { name: "Spacing adjustment", evidence: "Test 2", reviewed: true },
    ],
  };
}

describe("ARC draft assessment", () => {
  it("requires a scoped inventory and evidence before any level is review-ready", () => {
    const result = assessArc(EMPTY_ARC_ASSESSMENT);

    expect(result.levels.bronze.status).toBe("incomplete");
    expect(result.levels.silver.status).toBe("incomplete");
    expect(result.levels.gold.status).toBe("incomplete");
  });

  it("reports completed checks as ready for independent review, not certified", () => {
    const result = assessArc(completeAssessment());

    expect(result.levels.bronze.status).toBe("ready-for-review");
    expect(result.levels.silver.status).toBe("ready-for-review");
    expect(result.levels.gold.status).toBe("ready-for-review");
    expect(result.levels.gold.summary).toContain("independent ARC review");
  });

  it("fails Bronze when a text use misses its configured use-case Lc target", () => {
    const data = completeAssessment();
    data.textUses[1] = {
      ...data.textUses[1],
      textColor: "#f8f8f8",
    };

    const result = assessArc(data);
    const placeholder = result.textResults.find((item) => item.entry.id === "spot");

    expect(placeholder?.bronzeRequiredLc).toBe(30);
    expect(placeholder?.bronzePass).toBe(false);
    expect(result.levels.bronze.status).toBe("criteria-not-met");
    expect(result.levels.gold.status).toBe("criteria-not-met");
  });

  it("requires reviewer-confirmed font qualification and enough exchange rules", () => {
    const data = completeAssessment();
    data.fontEvidence[0].qualified = false;
    data.exchangeRules = data.exchangeRules.slice(0, 1);

    const result = assessArc(data);

    expect(result.levels.silver.status).toBe("criteria-not-met");
    expect(result.levels.gold.status).toBe("criteria-not-met");
    expect(
      result.levels.gold.checks.find((check) =>
        check.label.includes("font qualification"),
      )?.status,
    ).toBe("failed");
    expect(
      result.levels.gold.checks.find((check) =>
        check.label.includes("exchange rules"),
      )?.status,
    ).toBe("missing");
  });

  it("does not mark Silver ready if body text is missing", () => {
    const data = completeAssessment();
    data.textUses = data.textUses.filter((item) => item.useCase !== "body");

    expect(assessArc(data).levels.silver.status).toBe("incomplete");
  });

  it("normalizes CSS font size by the measured x-height ratio", () => {
    expect(equivalentReferenceFontSize(16, 0.9)).toBeCloseTo(14.4);
    expect(equivalentReferenceFontSize(20, 1.1)).toBeCloseTo(22);
  });

  it("uses the normalized size for APCA typography lookups", () => {
    const data = completeAssessment();
    const baseline = assessArc(data).textResults[0];
    data.fontTests[0].xHeightRatio = 0.5;
    const normalized = assessArc(data).textResults[0];

    expect(normalized.normalizedFontSizePx).toBe(8);
    expect(normalized.report.apca.passTypography).toBe(false);
    expect(baseline.report.apca.passTypography).toBe(true);
  });

  it("requires matching local-font x-height measurements for Silver and Gold lookups", () => {
    const data = completeAssessment();
    data.fontTests = [];

    const result = assessArc(data);

    expect(result.levels.bronze.status).toBe("ready-for-review");
    expect(result.levels.silver.status).toBe("incomplete");
    expect(result.levels.gold.status).toBe("incomplete");
    expect(
      result.levels.silver.checks.find((check) =>
        check.label.includes("typography lookup"),
      )?.status,
    ).toBe("missing");
  });
});
