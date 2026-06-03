import { useState } from "react";

type BrandLogoVariant = "full" | "compact" | "login";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  className?: string;
};

const logoPath = `${import.meta.env.BASE_URL}logo-next-glass.png`;
const markPath = `${import.meta.env.BASE_URL}logo-next-glass-mark.png`;

export default function BrandLogo({ variant = "full", className = "" }: BrandLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const isCompact = variant === "compact";
  const isLogin = variant === "login";

  if (isCompact) {
    return (
      <div className={`inline-flex items-center justify-center ${className}`} title="Next Glass">
        <LogoFrame compact imageFailed={imageFailed} onImageError={() => setImageFailed(true)} />
      </div>
    );
  }

  return (
    <div className={`min-w-0 ${isLogin ? "text-center" : ""} ${className}`}>
      <div className={isLogin ? "flex justify-center" : ""}>
        <LogoFrame
          login={isLogin}
          imageFailed={imageFailed}
          onImageError={() => setImageFailed(true)}
        />
      </div>
      {imageFailed ? (
        <div className={isLogin ? "mt-5" : "mt-3"}>
          <p className={`${isLogin ? "text-2xl" : "text-lg"} font-black tracking-wide text-white`}>
            NEXT GLASS
          </p>
          <p className={`${isLogin ? "text-sm" : "text-xs"} font-semibold uppercase tracking-wide text-white/70`}>
            Vidrios y Aluminios
          </p>
        </div>
      ) : null}
    </div>
  );
}

function LogoFrame({
  compact = false,
  login = false,
  imageFailed,
  onImageError
}: {
  compact?: boolean;
  login?: boolean;
  imageFailed: boolean;
  onImageError: () => void;
}) {
  const sizeClass = compact
    ? "h-11 w-11"
    : login
      ? "h-60 w-72"
      : "h-32 w-44";

  return (
    <div className={`inline-flex shrink-0 items-center justify-center ${sizeClass}`}>
      {!imageFailed ? (
        <img
          alt="Next Glass"
          className="h-full w-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
          src={compact ? markPath : logoPath}
          onError={onImageError}
        />
      ) : (
        <span className={`${compact ? "text-sm" : "text-xl"} font-black tracking-wide text-white`}>
          NG
        </span>
      )}
    </div>
  );
}
