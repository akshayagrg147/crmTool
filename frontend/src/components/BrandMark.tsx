import { useState } from "react";

type BrandMarkProps = {
  size?: number;
  inverse?: boolean;
  className?: string;
};

type BrandLogoProps = BrandMarkProps & {
  subtitle?: string;
  /** Organization logo URL returned by the branding API. */
  logoUrl?: string | null;
  /** Used for accessible naming when a custom logo is displayed. */
  brandName?: string;
};

const DEFAULT_BRAND_NAME = "Kelps Healthcare";
const DEFAULT_BRAND_LOGO = "/kelps-healthcare-logo.png";

/** Legacy conversation-frame monogram, kept code-native for crisp scaling. */
export function BrandMark({ size = 40, inverse = false, className = "" }: BrandMarkProps) {
  const field = inverse ? "#F8F4EA" : "#173A5E";
  const line = inverse ? "#173A5E" : "#F8F4EA";

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="12" fill={field} />
      <path
        d="M12.5 12.5h23c4.42 0 8 3.58 8 8v8c0 4.42-3.58 8-8 8h-7.2l-7.8 5v-5a8 8 0 0 1-8-8v-16Z"
        stroke={line}
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      <path d="M19 20h14" stroke="#C99B4A" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 20v10.5" stroke={line} strokeWidth="3" strokeLinecap="round" />
      <circle cx="34.5" cy="30.5" r="1.8" fill="#C99B4A" />
    </svg>
  );
}

/** Shared product lockup so every shell presents one consistent wordmark. */
export function BrandLogo({
  size = 40,
  inverse = false,
  subtitle = "Conversation-led CRM",
  className = "",
  logoUrl,
  brandName = DEFAULT_BRAND_NAME,
}: BrandLogoProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const hasCustomLogo = Boolean(logoUrl) && !logoFailed;
  const displayedLogoUrl = hasCustomLogo ? logoUrl! : DEFAULT_BRAND_LOGO;
  const displayedBrandName = hasCustomLogo ? brandName : DEFAULT_BRAND_NAME;

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`} aria-label={displayedBrandName}>
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg ${inverse ? "bg-white/10 p-1" : "border border-ink-100 bg-white p-1"}`}
        style={{ width: Math.max(size * 2.4, 96), height: size }}
      >
        <img
          src={displayedLogoUrl}
          alt={`${displayedBrandName} logo`}
          className="max-h-full max-w-full object-contain"
          onError={hasCustomLogo ? () => setLogoFailed(true) : undefined}
        />
      </div>
      {subtitle && !hasCustomLogo && (
        <p
          className={`hidden truncate text-[9px] font-bold uppercase tracking-[0.16em] sm:block ${
            inverse ? "text-white/45" : "text-ink-300"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
