# Post-MVP next steps

The MVP focuses on checking text contrast with WCAG 2.1 and APCA. Broader ARC certification, automated inventory completeness, and a polished review-management system remain outside its scope.

## Priority: prevent misleading ARC claims

The main release risk is overstating what the ARC results establish, not a missing core contrast-checking feature.

Suggested mitigation: consistently distinguish **current-pair contrast results**, **project review readiness**, and **independent conformance assessment** in the interface and exported packets.

- [x] Audit ARC labels, explanations, and exports for language that implies certification.
- [x] Use a persistent explanation alongside project-level statuses: “Recorded screening checks and evidence only. Not an ARC conformance determination.”
- [x] Make exported packets explicitly identify the screening profile, its limitations, and which checks are calculated versus reviewer-attested.
- [x] Add regression tests ensuring incomplete evidence cannot produce a review-ready status and exported packets retain their limitations notice.

## Broader ARC conformance and certification support

- [ ] Select and record the specific ARC draft/version each review targets.
- [ ] Map its full requirements to automated checks, reviewer assessments, and required evidence; document unsupported criteria.
- [ ] Have a qualified independent reviewer evaluate the methodology and representative review packets.
- [ ] Establish an appropriate independent assessment or certification process before introducing any certification claim. Completing fields or passing automated checks must not be treated as certification.

## Automated inventory completeness

- [ ] Explore collecting rendered text styles and foreground/background pairs across declared pages, themes, viewport sizes, and interaction states.
- [ ] Report missing coverage and collection limitations, including dynamic content, font fallback, and complex backgrounds.
- [ ] Compare collected uses with the declared scope and retain human confirmation of inventory completeness.

## Review-management improvements

- [ ] Support editing inventory entries with stable identities rather than relying on matching names.
- [ ] Track evidence provenance, reviewer identity, dates, and changes.
- [ ] Flag stale evidence when typography, colors, scope, or the adopted criterion changes.
- [ ] Improve navigation between missing checks and their relevant inputs, and make review-packet versioning and migration explicit.
