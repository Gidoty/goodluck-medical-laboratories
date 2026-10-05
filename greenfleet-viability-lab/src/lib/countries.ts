/** Countries offered in the business profile. Adding one is a single entry. */
export const COUNTRIES = [
  { id: "NG", label: "Nigeria" },
  { id: "GH", label: "Ghana" },
  { id: "KE", label: "Kenya" },
  { id: "ZA", label: "South Africa" },
  { id: "TZ", label: "Tanzania" },
  { id: "UG", label: "Uganda" },
  { id: "other", label: "Other" },
] as const;

export type CountryId = (typeof COUNTRIES)[number]["id"];
