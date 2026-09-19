import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

// Exact physical label dimensions
export const LABEL_WIDTH_MM = 52.5;
export const LABEL_HEIGHT_MM = 29.7;

// Centered reference point
export const LABEL_CENTER_X_MM = 26.25; // 52.5 / 2
export const LABEL_CENTER_Y_MM = 14.85; // 29.7 / 2

// Generous printing margins for Safe Area
export const SAFE_MARGIN_SIDE_MM = 4.0; // 4.0mm left & right
export const SAFE_MARGIN_TOP_MM = 2.8;  // 2.8mm top & bottom
export const SAFE_WIDTH_MM = 44.5;      // 52.5 - (4.0 * 2) = 44.5mm
export const SAFE_HEIGHT_MM = 24.1;     // 29.7 - (2.8 * 2) = 24.1mm

export interface PrintCalibrationSettings {
  topOffsetMm: number;        // Top offset in mm (default 0)
  leftOffsetMm: number;       // Left offset in mm (default 0)
  labelWidthMm: number;       // 52.5
  labelHeightMm: number;      // 29.7
  safeMarginTopMm: number;    // 2.8
  safeMarginSideMm: number;   // 4.0
  barcodeHeightMm: number;    // 5.5
  showTestCrosshair: boolean; // show center crosshair in preview
}

export const DEFAULT_CALIBRATION: PrintCalibrationSettings = {
  topOffsetMm: 0,
  leftOffsetMm: 0,
  labelWidthMm: LABEL_WIDTH_MM,
  labelHeightMm: LABEL_HEIGHT_MM,
  safeMarginTopMm: SAFE_MARGIN_TOP_MM,
  safeMarginSideMm: SAFE_MARGIN_SIDE_MM,
  barcodeHeightMm: 5.5,
  showTestCrosshair: true
};

export const CALIBRATION_STORAGE_KEY = 'ah_barcode_calibration_v7';

export const loadSavedCalibration = (): PrintCalibrationSettings => {
  try {
    const saved = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_CALIBRATION, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Failed to load saved calibration', e);
  }
  return DEFAULT_CALIBRATION;
};

export const saveCalibrationToStorage = (settings: PrintCalibrationSettings) => {
  try {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save calibration', e);
  }
};

export interface LabelData {
  id: string;
  serialNumber: string;
  partId: string;
  partNumber: string;
  nameAr?: string;
  nameEn?: string;
  brand?: string;
  chassis?: string;
  locationCode?: string;
  sellingPrice?: number;
  costPrice?: number;
  copyIndex?: number;
  totalCopiesForPart?: number;
  assignedSlotIndex?: number; // 0 to 39
}

export interface LabelDisplayOptions {
  storeBrandTitle: string;     // default: "Ashraf & Hesham Libya"
  showStoreTitle: boolean;     // default: true
  showPartArabicName: boolean; // default: true
  showPartNumber: boolean;     // default: true
  showSerialNumber: boolean;   // default: true
  showSellingPrice: boolean;   // default: false
  showLocationBin: boolean;    // default: true
}

export const DEFAULT_DISPLAY_OPTIONS: LabelDisplayOptions = {
  storeBrandTitle: 'Ashraf & Hesham Libya',
  showStoreTitle: true,
  showPartArabicName: true,
  showPartNumber: true,
  showSerialNumber: true,
  showSellingPrice: false,
  showLocationBin: true
};

/**
 * Calculates optimal barcode bar width for Code128 to fit strictly within the 44.5mm safe width
 */
export const calculateBarcodeBarWidth = (code: string): number => {
  const len = (code || '').trim().length;
  if (len <= 8) return 0.52;
  if (len <= 12) return 0.44;
  if (len <= 16) return 0.38;
  if (len <= 20) return 0.34;
  return 0.30;
};

/**
 * Generates vector Code128 SVG string for standalone print HTML
 */
