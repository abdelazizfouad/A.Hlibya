import React from 'react';

interface ThreeDBackgroundProps {
  variant?: 'app' | 'login';
}

/** Decorative only: CSS transforms keep it GPU-friendly and it never captures input. */
export const ThreeDBackground: React.FC<ThreeDBackgroundProps> = ({ variant = 'app' }) => (
  <div className={`three-d-background three-d-background--${variant}`} aria-hidden="true">
    <div className="three-d-grid" />
    <div className="three-d-orb three-d-orb--emerald" />
    <div className="three-d-orb three-d-orb--blue" />
    <div className="three-d-ring three-d-ring--one" />
    <div className="three-d-ring three-d-ring--two" />
    <div className="three-d-star">
      <i />
      <i />
      <i />
    </div>
  </div>
);
