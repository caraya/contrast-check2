import "./style.css";
import { evaluateContrast, type FontWeight } from "../contrast/contrast-validator";
import {
  ARC_USE_CASES,
  EMPTY_ARC_ASSESSMENT,
  assessArc,
  equivalentReferenceFontSize,
  makeArcTextUse,
  type ArcAssessmentData,
  type ArcExchangeRuleEvidence,
  type ArcFontEvidence,
  type ArcLevelResult,
  type ArcLocalFontTest,
  type ArcTextUse,
} from "../arc/arc-assessment";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Vite app root #app was not found.");

app.innerHTML = `
  <div class="page-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Contrast Lab home">
        <span class="brand-mark" aria-hidden="true">C</span>
        <span>contrast<span class="brand-light">lab</span></span>
      </a>
      <div class="topbar-note"><span class="status-dot"></span> WCAG 2.1 + APCA</div>
    </header>

    <main>
      <section class="intro" aria-labelledby="page-title">
        <p class="eyebrow"><span>01</span> / COLOR ACCESSIBILITY</p>
        <h1 id="page-title">Make every<br /><em>shade count.</em></h1>
        <p class="intro-copy">A considered color pairing is more than a number. Check your text and background against WCAG 2.1 and APCA.</p>
      </section>

      <section class="panel editor" aria-labelledby="inputs-heading">
          <div class="panel-heading">
            <div>
              <p class="section-index">YOUR COLOR PAIR</p>
              <h2 id="inputs-heading">Set the scene</h2>
            </div>
            <span class="step-label">01 — 02</span>
          </div>

          <form id="contrast-form" novalidate>
            <div class="field">
              <label for="text-color">Text color</label>
              <div class="input-wrap">
                <span class="color-indicator color-indicator--text" id="text-color-indicator" aria-hidden="true"></span>
                <input id="text-color" name="textColor" value="oklch(0.23 0.121 255)" autocomplete="off" spellcheck="false" required aria-describedby="text-hint">
              </div>
              <p class="field-hint" id="text-hint">CSS color formats are converted automatically. Use an opaque color.</p>
            </div>

            <div class="field">
              <label for="background-color">Background color</label>
              <div class="input-wrap">
                <span class="color-indicator color-indicator--background" id="background-color-indicator" aria-hidden="true"></span>
                <input id="background-color" name="backgroundColor" value="oklch(0.98 0.015 255)" autocomplete="off" spellcheck="false" required aria-describedby="background-hint">
              </div>
              <p class="field-hint" id="background-hint">Use an opaque color. Composite transparency first.</p>
            </div>

            <button class="swap-button" id="swap-colors" type="button" aria-label="Swap text and background colors">
              <span aria-hidden="true">↕</span> Swap colors
            </button>

            <div class="field-divider"></div>
            <div class="type-heading">
              <div>
                <p class="section-index">TYPOGRAPHY</p>
                <h3>Text characteristics</h3>
              </div>
              <span class="type-note">Used for APCA &amp; WCAG sizing</span>
            </div>

            <div class="type-fields">
              <div class="field">
                <label for="font-size">Font size <span class="unit">(CSS px)</span></label>
                <input id="font-size" name="fontSizePx" type="number" min="1" step="0.1" value="16" required>
              </div>
              <div class="field">
                <label for="font-weight">Font weight</label>
                <select id="font-weight" name="fontWeight">
                  <option value="100">100 — Thin</option>
                  <option value="200">200 — Extra light</option>
                  <option value="300">300 — Light</option>
                  <option value="400" selected>400 — Regular</option>
                  <option value="500">500 — Medium</option>
                  <option value="600">600 — Semi bold</option>
                  <option value="700">700 — Bold</option>
                  <option value="800">800 — Extra bold</option>
                  <option value="900">900 — Black</option>
                </select>
              </div>
            </div>

            <div class="field font-family-field">
              <label for="font-family">Rendered font family</label>
              <input id="font-family" name="fontFamily" autocomplete="off" placeholder="Font used by this text">
              <div class="local-font-controls">
                <button class="secondary-button" id="scan-local-fonts" type="button">Choose local fonts</button>
                <label class="local-font-face-picker">
                  <span>Installed font face</span>
                  <select id="local-font-face" disabled>
                    <option value="">Choose fonts to begin</option>
                  </select>
                </label>
                <button class="secondary-button" id="test-local-font" type="button" disabled>Measure x-height</button>
              </div>
              <p class="local-font-status" id="local-font-status" role="status" aria-live="polite">Optional. Chromium on a secure context can measure an installed face and adjust the APCA size lookup. Permission is required to access local fonts.</p>
              <div id="local-font-results" class="local-font-results"></div>
              <p class="local-font-note">The lowercase “x” is measured against a local Arial/Helvetica reference. Its ratio adjusts only the APCA font-size lookup; WCAG uses the entered CSS size. The measurement is saved only when this pair is added to a project ARC review.</p>
            </div>

            <div class="field arc-use-case-field">
              <label for="arc-use-case">Reading purpose <span class="unit">(ARC screening)</span></label>
              <select id="arc-use-case" name="useCase">
                ${ARC_USE_CASES.map((item) => `<option value="${item.id}">${item.label} — Lc ${item.minimumLc} guide</option>`).join("")}
              </select>
              <p class="field-hint">Adds a use-case Lc screen to results; this is not a conformance determination.</p>
            </div>

            <details class="arc-pair-inventory">
              <summary>Add this check to a project ARC review</summary>
              <div class="field">
                <label for="arc-entry-name">Text use / component</label>
                <input id="arc-entry-name" name="name" autocomplete="off" placeholder="Article body, button label…">
                <p class="field-hint">When selected, the next contrast check saves this entry. Reusing its name updates the existing inventory item.</p>
              </div>
              <label class="check-row">
                <input id="include-inventory" name="includeInInventory" type="checkbox">
                <span>Add this pair to the project review inventory</span>
              </label>
            </details>

            <p class="form-error" id="form-error" role="alert" hidden></p>
            <button class="submit-button" type="submit">
              <span>Check contrast</span><span aria-hidden="true">↗</span>
            </button>
          </form>
          <p class="privacy-note"><span aria-hidden="true">◈</span> Runs locally in your browser. Nothing is uploaded.</p>
      </section>

      <div class="workspace results-layout" aria-label="Contrast preview and results">
          <article class="preview-card" id="preview-card" aria-label="Text color preview">
            <div class="preview-topline">
              <span class="preview-label">LIVE PREVIEW</span>
              <span class="preview-meta" id="preview-meta">16px / 400</span>
            </div>
            <p class="preview-sample" id="preview-sample">Design for<br />everyone.</p>
            <p class="preview-subcopy">The best interfaces are clear to all.</p>
            <div class="preview-colors">
              <span><i class="swatch swatch--ink" id="preview-text-swatch"></i><span id="preview-text-color">Text</span></span>
              <span><i class="swatch swatch--paper" id="preview-background-swatch"></i><span id="preview-background-color">Background</span></span>
            </div>
          </article>

          <section class="panel results" aria-labelledby="results-heading">
            <div class="panel-heading results-heading">
              <div>
                <p class="section-index">THE READOUT</p>
                <h2 id="results-heading">Contrast results</h2>
              </div>
              <span class="result-status" id="overall-status">Ready to check</span>
            </div>
            <div id="contrast-result" class="result-content" role="status" aria-live="polite" aria-atomic="true">
              <p class="result-placeholder">Your color pairing is ready. Run a check to see how it measures up.</p>
            </div>
            <p class="apca-note">APCA is a proposed contrast model. Its Lc and font lookup values are reported independently from WCAG 2.1 and do not establish ARC conformance.</p>
          </section>
      </div>

      <details class="arc-review-context">
            <summary>
              <span>
                <strong>Optional project-wide ARC review</strong>
                <small>Record inventory and reviewer evidence; does not alter this pair’s WCAG/APCA results.</small>
              </span>
              <span class="arc-chevron" aria-hidden="true"></span>
            </summary>
            <div class="arc-review-content">
              <div class="arc-review-toolbar">
                <p id="assessment-notice" class="assessment-notice" role="status" aria-live="polite"></p>
                <div class="arc-review-actions">
                  <button class="export-button export-button--secondary" id="import-assessment" type="button">Import packet</button>
                  <input id="assessment-file" type="file" accept="application/json,.json" hidden>
                  <button class="export-button" id="export-assessment" type="button">Export review packet</button>
                </div>
              </div>
              <div id="assessment-load-error" class="form-error" role="alert" hidden></div>
              <form id="project-evidence-form" class="assessment-panel">
                <div class="assessment-panel-heading">
                  <div><h3>Define the review scope</h3><p>Project-wide status depends on this declared scope, a complete inventory, and independent review.</p></div>
                </div>
                <div class="assessment-grid">
                  <div class="field">
                    <label for="project-name">Project / product name</label>
                    <input id="project-name" name="projectName">
                  </div>
                  <div class="field">
                    <label for="project-scope">Pages, themes, and states in scope</label>
                    <input id="project-scope" name="scope" placeholder="Included pages and interaction states">
                  </div>
                </div>
                <label class="check-row">
                  <input id="inventory-complete" name="inventoryComplete" type="checkbox">
                  <span>I reviewed the declared scope and inventoried all applicable text uses.</span>
                </label>
                <div class="field">
                  <label for="inventory-evidence">Inventory evidence reference</label>
                  <input id="inventory-evidence" name="inventoryEvidence" placeholder="Audit date, URL, file, or reviewer note">
                </div>
                <div class="field-divider"></div>
                <label class="check-row">
                  <input id="body-review-complete" name="bodyReviewComplete" type="checkbox">
                  <span>A reviewer checked the stricter body-text criteria for the selected draft.</span>
                </label>
                <div class="field">
                  <label for="body-review-evidence">Body-text review evidence</label>
                  <input id="body-review-evidence" name="bodyReviewEvidence" placeholder="Reviewer, date, method, and evidence reference">
                </div>
                <button class="secondary-button" type="submit">Save project review details</button>
              </form>

              <section class="assessment-panel evidence-panel" aria-labelledby="font-evidence-heading">
                <div class="assessment-panel-heading">
                  <div><h3 id="font-evidence-heading">Font qualification evidence</h3><p>Local metrics are not font qualification; qualification must be reviewed and supported separately.</p></div>
                </div>
                <div id="font-evidence-list" class="evidence-list"></div>
              </section>

              <section class="assessment-panel evidence-panel" aria-labelledby="exchange-evidence-heading">
                <div class="assessment-panel-heading">
                  <div><h3 id="exchange-evidence-heading">Exchange-rule evidence</h3><p>Record distinct rules and evidence, then confirm review against the selected draft.</p></div>
                </div>
                <form id="exchange-rule-form" class="exchange-rule-form">
                  <div class="field">
                    <label for="exchange-rule-name">Rule or adaptation</label>
                    <input id="exchange-rule-name" name="name" required placeholder="Describe the exchange rule assessed">
                  </div>
                  <div class="field">
                    <label for="exchange-rule-evidence">Evidence reference</label>
                    <input id="exchange-rule-evidence" name="evidence" required placeholder="Test, policy, URL, or reviewer record">
                  </div>
                  <label class="check-row">
                    <input id="exchange-rule-reviewed" name="reviewed" type="checkbox">
                    <span>Reviewed against the selected ARC draft by a qualified reviewer</span>
                  </label>
                  <button class="secondary-button" type="submit">Add exchange rule</button>
                </form>
                <div id="exchange-rule-list" class="evidence-list"></div>
              </section>

              <section class="assessment-panel assessment-results" aria-labelledby="level-results-heading">
                <div class="assessment-panel-heading">
                  <div><h3 id="level-results-heading">Project-level level checks</h3><p>These require evidence across the declared scope. “Ready for review” is not certification.</p></div>
                </div>
                <div id="arc-level-results" class="level-results"></div>
              </section>

              <section class="assessment-panel inventory-panel" aria-labelledby="inventory-heading">
                <div class="assessment-panel-heading">
                  <div><h3 id="inventory-heading">Project text inventory</h3><p>Pairs are added from “Set the scene” when you choose to include them.</p></div>
                </div>
                <div id="arc-inventory" class="arc-inventory"></div>
              </section>
              <p class="assessment-disclaimer">The configured screening profile uses APCA guidance and does not fully transcribe draft ARC requirements. Project readiness relies on a complete and accurate inventory, reviewer evidence, and independent confirmation of the current criterion. It does not affect the checker’s WCAG/APCA color-pair calculations.</p>
            </div>
      </details>

      <section class="arc-guide" aria-labelledby="arc-heading">
        <div class="arc-intro">
          <p class="section-index">APCA READABILITY CRITERION</p>
          <h2 id="arc-heading">Three levels. A broader picture.</h2>
          <p>ARC describes draft Bronze, Silver, and Gold levels. Open a level for its checks and evidence requirements.</p>
        </div>
        <div class="arc-accordion">
          <details class="arc-level">
            <summary>
              <span class="arc-level-name"><span class="arc-marker arc-marker--bronze">B</span><span><strong>Bronze</strong><small>Simple Mode</small></span></span>
              <span class="arc-summary-note">Use-case Lc thresholds</span>
              <span class="arc-chevron" aria-hidden="true"></span>
            </summary>
            <div class="arc-detail">
              <p>Bronze Simple Mode compares APCA Lc with thresholds selected for the text’s use case. It does not use the font-size and weight lookup table.</p>
              <p>The checker displays an APCA use-case threshold for the selected text purpose: body Lc 75, fluent Lc 60, sub-fluent Lc 45, or spot text Lc 30. These screening targets are informed by the <a href="https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html#use-case--size-ranges" target="_blank" rel="noreferrer">APCA use-case guide</a>; confirm the adopted ARC draft and each use-case assignment with an independent reviewer.</p>
            </div>
          </details>
          <details class="arc-level">
            <summary>
              <span class="arc-level-name"><span class="arc-marker arc-marker--silver">S</span><span><strong>Silver</strong><small>Text-specific assessment</small></span></span>
              <span class="arc-summary-note">Lookup + additional rules</span>
              <span class="arc-chevron" aria-hidden="true"></span>
            </summary>
            <div class="arc-detail">
              <p>Silver covers fluent and sub-fluent text and uses font-size and weight contrast lookup requirements. It also requires qualified body fonts and at least one additional exchange rule.</p>
              <p>The checker’s ordinary APCA lookup applies to the current pair. Optional project-level readiness also requires a complete fluent/sub-fluent inventory, qualified body fonts, and at least one reviewed exchange rule.</p>
            </div>
          </details>
          <details class="arc-level">
            <summary>
              <span class="arc-level-name"><span class="arc-marker arc-marker--gold">G</span><span><strong>Gold</strong><small>Extended assessment</small></span></span>
              <span class="arc-summary-note">All text + stricter rules</span>
              <span class="arc-chevron" aria-hidden="true"></span>
            </summary>
            <div class="arc-detail">
              <p>Gold extends lookup coverage to all text, requires qualified fluent-text fonts, applies stricter body-text requirements, and requires at least two additional exchange rules.</p>
              <p>Gold extends lookup coverage to all text and requires qualified fluent-text fonts, stricter body-text review, and at least two reviewed exchange rules. Project readiness requires more than checking one color pair and remains subject to independent review.</p>
            </div>
          </details>
        </div>
        <p class="arc-disclaimer">These are draft ARC levels, separate from WCAG 2.1 AA/AAA. The integrated project review tracks supporting evidence but does not certify an ARC level.</p>
      </section>
    </main>

    <footer class="footer">
      <span>Built for more readable interfaces.</span>
      <span>Contrast Lab <span aria-hidden="true">·</span> WCAG 2.1 / APCA</span>
    </footer>
  </div>
`;

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Contrast checker element ${selector} was not found.`);
  return element;
}

const ARC_STORAGE_KEY = "contrast-lab.arc-assessment.v1";
const assessmentNotice = requireElement<HTMLElement>("#assessment-notice");
const assessmentLoadError = requireElement<HTMLElement>("#assessment-load-error");
const projectEvidenceForm = requireElement<HTMLFormElement>("#project-evidence-form");
const fontEvidenceList = requireElement<HTMLElement>("#font-evidence-list");
const exchangeRuleForm = requireElement<HTMLFormElement>("#exchange-rule-form");
const exchangeRuleList = requireElement<HTMLElement>("#exchange-rule-list");
const arcLevelResults = requireElement<HTMLElement>("#arc-level-results");
const arcInventory = requireElement<HTMLElement>("#arc-inventory");
const exportAssessmentButton = requireElement<HTMLButtonElement>("#export-assessment");
const importAssessmentButton = requireElement<HTMLButtonElement>("#import-assessment");
const assessmentFileInput = requireElement<HTMLInputElement>("#assessment-file");
const scanLocalFontsButton = requireElement<HTMLButtonElement>("#scan-local-fonts");
const localFontFaceSelect = requireElement<HTMLSelectElement>("#local-font-face");
const testLocalFontButton = requireElement<HTMLButtonElement>("#test-local-font");
const localFontStatus = requireElement<HTMLElement>("#local-font-status");
const localFontResults = requireElement<HTMLElement>("#local-font-results");
let availableLocalFonts: LocalFontFaceData[] = [];
let activeLocalFontTest: ArcLocalFontTest | undefined;

function findCurrentFontTest(
  family: string,
  fontWeight: FontWeight,
): ArcLocalFontTest | undefined {
  if (
    activeLocalFontTest &&
    activeLocalFontTest.family.toLocaleLowerCase() === family.toLocaleLowerCase() &&
    activeLocalFontTest.fontWeight === fontWeight
  ) {
    return activeLocalFontTest;
  }
  return arcData.fontTests
    .filter(
      (test) =>
        test.family.toLocaleLowerCase() === family.toLocaleLowerCase() &&
        test.fontWeight === fontWeight,
    )
    .sort((first, second) => second.testedAt.localeCompare(first.testedAt))[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArcAssessmentData(value: unknown): value is ArcAssessmentData {
  if (
    !isRecord(value) ||
    !isRecord(value.project) ||
    !Array.isArray(value.textUses) ||
    !Array.isArray(value.fontEvidence) ||
    (value.fontTests !== undefined && !Array.isArray(value.fontTests)) ||
    !Array.isArray(value.exchangeRules)
  ) {
    return false;
  }

  const project = value.project;
  const validProject =
    typeof project.projectName === "string" &&
    typeof project.scope === "string" &&
    typeof project.inventoryComplete === "boolean" &&
    typeof project.inventoryEvidence === "string" &&
    typeof project.bodyReviewComplete === "boolean" &&
    typeof project.bodyReviewEvidence === "string";
  const validTextUses = value.textUses.every(
    (entry) =>
      isRecord(entry) &&
      typeof entry.id === "string" &&
      typeof entry.name === "string" &&
      ARC_USE_CASES.some((useCase) => useCase.id === entry.useCase) &&
      typeof entry.textColor === "string" &&
      typeof entry.backgroundColor === "string" &&
      typeof entry.fontFamily === "string" &&
      typeof entry.fontSizePx === "number" &&
      Number.isFinite(entry.fontSizePx) &&
      typeof entry.fontWeight === "number" &&
      isFontWeight(entry.fontWeight),
  );
  const validFontEvidence = value.fontEvidence.every(
    (entry) =>
      isRecord(entry) &&
      typeof entry.family === "string" &&
      typeof entry.qualified === "boolean" &&
      typeof entry.reviewed === "boolean" &&
      typeof entry.evidence === "string",
  );
  const validFontTests = (value.fontTests ?? []).every(
    (test) =>
      isRecord(test) &&
      typeof test.family === "string" &&
      typeof test.fullName === "string" &&
      typeof test.postscriptName === "string" &&
      typeof test.style === "string" &&
      typeof test.fontWeight === "number" &&
      isFontWeight(test.fontWeight) &&
      typeof test.measuredXHeightPx === "number" &&
      Number.isFinite(test.measuredXHeightPx) &&
      test.measuredXHeightPx > 0 &&
      typeof test.referenceXHeightPx === "number" &&
      Number.isFinite(test.referenceXHeightPx) &&
      test.referenceXHeightPx > 0 &&
      typeof test.xHeightRatio === "number" &&
      Number.isFinite(test.xHeightRatio) &&
      test.xHeightRatio > 0 &&
      Math.abs(
        test.xHeightRatio - test.measuredXHeightPx / test.referenceXHeightPx,
      ) <= 0.005 &&
      typeof test.testedAt === "string",
  );
  const validExchangeRules = value.exchangeRules.every(
    (rule) =>
      isRecord(rule) &&
      typeof rule.name === "string" &&
      typeof rule.evidence === "string" &&
      typeof rule.reviewed === "boolean",
  );

  return (
    validProject &&
    validTextUses &&
    validFontEvidence &&
    validFontTests &&
    validExchangeRules
  );
}

function readStoredAssessment(): ArcAssessmentData {
  const serialized = localStorage.getItem(ARC_STORAGE_KEY);
  if (!serialized) return structuredClone(EMPTY_ARC_ASSESSMENT);

  const parsed: unknown = JSON.parse(serialized);
  if (!isArcAssessmentData(parsed)) {
    throw new Error("Saved ARC assessment data has an unsupported format.");
  }

  return {
    ...parsed,
    fontTests: parsed.fontTests ?? [],
  };
}

let arcData: ArcAssessmentData;
try {
  arcData = readStoredAssessment();
} catch (error) {
  arcData = structuredClone(EMPTY_ARC_ASSESSMENT);
  assessmentLoadError.hidden = false;
  assessmentLoadError.textContent =
    error instanceof Error
      ? `Could not restore the saved assessment: ${error.message}`
      : "Could not restore the saved assessment.";
}

function setAssessmentNotice(message: string, isError = false): void {
  assessmentNotice.textContent = message;
  assessmentNotice.className = isError
    ? "assessment-notice assessment-notice--error"
    : "assessment-notice";
}

function persistAssessment(message: string): void {
  try {
    localStorage.setItem(ARC_STORAGE_KEY, JSON.stringify(arcData));
    setAssessmentNotice(message);
    renderAssessment();
  } catch (error) {
    setAssessmentNotice(
      error instanceof Error
        ? `Could not save assessment data: ${error.message}`
        : "Could not save assessment data.",
      true,
    );
  }
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent !== undefined) element.textContent = textContent;
  return element;
}

function getStoredFontEvidence(family: string): ArcFontEvidence | undefined {
  return arcData.fontEvidence.find(
    (item) => item.family.toLocaleLowerCase() === family.toLocaleLowerCase(),
  );
}

function inferLocalFontWeight(face: LocalFontFaceData): FontWeight {
  const descriptor = `${face.fullName} ${face.style}`.toLocaleLowerCase();
  const numericWeight = descriptor.match(/(?:^|\D)([1-9]00)(?:\D|$)/)?.[1];
  const parsedWeight = Number(numericWeight);
  if (numericWeight && isFontWeight(parsedWeight)) return parsedWeight;
  const compactDescriptor = descriptor.replace(/[\s_-]/g, "");
  if (compactDescriptor.includes("thin")) return 100;
  if (
    compactDescriptor.includes("extralight") ||
    compactDescriptor.includes("ultralight")
  ) {
    return 200;
  }
  if (descriptor.includes("light")) return 300;
  if (
    compactDescriptor.includes("semibold") ||
    compactDescriptor.includes("demibold")
  ) {
    return 600;
  }
  if (
    compactDescriptor.includes("extrabold") ||
    compactDescriptor.includes("ultrabold")
  ) {
    return 800;
  }
  if (descriptor.includes("black") || descriptor.includes("heavy")) return 900;
  if (descriptor.includes("bold")) return 700;
  if (descriptor.includes("medium")) return 500;
  return 400;
}

async function loadLocalFont(face: LocalFontFaceData): Promise<{
  fontFace: FontFace;
  familyAlias: string;
  weight: FontWeight;
}> {
  const familyAlias = `ContrastLabLocal-${crypto.randomUUID()}`;
  const weight = inferLocalFontWeight(face);
  const fontFace = new FontFace(familyAlias, await face.blob().then((blob) => blob.arrayBuffer()), {
    weight: String(weight),
    style: /italic|oblique/i.test(`${face.fullName} ${face.style}`)
      ? "italic"
      : "normal",
  });
  await fontFace.load();
  document.fonts.add(fontFace);
  return { fontFace, familyAlias, weight };
}

function measureLowercaseX(context: CanvasRenderingContext2D, family: string, weight: number): number {
  context.font = `${weight} 100px "${family}"`;
  const xHeight = context.measureText("x").actualBoundingBoxAscent;
  if (!Number.isFinite(xHeight) || xHeight <= 0) {
    throw new Error(`The browser could not measure lowercase x for ${family}.`);
  }
  return xHeight;
}

function renderLocalFontMeasurement(): void {
  localFontResults.replaceChildren();
  if (!activeLocalFontTest) return;
  const selectedFamily = requireElement<HTMLInputElement>("#font-family").value.trim();
  const selectedWeight = Number(requireElement<HTMLSelectElement>("#font-weight").value);
  if (
    activeLocalFontTest.family.toLocaleLowerCase() !== selectedFamily.toLocaleLowerCase() ||
    activeLocalFontTest.fontWeight !== selectedWeight
  ) {
    return;
  }

  const isSavedForReview = arcData.fontTests.some(
    (test) =>
      test.family.toLocaleLowerCase() === activeLocalFontTest?.family.toLocaleLowerCase() &&
      test.fontWeight === activeLocalFontTest.fontWeight &&
      test.postscriptName === activeLocalFontTest.postscriptName,
  );
  localFontResults.append(
    createElement(
      "p",
      "local-font-measurement",
      `${activeLocalFontTest.fullName}: x-height ratio ${activeLocalFontTest.xHeightRatio.toFixed(3)}${isSavedForReview ? " · saved with the project review" : " · session only; saved if this pair is added to the project review"}`,
    ),
  );
}

scanLocalFontsButton.addEventListener("click", async () => {
  if (!window.isSecureContext || !window.queryLocalFonts) {
    localFontStatus.textContent =
      "Local Font Access is unavailable here. Use Chromium on localhost or another secure origin with the API enabled.";
    localFontStatus.className = "local-font-status local-font-status--error";
    return;
  }

  scanLocalFontsButton.disabled = true;
  localFontStatus.textContent =
    "Waiting for Local Font Access permission and reading installed font metadata…";
  localFontStatus.className = "local-font-status";
  try {
    availableLocalFonts = (await window.queryLocalFonts()).filter(
      (face) => !/italic|oblique/i.test(`${face.fullName} ${face.style}`),
    );
    localFontFaceSelect.replaceChildren();
    const placeholder = createElement("option", undefined, "Select an installed font face");
    placeholder.value = "";
    localFontFaceSelect.append(placeholder);

    availableLocalFonts
      .map((face, index) => ({ face, index }))
      .sort((first, second) =>
        first.face.fullName.localeCompare(second.face.fullName),
      )
      .forEach(({ face, index }) => {
        const option = createElement(
          "option",
          undefined,
          `${face.fullName} — ${face.family} (${face.style})`,
        );
        option.value = String(index);
        localFontFaceSelect.append(option);
      });

    localFontFaceSelect.disabled = availableLocalFonts.length === 0;
    testLocalFontButton.disabled = availableLocalFonts.length === 0;
    localFontStatus.textContent =
      availableLocalFonts.length > 0
        ? `Found ${availableLocalFonts.length} upright local font face(s). Select a face to measure.`
        : "No upright local font faces were provided by the browser.";
    localFontStatus.className = "local-font-status";
  } catch (error) {
    localFontStatus.textContent =
      error instanceof Error
        ? `Could not access local fonts: ${error.message}`
        : "Could not access local fonts.";
    localFontStatus.className = "local-font-status local-font-status--error";
  } finally {
    scanLocalFontsButton.disabled = false;
  }
});

testLocalFontButton.addEventListener("click", async () => {
  const selectedIndex = Number(localFontFaceSelect.value);
  const selectedFace = availableLocalFonts[selectedIndex];
  if (!selectedFace) {
    localFontStatus.textContent = "Choose a local font face before measuring.";
    localFontStatus.className = "local-font-status local-font-status--error";
    return;
  }

  activeLocalFontTest = undefined;
  renderLocalFontMeasurement();
  testLocalFontButton.disabled = true;
  localFontStatus.textContent = `Loading ${selectedFace.fullName} and measuring x-height…`;
  localFontStatus.className = "local-font-status";

  let selectedFont: FontFace | undefined;
  let referenceFont: FontFace | undefined;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable in this browser.");

    const selectedLoaded = await loadLocalFont(selectedFace);
    selectedFont = selectedLoaded.fontFace;
    const referenceFace = availableLocalFonts.find(
      (face) =>
        /^(arial|helvetica)$/i.test(face.family.trim()) &&
        inferLocalFontWeight(face) === 400 &&
        !/italic|oblique/i.test(`${face.fullName} ${face.style}`),
    );
    if (!referenceFace) {
      throw new Error(
        "No regular local Arial or Helvetica face is available as an x-height reference.",
      );
    }

    const referenceLoaded = await loadLocalFont(referenceFace);
    referenceFont = referenceLoaded.fontFace;
    await document.fonts.ready;
    const measuredXHeightPx = measureLowercaseX(
      context,
      selectedLoaded.familyAlias,
      selectedLoaded.weight,
    );
    const referenceXHeightPx = measureLowercaseX(
      context,
      referenceLoaded.familyAlias,
      400,
    );
    const test: ArcLocalFontTest = {
      family: selectedFace.family,
      fullName: selectedFace.fullName,
      postscriptName: selectedFace.postscriptName,
      style: selectedFace.style,
      fontWeight: selectedLoaded.weight,
      measuredXHeightPx,
      referenceXHeightPx,
      xHeightRatio: measuredXHeightPx / referenceXHeightPx,
      testedAt: new Date().toISOString(),
    };
    activeLocalFontTest = test;
    localFontStatus.textContent =
      `Tested ${test.fullName}. This measurement is temporary and will be saved only if you add this pair to a project ARC review.`;
    localFontStatus.className = "local-font-status";
    requireElement<HTMLInputElement>("#font-family").value = test.family;
    requireElement<HTMLSelectElement>("#font-weight").value = String(test.fontWeight);
    renderLocalFontMeasurement();
    updatePreview();
  } catch (error) {
    localFontStatus.textContent =
      error instanceof Error
        ? `Could not test this font: ${error.message}`
        : "Could not test this font.";
    localFontStatus.className = "local-font-status local-font-status--error";
  } finally {
    if (selectedFont) document.fonts.delete(selectedFont);
    if (referenceFont) document.fonts.delete(referenceFont);
    testLocalFontButton.disabled = availableLocalFonts.length === 0;
  }
});

function renderFontEvidence(): void {
  fontEvidenceList.replaceChildren();
  const families = [
    ...new Set(
      arcData.textUses.map((entry) => entry.fontFamily.trim()).filter(Boolean),
    ),
  ];

  if (families.length === 0) {
    fontEvidenceList.append(
      createElement(
        "p",
        "evidence-empty",
        "Add text uses to record qualification evidence for the fonts in scope.",
      ),
    );
    return;
  }

  for (const family of families) {
    const saved = getStoredFontEvidence(family);
    const evidenceForm = createElement("form", "font-evidence-item");
    evidenceForm.dataset.family = family;

    const title = createElement("strong", "evidence-title", family);
    const selectLabel = createElement("label", "field");
    const selectCaption = createElement("span", undefined, "Reviewer outcome");
    const outcome = createElement("select");
    outcome.name = "outcome";
    for (const [value, text] of [
      ["unreviewed", "Not reviewed"],
      ["qualified", "Qualified"],
      ["not-qualified", "Not qualified"],
    ]) {
      const option = createElement("option", undefined, text);
      option.value = value;
      outcome.append(option);
    }
    outcome.value = saved ? (saved.qualified ? "qualified" : "not-qualified") : "unreviewed";
    selectLabel.append(selectCaption, outcome);

    const referenceLabel = createElement("label", "field");
    referenceLabel.append(createElement("span", undefined, "Evidence reference"));
    const reference = createElement("input");
    reference.name = "evidence";
    reference.value = saved?.evidence ?? "";
    reference.placeholder = "Font test, qualification record, or reviewer note";
    referenceLabel.append(reference);

    const saveButton = createElement("button", "small-button", "Save font evidence");
    saveButton.type = "submit";
    evidenceForm.append(title, selectLabel, referenceLabel, saveButton);
    evidenceForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = new FormData(evidenceForm);
      const selectedOutcome = String(values.get("outcome"));
      const evidence = String(values.get("evidence")).trim();
      if (selectedOutcome === "unreviewed" || !evidence) {
        setAssessmentNotice("Choose a reviewer outcome and add its evidence reference.", true);
        reference.focus();
        return;
      }

      const record: ArcFontEvidence = {
        family,
        qualified: selectedOutcome === "qualified",
        reviewed: true,
        evidence,
      };
      arcData.fontEvidence = [
        ...arcData.fontEvidence.filter(
          (item) => item.family.toLocaleLowerCase() !== family.toLocaleLowerCase(),
        ),
        record,
      ];
      persistAssessment(`Saved reviewer evidence for ${family}.`);
    });
    fontEvidenceList.append(evidenceForm);
  }
}

function renderExchangeRules(): void {
  exchangeRuleList.replaceChildren();
  if (arcData.exchangeRules.length === 0) {
    exchangeRuleList.append(
      createElement("p", "evidence-empty", "No exchange rules documented yet."),
    );
    return;
  }

  arcData.exchangeRules.forEach((rule, index) => {
    const row = createElement("div", "exchange-rule-item");
    const details = createElement("div", "evidence-copy");
    details.append(
      createElement("strong", undefined, rule.name),
      createElement(
        "span",
        undefined,
        `${rule.reviewed ? "Reviewed" : "Review pending"} · ${rule.evidence}`,
      ),
    );
    const remove = createElement("button", "small-button small-button--quiet", "Remove");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove exchange rule ${rule.name}`);
    remove.addEventListener("click", () => {
      arcData.exchangeRules = arcData.exchangeRules.filter((_, ruleIndex) => ruleIndex !== index);
      persistAssessment("Removed exchange-rule evidence.");
    });
    row.append(details, remove);
    exchangeRuleList.append(row);
  });
}