export const generateBarcodeSvgString = (
  code: string,
  heightMm: number = 5.5
): string => {
  if (typeof document === 'undefined') return '';
  const cleanCode = String(code || 'AH-0001').trim();
  const barWidth = calculateBarcodeBarWidth(cleanCode);
  const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  try {
    JsBarcode(svgNode, cleanCode, {
      format: 'CODE128',
      width: barWidth,
      height: Math.max(14, Math.round(heightMm * 3.78)),
      displayValue: false,
      margin: 0,
      background: 'transparent',
      lineColor: '#000000',
      valid: () => {}
    });

    svgNode.setAttribute(
      'style',
      `max-width: ${SAFE_WIDTH_MM - 2}mm; height: ${heightMm}mm; display: block; margin: 0 auto;`
    );
    return svgNode.outerHTML;
  } catch (err) {
    return `<div style="font-family: monospace; font-size: 6pt; font-weight: bold; text-align: center;">${cleanCode}</div>`;
  }
};

/**
 * React Component for high-fidelity vector Barcode rendering
 */
export const BarcodeSvgRenderer: React.FC<{
  code: string;
  heightMm?: number;
  className?: string;
}> = ({ code, heightMm = 5.5, className = '' }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && code) {
      try {
        const cleanCode = String(code).trim();
        const barWidth = calculateBarcodeBarWidth(cleanCode);

        JsBarcode(svgRef.current, cleanCode, {
          format: 'CODE128',
          width: barWidth,
          height: Math.max(14, Math.round(heightMm * 3.78)),
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor: '#000000',
          valid: () => {}
        });
      } catch (err) {
        console.warn('JsBarcode render error', code, err);
      }
    }
  }, [code, heightMm]);

  return (
    <div className={`w-full flex items-center justify-center overflow-hidden leading-none ${className}`}>
      <svg
        ref={svgRef}
        className="max-w-[42mm] block mx-auto overflow-hidden shrink-0"
        style={{ height: `${heightMm}mm` }}
      />
    </div>
  );
};

/**
 * Calculates adaptive font size based on string length to guarantee no overflow
 */
export const getAdaptiveFontSize = (text: string, type: 'store' | 'part' | 'serial' | 'desc'): string => {
  const len = (text || '').length;
  switch (type) {
    case 'store':
      if (len > 26) return '4.2pt';
      if (len > 20) return '4.8pt';
      return '5.2pt';
    case 'part':
      if (len > 18) return '6.0pt';
      if (len > 14) return '7.0pt';
      return '8.2pt';
    case 'serial':
      if (len > 18) return '4.6pt';
      if (len > 14) return '5.2pt';
      return '5.6pt';
    case 'desc':
      if (len > 30) return '3.8pt';
      if (len > 20) return '4.2pt';
      return '4.8pt';
  }
};

/**
 * Pure HTML Renderer for a Single Label Cell (52.5mm × 29.7mm)
 * strictly using Flexbox center alignment with Safe Area and Zero Distortion.
 */
