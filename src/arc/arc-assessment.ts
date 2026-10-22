import {
  APCA_FONT_SIZE_SENTINELS,
  evaluateContrast,
  type FontWeight,
  type ValidationReport,
} from "../contrast/contrast-validator";

export const ARC_USE_CASES = [
  {
    id: "body",
    label: "Body / block text",
    minimumLc: 75,
    description: "Primary body or column text; APCA guidance recommends Lc 75 minimum.",
  },
  {
    id: "fluent",
    label: "Other fluent content",
    minimumLc: 60,
    description: "Content intended to be read, but not body, column, or block text.",
  },
  {
    id: "subfluent",
    label: "Sub-fluent content",
    minimumLc: 45,
    description: "Secondary content that is not intended for fluent reading.",
  },
  {
    id: "spot",
    label: "Spot / non-fluent text",
    minimumLc: 30,
    description: "Short labels, placeholders, disabled text, or similar spot-readable text.",
  },
] as const;

export type ArcUseCase = (typeof ARC_USE_CASES)[number]["id"];

export interface ArcTextUse {
  id: string;
  name: string;
  useCase: ArcUseCase;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
  fontSizePx: number;
  fontWeight: FontWeight;
}

export interface ArcFontEvidence {
  family: string;
  qualified: boolean;
  reviewed: boolean;
  evidence: string;
}

export interface ArcLocalFontTest {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  fontWeight: FontWeight;
  measuredXHeightPx: number;
  referenceXHeightPx: number;
  xHeightRatio: number;
  testedAt: string;
}

export interface ArcExchangeRuleEvidence {
  name: string;
  evidence: string;
  reviewed: boolean;
}

export interface ArcProjectEvidence {
  projectName: string;
  scope: string;
  inventoryComplete: boolean;
  inventoryEvidence: string;
  bodyReviewComplete: boolean;
  bodyReviewEvidence: string;
}

export interface ArcAssessmentData {
  project: ArcProjectEvidence;
  textUses: ArcTextUse[];
  fontEvidence: ArcFontEvidence[];
  fontTests: ArcLocalFontTest[];
  exchangeRules: ArcExchangeRuleEvidence[];
}

export interface ArcTextResult {
  entry: ArcTextUse;
  report: ValidationReport;
  bronzePass: boolean;
  bronzeRequiredLc: number;
  lookupPass: boolean;
  silverApplicable: boolean;
  xHeightRatio?: number;
  normalizedFontSizePx?: number;
}

export type ArcLevelStatus = "incomplete" | "criteria-not-met" | "ready-for-review";

export interface ArcLevelResult {
  level: "Bronze" | "Silver" | "Gold";
  status: ArcLevelStatus;
  summary: string;
  checks: Array<{ label: string; status: "complete" | "missing" | "failed"; detail: string }>;
}

export interface ArcAssessmentResult {
  textResults: ArcTextResult[];
  levels: Record<"bronze" | "silver" | "gold", ArcLevelResult>;
}

export const EMPTY_ARC_ASSESSMENT: ArcAssessmentData = {
  project: {
    projectName: "",
    scope: "",
    inventoryComplete: false,
    inventoryEvidence: "",
    bodyReviewComplete: false,
    bodyReviewEvidence: "",
  },
  textUses: [],
  fontEvidence: [],
  fontTests: [],
  exchangeRules: [],
};

export function equivalentReferenceFontSize(
  fontSizePx: number,
  xHeightRatio: number,
): number {
  if (
    !Number.isFinite(fontSizePx) ||
    fontSizePx <= 0 ||
    !Number.isFinite(xHeightRatio) ||
    xHeightRatio <= 0
  ) {
    throw new Error("Font size and x-height ratio must be positive finite numbers.");
  }
  return fontSizePx * xHeightRatio;
}

function findXHeightTest(
  entry: ArcTextUse,
  tests: ArcLocalFontTest[],
): ArcLocalFontTest | undefined {
  return tests
    .filter(
      (test) =>
        test.family.toLocaleLowerCase() === entry.fontFamily.toLocaleLowerCase() &&
        test.fontWeight === entry.fontWeight,
    )
    .sort((first, second) => second.testedAt.localeCompare(first.testedAt))[0];
}

function findFontEvidence(family: string, evidence: ArcFontEvidence[]): ArcFontEvidence | undefined {
  return evidence.find((item) => item.family.toLocaleLowerCase() === family.toLocaleLowerCase());
}

function countReviewedRules(rules: ArcExchangeRuleEvidence[]): number {
  return new Set(
    rules
      .filter((rule) => rule.reviewed && rule.name.trim() && rule.evidence.trim())
      .map((rule) => rule.name.trim().toLocaleLowerCase()),
  ).size;
}

