import React from 'react';

interface ThreeDBackgroundProps {
  variant?: 'app' | 'login';
}

/** Decorative only: CSS transforms keep it GPU-friendly and it never captures input. */
export const ThreeDBackground: React.FC<ThreeDBackgroundProps> = ({ variant = 'app' }) => (
  <div className={`three-d-background three-d-background--${variant}`} aria-hidden="true">
    <div className="three-d-grid" />
    <div className="three-d-assembly">
      <span className="three-d-assembly__disc" />
      <span className="three-d-assembly__hub" />
      <span className="three-d-assembly__line three-d-assembly__line--one" />
      <span className="three-d-assembly__line three-d-assembly__line--two" />
    </div>
    <div className="three-d-ring three-d-ring--one" />
    <div className="three-d-ring three-d-ring--two" />
  </div>
);