function renderLevelResult(result: ArcLevelResult): HTMLElement {
  const card = createElement("article", `level-card level-card--${result.status}`);
  const heading = createElement("div", "level-card-heading");
  const title = createElement("h4", undefined, result.level);
  const statusText =
    result.status === "ready-for-review"
      ? "Ready for review"
      : result.status === "criteria-not-met"
        ? "Checks not met"
        : "Evidence needed";
  const badge = createElement("span", "level-status", statusText);
  heading.append(title, badge);
  card.append(heading, createElement("p", "level-summary", result.summary));

  const checks = createElement("ul", "level-check-list");
  result.checks.forEach((check) => {
    const item = createElement("li", `level-check level-check--${check.status}`);
    item.append(
      createElement("strong", undefined, check.label),
      createElement("span", undefined, check.detail),
    );
    checks.append(item);
  });
  card.append(checks);
  return card;
}

function renderInventory(): void {
  arcInventory.replaceChildren();
  if (arcData.textUses.length === 0) {
    arcInventory.append(
      createElement(
        "p",
        "evidence-empty",
        "No text uses yet. Add a body style, content style, or spot-text style to start the inventory.",
      ),
    );
    return;
  }

  const assessment = assessArc(arcData);
  const table = createElement("table", "inventory-table");
  const thead = createElement("thead");
  const headerRow = createElement("tr");
  ["Text use", "Use case", "APCA Lc", "Bronze target", "X-height / lookup size", "Typography", ""].forEach((label) => {
    headerRow.append(createElement("th", undefined, label));
  });
  thead.append(headerRow);
  const tbody = createElement("tbody");
  assessment.textResults.forEach((item) => {
    const row = createElement("tr");
    const useCase = ARC_USE_CASES.find((value) => value.id === item.entry.useCase);
    const lcState = item.bronzePass ? "pass" : "fail";
    const typographyState = item.lookupPass ? "pass" : "fail";
    row.append(
      createElement("th", "inventory-name", item.entry.name),
      createElement("td", undefined, useCase?.label ?? item.entry.useCase),
      createElement("td", `inventory-value inventory-value--${lcState}`, `${item.report.apca.lightnessContrast}`),
      createElement("td", undefined, `≥ ${item.bronzeRequiredLc}`),
      createElement(
        "td",
        "inventory-normalization",
        item.xHeightRatio && item.normalizedFontSizePx
          ? `${item.xHeightRatio.toFixed(3)} · ${item.normalizedFontSizePx.toFixed(1)}px`
          : "Font test needed",
      ),
      createElement(
        "td",
        `inventory-value${item.normalizedFontSizePx ? ` inventory-value--${typographyState}` : ""}`,
        item.normalizedFontSizePx ? (item.lookupPass ? "Pass" : "Does not pass") : "Not tested",
      ),
    );
    const actions = createElement("td");
    const remove = createElement("button", "small-button small-button--quiet", "Remove");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove text use ${item.entry.name}`);
    remove.addEventListener("click", () => {
      arcData.textUses = arcData.textUses.filter((entry) => entry.id !== item.entry.id);
      persistAssessment(`Removed ${item.entry.name} from the inventory.`);
    });
    actions.append(remove);
    row.append(actions);
    tbody.append(row);
  });
  table.append(thead, tbody);
  const scrollRegion = createElement("div", "inventory-scroll");
  scrollRegion.append(table);
  arcInventory.append(scrollRegion);
}

function renderAssessment(): void {
  requireElement<HTMLInputElement>("#project-name").value = arcData.project.projectName;
  requireElement<HTMLInputElement>("#project-scope").value = arcData.project.scope;
  requireElement<HTMLInputElement>("#inventory-complete").checked =
    arcData.project.inventoryComplete;
  requireElement<HTMLInputElement>("#inventory-evidence").value =
    arcData.project.inventoryEvidence;
  requireElement<HTMLInputElement>("#body-review-complete").checked =
    arcData.project.bodyReviewComplete;
  requireElement<HTMLInputElement>("#body-review-evidence").value =
    arcData.project.bodyReviewEvidence;

  const assessment = assessArc(arcData);
  arcLevelResults.replaceChildren(
    renderLevelResult(assessment.levels.bronze),
    renderLevelResult(assessment.levels.silver),
    renderLevelResult(assessment.levels.gold),
  );
  renderFontEvidence();
  renderLocalFontMeasurement();
  renderExchangeRules();
  renderInventory();
}

projectEvidenceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = new FormData(projectEvidenceForm);
  arcData.project = {
    projectName: String(values.get("projectName")).trim(),
    scope: String(values.get("scope")).trim(),
    inventoryComplete: values.has("inventoryComplete"),
    inventoryEvidence: String(values.get("inventoryEvidence")).trim(),
    bodyReviewComplete: values.has("bodyReviewComplete"),
    bodyReviewEvidence: String(values.get("bodyReviewEvidence")).trim(),
  };
  persistAssessment("Saved project scope and review evidence.");
});

exchangeRuleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = new FormData(exchangeRuleForm);
  const rule: ArcExchangeRuleEvidence = {
    name: String(values.get("name")).trim(),
    evidence: String(values.get("evidence")).trim(),
    reviewed: values.has("reviewed"),
  };
  if (!rule.name || !rule.evidence) {
    setAssessmentNotice("Add both an exchange-rule description and its evidence reference.", true);
    return;
  }
  arcData.exchangeRules.push(rule);
  persistAssessment(`Added exchange rule${rule.reviewed ? " with reviewer confirmation" : ""}.`);
  exchangeRuleForm.reset();
});

exportAssessmentButton.addEventListener("click", () => {
  try {
    const packet = {
      format: "contrast-lab-arc-review",
      formatVersion: 1,
      generatedAt: new Date().toISOString(),
      notice: "Draft screening and recorded evidence only. Not ARC certification.",
      assessment: arcData,
      results: assessArc(arcData),
    };
    const blob = new Blob([JSON.stringify(packet, null, 2)], {
      type: "application/json",
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = createElement("a");
    link.href = objectUrl;
    link.download = "arc-review-packet.json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setAssessmentNotice("Exported the ARC review packet as JSON.");
  } catch (error) {
    setAssessmentNotice(
      error instanceof Error
        ? `Could not export the assessment: ${error.message}`
        : "Could not export the assessment.",
      true,
    );
  }
});

importAssessmentButton.addEventListener("click", () => assessmentFileInput.click());
assessmentFileInput.addEventListener("change", async () => {
  const file = assessmentFileInput.files?.[0];
  if (!file) return;

  try {
    const packet: unknown = JSON.parse(await file.text());
    if (
      !isRecord(packet) ||
      packet.format !== "contrast-lab-arc-review" ||
      packet.formatVersion !== 1 ||
      !isArcAssessmentData(packet.assessment)
    ) {
      throw new Error("Choose a valid Contrast Lab ARC review packet.");
    }
    arcData = packet.assessment;
    persistAssessment("Imported ARC review packet and saved it in this browser.");
  } catch (error) {
    setAssessmentNotice(
      error instanceof Error
        ? `Could not import the review packet: ${error.message}`
        : "Could not import the review packet.",
      true,
    );
  } finally {
    assessmentFileInput.value = "";
  }
});

renderAssessment();

const form = requireElement<HTMLFormElement>("#contrast-form");
const result = requireElement<HTMLElement>("#contrast-result");
const errorMessage = requireElement<HTMLElement>("#form-error");
const previewCard = requireElement<HTMLElement>("#preview-card");
const previewSample = requireElement<HTMLElement>("#preview-sample");
const previewMeta = requireElement<HTMLElement>("#preview-meta");
const textColorInput = requireElement<HTMLInputElement>("#text-color");
const backgroundColorInput = requireElement<HTMLInputElement>("#background-color");
const fontSizeInput = requireElement<HTMLInputElement>("#font-size");
const fontWeightInput = requireElement<HTMLSelectElement>("#font-weight");
const fontFamilyInput = requireElement<HTMLInputElement>("#font-family");
const useCaseInput = requireElement<HTMLSelectElement>("#arc-use-case");
const inventoryNameInput = requireElement<HTMLInputElement>("#arc-entry-name");
const includeInventoryInput = requireElement<HTMLInputElement>("#include-inventory");
const overallStatus = requireElement<HTMLElement>("#overall-status");
const textColorIndicator = requireElement<HTMLElement>("#text-color-indicator");
const backgroundColorIndicator = requireElement<HTMLElement>("#background-color-indicator");
const previewTextSwatch = requireElement<HTMLElement>("#preview-text-swatch");
const previewBackgroundSwatch = requireElement<HTMLElement>("#preview-background-swatch");

function isFontWeight(value: number): value is FontWeight {
  return [100, 200, 300, 400, 500, 600, 700, 800, 900].includes(value);
}

function updatePreview(): void {
  const textColor = textColorInput.value.trim();
  const backgroundColor = backgroundColorInput.value.trim();
  const fontSizePx = Number(fontSizeInput.value);
  const fontWeight = Number(fontWeightInput.value);

  previewCard.style.backgroundColor = backgroundColor;
  previewCard.style.color = textColor;
  previewSample.style.color = textColor;
  previewSample.style.fontSize = `${fontSizePx}px`;
  previewSample.style.fontWeight = String(fontWeight);
  previewSample.style.fontFamily = fontFamilyInput.value.trim()
    ? `${JSON.stringify(fontFamilyInput.value.trim())}, sans-serif`
    : '"Playfair Display", Georgia, serif';
  previewMeta.textContent = `${fontSizePx || "—"}px / ${fontWeight}`;
  textColorIndicator.style.backgroundColor = textColor;
  backgroundColorIndicator.style.backgroundColor = backgroundColor;
  previewTextSwatch.style.backgroundColor = textColor;
  previewBackgroundSwatch.style.backgroundColor = backgroundColor;

  const previewTextValue = document.querySelector<HTMLElement>("#preview-text-color");
  const previewBackgroundValue = document.querySelector<HTMLElement>("#preview-background-color");
  if (previewTextValue) previewTextValue.textContent = textColor;
  if (previewBackgroundValue) previewBackgroundValue.textContent = backgroundColor;
}

function addMetric(
  container: HTMLElement,
  label: string,
  value: string,
  state?: "pass" | "fail" | "neutral",
  detail?: string,
): void {
  const row = document.createElement("div");
  row.className = "metric";

  const info = document.createElement("div");
  info.className = "metric-info";
  const name = document.createElement("span");
  name.className = "metric-name";
  name.textContent = label;
  info.append(name);
  if (detail) {
    const note = document.createElement("span");
    note.className = "metric-detail";
    note.textContent = detail;
    info.append(note);
  }

  const valueElement = document.createElement("span");
  valueElement.className = `metric-value${state ? ` metric-value--${state}` : ""}`;
  valueElement.textContent = value;
  row.append(info, valueElement);
  container.append(row);
}

function showError(message: string): void {
  errorMessage.hidden = false;
  errorMessage.textContent = message;
  result.replaceChildren();
  overallStatus.textContent = "Check the inputs";
  overallStatus.className = "result-status result-status--error";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.hidden = true;

  const fontSizePx = Number(fontSizeInput.value);
  const fontWeight = Number(fontWeightInput.value);

  if (!Number.isFinite(fontSizePx) || fontSizePx <= 0 || !isFontWeight(fontWeight)) {
    showError("Enter a font size greater than zero and select a valid font weight.");
    fontSizeInput.focus();
    return;
  }
  const useCase = ARC_USE_CASES.find((item) => item.id === useCaseInput.value);
  if (!useCase) {
    showError("Choose a valid reading purpose for the ARC screening result.");
    useCaseInput.focus();
    return;
  }
  const inventoryName = inventoryNameInput.value.trim();
  if (includeInventoryInput.checked && !inventoryName) {
    showError("Name this text use before including it in the project inventory.");
    inventoryNameInput.focus();
    return;
  }
  if (includeInventoryInput.checked && !fontFamilyInput.value.trim()) {
    showError("Enter the rendered font family before including this pair in the project inventory.");
    fontFamilyInput.focus();
    return;
  }

  try {
    const textColor = textColorInput.value.trim();
    const backgroundColor = backgroundColorInput.value.trim();
    const fontFamily = fontFamilyInput.value.trim();
    const currentFontTest = fontFamily
      ? findCurrentFontTest(fontFamily, fontWeight)
      : undefined;
    const normalizedFontSizePx = currentFontTest
      ? equivalentReferenceFontSize(fontSizePx, currentFontTest.xHeightRatio)
      : fontSizePx;
    const wcagReport = evaluateContrast({
      textColor,
      backgroundColor,
      description: "Browser color check",
      typography: { fontSizePx, fontWeight },
    });
    const apcaReport = evaluateContrast({
      textColor,
      backgroundColor,
      description: "Browser color check",
      typography: { fontSizePx: normalizedFontSizePx, fontWeight },
    });
    const report = { ...wcagReport, apca: apcaReport.apca };

    if (includeInventoryInput.checked) {
      const inventoryEntry: Omit<ArcTextUse, "id"> = {
        name: inventoryName,
        useCase: useCase.id,
        textColor,
        backgroundColor,
        fontFamily,
        fontSizePx,
        fontWeight,
      };
      const replacement = makeArcTextUse(inventoryEntry);
      if (currentFontTest) {
        arcData.fontTests = [
          ...arcData.fontTests.filter(
            (test) =>
              !(
                test.family.toLocaleLowerCase() ===
                  currentFontTest.family.toLocaleLowerCase() &&
                test.fontWeight === currentFontTest.fontWeight
              ),
          ),
          currentFontTest,
        ];
      }
      arcData.textUses = [
        ...arcData.textUses.filter(
          (entry) => entry.name.toLocaleLowerCase() !== inventoryName.toLocaleLowerCase(),
        ),
        replacement,
      ];
      persistAssessment(`Added ${inventoryName} to the project text inventory.`);
    }

    const metrics = document.createElement("div");
    metrics.className = "metrics";
    addMetric(
      metrics,
      "WCAG 2.1 AA",
      report.wcag.passAa ? "Pass" : "Does not pass",
      report.wcag.passAa ? "pass" : "fail",
      report.wcag.isLargeText ? "Large text threshold" : "Normal text threshold",
    );
    addMetric(
      metrics,
      "WCAG 2.1 AAA",
      report.wcag.passAaa ? "Pass" : "Does not pass",
      report.wcag.passAaa ? "pass" : "fail",
    );
    addMetric(metrics, "WCAG contrast ratio", `${report.wcag.ratio}:1`);
    addMetric(
      metrics,
      "APCA lightness contrast",
      `Lc ${report.apca.lightnessContrast}`,
      "neutral",
      "Signed score; direction follows foreground and background",
    );

    const apcaPass = report.apca.passTypography;
    const minimumSize = report.apca.minFontSizeForWeight;
    let apcaLabel = "Not available";
    let apcaDetail = "No font-size recommendation for this pairing";
    let apcaState: "pass" | "fail" | "neutral" = "neutral";

    if (apcaPass !== undefined) {
      apcaLabel = apcaPass ? "Pass" : "Does not pass";
      apcaDetail =
        minimumSize === 777
          ? "This contrast level is for non-text only"
          : minimumSize === 999
            ? "Contrast is insufficient for text"
            : minimumSize
              ? `Recommended minimum: ${minimumSize}px at weight ${fontWeight}`
              : "No font-size recommendation for this pairing";
      apcaState = apcaPass ? "pass" : "fail";
    }
    if (currentFontTest) {
      apcaDetail += ` X-height adjusted size: ${normalizedFontSizePx.toFixed(1)}px (${currentFontTest.xHeightRatio.toFixed(3)} ratio).`;
    } else if (fontFamily) {
      apcaDetail += ` No matching local x-height test for ${fontFamily} at weight ${fontWeight}; using the entered CSS size.`;
    }
    addMetric(metrics, "APCA typography", apcaLabel, apcaState, apcaDetail);
    addMetric(
      metrics,
      "APCA Lc 60 baseline",
      report.apca.passLc60 ? "Meets baseline" : "Below baseline",
      report.apca.passLc60 ? "pass" : "fail",
    );
    addMetric(
      metrics,
      `ARC ${useCase.label} Lc screen`,
      report.apca.absLc >= useCase.minimumLc ? "Meets target" : "Below target",
      report.apca.absLc >= useCase.minimumLc ? "pass" : "fail",
      `|Lc| ${report.apca.absLc} / ${useCase.minimumLc} guide; pair-level screening only`,
    );

    result.replaceChildren(metrics);
    overallStatus.textContent =
      report.wcag.passAa && report.apca.passTypography
        ? "Strong pairing"
        : report.wcag.passAa
          ? "Review APCA result"
          : "Needs more contrast";
    overallStatus.className =
      report.wcag.passAa && report.apca.passTypography
        ? "result-status result-status--pass"
        : "result-status result-status--review";
  } catch (error) {
    showError(
      error instanceof Error
        ? `Could not evaluate these colors: ${error.message}`
        : "Could not evaluate these colors.",
    );
  }
});

document.querySelector<HTMLButtonElement>("#swap-colors")?.addEventListener("click", () => {
  const currentText = textColorInput.value;
  textColorInput.value = backgroundColorInput.value;
  backgroundColorInput.value = currentText;
  updatePreview();
  form.requestSubmit();
});

form.addEventListener("input", updatePreview);
form.addEventListener("change", updatePreview);
updatePreview();
form.requestSubmit();
