# Contrast Validation Suite

A browser-based color contrast checker with a shared TypeScript engine, command-line design-token checks, and tests. It reports WCAG 2.1 and APCA results separately.

## Prerequisites

- Node.js 22.12 or newer
- npm (included with Node.js)

## Install

From the project root, install the dependencies:

```bash
npm install
```

## Run the app

Start the Vite development server:

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

The checker runs in the browser. Enter opaque text and background colors, set the rendered font size and weight, and select a reading purpose to see the corresponding APCA Lc screening target. The results show WCAG 2.1 and APCA independently.

**Local font measurement is Chromium-only.** The Local Font Access API is not available in Firefox or Safari, and this app currently provides no fallback for those browsers. In a supported Chromium browser on a secure context such as `localhost`, you can optionally grant permission to measure an installed font’s x-height against an Arial/Helvetica reference. The measurement adjusts the APCA font-size lookup; WCAG sizing continues to use the entered CSS font size.

The optional project-wide ARC review is below the contrast results and collapsed by default. It can collect a text inventory and reviewer evidence, then export or import a JSON review packet. Its Bronze/Silver/Gold checks are project-level screening only, not an ARC certification, and do not change the ordinary WCAG/APCA calculation for the current pair.

## Other commands

```bash
npm test                # Run unit tests
npm run contrast:check  # Check the included design-system color contracts
npm run build           # Type-check and build the production app into dist/
npm run preview         # Preview the production build locally
```

## Source layout

- `src/contrast/`: shared WCAG/APCA engine and design-system contracts.
- `src/arc/`: ARC screening and evidence assessment logic.
- `src/__tests__/`: contrast and ARC unit tests.
- `src/cli/`: command-line contrast checker.
- `src/web/`: Vite browser entry point, styles, and Local Font Access types.

See [architecture.md](./architecture.md) for the validation engine details, implementation walkthrough, color-space notes, and ARC screening guidance.
