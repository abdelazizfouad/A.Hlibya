import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showSubtitle?: boolean;
  className?: string;
  isDark?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
  isDark = true,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    hero: 'w-16 h-16 text-xl',
  };

  const starSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
    hero: 'w-9 h-9',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Precision Chrome Mercedes-Benz Emblem */}
      <div
        className={`${iconSizes[size]} relative rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-105 duration-200 ${
          isDark
            ? 'bg-gradient-to-b from-zinc-700 via-zinc-900 to-black border border-white/25 text-white shadow-black/80'
            : 'bg-gradient-to-b from-slate-200 via-white to-slate-300 border border-slate-300 text-slate-900 shadow-slate-300/60'
        }`}
      >
        {/* Concentric Chrome Ring */}
        <div className="absolute inset-[1px] rounded-full border border-white/20 pointer-events-none" />
        
        {/* Mercedes Tri-star precision SVG symbol */}
        <svg
          viewBox="0 0 24 24"
          className={`${starSizes[size]} transition-all drop-shadow-sm`}
        >
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M12 3.2 L12 12 M12 12 L4.3 17.5 M12 12 L19.7 17.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Subtle star facets */}
          <polygon
            points="12,3.2 11.1,12 12,12.5 12.9,12"
            fill="currentColor"
            opacity="0.9"
          />
          <polygon
            points="4.3,17.5 12,12 12.4,12.9 11.1,13.2"
            fill="currentColor"
            opacity="0.9"
          />
          <polygon
            points="19.7,17.5 12,12 12.9,11.1 13.2,12.4"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
      </div>

      {/* Brand Typography */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`font-serif-luxury font-black tracking-tight leading-tight truncate ${
              size === 'hero' ? 'text-2xl sm:text-3xl' : size === 'lg' ? 'text-lg sm:text-xl' : size === 'md' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
            } ${isDark ? 'text-white' : 'text-slate-900'}`}
          >
            AH.Libya Store
          </span>
          <span
            className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md font-mono font-bold tracking-wide shrink-0 ${
              isDark
                ? 'bg-zinc-800 text-zinc-300 border border-white/10'
                : 'bg-slate-100 text-slate-700 border border-slate-300'
            }`}
          >
            فرع الحرفيين
          </span>
        </div>

        {showSubtitle && (
          <p
            className={`text-[10px] sm:text-[11px] truncate font-medium mt-0.5 ${
              isDark ? 'text-zinc-400' : 'text-slate-500'
            }`}
          >
            قطع غيار مرسيدس-بنز الأصلية (Mercedes-Benz Genuine Parts)
          </p>
        )}
      </div>
    </div>
  );
};

