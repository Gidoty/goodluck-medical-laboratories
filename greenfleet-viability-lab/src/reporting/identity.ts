import pkg from "../../package.json";

/**
 * Identity and wording shared by every reporting surface (report, presentation, exports).
 * The authorship line is allowed in generated report artifacts only. Ordinary application
 * pages do not carry it, and the product credit stays on the landing page.
 */
export const APP_NAME = "GreenFleet Viability Lab";
export const REPORT_TITLE = "Commercial Viability Assessment";
export const REPORT_VERSION = "1.0";

/**
 * The frozen prototype identifier. It names the delivered software and is NOT the version of the Commercial
 * Viability Policy ("GreenFleet Commercial Viability Policy v1.0"), which versions the decision rules.
 * The two change independently.
 */
export const PROTOTYPE_VERSION = "GreenFleet MSc Prototype v1.0";
export const PROTOTYPE_STATUS = "MSc Prototype Feature Freeze";
export const APP_VERSION: string = pkg.version;
export const REPORT_AUTHORSHIP = "Built by Group 8, MSc Class of 2025, CELTRAS";

export const REPORT_DISCLAIMER =
  "GreenFleet is an academic decision-support prototype. Results are model-derived estimates based on the entered assumptions and should not be interpreted as financial, investment, engineering, regulatory or procurement advice.";

export const THRESHOLD_NOTE = "Thresholds and sensitivity results are model-derived estimates based on the entered assumptions. They are not forecasts, quotations or investment guarantees.";
