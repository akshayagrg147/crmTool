export interface LoginCountry {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

/**
 * Keep this list focused on countries most commonly used by TalkoCRM teams.
 * Adding a country later only requires extending this data list.
 */
export const LOGIN_COUNTRIES: LoginCountry[] = [
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
];

export const DEFAULT_LOGIN_COUNTRY = LOGIN_COUNTRIES[0];