function buildLevelResult(
  level: ArcLevelResult["level"],
  checks: ArcLevelResult["checks"],
): ArcLevelResult {
  const failed = checks.some((check) => check.status === "failed");
  const incomplete = checks.some((check) => check.status === "missing");
  const status: ArcLevelStatus = failed
    ? "criteria-not-met"
    : incomplete
      ? "incomplete"
      : "ready-for-review";

  const summary =
    status === "criteria-not-met"
      ? "One or more configured checks are not met."
      : status === "incomplete"
        ? "Add the missing inventory or supporting evidence."
        : "Recorded checks are complete. Submit evidence for independent ARC review.";

  return { level, status, summary, checks };
}

export function assessArc(data: ArcAssessmentData): ArcAssessmentResult {
  const textResults = data.textUses.map((entry): ArcTextResult => {
    const fontTest = findXHeightTest(entry, data.fontTests);
    const normalizedFontSizePx = fontTest
      ? equivalentReferenceFontSize(entry.fontSizePx, fontTest.xHeightRatio)
      : undefined;
    const report = evaluateContrast({
      textColor: entry.textColor,
      backgroundColor: entry.backgroundColor,
      description: entry.name,
      typography: {
        fontSizePx: normalizedFontSizePx ?? entry.fontSizePx,
        fontWeight: entry.fontWeight,
      },
    });
    const useCase = ARC_USE_CASES.find((item) => item.id === entry.useCase);
    if (!useCase) throw new Error(`Unsupported ARC text use case: ${entry.useCase}`);

    const isSentinel =
      report.apca.minFontSizeForWeight === APCA_FONT_SIZE_SENTINELS.nonTextOnly ||
      report.apca.minFontSizeForWeight === APCA_FONT_SIZE_SENTINELS.insufficientContrast;

    return {
      entry,
      report,
      bronzePass: report.apca.absLc >= useCase.minimumLc,
      bronzeRequiredLc: useCase.minimumLc,
      lookupPass: report.apca.passTypography === true && !isSentinel,
      silverApplicable: entry.useCase !== "spot",
      xHeightRatio: fontTest?.xHeightRatio,
      normalizedFontSizePx,
    };
  });

  const inventoryComplete =
    data.project.inventoryComplete &&
    data.project.scope.trim().length > 0 &&
    data.project.inventoryEvidence.trim().length > 0 &&
    textResults.length > 0;

  const bronzeChecks: ArcLevelResult["checks"] = [
    {
      label: "Scoped text inventory",
      status: inventoryComplete ? "complete" : "missing",
      detail: inventoryComplete
        ? `${textResults.length} inventoried text uses; scope and completeness evidence recorded.`
        : "Record the scope, all applicable text uses, and evidence that the inventory is complete.",
    },
    ...textResults.map(({ entry, report, bronzePass, bronzeRequiredLc }) => ({
      label: entry.name,
      status: bronzePass ? ("complete" as const) : ("failed" as const),
      detail: `|Lc ${report.apca.lightnessContrast}| / ${bronzeRequiredLc} required for ${ARC_USE_CASES.find((item) => item.id === entry.useCase)?.label}.`,
    })),
  ];

  const silverEntries = textResults.filter((item) => item.silverApplicable);
  const silverBodyEntries = textResults.filter((item) => item.entry.useCase === "body");
  const silverFontFamilies = [
    ...new Set(
      data.textUses
        .filter((entry) => entry.useCase === "body")
        .map((entry) => entry.fontFamily.trim())
        .filter(Boolean),
    ),
  ];
  const silverRuleCount = countReviewedRules(data.exchangeRules);
  const silverChecks: ArcLevelResult["checks"] = [
    {
      label: "Fluent and sub-fluent text inventory",
      status:
        inventoryComplete && silverEntries.length > 0
          ? "complete"
          : "missing",
      detail:
        inventoryComplete && silverEntries.length > 0
          ? `${silverEntries.length} covered text uses. Spot-only uses are outside this Silver lookup check.`
          : "Record a complete scoped inventory with at least one fluent or sub-fluent text use.",
    },
    {
      label: "Body-text coverage",
      status: silverBodyEntries.length > 0 ? "complete" : "missing",
      detail:
        silverBodyEntries.length > 0
          ? `${silverBodyEntries.length} body-text use(s) included.`
          : "Include body / block text to assess the body-font qualification requirement.",
    },
    ...silverEntries.map(({ entry, lookupPass, report }) => ({
      label: `${entry.name} typography lookup`,
      status: !findXHeightTest(entry, data.fontTests)
        ? ("missing" as const)
        : lookupPass &&
            textResults.find((item) => item.entry.id === entry.id)?.bronzePass
          ? ("complete" as const)
          : ("failed" as const),
      detail: !findXHeightTest(entry, data.fontTests)
        ? `Run a local-font x-height test for ${entry.fontFamily} at weight ${entry.fontWeight} before applying the lookup.`
        : lookupPass &&
            textResults.find((item) => item.entry.id === entry.id)?.bronzePass
          ? `Passes at ${textResults.find((item) => item.entry.id === entry.id)?.normalizedFontSizePx?.toFixed(1)}px x-height-equivalent / ${entry.fontWeight} (Lc ${report.apca.lightnessContrast}).`
          : `Does not meet both its use-case Lc target and APCA lookup after x-height normalization (Lc ${report.apca.lightnessContrast}).`,
    })),
    ...silverFontFamilies.map((family) => {
      const evidence = findFontEvidence(family, data.fontEvidence);
      const complete = Boolean(
        evidence?.reviewed && evidence.qualified && evidence.evidence.trim(),
      );
      return {
        label: `${family} body-font qualification`,
        status: complete
          ? ("complete" as const)
          : evidence?.reviewed && !evidence.qualified
            ? ("failed" as const)
            : ("missing" as const),
        detail: complete
          ? "Qualification is recorded with an evidence reference."
          : "Record reviewer-confirmed qualification and its evidence reference.",
      };
    }),
    {
      label: "At least one reviewed exchange rule",
      status: silverRuleCount > 0 ? "complete" : "missing",
      detail:
        silverRuleCount > 0
          ? `${silverRuleCount} distinct rule(s) have a description, evidence reference, and reviewer confirmation.`
          : "Document and review at least one applicable exchange rule.",
    },
  ];

  const goldEntries = textResults;
  const goldFontFamilies = [
    ...new Set(
      data.textUses
        .filter((entry) => entry.useCase !== "spot")
        .map((entry) => entry.fontFamily.trim())
        .filter(Boolean),
    ),
  ];
  const goldRuleCount = countReviewedRules(data.exchangeRules);
  const goldChecks: ArcLevelResult["checks"] = [
    {
      label: "Complete all-text inventory",
      status: inventoryComplete ? "complete" : "missing",
      detail: inventoryComplete
        ? `${textResults.length} text uses recorded across the declared scope.`
        : "Record scope, every text use (including spot text), and inventory evidence.",
    },
    ...goldEntries.map(({ entry, lookupPass, report }) => ({
      label: `${entry.name} typography lookup`,
      status: !findXHeightTest(entry, data.fontTests)
        ? ("missing" as const)
        : lookupPass &&
            textResults.find((item) => item.entry.id === entry.id)?.bronzePass
          ? ("complete" as const)
          : ("failed" as const),
      detail: !findXHeightTest(entry, data.fontTests)
        ? `Run a local-font x-height test for ${entry.fontFamily} at weight ${entry.fontWeight} before applying the lookup.`
        : lookupPass &&
            textResults.find((item) => item.entry.id === entry.id)?.bronzePass
          ? `Passes at ${textResults.find((item) => item.entry.id === entry.id)?.normalizedFontSizePx?.toFixed(1)}px x-height-equivalent / ${entry.fontWeight} (Lc ${report.apca.lightnessContrast}).`
          : `Does not meet both its use-case Lc target and APCA lookup after x-height normalization (Lc ${report.apca.lightnessContrast}).`,
    })),
    ...goldFontFamilies.map((family) => {
      const evidence = findFontEvidence(family, data.fontEvidence);
      const complete = Boolean(
        evidence?.reviewed && evidence.qualified && evidence.evidence.trim(),
      );
      return {
        label: `${family} fluent-text font qualification`,
        status: complete
          ? ("complete" as const)
          : evidence?.reviewed && !evidence.qualified
            ? ("failed" as const)
            : ("missing" as const),
        detail: complete
          ? "Qualification is recorded with an evidence reference."
          : "Record reviewer-confirmed qualification and its evidence reference.",
      };
    }),
    {
      label: "Stricter body-text review",
      status:
        data.project.bodyReviewComplete && data.project.bodyReviewEvidence.trim()
          ? "complete"
          : "missing",
      detail:
        data.project.bodyReviewComplete && data.project.bodyReviewEvidence.trim()
          ? "Reviewer attestation and evidence reference are recorded."
          : "Record a reviewer attestation that body-text requirements were checked, with evidence.",
    },
    {
      label: "At least two reviewed exchange rules",
      status: goldRuleCount >= 2 ? "complete" : "missing",
      detail:
        goldRuleCount >= 2
          ? `${goldRuleCount} distinct rules have descriptions, evidence references, and reviewer confirmation.`
          : `Record and review at least two distinct applicable exchange rules (${goldRuleCount}/2 recorded).`,
    },
  ];

  return {
    textResults,
    levels: {
      bronze: buildLevelResult("Bronze", bronzeChecks),
      silver: buildLevelResult("Silver", silverChecks),
      gold: buildLevelResult("Gold", goldChecks),
    },
  };
}

export function makeArcTextUse(
  input: Omit<ArcTextUse, "id">,
  id = globalThis.crypto.randomUUID(),
): ArcTextUse {
  return { ...input, id };
}