export const renderSingleLabelInnerHtml = (params: {
  label: LabelData;
  options: LabelDisplayOptions;
  calibration: PrintCalibrationSettings;
  showTestGuides?: boolean;
}): string => {
  const { label, options, calibration, showTestGuides = false } = params;
  const barcodeSvg = generateBarcodeSvgString(label.serialNumber, calibration.barcodeHeightMm || 5.5);

  const storeFontSize = getAdaptiveFontSize(options.storeBrandTitle, 'store');
  const partFontSize = getAdaptiveFontSize(label.partNumber, 'part');
  const serialFontSize = getAdaptiveFontSize(label.serialNumber, 'serial');
  const descFontSize = getAdaptiveFontSize(label.nameAr || label.nameEn || '', 'desc');

  return `
    <div class="label-cell ${showTestGuides ? 'test-guides' : ''}">
      ${showTestGuides ? `
        <!-- Center Geometric Crosshairs (X=26.25mm, Y=14.85mm) -->
        <div class="guide-cross-h"></div>
        <div class="guide-cross-v"></div>
        <div class="guide-center-dot"></div>
      ` : ''}

      <div class="safe-area ${showTestGuides ? 'show-safe-border' : ''}">
        
        <!-- Top Section: Store Brand Title & Optional Description -->
        <div class="lbl-top-row">
          ${options.showStoreTitle ? `<div class="lbl-store" style="font-size: ${storeFontSize};">${options.storeBrandTitle}</div>` : ''}
          ${options.showPartArabicName && (label.nameAr || label.nameEn) ? `
            <div class="lbl-desc" style="font-size: ${descFontSize};">${label.nameAr || label.nameEn}</div>
          ` : ''}
        </div>

        <!-- Middle Upper: Part Number (Centered & Bold) -->
        <div class="lbl-partno" style="font-size: ${partFontSize};">
          ${label.partNumber}
        </div>

        <!-- Middle Center: Vector Barcode (Centered in X & Y) -->
        <div class="lbl-barcode-box">
          ${barcodeSvg}
        </div>

        <!-- Bottom Section: Serial Number & Additional Badges (Centered) -->
        <div class="lbl-bottom-row">
          <span class="lbl-serial" style="font-size: ${serialFontSize};">${label.serialNumber}</span>
          ${options.showLocationBin && label.locationCode ? `
            <span class="lbl-badge lbl-loc">${label.locationCode}</span>
          ` : ''}
          ${options.showSellingPrice && label.sellingPrice ? `
            <span class="lbl-badge lbl-price">${label.sellingPrice.toLocaleString()} EGP</span>
          ` : ''}
        </div>

      </div>
    </div>
  `;
};

/**
 * Live React Label Card for Interactive Preview (1:1 Centering with Crosshairs)
 */
