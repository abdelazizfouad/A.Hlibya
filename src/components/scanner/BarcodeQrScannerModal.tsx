import React, { useState, useEffect, useRef, useCallback } from 'react';
import JsBarcode from 'jsbarcode';
import { Html5Qrcode, Html5QrcodeCameraScanConfig, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  QrCode, 
  Barcode, 
  X, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Printer,
  Sliders,
  Tag,
  ExternalLink,
  Zap,
  Upload,
  RefreshCw,
  Eye,
  Layers,
  Volume2,
  VolumeX,
  Smartphone,
  Laptop,
  Check
} from 'lucide-react';
import { PartMaster, WarehouseLocation, InventoryItem } from '../../types/erp';
import { useTheme } from '../../lib/themeContext';
import { useAuth } from '../../lib/authContext';
import { formatEGP } from '../../lib/formatters';
import { printViaIsolatedIframe, openInCleanTab } from '../parts/barcodePrintEngine';
import { executeStockMovement, getPartByBarcode, getPartByPartNumber, getLocationByCode } from '../../lib/firestoreService';

interface BarcodeQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: PartMaster[];
  locations: WarehouseLocation[];
  inventory: InventoryItem[];
  onSelectPart: (part: PartMaster) => void;
  onSelectLocation: (location: WarehouseLocation) => void;
}

// Thermal paper preset dimensions
interface ThermalSizePreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
  isDefault?: boolean;
}

const THERMAL_PRESETS: ThermalSizePreset[] = [
  { id: '50x25', name: '5cm × 2.5cm', widthMm: 50, heightMm: 25, description: 'القياس المعياري للورق الحراري (50×25mm) ⭐', isDefault: true },
  { id: '50x30', name: '5cm × 3.0cm', widthMm: 50, heightMm: 30, description: 'ملصق حراري طولي (50×30mm)' },
  { id: '40x25', name: '4cm × 2.5cm', widthMm: 40, heightMm: 25, description: 'ملصق مدمج للقطع الصغيرة (40×25mm)' },
  { id: '60x30', name: '6cm × 3.0cm', widthMm: 60, heightMm: 30, description: 'ملصق عريض للطرود الكبيرة (60×30mm)' },
  { id: 'CUSTOM', name: 'قياس مخصص', widthMm: 50, heightMm: 25, description: 'تحديد العرض والطول يدوياً بالمليمتر' },
];

/**
 * Web Audio POS Beep & Haptic Vibration Helper
 */
export const triggerScanFeedback = (type: 'success' | 'error' = 'success') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        // High-pitched, crisp POS scanner beep (1760Hz, 85ms)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.085);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.085);
      } else {
        // Double lower frequency error buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.22);
      }
    }
  } catch (e) {
    // AudioContext might be silent if not interacted yet
  }

  // Mobile device haptic feedback
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'success') {
        navigator.vibrate(80);
      } else {
        navigator.vibrate([60, 40, 60]);
      }
    } catch (e) {
      // Ignore vibration error
    }
  }
};

/**
 * High-performance vector Barcode component using JsBarcode
 */
const ThermalBarcodeRenderer: React.FC<{
  code: string;
  heightMm?: number;
  barWidth?: number;
  className?: string;
}> = ({ code, heightMm = 5.2, barWidth = 0.55, className = '' }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && code) {
      try {
        const clean = String(code).trim();
        JsBarcode(svgRef.current, clean, {
          format: 'CODE128',
          width: barWidth,
          height: Math.max(12, Math.round(heightMm * 3.78)),
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor: '#000000',
          valid: () => {}
        });
      } catch (err) {
        console.warn('Barcode render error in scanner modal', err);
      }
    }
  }, [code, heightMm, barWidth]);

  return (
    <div className={`w-full flex items-center justify-center overflow-hidden leading-none ${className}`}>
      <svg ref={svgRef} className="max-w-[42mm] max-h-[7.5mm] block mx-auto overflow-hidden shrink-0" />
    </div>
  );
};

