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