export const LiveLabelPreviewCard: React.FC<{
  label: LabelData;
  options: LabelDisplayOptions;
  calibration: PrintCalibrationSettings;
  showGuides?: boolean;
  isZoomed?: boolean;
  className?: string;
}> = ({
  label,
  options,
  calibration,
  showGuides = true,
  isZoomed = false,
  className = ''
}) => {
  const storeTitle = options.storeBrandTitle || 'Ashraf & Hesham Libya';
  const heightMm = isZoomed ? (calibration.barcodeHeightMm * 1.35) : calibration.barcodeHeightMm;

  return (
    <div
      className={`relative bg-white text-black select-none box-border flex items-center justify-center overflow-hidden transition-all ${
        isZoomed ? 'w-[290px] h-[164px] rounded-xl shadow-2xl border border-zinc-200' : 'w-full h-full'
      } ${className}`}
      style={{
        width: isZoomed ? undefined : `${calibration.labelWidthMm}mm`,
        height: isZoomed ? undefined : `${calibration.labelHeightMm}mm`,
      }}
    >
      {/* Visual Outer Label Border (52.5mm × 29.7mm) */}
      {showGuides && (
        <>
          <div className="absolute inset-0 border border-red-500/40 pointer-events-none z-20" />
          
          {/* Vertical Center Crosshair Line (X = 50% / 26.25mm) */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-blue-500/40 pointer-events-none z-20" />
          
          {/* Horizontal Center Crosshair Line (Y = 50% / 14.85mm) */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-blue-500/40 pointer-events-none z-20" />
          
          {/* Center Point Marker */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-blue-600 bg-blue-500/20 pointer-events-none z-20" />
        </>
      )}

      {/* Centered Safe Printing Area (44.5mm × 24.1mm) */}
      <div
        className={`w-full h-full flex flex-col justify-between items-center text-center overflow-hidden box-border z-10 ${
          showGuides ? 'border border-dashed border-emerald-600/80 bg-emerald-500/[0.03]' : ''
        }`}
        style={{
          paddingTop: `${calibration.safeMarginTopMm}mm`,
          paddingBottom: `${calibration.safeMarginTopMm}mm`,
          paddingLeft: `${calibration.safeMarginSideMm}mm`,
          paddingRight: `${calibration.safeMarginSideMm}mm`,
        }}
      >
        {/* Top: Store Brand */}
        <div className="w-full flex flex-col items-center justify-center leading-none overflow-hidden shrink-0">
          {options.showStoreTitle && (
            <div className={`font-black text-black tracking-tight truncate max-w-full ${
              isZoomed ? 'text-[11.5px]' : 'text-[7.5px]'
            }`}>
              {storeTitle}
            </div>
          )}
          {options.showPartArabicName && (label.nameAr || label.nameEn) && (
            <div className={`font-bold text-zinc-800 truncate max-w-full mt-0.5 ${
              isZoomed ? 'text-[9.5px]' : 'text-[6.5px]'
            }`} dir="rtl">
              {label.nameAr || label.nameEn}
            </div>
          )}
        </div>

        {/* Middle Upper: Part Number (Bold & Centered) */}
        <div className={`font-mono font-black text-black tracking-tight truncate max-w-full leading-none my-auto shrink-0 ${
          isZoomed ? 'text-[14.5px]' : 'text-[9.5px]'
        }`}>
          {label.partNumber}
        </div>

        {/* Middle Center: Vector Barcode (Centered precisely in X & Y) */}
        <div className="w-full flex items-center justify-center overflow-hidden my-auto shrink-0">
          <BarcodeSvgRenderer
            code={label.serialNumber}
            heightMm={heightMm}
          />
        </div>

        {/* Bottom: Serial & Badges */}
        <div className="w-full flex items-center justify-center gap-1.5 leading-none overflow-hidden shrink-0 mt-auto">
          <span className={`font-mono font-bold text-zinc-900 tracking-wider truncate ${
            isZoomed ? 'text-[11px]' : 'text-[7.5px]'
          }`}>
            {label.serialNumber}
          </span>
          {options.showLocationBin && label.locationCode && (
            <span className={`font-mono font-black bg-black text-white px-1.5 py-0.2 rounded-xs shrink-0 ${
              isZoomed ? 'text-[9px]' : 'text-[6px]'
            }`}>
              {label.locationCode}
            </span>
          )}
          {options.showSellingPrice && label.sellingPrice && (
            <span className={`font-black text-black shrink-0 ${
              isZoomed ? 'text-[9.5px]' : 'text-[6.5px]'
            }`}>
              {label.sellingPrice.toLocaleString()} EGP
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Compiles 100% self-contained HTML/CSS for direct printing with Zero Browser Scaling Distortion
 */
export const generateStandalonePrintHtml = (params: {
  pages: (LabelData | null)[][];
  rawLabels: LabelData[];
  layout: 'SHEET_40' | 'THERMAL_ROLL';
  options: LabelDisplayOptions;
  calibration: PrintCalibrationSettings;
  isTestGridMode?: boolean;
}): string => {
  const {
    pages,
    rawLabels,
    layout,
    options,
    calibration,
    isTestGridMode = false
  } = params;

  const {
    labelWidthMm = LABEL_WIDTH_MM,
    labelHeightMm = LABEL_HEIGHT_MM,
    safeMarginTopMm = SAFE_MARGIN_TOP_MM,
    safeMarginSideMm = SAFE_MARGIN_SIDE_MM
  } = calibration;

  const safeWidthMm = labelWidthMm - (safeMarginSideMm * 2);
  const safeHeightMm = labelHeightMm - (safeMarginTopMm * 2);

  let pagesHtml = '';

  if (isTestGridMode) {
    // 40-Slot Alignment Test Grid with precise millimeters crosshairs
    pagesHtml = `
      <div class="sheet-page test-page">
        ${Array.from({ length: 40 }).map((_, idx) => {
          const row = Math.floor(idx / 4) + 1;
          const col = (idx % 4) + 1;
          return `
            <div class="label-cell test-cell">
              <div class="guide-cross-h"></div>
              <div class="guide-cross-v"></div>
              <div class="safe-area test-safe">
                <div class="test-top">
                  <span class="test-badge">#${idx + 1}</span>
                  <span class="test-pos">R${row} C${col}</span>
                </div>
                <div class="test-title">Power Paper 6688028</div>
                <div class="test-cross">┼ 52.5 × 29.7mm ┼</div>
                <div class="test-bot">Center X=26.25 Y=14.85mm</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (layout === 'SHEET_40') {
    // Standard A4 40-Up Sheets (4 columns × 10 rows)
    pages.forEach((page) => {
      let cellsHtml = '';
      page.forEach((lbl) => {
        if (!lbl) {
          cellsHtml += `<div class="label-cell empty-cell"></div>`;
          return;
        }
        cellsHtml += renderSingleLabelInnerHtml({
          label: lbl,
          options,
          calibration,
          showTestGuides: false
        });
      });
      pagesHtml += `<div class="sheet-page">${cellsHtml}</div>`;
    });
  } else {
    // Single Thermal Roll Pages
    rawLabels.forEach((lbl) => {
      const cell = renderSingleLabelInnerHtml({
        label: lbl,
        options,
        calibration,
        showTestGuides: false
      });
      pagesHtml += `<div class="thermal-page">${cell}</div>`;
    });
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>طباعة ملصقات الباركود - ${options.storeBrandTitle}</title>
  <style>
    @page {
      size: ${layout === 'SHEET_40' || isTestGridMode ? '210mm 297mm' : `${labelWidthMm}mm ${labelHeightMm}mm`};
      margin: 0mm !important;
    }
    *, *:before, *:after {
      box-sizing: border-box !important;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: ${layout === 'SHEET_40' || isTestGridMode ? '210mm' : `${labelWidthMm}mm`} !important;
      height: ${layout === 'SHEET_40' || isTestGridMode ? '297mm' : `${labelHeightMm}mm`} !important;
      margin: 0mm !important;
      padding: 0mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      direction: rtl;
      -webkit-font-smoothing: antialiased;
      overflow: hidden !important;
    }
    
    /* A4 40-Up Grid Structure (4 Cols × 10 Rows = Exactly 210mm × 297mm) */
    .sheet-page {
      width: 210mm !important;
      height: 297mm !important;
      min-width: 210mm !important;
      max-width: 210mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      display: grid !important;
      grid-template-columns: 52.5mm 52.5mm 52.5mm 52.5mm !important;
      grid-template-rows: repeat(10, 29.7mm) !important;
      gap: 0mm !important;
      margin: 0mm !important;
      padding: 0mm !important;
      overflow: hidden !important;
      background: #ffffff !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* Single Thermal Page Structure (52.5mm × 29.7mm) */
    .thermal-page {
      width: ${labelWidthMm}mm !important;
      height: ${labelHeightMm}mm !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* Individual Label Box (52.5mm × 29.7mm) - Strict Center Alignment */
    .label-cell {
      position: relative !important;
      width: ${labelWidthMm}mm !important;
      height: ${labelHeightMm}mm !important;
      min-width: ${labelWidthMm}mm !important;
      max-width: ${labelWidthMm}mm !important;
      min-height: ${labelHeightMm}mm !important;
      max-height: ${labelHeightMm}mm !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      background: #ffffff !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .label-cell.empty-cell {
      visibility: hidden !important;
    }

    /* Centered Safe Printing Area (44.5mm × 24.1mm) */
    .safe-area {
      width: ${safeWidthMm}mm !important;
      height: ${safeHeightMm}mm !important;
      max-width: ${safeWidthMm}mm !important;
      max-height: ${safeHeightMm}mm !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: space-between !important;
      text-align: center !important;
      overflow: hidden !important;
      margin: auto !important;
      padding: 0 !important;
    }

    /* Inner Label Typography & Elements (Centered in X & Y) */
    .lbl-top-row {
      width: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      line-height: 1 !important;
      overflow: hidden !important;
      flex-shrink: 0 !important;
    }
    .lbl-store {
      font-weight: 900 !important;
      color: #000000 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      max-width: 100% !important;
      letter-spacing: -0.1px !important;
    }
    .lbl-desc {
      font-weight: 700 !important;
      color: #222222 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      max-width: 100% !important;
      margin-top: 0.2mm !important;
    }
    .lbl-partno {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace !important;
      font-weight: 900 !important;
      color: #000000 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      max-width: 100% !important;
      letter-spacing: -0.2px !important;
      line-height: 1 !important;
      margin: auto 0 !important;
      flex-shrink: 0 !important;
    }
    .lbl-barcode-box {
      width: 100% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden !important;
      line-height: 0 !important;
      margin: auto 0 !important;
      flex-shrink: 0 !important;
    }
    .lbl-bottom-row {
      width: 100% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 1.2mm !important;
      line-height: 1 !important;
      overflow: hidden !important;
      margin-top: auto !important;
      flex-shrink: 0 !important;
    }
    .lbl-serial {
      font-family: monospace !important;
      font-weight: 800 !important;
      color: #111111 !important;
      letter-spacing: 0.2px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .lbl-badge {
      font-family: monospace !important;
      font-weight: 900 !important;
      font-size: 4.8pt !important;
      padding: 0.15mm 1.2mm !important;
      border-radius: 0.5mm !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
    }
    .lbl-loc {
      background: #000000 !important;
      color: #ffffff !important;
    }
    .lbl-price {
      font-weight: 900 !important;
      color: #000000 !important;
    }

    /* Test Grid Crosshairs */
    .test-cell {
      border: 0.15mm solid #000000 !important;
    }
    .test-safe {
      border: 0.15mm dashed #444444 !important;
      padding: 0.5mm !important;
    }
    .test-top {
      width: 100% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 4.5pt !important;
      font-weight: bold !important;
    }
    .test-badge {
      background: #000000 !important;
      color: #ffffff !important;
      padding: 0.2mm 1.2mm !important;
      border-radius: 0.4mm !important;
      font-weight: 900 !important;
    }
    .test-title { font-size: 5.2pt !important; font-weight: 900 !important; }
    .test-cross { font-family: monospace !important; font-size: 5.0pt !important; font-weight: bold !important; }
    .test-bot { font-size: 4.0pt !important; color: #555555 !important; font-weight: bold !important; }

    .guide-cross-h {
      position: absolute !important;
      left: 0 !important;
      right: 0 !important;
      top: 50% !important;
      height: 0.15mm !important;
      background: rgba(0, 100, 255, 0.4) !important;
      pointer-events: none !important;
    }
    .guide-cross-v {
      position: absolute !important;
      top: 0 !important;
      bottom: 0 !important;
      left: 50% !important;
      width: 0.15mm !important;
      background: rgba(0, 100, 255, 0.4) !important;
      pointer-events: none !important;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
};

/**
 * Direct print using an isolated hidden iframe
 */
export const printViaIsolatedIframe = (html: string): Promise<boolean> => {
  return new Promise((resolve) => {
    let iframe = document.getElementById('ah-isolated-barcode-iframe') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'ah-isolated-barcode-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      resolve(false);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
        resolve(true);
      } catch (err) {
        console.warn('Iframe print error fallback', err);
        window.print();
        resolve(false);
      }
    }, 350);
  });
};

/**
 * Open in clean standalone browser tab for printing
 */
export const openInCleanTab = (html: string) => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (e) {
        console.warn('Tab print error', e);
      }
    }, 450);
  }
};
