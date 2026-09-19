/**
 * AH.Libya Store - Currency & Unit Formatters
 * Strict Currency Standard: Egyptian Pound (EGP / جنيه مصري)
 */

export function formatEGP(amount: number | undefined | null, options?: { showUnit?: boolean; short?: boolean }): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0 ج.م';
  }

  const formattedNumber = new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);

  if (options?.short) {
    return `${formattedNumber} ج.م`;
  }

  if (options?.showUnit === false) {
    return formattedNumber;
  }

  return `${formattedNumber} جنيه مصري`;
}

export function formatEGPNumber(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}