export const BarcodeQrScannerModal: React.FC<BarcodeQrScannerModalProps> = ({
  isOpen,
  onClose,
  parts,
  locations,
  inventory,
  onSelectPart,
  onSelectLocation
}) => {
  const { isDark } = useTheme();
  const { currentUser, activeBranch } = useAuth();
  const [scanInput, setScanInput] = useState('');
  const [lastScannedResult, setLastScannedResult] = useState<{
    type: 'PART' | 'LOCATION' | 'NOT_FOUND';
    part?: PartMaster;
    location?: WarehouseLocation;
    locationParts?: InventoryItem[];
    code: string;
  } | null>(null);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorchCapability, setHasTorchCapability] = useState<boolean>(false);
  const [soundFeedback, setSoundFeedback] = useState<boolean>(true);
  const [continuousMode, setContinuousMode] = useState<boolean>(false);
  const [hardwareScannerDetected, setHardwareScannerDetected] = useState<boolean>(false);
  const [deductQuantity, setDeductQuantity] = useState<number>(1);
  const [isDeducting, setIsDeducting] = useState<boolean>(false);
  const [deductionMessage, setDeductionMessage] = useState<string | null>(null);

  // Thermal Print Configuration
  const [selectedPreset, setSelectedPreset] = useState<string>('50x25');
  const [customWidthMm, setCustomWidthMm] = useState<number>(50);
  const [customHeightMm, setCustomHeightMm] = useState<number>(25);
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [showPrintPrice, setShowPrintPrice] = useState<boolean>(true);
  const [showPrintLocation, setShowPrintLocation] = useState<boolean>(true);
  const [showPrintBrand, setShowPrintBrand] = useState<boolean>(true);
  const [customBrandTitle, setCustomBrandTitle] = useState<string>('أشرف و هشام • AH.Libya');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);
  const [showThermalSettings, setShowThermalSettings] = useState<boolean>(false);

  // Refs
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');
  const hardwareFlushTimerRef = useRef<number | null>(null);
  const deductionInFlightRef = useRef<boolean>(false);

  // Active Dimensions
  const activeWidthMm = selectedPreset === 'CUSTOM' ? customWidthMm : (THERMAL_PRESETS.find(p => p.id === selectedPreset)?.widthMm || 50);
  const activeHeightMm = selectedPreset === 'CUSTOM' ? customHeightMm : (THERMAL_PRESETS.find(p => p.id === selectedPreset)?.heightMm || 25);
  const activeWidthCm = (activeWidthMm / 10).toFixed(1);
  const activeHeightCm = (activeHeightMm / 10).toFixed(1);

  // 1. Process Scanned Code Core Handler (Async with direct Firestore lookup for 200,000+ parts)
  const handleScan = useCallback(async (codeToScan: string) => {
    // Treat barcode strictly as a string, preserving all leading zeros
    const raw = String(codeToScan || '').trim();
    if (!raw) return;

    // Prevent immediate duplicate scans within 1.2s in continuous mode
    const now = Date.now();
    if (raw === lastScannedCodeRef.current && (now - lastScannedTimeRef.current) < 1200) {
      return;
    }
    lastScannedCodeRef.current = raw;
    lastScannedTimeRef.current = now;

    const normalized = raw.toUpperCase();

    // Always query the indexed backend first; the in-memory list is paginated.
    let matchedPart: PartMaster | null | undefined;
    try {
      matchedPart = await getPartByBarcode(raw);
      if (!matchedPart) {
        matchedPart = await getPartByPartNumber(raw);
      }
    } catch (error) {
      console.warn('Barcode lookup failed:', error);
      setLastScannedResult({ type: 'NOT_FOUND', code: raw });
      setScanInput(raw);
      return;
    }

    if (matchedPart) {
      if (soundFeedback) triggerScanFeedback('success');
      setLastScannedResult({
        type: 'PART',
        part: matchedPart,
        code: raw
      });
      setScanInput(raw);
      setDeductQuantity(1);
      setDeductionMessage(null);
      return;
    }

    // 3. Check if it matches a Warehouse Location in local memory or Firestore
    let matchedLocation: WarehouseLocation | null | undefined = (locations || []).find(
      (l) => l?.code?.toUpperCase() === normalized || l?.id === raw
    );
    if (!matchedLocation) {
      matchedLocation = await getLocationByCode(raw);
    }

    if (matchedLocation) {
      if (soundFeedback) triggerScanFeedback('success');
      const partsInLoc = (inventory || []).filter((inv) => inv?.locationId === matchedLocation?.id || inv?.locationCode === matchedLocation?.code);
      setLastScannedResult({
        type: 'LOCATION',
        location: matchedLocation,
        locationParts: partsInLoc,
        code: raw
      });
      setScanInput(raw);
      return;
    }

    // 4. Not found in catalog
    if (soundFeedback) triggerScanFeedback('error');
    setLastScannedResult({
      type: 'NOT_FOUND',
      code: raw
    });
    setScanInput(raw);
  }, [locations, inventory, soundFeedback]);

  // 2. Datalogic QuickScan & Hardware USB/Bluetooth Barcode Scanner Listener
  useEffect(() => {
    if (!isOpen) return;

    let buffer = '';
    let lastKeyTimestamp = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeDelta = now - lastKeyTimestamp;
      lastKeyTimestamp = now;

      // Enter key signals end of barcode transmission from hardware reader (e.g. Datalogic QuickScan)
      if (e.key === 'Enter') {
        if (buffer.length >= 2) {
          // Hardware scanner or rapid scan
          e.preventDefault();
          e.stopPropagation();
          setHardwareScannerDetected(true);
          const scanned = buffer.trim();
          buffer = '';
          if (hardwareFlushTimerRef.current) window.clearTimeout(hardwareFlushTimerRef.current);
          handleScan(scanned);
          setTimeout(() => setHardwareScannerDetected(false), 3000);
        } else {
          buffer = '';
        }
        return;
      }

      // Tab key can also be sent as suffix by some Datalogic scanner profiles
      if (e.key === 'Tab' && buffer.length >= 2) {
        e.preventDefault();
        e.stopPropagation();
        setHardwareScannerDetected(true);
        const scanned = buffer.trim();
        buffer = '';
        if (hardwareFlushTimerRef.current) window.clearTimeout(hardwareFlushTimerRef.current);
        handleScan(scanned);
        setTimeout(() => setHardwareScannerDetected(false), 3000);
        return;
      }

      // Printable single characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (timeDelta > 120) {
          // Slow typing or start of a new scan burst
          buffer = e.key;
        } else {
          // Fast keystroke burst characteristic of Datalogic hardware scanners
          buffer += e.key;
        }

        // Some scanners are configured without a suffix. Flush only after a
        // fast burst so normal human typing remains a manual search.
        if (buffer.length >= 2 && timeDelta <= 120) {
          if (hardwareFlushTimerRef.current) window.clearTimeout(hardwareFlushTimerRef.current);
          hardwareFlushTimerRef.current = window.setTimeout(() => {
            const scanned = buffer.trim();
            buffer = '';
            if (scanned.length >= 2) {
              setHardwareScannerDetected(true);
              handleScan(scanned);
              window.setTimeout(() => setHardwareScannerDetected(false), 3000);
            }
          }, 180);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (hardwareFlushTimerRef.current) window.clearTimeout(hardwareFlushTimerRef.current);
    };
  }, [isOpen, handleScan]);

  // 3. Auto-focus manual input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // 4. Enumerate Available Cameras
  useEffect(() => {
    if (!isOpen) return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameraDevices(devices);
          // Prefer back/environment camera if available
          const backCam = devices.find(d => 
            d.label?.toLowerCase().includes('back') || 
            d.label?.toLowerCase().includes('rear') || 
            d.label?.toLowerCase().includes('environment') ||
            d.label?.includes('خلفية')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('Unable to query camera devices on mount', err);
      });
  }, [isOpen]);

  // 5. Start / Stop Camera Stream
  const stopCameraStream = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping camera:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
    setHasTorchCapability(false);
  }, []);

  const startCameraStream = useCallback(async (cameraIdToUse?: string) => {
    setCameraError(null);
    await stopCameraStream();

    const container = document.getElementById('ah-camera-viewfinder');
    if (!container) return;

    try {
      // Clear inner container contents before mounting
      container.innerHTML = '';

      const html5QrCode = new Html5Qrcode('ah-camera-viewfinder', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.PDF_417,
        ],
        verbose: false
      });
      html5QrCodeRef.current = html5QrCode;

      // On mobile screens, let Html5Qrcode adapt calculation to ensure video tag is visible
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

      const cameraConfig: Html5QrcodeCameraScanConfig = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          // Wide aspect box optimal for 1D barcodes and QR codes
          const boxWidth = Math.max(180, Math.floor(minEdge * (isMobile ? 0.92 : 0.85)));
          const boxHeight = Math.max(120, Math.floor(boxWidth * 0.65));
          return { width: boxWidth, height: boxHeight };
        }
      };

      const onScanSuccess = (decodedText: string) => {
        void stopCameraStream();
        handleScan(decodedText);
      };

      // Resilient camera startup with multi-tier fallback for phones and desktops
      let started = false;
      let lastErr: any = null;

      // Strategy 1: Specific cameraId passed by user selection
      if (cameraIdToUse) {
        try {
          await html5QrCode.start(cameraIdToUse, cameraConfig, onScanSuccess, () => {});
          started = true;
        } catch (err) {
          lastErr = err;
          console.warn('Specific camera start failed, fallback to environment mode...', err);
        }
      }

      // Strategy 2: Native environment/back camera (Optimal for mobile smartphones)
      if (!started) {
        try {
          await html5QrCode.start({ facingMode: 'environment' }, cameraConfig, onScanSuccess, () => {});
          started = true;
        } catch (err1: any) {
          lastErr = err1;
          console.warn('Environment camera failed, trying direct device ID enumeration...', err1);
          
          // Strategy 3: Direct hardware enumeration
          try {
            const devs = await Html5Qrcode.getCameras();
            if (devs && devs.length > 0) {
              setCameraDevices(devs);
              const backCam = devs.find(d => 
                d.label?.toLowerCase().includes('back') || 
                d.label?.toLowerCase().includes('rear') || 
                d.label?.toLowerCase().includes('environment') ||
                d.label?.includes('خلفية')
              );
              const targetId = backCam ? backCam.id : devs[0].id;
              setSelectedCameraId(targetId);
              await html5QrCode.start(targetId, cameraConfig, onScanSuccess, () => {});
              started = true;
            }
          } catch (err2: any) {
            lastErr = err2;
            console.warn('Direct device ID failed, trying user camera fallback...', err2);

            // Strategy 4: User-facing webcam (for laptops/desktops with no rear camera)
            try {
              await html5QrCode.start({ facingMode: 'user' }, cameraConfig, onScanSuccess, () => {});
              started = true;
            } catch (err3: any) {
              lastErr = err3;
            }
          }
        }
      }

      if (!started) {
        throw lastErr || new Error('تعذر تشغيل كاميرا الجهاز');
      }

      setIsCameraActive(true);

      // Re-populate devices list if empty
      Html5Qrcode.getCameras()
        .then((devs) => {
          if (devs && devs.length > 0) {
            setCameraDevices(devs);
            if (!selectedCameraId) setSelectedCameraId(devs[0].id);
          }
        })
        .catch(() => {});

      // Check if torch/flashlight is supported
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if ((capabilities as any)?.torch) {
          setHasTorchCapability(true);
        }
      } catch (e) {
        // Torch capability check not supported on this browser
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setIsCameraActive(false);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission')) {
        setCameraError('تم رفض إذن الوصول للكاميرا. يرجى تفعيل إذن الكاميرا من إعدادات المتصفح.');
      } else if (errMsg.includes('NotFoundError') || errMsg.includes('DevicesNotFoundError')) {
        setCameraError('لم يتم العثور على كاميرا متصلة بالجهاز. يمكنك إدخال الكود يدويًا أو استخدام قارئ Datalogic Barcode.');
      } else {
        setCameraError(`تعذر فتح الكاميرا: ${errMsg}`);
      }
    }
  }, [selectedCameraId, handleScan, stopCameraStream]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !isCameraActive) return;
    try {
      const nextTorch = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any]
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Failed to toggle torch', err);
    }
  };

  // Scan from uploaded Image / Screenshot
  const handleImageUploadScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const tempScanner = new Html5Qrcode('ah-camera-viewfinder-temp', false);
      const decodedText = await tempScanner.scanFile(file, true);
      handleScan(decodedText);
      tempScanner.clear();
    } catch (err: any) {
      console.warn('Image file scan error', err);
      triggerScanFeedback('error');
      setCameraError('لم يتم التعرف على باركود أو QR واضح في الصورة المرفوعة. يرجى التقاط صورة أقرب وأوضح.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Clean up camera on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      setLastScannedResult(null);
      setScanInput('');
      setCameraError(null);
    }
  }, [isOpen, stopCameraStream]);

  // Generate Code128 SVG string for thermal print HTML
  const generateCode128SvgHtml = (barcodeStr: string, heightMmVal: number = 4.8): string => {
    if (typeof document === 'undefined') return '';
    try {
      const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svgNode, barcodeStr, {
        format: 'CODE128',
        width: barcodeStr.length > 20 ? 0.46 : 0.54,
        height: Math.max(12, Math.round(heightMmVal * 3.78)),
        displayValue: false,
        margin: 0,
        background: 'transparent',
        lineColor: '#000000',
        valid: () => {}
      });
      svgNode.setAttribute('style', `max-width: ${activeWidthMm - 6}mm; height: ${heightMmVal}mm; display: block; margin: 0 auto;`);
      return svgNode.outerHTML;
    } catch (e) {
      return `<div style="font-family: monospace; font-size: 7pt; font-weight: bold; text-align: center;">${barcodeStr}</div>`;
    }
  };

  // Generate Thermal Print HTML
  const generateThermalPrintHtml = (): string => {
    if (!lastScannedResult) return '';

    const isPart = lastScannedResult.type === 'PART' && lastScannedResult.part;
    const isLoc = lastScannedResult.type === 'LOCATION' && lastScannedResult.location;

    const part = lastScannedResult.part;
    const location = lastScannedResult.location;

    let locationCode = '';
    if (isPart && part) {
      const inv = inventory.find(i => i.partId === part.id);
      locationCode = inv?.locationCode || (locations.find(l => l.id === inv?.locationId)?.code) || 'A-01';
    } else if (isLoc && location) {
      locationCode = location.code;
    }

    const barcodeValue = isPart && part ? (part.barcode || part.partNumber) : (location?.code || lastScannedResult.code);
    const barcodeSvgHtml = generateCode128SvgHtml(barcodeValue, 4.6);

    let singleLabelHtml = '';

    if (isPart && part) {
      singleLabelHtml = `
        <div class="thermal-label">
          <div class="header-row">
            <span class="part-number">${part.partNumber}</span>
            ${showPrintLocation && locationCode ? `<span class="location-badge">${locationCode}</span>` : ''}
          </div>
          <div class="part-name">
            ${part.nameAr || part.nameEn} ${part.brand ? `• ${part.brand}` : ''}
          </div>
          <div class="barcode-container">
            ${barcodeSvgHtml}
          </div>
          <div class="footer-row">
            <span class="serial-code">${barcodeValue}</span>
            <span class="price-or-brand">
              ${showPrintPrice ? `${part.sellingPrice.toLocaleString()} EGP` : (showPrintBrand ? customBrandTitle : '')}
            </span>
          </div>
        </div>
      `;
    } else if (isLoc && location) {
      singleLabelHtml = `
        <div class="thermal-label">
          <div class="header-row">
            <span class="part-number">${location.code}</span>
            <span class="location-badge">سعة: ${location.capacity}</span>
          </div>
          <div class="part-name">
            رف مستودع • منطقة ${location.zone} • ممر ${location.aisle} • رف ${location.shelf}
          </div>
          <div class="barcode-container">
            ${barcodeSvgHtml}
          </div>
          <div class="footer-row">
            <span class="serial-code">${location.code}</span>
            <span class="price-or-brand">${customBrandTitle}</span>
          </div>
        </div>
      `;
    }

    const copiesHtml = Array.from({ length: Math.max(1, printCopies) })
      .map(() => singleLabelHtml)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>طباعة ملصق حراري (${activeWidthCm}cm × ${activeHeightCm}cm)</title>
  <style>
    @page {
      size: ${activeWidthMm}mm ${activeHeightMm}mm;
      margin: 0mm !important;
    }
    *, *:before, *:after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${activeWidthMm}mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Segoe UI', Tahoma, -apple-system, BlinkMacSystemFont, Arial, sans-serif !important;
    }
    .thermal-label {
      width: ${activeWidthMm}mm !important;
      height: ${activeHeightMm}mm !important;
      max-width: ${activeWidthMm}mm !important;
      max-height: ${activeHeightMm}mm !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: hidden !important;
      padding: 1.4mm 2.2mm !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      background: #ffffff !important;
      border: none !important;
    }
    .header-row {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      border-bottom: 0.5pt solid #000000 !important;
      padding-bottom: 0.4mm !important;
      line-height: 1 !important;
    }
    .part-number {
      font-family: 'Consolas', 'Courier New', monospace !important;
      font-size: 7.5pt !important;
      font-weight: 900 !important;
      letter-spacing: -0.2pt !important;
      color: #000000 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .location-badge {
      font-family: 'Consolas', 'Courier New', monospace !important;
      font-size: 5.8pt !important;
      font-weight: 900 !important;
      background: #000000 !important;
      color: #ffffff !important;
      padding: 0.3mm 1.2mm !important;
      border-radius: 1mm !important;
      white-space: nowrap !important;
    }
    .part-name {
      font-size: 6.2pt !important;
      font-weight: 700 !important;
      color: #111111 !important;
      text-align: center !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      margin: 0.2mm 0 !important;
      line-height: 1.1 !important;
    }
    .barcode-container {
      width: 100% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin: auto 0 !important;
      overflow: hidden !important;
      line-height: 0 !important;
    }
    .barcode-container svg {
      max-width: ${activeWidthMm - 5}mm !important;
      height: 4.8mm !important;
      display: block !important;
      margin: 0 auto !important;
    }
    .footer-row {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      border-top: 0.5pt solid #000000 !important;
      padding-top: 0.4mm !important;
      font-size: 5.8pt !important;
      font-family: 'Consolas', monospace !important;
      line-height: 1 !important;
    }
    .serial-code {
      font-weight: 700 !important;
      color: #222222 !important;
      max-width: 26mm !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .price-or-brand {
      font-weight: 900 !important;
      color: #000000 !important;
      white-space: nowrap !important;
    }
  </style>
</head>
<body>
  ${copiesHtml}
</body>
</html>`;
  };

  // Execute immediate thermal print in isolated iframe
  const handleExecuteThermalPrint = async () => {
    if (!lastScannedResult || (lastScannedResult.type !== 'PART' && lastScannedResult.type !== 'LOCATION')) return;

    setIsPrinting(true);
    try {
      const printHtml = generateThermalPrintHtml();
      await printViaIsolatedIframe(printHtml);
      setPrintSuccessMsg(`تم إرسال ${printCopies} ملصق حراري (${activeWidthCm}cm × ${activeHeightCm}cm) للطابعة بنجاح!`);
      setTimeout(() => setPrintSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Thermal print error:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  // Active Part / Location
  const activePart = lastScannedResult?.type === 'PART' ? lastScannedResult.part : undefined;
  const scannedPartInventory = (activePart as (PartMaster & { scannedInventory?: InventoryItem[] }) | undefined)?.scannedInventory || [];
  const activePartInv = activePart
    ? scannedPartInventory.find(i => Number(i.quantity || 0) > 0) || scannedPartInventory[0] || inventory.find(i => i.partId === activePart.id)
    : undefined;
  const activeLocCode = activePartInv?.locationCode || (locations.find(l => l.id === activePartInv?.locationId)?.code) || 'A-01';

  const handleDeductStock = async () => {
    if (!activePart || deductionInFlightRef.current) return;

    const quantity = Number(deductQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setDeductionMessage('أدخل كمية صحيحة أكبر من صفر.');
      return;
    }
    if (quantity > Number(activePart.totalStock || 0)) {
      setDeductionMessage(`الكمية غير كافية. الرصيد الحالي: ${activePart.totalStock || 0}.`);
      return;
    }

    deductionInFlightRef.current = true;
    setIsDeducting(true);
    setDeductionMessage(null);
    try {
      await executeStockMovement({
        partId: activePart.id,
        partNumber: activePart.partNumber,
        movementType: 'SALE',
        quantity,
        branchId: activeBranch?.id,
        warehouseId: activePartInv?.warehouseId,
        sourceLocation: activePartInv?.locationCode,
        reason: 'صرف مبيعات عبر قارئ الباركود',
        userId: currentUser?.id,
        userName: currentUser?.displayName
      });
      setDeductionMessage(`تم خصم ${quantity} من المخزون وتسجيل الحركة بنجاح.`);
      lastScannedCodeRef.current = '';
      await handleScan(lastScannedResult.code);
    } catch (error: any) {
      setDeductionMessage(error?.message || 'تعذر خصم القطعة من المخزون.');
    } finally {
      deductionInFlightRef.current = false;
      setIsDeducting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div 
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[95vh] transition-colors ${
          isDark ? 'bg-[#0e0e12] border-white/10 text-zinc-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Hidden Container for single image decoding */}
        <div id="ah-camera-viewfinder-temp" className="hidden" />

        {/* Header */}
        <div className={`flex items-center justify-between px-4 sm:px-6 py-3.5 border-b ${isDark ? 'bg-[#07070a] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${
              isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base">
                  قارئ وماسح الباركود الذكي (Optical & Hardware Barcode)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-black">
                  Live Scanner
                </span>
              </div>
              <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                يدعم كاميرات الهواتف الذكية (iOS & Android)، أجهزة Datalogic QuickScan، وقارئات الـ POS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Feedback Toggle */}
            <button
              type="button"
              onClick={() => setSoundFeedback(!soundFeedback)}
              title={soundFeedback ? 'تعطيل صوت الصافرة' : 'تفعيل صوت صافرة المسح'}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                soundFeedback 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                  : isDark ? 'bg-zinc-900 text-zinc-500 border-white/10' : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}
            >
              {soundFeedback ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Active Hardware Scanner Badge notification */}
          {hardwareScannerDetected && (
            <div className="p-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500 text-emerald-300 text-xs font-bold flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>تم استقبال مسح سريع من قارئ Datalogic QuickScan / Hardware Scanner!</span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/30 px-2 py-0.5 rounded">USB Wedge</span>
            </div>
          )}

          {/* Camera Viewfinder & Controls Box */}
          <div className={`rounded-2xl border overflow-hidden relative ${
            isDark ? 'bg-[#060608] border-white/15' : 'bg-slate-950 border-slate-800 text-white'
          }`}>
            
            {/* Live Camera DOM Container or Standby Poster */}
            <div className="relative w-full min-h-[190px] sm:min-h-[240px] max-h-[300px] flex items-center justify-center overflow-hidden bg-black">
              
              {/* HTML5-QRCode Target Element */}
              <div 
                id="ah-camera-viewfinder" 
                className={`w-full h-full flex items-center justify-center ${isCameraActive ? 'block' : 'hidden'}`}
              />

              {/* Standby View when Camera is OFF */}
              {!isCameraActive && (
                <div className="p-6 text-center space-y-3 z-10">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-emerald-400 shadow-xl">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      القارئ البصري للكاميرا (Camera Scanner)
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                      افتح كاميرا الهاتف أو الكمبيوتر لمسح باركود قطع الغيار والملصقات أو استخدم قارئ Datalogic QuickScan مباشرة
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startCameraStream()}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>تشغيل كاميرا الهاتف / الجهاز الآن</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-xl border border-white/10 transition flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>مسح من صورة / لقطة</span>
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUploadScan} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>
                </div>
              )}

              {/* Animated Laser Overlay when Camera is Active */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-center">
                  <div className="w-4/5 max-w-[290px] h-[140px] border-2 border-dashed border-emerald-400/80 rounded-xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                    {/* Laser scanning line */}
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,1)] animate-pulse top-1/2 -translate-y-1/2" />
                    <div className="absolute top-2 left-2 text-[9px] font-mono text-emerald-400 font-bold bg-black/60 px-1.5 py-0.5 rounded">
                      [وجه الباركود داخل الإطار]
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Bottom Controls Bar */}
            {isCameraActive && (
              <div className="p-3 bg-zinc-900/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Camera Selector Dropdown */}
                {cameraDevices.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-zinc-400">الكاميرا:</span>
                    <select
                      value={selectedCameraId}
                      onChange={(e) => {
                        setSelectedCameraId(e.target.value);
                        startCameraStream(e.target.value);
                      }}
                      className="bg-black text-white text-[11px] font-bold rounded-lg px-2 py-1 border border-white/20 focus:outline-none"
                    >
                      {cameraDevices.map((dev, idx) => (
                        <option key={dev.id} value={dev.id}>
                          {dev.label || `كاميرا ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2 mr-auto">
                  {/* Torch Toggle if available */}
                  {hasTorchCapability && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        isTorchOn ? 'bg-amber-500 text-black border-amber-400' : 'bg-black text-white border-white/20 hover:bg-zinc-800'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isTorchOn ? 'إطفاء الكشاف' : 'تشغيل الكشاف'}</span>
                    </button>
                  )}

                  {/* Switch Camera Button */}
                  {cameraDevices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentIdx = cameraDevices.findIndex(d => d.id === selectedCameraId);
                        const nextIdx = (currentIdx + 1) % cameraDevices.length;
                        const nextDev = cameraDevices[nextIdx];
                        setSelectedCameraId(nextDev.id);
                        startCameraStream(nextDev.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-black hover:bg-zinc-800 text-white border border-white/20 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>تبديل العدسة</span>
                    </button>
                  )}

                  {/* Stop Camera Button */}
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
                  >
                    إيقاف الكاميرا
                  </button>
                </div>
              </div>
            )}

            {/* Camera Permission / Device Error Banner */}
            {cameraError && (
              <div className="p-3 bg-rose-950/80 border-t border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{cameraError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => startCameraStream()}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[11px] shrink-0 cursor-pointer"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}
          </div>

          {/* Datalogic QuickScan & Hardware Reader Ready Bar */}
          <div className={`px-3.5 py-2 rounded-xl border flex items-center justify-between text-xs ${
            isDark ? 'bg-zinc-900/60 border-white/10' : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}>
            <div className="flex items-center gap-2 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                قارئ Datalogic QuickScan & POS Scanner جاهز:
              </span>
              <span className="opacity-80 text-[11px] hidden sm:inline">
                وجّه القارئ واضغط الزر وسيتعرف النظام على القطعة فورياً بدون نقرات إضافية
              </span>
            </div>

            <div className="flex items-center gap-1 font-mono text-[10px] opacity-70">
              <Laptop className="w-3.5 h-3.5" />
              <span>USB / BT HID Ready</span>
            </div>
          </div>

          {/* Manual Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleScan(scanInput);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Barcode className={`w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="امسح بقارئ الباركود أو اكتب رقم القطعة (مثل A2233302303) أو كود الرف..."
                className={`w-full rounded-xl pr-11 pl-4 py-2.5 text-xs font-mono font-bold border transition focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                  isDark
                    ? 'bg-[#09090c] border-white/15 text-white focus:border-emerald-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600'
                }`}
              />
            </div>
            <button
              type="submit"
              className={`px-5 py-2.5 font-bold text-xs rounded-xl transition shrink-0 cursor-pointer ${
                isDark
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              بحث / مسح
            </button>
          </form>

          {/* Quick Click-to-Test Barcode Presets & Thermal Settings Link */}
          <div className="space-y-1.5">
            <div className={`text-xs font-bold flex items-center justify-between ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>نماذج تجريبية سريعة:</span>
              </span>
              <button
                type="button"
                onClick={() => setShowThermalSettings(!showThermalSettings)}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <Sliders className="w-3 h-3" />
                <span>إعدادات مقاس الورق الحراري ({activeWidthCm}×{activeHeightCm}cm)</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setScanInput('A2233302303');
                  handleScan('A2233302303');
                }}
                className={`px-3 py-1.5 rounded-full border text-xs font-mono font-bold transition cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border-white/10'
                    : 'bg-slate-100 hover:bg-slate-200 text-emerald-800 border-slate-300'
                }`}
              >
                قطعة: A2233302303 (مقص أمامي مرسيدس W223)
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanInput('A-03-02-07');
                  handleScan('A-03-02-07');
                }}
                className={`px-3 py-1.5 rounded-full border text-xs font-mono font-bold transition cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                رف تخزين: A-03-02-07
              </button>
            </div>
          </div>

          {/* Thermal Paper Fixed Size Settings Panel */}
          {showThermalSettings && (
            <div className={`p-4 rounded-2xl border space-y-3.5 animate-fadeIn ${
              isDark ? 'bg-zinc-900/90 border-emerald-500/30' : 'bg-emerald-50/50 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-xs text-emerald-400">
                    تخصيص مقاس الورق الحراري (Thermal Sticker Dimensions)
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-zinc-400">
                  المقاس النشط: {activeWidthCm}cm × {activeHeightCm}cm ({activeWidthMm}×{activeHeightMm}mm)
                </span>
              </div>

              {/* Preset Selector Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {THERMAL_PRESETS.filter(p => p.id !== 'CUSTOM').map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(preset.id);
                      setCustomWidthMm(preset.widthMm);
                      setCustomHeightMm(preset.heightMm);
                    }}
                    className={`p-2 rounded-xl border text-center transition font-bold text-xs cursor-pointer ${
                      selectedPreset === preset.id
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm ring-1 ring-emerald-400'
                        : isDark ? 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-white' : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-mono">{preset.name}</div>
                    <div className="text-[9px] opacity-80 font-normal mt-0.5">{preset.widthMm}mm × {preset.heightMm}mm</div>
                  </button>
                ))}
              </div>

              {/* Custom Dimensions or Fine-Tuning */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-300">العرض (Width):</span>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <input
                      type="number"
                      min={20}
                      max={120}
                      value={activeWidthMm}
                      onChange={(e) => {
                        setSelectedPreset('CUSTOM');
                        setCustomWidthMm(Number(e.target.value) || 50);
                      }}
                      className={`w-16 px-2 py-1 rounded-lg border text-center font-bold font-mono text-xs ${
                        isDark ? 'bg-zinc-950 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <span className="text-zinc-400 text-[11px]">mm ({activeWidthCm}cm)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-300">الطول/الارتفاع (Height):</span>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <input
                      type="number"
                      min={15}
                      max={100}
                      value={activeHeightMm}
                      onChange={(e) => {
                        setSelectedPreset('CUSTOM');
                        setCustomHeightMm(Number(e.target.value) || 25);
                      }}
                      className={`w-16 px-2 py-1 rounded-lg border text-center font-bold font-mono text-xs ${
                        isDark ? 'bg-zinc-950 border-white/20 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <span className="text-zinc-400 text-[11px]">mm ({activeHeightCm}cm)</span>
                  </div>
                </div>
              </div>

              {/* Print Content Options */}
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/10 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrintPrice}
                    onChange={(e) => setShowPrintPrice(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>إظهار السعر EGP</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrintLocation}
                    onChange={(e) => setShowPrintLocation(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>إظهار كود الرف Location</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrintBrand}
                    onChange={(e) => setShowPrintBrand(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>اسم المؤسسة والشعار</span>
                </label>
              </div>
            </div>
          )}

          {/* Success Toast */}
          {printSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-600/20 border border-emerald-500 text-emerald-300 text-xs font-bold flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{printSuccessMsg}</span>
              </div>
            </div>
          )}

          {/* Scan Result Card & Live Thermal Sticker Preview */}
          {lastScannedResult && (
            <div className={`p-4 sm:p-5 rounded-2xl border space-y-4 animate-fadeIn ${
              isDark ? 'bg-[#141418] border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              
              {/* Part Found */}
              {lastScannedResult.type === 'PART' && lastScannedResult.part && (
                <div className="space-y-4">
                  <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تم التعرف على قطعة غيار مرسيدس بنجاح</span>
                    </div>
                    <span className="text-xs font-mono opacity-60">
                      الكود الممسوح: {lastScannedResult.code}
                    </span>
                  </div>

                  {/* Part Details & Stock Info */}
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
                          {lastScannedResult.part.partNumber}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-bold border ${
                          isDark ? 'bg-zinc-900 text-zinc-300 border-zinc-800' : 'bg-white text-slate-700 border-slate-300'
                        }`}>
                          {lastScannedResult.part.quality === 'GENUINE_OEM' ? 'أصلي وكالة OEM' : 'مطابق للأصلي'}
                        </span>
                      </div>
                      <div className="text-sm font-bold">
                        {lastScannedResult.part.nameAr || lastScannedResult.part.nameEn}
                      </div>
                      <div className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                        {lastScannedResult.part.nameEn} {lastScannedResult.part.brand ? `• ${lastScannedResult.part.brand}` : ''}
                      </div>
                    </div>

                    <div className="text-start sm:text-left shrink-0">
                      <div className="text-xs opacity-60 font-mono">الرصيد المتاح</div>
                      <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {lastScannedResult.part.totalStock} {lastScannedResult.part.unit}
                      </div>
                      <div className="text-xs font-mono font-bold mt-0.5">
                        {formatEGP(lastScannedResult.part.sellingPrice)}
                      </div>
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border p-3 text-xs ${
                    isDark ? 'bg-zinc-950/60 border-white/10' : 'bg-white border-slate-200'
                  }`}>
                    <div>
                      <div className="opacity-60">Barcode</div>
                      <div className="font-mono font-bold mt-1 break-all">{lastScannedResult.part.barcode || lastScannedResult.code}</div>
                    </div>
                    <div>
                      <div className="opacity-60">Serial Number</div>
                      <div className="font-mono font-bold mt-1 break-all">
                        {((lastScannedResult.part as PartMaster & { serials?: string[] }).serials || []).join(', ') || 'غير موجود'}
                      </div>
                    </div>
                    <div>
                      <div className="opacity-60">مكان التخزين / Shelf Location</div>
                      <div className="font-mono font-bold mt-1">{activeLocCode || 'غير محدد'}</div>
                    </div>
                    <div>
                      <div className="opacity-60">الكمية الحالية</div>
                      <div className="font-mono font-bold mt-1">{lastScannedResult.part.totalStock || 0}</div>
                    </div>
                  </div>

                  <div className={`flex flex-col sm:flex-row sm:items-end gap-3 rounded-xl border p-3 ${
                    isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <label className="flex-1 text-xs font-bold">
                      كمية الخصم
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, Number(lastScannedResult.part.totalStock || 0))}
                        step={1}
                        value={deductQuantity}
                        onChange={(e) => setDeductQuantity(Math.max(1, Number(e.target.value) || 1))}
                        className={`mt-1 w-full rounded-lg border px-3 py-2 font-mono ${
                          isDark ? 'bg-zinc-950 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleDeductStock}
                      disabled={isDeducting || Number(lastScannedResult.part.totalStock || 0) <= 0}
                      className="w-full sm:w-auto rounded-lg bg-amber-600 px-5 py-2.5 text-xs font-black text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isDeducting ? 'جاري الخصم...' : 'خصم من المخزون'}
                    </button>
                  </div>
                  {Number(lastScannedResult.part.totalStock || 0) <= 0 && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-bold text-rose-500">
                      هذه القطعة نفد مخزونها ولا يمكن خصمها.
                    </div>
                  )}
                  {deductionMessage && (
                    <div className={`rounded-lg border p-2.5 text-xs font-bold ${
                      deductionMessage.startsWith('تم خصم')
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-500'
                    }`}>
                      {deductionMessage}
                    </div>
                  )}

                  {/* Fixed Dimension Thermal Sticker Card Preview Section */}
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-zinc-950/70 border-white/10' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Tag className="w-3.5 h-3.5 text-emerald-400" />
                        <span>معاينة الملصق الحراري بمقاس ثابت ({activeWidthCm}cm × {activeHeightCm}cm):</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        مطابق للورق الحراري المستخدم
                      </span>
                    </div>

                    {/* The Live Physical Dimension Sticker Box */}
                    <div className="flex items-center justify-center p-3 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-700 overflow-x-auto">
                      <div 
                        className="bg-white text-black rounded-sm border border-zinc-400 shadow-md flex flex-col justify-between select-none overflow-hidden box-border p-2"
                        style={{
                          width: `${activeWidthMm * 4.2}px`,
                          height: `${activeHeightMm * 4.2}px`,
                          minWidth: `${activeWidthMm * 4.2}px`,
                          minHeight: `${activeHeightMm * 4.2}px`,
                        }}
                      >
                        {/* Row 1: Part Number & Location */}
                        <div className="flex items-center justify-between border-b border-black/25 pb-0.5 leading-none">
                          <span className="font-mono font-black text-[9px] text-black tracking-tight truncate max-w-[125px]">
                            {lastScannedResult.part.partNumber}
                          </span>
                          {showPrintLocation && activeLocCode && (
                            <span className="font-mono text-[6.5px] font-black bg-black text-white px-1 py-0.5 rounded-xs shrink-0">
                              {activeLocCode}
                            </span>
                          )}
                        </div>

                        {/* Row 2: Part Arabic Name */}
                        <div className="text-[7.5px] font-bold text-zinc-900 truncate whitespace-nowrap text-center leading-none my-0.5">
                          {lastScannedResult.part.nameAr || lastScannedResult.part.nameEn}
                        </div>

                        {/* Row 3: Barcode Vector SVG */}
                        <div className="w-full flex items-center justify-center overflow-hidden my-auto">
                          <ThermalBarcodeRenderer 
                            code={lastScannedResult.part.barcode || lastScannedResult.part.partNumber} 
                            heightMm={4.8} 
                            barWidth={0.52} 
                          />
                        </div>

                        {/* Row 4: Serial & Price */}
                        <div className="flex items-center justify-between border-t border-black/25 pt-0.5 text-[6.5px] font-mono leading-none">
                          <span className="font-bold text-zinc-900 truncate max-w-[95px] whitespace-nowrap">
                            {lastScannedResult.part.barcode || lastScannedResult.part.partNumber}
                          </span>
                          <span className="font-black text-black shrink-0 whitespace-nowrap">
                            {showPrintPrice ? `${lastScannedResult.part.sellingPrice.toLocaleString()} EGP` : customBrandTitle}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Thermal Print Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                      {/* Copies Stepper */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-400">عدد النسخ:</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPrintCopies(Math.max(1, printCopies - 1))}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold flex items-center justify-center text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={printCopies}
                            onChange={(e) => setPrintCopies(Math.max(1, Number(e.target.value) || 1))}
                            className="w-12 h-7 rounded-lg bg-zinc-900 border border-white/10 text-center font-mono font-bold text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setPrintCopies(printCopies + 1)}
                            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold flex items-center justify-center text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Print Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openInCleanTab(generateThermalPrintHtml())}
                          className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            isDark ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                          title="فتح بنافذة مستقلة للطباعة"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">نافذة طباعة مستقلة</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleExecuteThermalPrint}
                          disabled={isPrinting}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Printer className="w-4 h-4" />
                          <span>
                            {isPrinting ? 'جاري إرسال الملصق...' : `طباعة ملصق حراري (${activeWidthCm}×${activeHeightCm}cm)`}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Open Part Details button */}
                  <div className={`pt-2 flex justify-end gap-2 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <button
                      onClick={() => {
                        onSelectPart(lastScannedResult.part!);
                        onClose();
                      }}
                      className={`px-5 py-2 font-bold text-xs rounded-xl transition cursor-pointer ${
                        isDark
                          ? 'bg-white hover:bg-zinc-200 text-black'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      فتح بطاقة الصنف الكاملة ←
                    </button>
                  </div>
                </div>
              )}

              {/* Location Found */}
              {lastScannedResult.type === 'LOCATION' && lastScannedResult.location && (
                <div className="space-y-4">
                  <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تم التعرف على موقع رف التخزين بالمستودع</span>
                    </div>
                    <span className="text-xs font-mono opacity-60">
                      الكود: {lastScannedResult.code}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-base tracking-wider text-emerald-600 dark:text-emerald-400">
                        {lastScannedResult.location.code}
                      </div>
                      <div className={`text-xs font-medium mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                        المنطقة {lastScannedResult.location.zone} • الممر {lastScannedResult.location.aisle} • الرف {lastScannedResult.location.shelf}
                      </div>
                    </div>
                    <div className="text-left">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-mono font-bold ${
                        isDark ? 'bg-zinc-900 text-zinc-300 border-white/10' : 'bg-white text-slate-700 border-slate-300'
                      }`}>
                        السعة القصوى: {lastScannedResult.location.capacity} قطعة
                      </span>
                    </div>
                  </div>

                  {/* Thermal Location Sticker Preview */}
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-zinc-950/70 border-white/10' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                        <Tag className="w-3.5 h-3.5" />
                        <span>معاينة ملصق الرف الحراري ({activeWidthCm}cm × {activeHeightCm}cm):</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleExecuteThermalPrint}
                        disabled={isPrinting}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>طباعة ملصق الرف الحراري</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-center p-3 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-700 overflow-x-auto">
                      <div 
                        className="bg-white text-black rounded-sm border border-zinc-400 shadow-md flex flex-col justify-between select-none overflow-hidden box-border p-2"
                        style={{
                          width: `${activeWidthMm * 4.2}px`,
                          height: `${activeHeightMm * 4.2}px`,
                          minWidth: `${activeWidthMm * 4.2}px`,
                          minHeight: `${activeHeightMm * 4.2}px`,
                        }}
                      >
                        <div className="flex items-center justify-between border-b border-black/25 pb-0.5 leading-none">
                          <span className="font-mono font-black text-[9px] text-black tracking-tight">
                            {lastScannedResult.location.code}
                          </span>
                          <span className="font-mono text-[6.5px] font-black bg-black text-white px-1 py-0.5 rounded-xs">
                            سعة: {lastScannedResult.location.capacity}
                          </span>
                        </div>
                        <div className="text-[7.5px] font-bold text-zinc-900 truncate text-center my-0.5">
                          منطقة {lastScannedResult.location.zone} • ممر {lastScannedResult.location.aisle} • رف {lastScannedResult.location.shelf}
                        </div>
                        <div className="w-full flex items-center justify-center overflow-hidden my-auto">
                          <ThermalBarcodeRenderer code={lastScannedResult.location.code} heightMm={4.8} />
                        </div>
                        <div className="flex items-center justify-between border-t border-black/25 pt-0.5 text-[6.5px] font-mono leading-none">
                          <span>{lastScannedResult.location.code}</span>
                          <span className="font-bold">{customBrandTitle}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    القطع المخزنة في هذا الرف ({lastScannedResult.locationParts?.length || 0}):
                  </div>

                  {lastScannedResult.locationParts && lastScannedResult.locationParts.length > 0 ? (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {lastScannedResult.locationParts.map((item) => (
                        <div
                          key={item.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                            isDark ? 'bg-[#09090c] border-white/5' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 ml-2">
                              {item.partNumber}
                            </span>
                            <span className="font-medium">{item.partNameAr || item.partNameEn}</span>
                          </div>
                          <span className="font-mono font-bold">
                            {item.quantity} قطعة
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs italic p-3 opacity-60">
                      هذا الرف فارغ حالياً وجاهز للتخزين.
                    </div>
                  )}

                  <div className={`pt-2 flex justify-end gap-2 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <button
                      onClick={() => {
                        onSelectLocation(lastScannedResult.location!);
                        onClose();
                      }}
                      className={`px-5 py-2 font-bold text-xs rounded-xl transition cursor-pointer ${
                        isDark
                          ? 'bg-white hover:bg-zinc-200 text-black'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      معاينة الرف في المستودع ←
                    </button>
                  </div>
                </div>
              )}

              {/* Not Found */}
              {lastScannedResult.type === 'NOT_FOUND' && (
                <div className="text-center py-5 space-y-2">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                  <div className="text-sm font-bold">
                    لم يتم العثور على قطعة بهذا الباركود: "{lastScannedResult.code}"
                  </div>
                  <p className={`text-xs font-medium max-w-sm mx-auto ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    تأكد من صحة رقم القطعة أو كود الرف التخزيني.
                  </p>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className={`px-4 sm:px-6 py-3 border-t text-xs flex items-center justify-between ${isDark ? 'bg-[#07070a] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] opacity-75 hidden sm:inline">نظام المسح والطباعة الحرارية: MB-PART-[CODE]</span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
              مقاس الورق الحراري: {activeWidthCm}cm × {activeHeightCm}cm
            </span>
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              isDark
                ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
