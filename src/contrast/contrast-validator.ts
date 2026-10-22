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
  passAaNormal: boolean;
  passAaLarge: boolean;
  passAaaNormal: boolean;
  passAaaLarge: boolean;
}

export interface ApcaEvaluation {
  lightnessContrast: number;
  absLc: number;
  minFontSizeForWeight?: number;
  passTypography?: boolean;
  passLc60: boolean;
  recommendedSizes: Record<FontWeight, number>;
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

function evaluateApca(
  pair: ColorPairCheck,
  textColor: Color,
  backgroundColor: Color,
): ApcaEvaluation {
  if (textColor.alpha !== 1 || backgroundColor.alpha !== 1) {
    throw new Error("APCA checks require opaque colors; composite alpha first.");
  }

  const rawLc = backgroundColor.contrast(textColor, "APCA");
  const signedLc = typeof rawLc === "number" ? rawLc : Number.parseFloat(String(rawLc));
  if (!Number.isFinite(signedLc)) {
    throw new Error("APCA could not calculate contrast for these colors.");
  }

  const absLc = Math.abs(signedLc);
  const lookupRaw = fontLookupAPCA(signedLc);
  const weights: FontWeight[] = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const recommendedSizes = {} as Record<FontWeight, number>;

  weights.forEach((weight, index) => {
    recommendedSizes[weight] = lookupRaw
      ? Number(lookupRaw[index + 1])
      : APCA_FONT_SIZE_SENTINELS.insufficientContrast;
  });

  let minFontSizeForWeight: number | undefined;
  let passTypography: boolean | undefined;

  if (pair.typography) {
    minFontSizeForWeight = recommendedSizes[pair.typography.fontWeight];
    passTypography =
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

export function evaluateContrast(pair: ColorPairCheck): ValidationReport {
  const textColor = new Color(pair.textColor);
  const backgroundColor = new Color(pair.backgroundColor);
  if (textColor.alpha !== 1 || backgroundColor.alpha !== 1) {
    throw new Error("Contrast checks require opaque colors; composite alpha first.");
  }

  const wcagRatio = backgroundColor.contrast(textColor, "WCAG21");
  const isLargeText = Boolean(
    pair.typography &&
      (pair.typography.fontSizePx >= 24 ||
        (pair.typography.fontWeight >= 700 &&
          pair.typography.fontSizePx >= (14 * 96) / 72)),
  );

  const wcag: WcagEvaluation = {
    ratio: Number(wcagRatio.toFixed(2)),
    isLargeText,
    passAa: wcagRatio >= (isLargeText ? 3 : 4.5),
    passAaa: wcagRatio >= (isLargeText ? 4.5 : 7),
    passAaNormal: wcagRatio >= 4.5,
    passAaLarge: wcagRatio >= 3,
    passAaaNormal: wcagRatio >= 7,
    passAaaLarge: wcagRatio >= 4.5,
  };

  return {
    pair,
    wcag,
    apca: evaluateApca(pair, textColor, backgroundColor),
  };
}

export function validateScaleSteps(
  scale: Record<string, string>,
  background: string,
  typography?: TypographyRequirement,
): ValidationReport[] {
  return Object.entries(scale).map(([step, colorValue]) =>
    evaluateContrast({
      textColor: colorValue,
      backgroundColor: background,
      description: `Step ${step} against ${background}`,
      typography,
    }),
  );
}
