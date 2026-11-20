import React, { useState, useEffect } from 'react';
import { formatGoogleDriveUrls } from '../utils/googleDrive';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'full' | 'mark';
  showText?: boolean;
  textDark?: boolean;
  customLogo?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  showText = true,
  textDark = true,
  customLogo,
}) => {
  // Height map for responsive rendering
  const heightMap = {
    sm: 36,
    md: 46,
    lg: 64,
    xl: 84,
    '2xl': 120,
  };

  const currentHeight = heightMap[size] || 46;

  // Build cascade of fallback sources with Google Drive resolution
  const sources: string[] = [];
  if (customLogo && customLogo.trim().length > 5) {
    const driveResolved = formatGoogleDriveUrls(customLogo.trim());
    sources.push(...driveResolved);
  }
  sources.push('/logo.png');
  sources.push('/logo.jpg');

  const [currentSrcIndex, setCurrentSrcIndex] = useState(0);
  const [hasAllFailed, setHasAllFailed] = useState(false);

  useEffect(() => {
    setCurrentSrcIndex(0);
    setHasAllFailed(false);
  }, [customLogo]);

  const handleImgError = () => {
    if (currentSrcIndex < sources.length - 1) {
      setCurrentSrcIndex((prev) => prev + 1);
    } else {
      setHasAllFailed(true);
    }
  };

  const activeSrc = sources[currentSrcIndex];

  // If image sources failed or not available, render SVG Luxury Brand Emblem
  if (hasAllFailed || !activeSrc) {
    return (
      <div
        className={`inline-flex items-center gap-2.5 select-none cursor-pointer group shrink-0 ${className}`}
        id="gm-management-brand-logo"
      >
        <div
          className="rounded-xl bg-[#111827] text-amber-400 border border-amber-500/30 flex items-center justify-center font-black tracking-tighter shadow-sm group-hover:border-amber-400/60 transition"
          style={{ width: `${currentHeight}px`, height: `${currentHeight}px` }}
        >
          <div className="flex flex-col items-center justify-center leading-none">
            <span className="text-base font-extrabold tracking-tight bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
              GM
            </span>
          </div>
        </div>

        {showText && (
          <div className="flex flex-col text-left justify-center">
            <span
              className={`font-black tracking-tight leading-none text-sm sm:text-base ${
                textDark ? 'text-[#111827]' : 'text-white'
              }`}
            >
              GM MANAGEMENT
            </span>
            <span className="text-[10px] font-semibold tracking-widest text-[#FF385C] uppercase mt-0.5">
              Luxury Rentals
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center select-none cursor-pointer transition-opacity hover:opacity-95 shrink-0 ${className}`}
      id="gm-management-brand-logo"
    >
      <img
        src={activeSrc}
        alt="GM Management Logo"
        onError={handleImgError}
        className="object-contain w-auto max-w-full rounded-md"
        style={{ height: `${currentHeight}px` }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
