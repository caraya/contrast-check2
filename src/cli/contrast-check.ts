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
    `${contract.name}: WCAG AA ${wcagPass ? "PASS" : "FAIL"} (${result.wcag.ratio}:1), APCA ${apcaPass ? "PASS" : "FAIL"} (Lc ${result.apca.lightnessContrast})`,
  );
  if (!wcagPass || !apcaPass) failed = true;
}

if (failed) {
  console.error("One or more contrast contracts failed.");
  process.exitCode = 1;
}
