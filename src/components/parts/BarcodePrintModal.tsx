import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Printer, 
  Sparkles, 
  Trash2, 
  Plus, 
  Minus, 
  Search, 
  Tag, 
  Sliders, 
  RefreshCw, 
  Crosshair, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Store,
  MapPin,
  Coins,
  ShieldCheck,
  Zap,
  Grid3X3,
  X,
  Check,
  HelpCircle,
  FileText
} from 'lucide-react';
import { PartMaster, InventoryItem, WarehouseLocation } from '../../types/erp';
import { useTheme } from '../../lib/themeContext';
import { formatEGP } from '../../lib/formatters';
import { searchPartsFirestore } from '../../lib/firestoreService';
import {
  LABEL_WIDTH_MM,
  LABEL_HEIGHT_MM,
  SAFE_WIDTH_MM,
  SAFE_HEIGHT_MM,
  LabelData,
  LabelDisplayOptions,
  DEFAULT_DISPLAY_OPTIONS,
  PrintCalibrationSettings,
  DEFAULT_CALIBRATION,
  loadSavedCalibration,
  saveCalibrationToStorage,
  generateStandalonePrintHtml,
  printViaIsolatedIframe,
  openInCleanTab,
  LiveLabelPreviewCard
} from './barcodePrintEngine';

export interface SelectedPrintItem {
  part: PartMaster;
  quantity: number;
}

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItems?: SelectedPrintItem[];
  allParts: PartMaster[];
  inventory: InventoryItem[];
  locations: WarehouseLocation[];
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  initialItems = [],
  allParts = [],
  inventory = [],
  locations = []
}) => {
  const { isDark } = useTheme();

  // -------------------------------------------------------------
  // 1. Core State
  // -------------------------------------------------------------
  const [selectedItems, setSelectedItems] = useState<SelectedPrintItem[]>([]);
  const [printLayout, setPrintLayout] = useState<'SHEET_40' | 'THERMAL_ROLL'>('SHEET_40');
  const [displayOptions, setDisplayOptions] = useState<LabelDisplayOptions>(DEFAULT_DISPLAY_OPTIONS);
  const [calibration, setCalibration] = useState<PrintCalibrationSettings>(DEFAULT_CALIBRATION);
  
  const [showSafeGuideInPreview, setShowSafeGuideInPreview] = useState<boolean>(true);
  const [saveSerialsToSystem, setSaveSerialsToSystem] = useState<boolean>(true);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);

  // Active page & slot selection on 40-Up A4 sheets
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [pageSlotSelections, setPageSlotSelections] = useState<Record<number, boolean[]>>({});
  const [startFromSlotNum, setStartFromSlotNum] = useState<number>(1);

  // Quick search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [serverSearchResults, setServerSearchResults] = useState<PartMaster[]>([]);
  const [isSearchingParts, setIsSearchingParts] = useState(false);

  // -------------------------------------------------------------
  // 2. Initialization & Effects
  // -------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      if (initialItems && initialItems.length > 0) {
        setSelectedItems(initialItems.map(it => ({ ...it, quantity: Math.max(1, it.quantity) })));
      } else {
        setSelectedItems([]);
      }
      setCalibration(loadSavedCalibration());
      setActivePageIndex(0);
      setPageSlotSelections({});
    }
  }, [isOpen, initialItems]);

  const updateCalibration = useCallback((updates: Partial<PrintCalibrationSettings>) => {
    setCalibration(prev => {
      const next = { ...prev, ...updates };
      saveCalibrationToStorage(next);
      return next;
    });
  }, []);

  const updateDisplayOptions = useCallback((updates: Partial<LabelDisplayOptions>) => {
    setDisplayOptions(prev => ({ ...prev, ...updates }));
  }, []);

  // -------------------------------------------------------------
  // 3. Location Code Mapping Helper
  // -------------------------------------------------------------
  const getLocationCode = useCallback((locationId?: string): string => {
    if (!locationId) return '';
    const loc = locations.find(l => l.id === locationId);
    if (!loc) return '';
    return loc.bin || loc.code || loc.shelf || loc.zone || '';
  }, [locations]);

  const getPartLocationCode = useCallback((part: PartMaster): string => {
    const defaultCode = getLocationCode(part.defaultLocationId);
    if (defaultCode) return defaultCode;
    const inventoryRow = inventory.find(item => item.partId === part.id && Number(item.quantity || 0) > 0)
      || inventory.find(item => item.partId === part.id);
    return inventoryRow?.locationCode || '';
  }, [getLocationCode, inventory]);

  // -------------------------------------------------------------
  // 4. Raw Labels Queue Builder
  // -------------------------------------------------------------
  const rawLabelQueue = useMemo<LabelData[]>(() => {
    const queue: LabelData[] = [];

    selectedItems.forEach((item, itemIdx) => {
      const part = item.part;
      const count = Math.max(1, item.quantity);
      const locCode = getPartLocationCode(part);

      for (let copy = 1; copy <= count; copy++) {
        // Always retain the original string: barcodes and part/serial numbers
        // may begin with zero. Generating a shortened number here was causing
        // printed labels to differ from the stored barcode.
        const serial = String(part.barcode || part.partNumber || 'MB').trim();

        queue.push({
          id: `${part.id}_copy_${copy}_${itemIdx}`,
          serialNumber: serial,
          partId: part.id,
          partNumber: part.partNumber || 'A 000 000 00 00',
          nameAr: part.nameAr || part.nameEn || '',
          nameEn: part.nameEn || '',
          brand: part.brand || '',
          chassis: part.applicableChassis ? (Array.isArray(part.applicableChassis) ? part.applicableChassis.slice(0, 2).join(', ') : String(part.applicableChassis)) : '',
          locationCode: locCode,
          sellingPrice: part.sellingPrice || 0,
          costPrice: part.costPrice || 0,
          copyIndex: copy,
          totalCopiesForPart: count
        });
      }
    });

    return queue;
  }, [selectedItems, getPartLocationCode]);

  const totalRequiredLabels = rawLabelQueue.length;
  const totalPagesNeeded = Math.max(1, Math.ceil(totalRequiredLabels / 40));

  // -------------------------------------------------------------
  // 5. 40-Up Sheet Slot Mapping
  // -------------------------------------------------------------
  const getPageSlots = useCallback((pageIdx: number): boolean[] => {
    if (pageSlotSelections[pageIdx]) {
      return pageSlotSelections[pageIdx];
    }
    const defaults = Array(40).fill(false);
    const startIdx = pageIdx * 40;
    const countOnThisPage = Math.max(0, Math.min(40, totalRequiredLabels - startIdx));
    for (let i = 0; i < countOnThisPage; i++) {
      defaults[i] = true;
    }
    return defaults;
  }, [pageSlotSelections, totalRequiredLabels]);

  const currentSlots = useMemo(() => getPageSlots(activePageIndex), [getPageSlots, activePageIndex]);

  const toggleSlot = useCallback((slotIdx: number) => {
    setPageSlotSelections(prev => {
      const current = prev[activePageIndex] ? [...prev[activePageIndex]] : getPageSlots(activePageIndex);
      current[slotIdx] = !current[slotIdx];
      return { ...prev, [activePageIndex]: current };
    });
  }, [activePageIndex, getPageSlots]);

  const handleSelectAllSlots = useCallback(() => {
    setPageSlotSelections(prev => ({
      ...prev,
      [activePageIndex]: Array(40).fill(true)
    }));
  }, [activePageIndex]);

  const handleClearAllSlots = useCallback(() => {
    setPageSlotSelections(prev => ({
      ...prev,
      [activePageIndex]: Array(40).fill(false)
    }));
  }, [activePageIndex]);

  const handleAutoFitSlots = useCallback(() => {
    setPageSlotSelections(prev => {
      const nextArr = Array(40).fill(false);
      const startIdx = activePageIndex * 40;
      const countForThisPage = Math.max(0, Math.min(40, totalRequiredLabels - startIdx));
      for (let i = 0; i < countForThisPage; i++) {
        nextArr[i] = true;
      }
      return { ...prev, [activePageIndex]: nextArr };
    });
  }, [activePageIndex, totalRequiredLabels]);

  const handleStartFromSlot = useCallback((slotNum: number) => {
    const slotIdx = Math.max(0, Math.min(39, slotNum - 1));
    setPageSlotSelections(prev => {
      const nextArr = Array(40).fill(false);
      const startIdx = activePageIndex * 40;
      const neededCount = Math.max(0, totalRequiredLabels - startIdx);
      let filled = 0;
      for (let i = slotIdx; i < 40 && filled < neededCount; i++) {
        nextArr[i] = true;
        filled++;
      }
      return { ...prev, [activePageIndex]: nextArr };
    });
  }, [activePageIndex, totalRequiredLabels]);

  // Map queue labels into active grid slots
  const mappedPages = useMemo(() => {
    const pages: (LabelData | null)[][] = [];
    let queuePointer = 0;

    for (let p = 0; p < totalPagesNeeded; p++) {
      const slots = getPageSlots(p);
      const pageGrid: (LabelData | null)[] = Array(40).fill(null);

      for (let s = 0; s < 40; s++) {
        if (slots[s] && queuePointer < rawLabelQueue.length) {
          pageGrid[s] = {
            ...rawLabelQueue[queuePointer],
            assignedSlotIndex: s
          };
          queuePointer++;
        }
      }
      pages.push(pageGrid);
    }

    return pages;
  }, [totalPagesNeeded, getPageSlots, rawLabelQueue]);

  const currentActivePageGrid = mappedPages[activePageIndex] || Array(40).fill(null);
  const actualPrintedLabels = useMemo(() => {
    return mappedPages.flatMap(p => p.filter(Boolean) as LabelData[]);
  }, [mappedPages]);

  // Primary label to display in large 1:1 Live Preview
  const samplePreviewLabel: LabelData = useMemo(() => {
    if (actualPrintedLabels.length > 0) return actualPrintedLabels[0];
    if (rawLabelQueue.length > 0) return rawLabelQueue[0];
    return {
      id: 'demo_sample',
      serialNumber: 'A2044210000-01',
      partId: 'demo',
      partNumber: 'A 204 421 00 00',
      nameAr: 'تيل فرامل أمامي مرسيدس أصلي',
      nameEn: 'Brake Pad Front Genuine',
      brand: 'Mercedes-Benz',
      chassis: 'W204, W212',
      locationCode: 'A-04-02',
      sellingPrice: 3450,
      costPrice: 2200
    };
  }, [actualPrintedLabels, rawLabelQueue]);

  // -------------------------------------------------------------
  // 6. Search & Selection Actions
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || searchQuery.trim().length < 2) {
      setServerSearchResults([]);
      setIsSearchingParts(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearchingParts(true);
      try {
        const results = await searchPartsFirestore(searchQuery.trim(), 20);
        if (!cancelled) setServerSearchResults(results);
      } catch (error) {
        console.warn('Barcode part search failed:', error);
        if (!cancelled) setServerSearchResults([]);
      } finally {
        if (!cancelled) setIsSearchingParts(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, searchQuery]);

  const handleAddPartToPrint = (part: PartMaster) => {
    setSelectedItems(prev => {
      const existingIdx = prev.findIndex(it => it.part.id === part.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].quantity += 1;
        return next;
      }
      return [...prev, { part, quantity: 1 }];
    });
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const isPartSelected = useCallback((partId: string) => selectedItems.some(item => item.part.id === partId), [selectedItems]);

  const togglePartForPrint = useCallback((part: PartMaster) => {
    if (isPartSelected(part.id)) {
      setSelectedItems(prev => prev.filter(item => item.part.id !== part.id));
    } else {
      setSelectedItems(prev => [...prev, { part, quantity: 1 }]);
    }
  }, [isPartSelected]);

  const selectAllSearchResults = useCallback(() => {
    setSelectedItems(prev => {
      const known = new Set(prev.map(item => item.part.id));
      return [...prev, ...serverSearchResults.filter(part => !known.has(part.id)).map(part => ({ part, quantity: 1 }))];
    });
  }, [serverSearchResults]);

  const deselectAllSearchResults = useCallback(() => {
    const ids = new Set(serverSearchResults.map(part => part.id));
    setSelectedItems(prev => prev.filter(item => !ids.has(item.part.id)));
  }, [serverSearchResults]);

  const handleUpdateQuantity = (partId: string, delta: number) => {
    setSelectedItems(prev => 
      prev
        .map(it => it.part.id === partId ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it)
        .filter(it => it.quantity > 0)
    );
  };

  const handleSetExactQuantity = (partId: string, qty: number) => {
    setSelectedItems(prev => 
      prev
        .map(it => it.part.id === partId ? { ...it, quantity: Math.max(0, qty) } : it)
        .filter(it => it.quantity > 0)
    );
  };

  const handleRemoveItem = (partId: string) => {
    setSelectedItems(prev => prev.filter(it => it.part.id !== partId));
  };

  const handleSetAllToStock = () => {
    setSelectedItems(prev => 
      prev.map(it => {
        const stock = inventory
          .filter(inv => inv.partId === it.part.id)
          .reduce((sum, inv) => sum + (inv.quantityOnHand || 0), 0);
        return { ...it, quantity: Math.max(1, stock) };
      })
    );
  };

  // -------------------------------------------------------------
  // 7. Print Execution
  // -------------------------------------------------------------
  const buildCurrentPrintHtml = useCallback((isTestMode: boolean = false): string => {
    return generateStandalonePrintHtml({
      pages: mappedPages,
      rawLabels: rawLabelQueue,
      layout: printLayout,
      options: displayOptions,
      calibration,
      isTestGridMode: isTestMode
    });
  }, [mappedPages, rawLabelQueue, printLayout, displayOptions, calibration]);

  const handleExecutePrint = async () => {
    if (actualPrintedLabels.length === 0 && printLayout === 'SHEET_40') {
      alert('يرجى تحديد خانة واحدة على الأقل في ورقة A4 للطباعة.');
      return;
    }
    if (rawLabelQueue.length === 0 && printLayout === 'THERMAL_ROLL') {
      alert('يرجى اختيار صنف واحد على الأقل للطباعة.');
      return;
    }

    setIsPrinting(true);
    try {
      if (saveSerialsToSystem) {
        const labelsToSave = printLayout === 'SHEET_40' ? actualPrintedLabels : rawLabelQueue;
        for (const lbl of labelsToSave) {
          try {
            await fetch(`/api/local/parts/${encodeURIComponent(lbl.partId)}/printed-serial`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ serialNumber: lbl.serialNumber })
            });
          } catch (e) {
            console.warn('Could not update local printed serial', lbl.partId, e);
          }
        }
      }

      const printHtml = buildCurrentPrintHtml(false);
      await printViaIsolatedIframe(printHtml);

      setPrintSuccessMsg('تم إرسال أمر الطباعة بنجاح وبمحاذاة دقيقة 100% ✨');
      setTimeout(() => setPrintSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Print execution error:', err);
      const printHtml = buildCurrentPrintHtml(false);
      openInCleanTab(printHtml);
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintTestGrid = async () => {
    const testHtml = buildCurrentPrintHtml(true);
    await printViaIsolatedIframe(testHtml);
  };

  const handleOpenCleanTab = () => {
    const printHtml = buildCurrentPrintHtml(false);
    openInCleanTab(printHtml);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      dir="rtl"
    >
      <div 
        className={`w-full max-w-7xl max-h-[96vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          isDark ? 'bg-[#0f1117] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* ========================================================= */}
        {/* 1. Header Toolbar                                         */}
        {/* ========================================================= */}
        <div 
          className={`px-5 py-3.5 border-b flex items-center justify-between gap-3 shrink-0 ${
            isDark ? 'bg-[#151822] border-white/10' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>مركز طباعة ملصقات الباركود (52.5 × 29.7 مم)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  منطقة أمان Safe Area
                </span>
              </h2>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                طباعة متمركزة ومحاذاة بالملليمتر لورق A4 المعياري (40 ملصق 4×10) وللطابعات الحرارية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintTestGrid}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                isDark 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="طباعة شبكة محاذاة تجريبية لاختبار مقاسات الورق الحقيقي"
            >
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              <span>ورقة اختبار المحاذاة</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCleanTab}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                isDark 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>فتح بتبويب مستقل</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-xl transition cursor-pointer ${
                isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-black'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. Main Two-Column Workspace                              */}
        {/* ========================================================= */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

          {/* ------------------------------------------------------- */}
          {/* Left Column: Items Selection & Customization (5 Cols)   */}
          {/* ------------------------------------------------------- */}
          <div 
            className={`lg:col-span-5 flex flex-col border-b lg:border-b-0 lg:border-s overflow-hidden ${
              isDark ? 'border-white/10 bg-[#0f1117]' : 'border-slate-200 bg-slate-50/50'
            }`}
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* Paper Layout Selection */}
              <div>
                <label className="text-xs font-bold block mb-1.5">نوع الورق والطباعة</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintLayout('SHEET_40')}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                      printLayout === 'SHEET_40'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-xs'
                        : isDark ? 'bg-zinc-900/60 border-white/5 text-zinc-400' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <Grid3X3 className="w-4 h-4" />
                      <span>ورق A4 كامل (40 ملصق)</span>
                    </div>
                    <div className="text-[10px] opacity-75 mt-0.5">52.5 × 29.7 مم (4 أعمدة × 10 صفوف)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintLayout('THERMAL_ROLL')}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                      printLayout === 'THERMAL_ROLL'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-xs'
                        : isDark ? 'bg-zinc-900/60 border-white/5 text-zinc-400' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <Zap className="w-4 h-4" />
                      <span>طابعة حرارية رول (مفرد)</span>
                    </div>
                    <div className="text-[10px] opacity-75 mt-0.5">Xprinter / Zebra / Hoin 52.5×29.7mm</div>
                  </button>
                </div>
              </div>

              {/* Part Search & Quick Add */}
              <div className="relative">
                <label className="text-xs font-bold block mb-1">اختيار الصنف و Part Number</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSearchDropdown(true);
                    }}
                    onFocus={() => setShowSearchDropdown(true)}
                    placeholder="ابحث برقم القطعة أو الاسم لإضافتها..."
                    className={`w-full pr-9 pl-4 py-2 rounded-xl text-xs font-medium border outline-none transition ${
                      isDark 
                        ? 'bg-[#151822] border-white/10 focus:border-emerald-500 text-white placeholder-zinc-500' 
                        : 'bg-white border-slate-300 focus:border-emerald-600 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                {showSearchDropdown && searchQuery.trim().length >= 2 && (
                  <div 
                    className={`absolute top-full right-0 left-0 mt-1 rounded-xl border shadow-2xl z-30 max-h-56 overflow-y-auto ${
                      isDark ? 'bg-[#1a1d29] border-white/10' : 'bg-white border-slate-200'
                    }`}
                  >
                    {isSearchingParts ? (
                      <div className="p-3 text-xs text-zinc-400">جارٍ البحث في كامل قاعدة الأصناف…</div>
                    ) : serverSearchResults.length === 0 ? (
                      <div className="p-3 text-xs text-zinc-400">لا توجد نتائج مطابقة.</div>
                    ) : (
                      <>
                        <div className={`sticky top-0 z-10 px-2.5 py-2 flex items-center justify-between border-b ${isDark ? 'bg-[#1a1d29] border-white/10' : 'bg-white border-slate-200'}`}>
                          <span className="text-[10px] text-zinc-400">نتائج الخادم: {serverSearchResults.length}</span>
                          <div className="flex gap-2 text-[10px] font-bold">
                            <button type="button" onClick={selectAllSearchResults} className="text-emerald-500 hover:underline">تحديد الكل</button>
                            <button type="button" onClick={deselectAllSearchResults} className="text-rose-400 hover:underline">إلغاء التحديد</button>
                          </div>
                        </div>
                        {serverSearchResults.map(p => {
                          const selected = isPartSelected(p.id);
                          return (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => togglePartForPrint(p)}
                              className={`w-full p-2.5 flex items-center justify-between gap-2 border-b last:border-b-0 text-right transition text-xs ${
                                isDark ? 'hover:bg-zinc-800/80 border-white/5' : 'hover:bg-slate-50 border-slate-100'
                              }`}
                            >
                              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-emerald-600 border-emerald-500 text-white' : isDark ? 'border-zinc-600' : 'border-slate-300'}`}>
                                {selected && <Check className="w-3 h-3" />}
                              </span>
                              <span className="overflow-hidden flex-1 pr-1">
                                <span className="block font-mono font-bold text-emerald-500">{p.partNumber}</span>
                                <span className="block text-[11px] truncate opacity-90">{p.nameAr || p.nameEn}{p.barcode ? ` • ${p.barcode}` : ''}</span>
                              </span>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Items List & Stepper */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-500" />
                    <span>القطع المحددة للطباعة ({selectedItems.length})</span>
                  </label>
                  
                  {selectedItems.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSetAllToStock}
                        className="text-[11px] text-emerald-500 hover:underline font-bold cursor-pointer"
                      >
                        حسب رصيد المخزن 📦
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedItems([])}
                        className="text-[11px] text-rose-400 hover:underline font-bold cursor-pointer"
                      >
                        تفريغ الكل
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {selectedItems.length === 0 ? (
                    <div className={`p-6 text-center rounded-xl border border-dashed ${
                      isDark ? 'border-white/10 text-zinc-500' : 'border-slate-300 text-slate-400'
                    }`}>
                      <Tag className="w-6 h-6 mx-auto mb-1 opacity-40" />
                      <p className="text-xs font-bold">لم يتم اختيار أي قطع بعد</p>
                      <p className="text-[10px] opacity-75 mt-0.5">ابحث أعلاه لإضافة قطع وإنشاء الباركود لها</p>
                    </div>
                  ) : (
                    selectedItems.map((item) => (
                      <div
                        key={item.part.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                          isDark ? 'bg-[#151822] border-white/5' : 'bg-white border-slate-200 shadow-xs'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-black text-xs text-emerald-500 tracking-tight">
                            {item.part.partNumber}
                          </div>
                          <div className={`text-[11px] truncate font-medium ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                            {item.part.nameAr || item.part.nameEn}
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-0.5">
                            <span>السعر: {formatEGP(item.part.sellingPrice || 0)}</span>
                            {getLocationCode(item.part.defaultLocationId) && (
                              <span>الرف: {getLocationCode(item.part.defaultLocationId)}</span>
                            )}
                          </div>
                        </div>

                        {/* Stepper */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.part.id, -1)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold border transition cursor-pointer ${
                              isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                            }`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={item.quantity}
                            onChange={(e) => handleSetExactQuantity(item.part.id, parseInt(e.target.value) || 1)}
                            className={`w-11 text-center font-mono font-black text-xs py-0.5 rounded-lg border outline-none ${
                              isDark ? 'bg-zinc-900 border-white/10 text-emerald-400' : 'bg-white border-slate-300 text-emerald-700'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.part.id, 1)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold border transition cursor-pointer ${
                              isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.part.id)}
                            className="p-1 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Label Customization Controls */}
              <div className="space-y-3 border-t pt-3 border-white/10">
                <label className="text-xs font-bold block">محتوى وتخصيص الـ Label</label>

                {/* Store Name Input */}
                <div>
                  <div className="text-[11px] font-medium mb-1 text-zinc-400">اسم المتجر / البراند أعلى الملصق:</div>
                  <input
                    type="text"
                    value={displayOptions.storeBrandTitle}
                    onChange={(e) => updateDisplayOptions({ storeBrandTitle: e.target.value })}
                    placeholder="Ashraf & Hesham Libya"
                    className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold border outline-none ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Quick Content Toggles */}
                <div className="grid grid-cols-2 gap-2">
                  <label className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer text-xs font-medium transition ${
                    displayOptions.showStoreTitle 
                      ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-white' : 'bg-emerald-50 border-emerald-300 text-emerald-950')
                      : (isDark ? 'bg-zinc-900/60 border-white/5 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-500')
                  }`}>
                    <input
                      type="checkbox"
                      checked={displayOptions.showStoreTitle}
                      onChange={(e) => updateDisplayOptions({ showStoreTitle: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <Store className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ashraf & Hesham</span>
                  </label>

                  <label className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer text-xs font-medium transition ${
                    displayOptions.showPartArabicName 
                      ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-white' : 'bg-emerald-50 border-emerald-300 text-emerald-950')
                      : (isDark ? 'bg-zinc-900/60 border-white/5 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-500')
                  }`}>
                    <input
                      type="checkbox"
                      checked={displayOptions.showPartArabicName}
                      onChange={(e) => updateDisplayOptions({ showPartArabicName: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <span>اسم القطعة بالعربي</span>
                  </label>

                  <label className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer text-xs font-medium transition ${
                    displayOptions.showLocationBin 
                      ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-white' : 'bg-emerald-50 border-emerald-300 text-emerald-950')
                      : (isDark ? 'bg-zinc-900/60 border-white/5 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-500')
                  }`}>
                    <input
                      type="checkbox"
                      checked={displayOptions.showLocationBin}
                      onChange={(e) => updateDisplayOptions({ showLocationBin: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>موقع الرف (Bin)</span>
                  </label>

                  <label className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer text-xs font-medium transition ${
                    displayOptions.showSellingPrice 
                      ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-white' : 'bg-emerald-50 border-emerald-300 text-emerald-950')
                      : (isDark ? 'bg-zinc-900/60 border-white/5 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-500')
                  }`}>
                    <input
                      type="checkbox"
                      checked={displayOptions.showSellingPrice}
                      onChange={(e) => updateDisplayOptions({ showSellingPrice: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>سعر البيع (EGP)</span>
                  </label>
                </div>

                <label className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer text-xs font-medium transition ${
                  saveSerialsToSystem 
                    ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-white' : 'bg-emerald-50 border-emerald-300 text-emerald-950')
                    : (isDark ? 'bg-zinc-900/60 border-white/5 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-500')
                }`}>
                  <input
                    type="checkbox"
                    checked={saveSerialsToSystem}
                    onChange={(e) => setSaveSerialsToSystem(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0"
                  />
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>توليد وحفظ السيريال تلقائياً في بيانات الصنف</span>
                </label>
              </div>

            </div>
          </div>

          {/* ------------------------------------------------------- */}
          {/* Right Column: 1:1 Live Preview & A4 Sheet Grid (7 Cols) */}
          {/* ------------------------------------------------------- */}
          <div className="lg:col-span-7 flex flex-col overflow-hidden">
            
            {/* Top Bar of Right Column: 1:1 Live Preview Showcase */}
            <div className={`p-4 border-b shrink-0 ${isDark ? 'bg-[#151822]/80 border-white/10' : 'bg-slate-100/70 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-black">معاينة الـ Label الحقيقية (52.5 × 29.7 مم)</span>
                </div>

                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSafeGuideInPreview}
                    onChange={(e) => setShowSafeGuideInPreview(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0"
                  />
                  <span className="text-[11px] font-bold text-zinc-400">إظهار شبكة ومحاور التمركز (Safe Area + Center Cross)</span>
                </label>
              </div>

              {/* Large Centered Live Preview Card */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
                <LiveLabelPreviewCard
                  label={samplePreviewLabel}
                  options={displayOptions}
                  calibration={calibration}
                  showGuides={showSafeGuideInPreview}
                  isZoomed={true}
                />

                <div className={`text-xs space-y-1 max-w-xs ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  <div className="font-bold text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>متمركز 100% أفقيًا ورأسيًا</span>
                  </div>
                  <p className="text-[11px]">
                    الباركود والنصوص تقع داخل مساحة الأمان بدون أي تماس مع حواف القص.
                  </p>
                  <div className="text-[10px] font-mono opacity-80 pt-1">
                    Part: <strong>{samplePreviewLabel.partNumber}</strong> | Serial: <strong>{samplePreviewLabel.serialNumber}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Part: 40-Up A4 Sheet Virtual Grid / Slot Selector */}
            {printLayout === 'SHEET_40' ? (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                {/* Grid Toolbar Controls */}
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black flex items-center gap-1">
                      <Grid3X3 className="w-4 h-4 text-emerald-500" />
                      <span>تحديد خانات ورقة A4 (الصفحة {activePageIndex + 1} من {totalPagesNeeded})</span>
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">
                      {actualPrintedLabels.length} / {totalRequiredLabels} ملصق
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleAutoFitSlots}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-white/10 text-zinc-200' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      }`}
                      title="ملء الخانات تلقائياً مساوي لعدد الملصقات المطلوبة"
                    >
                      ملء تلقائي 🪄
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAllSlots}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-white/10 text-zinc-200' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      }`}
                    >
                      تحديد الكل (40)
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllSlots}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-white/10 text-zinc-200' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      }`}
                    >
                      مسح
                    </button>

                    {/* Start from Slot Stepper */}
                    <div className="flex items-center gap-1 text-[11px] font-bold ms-1">
                      <span className="text-zinc-400">ابدأ من #:</span>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={startFromSlotNum}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setStartFromSlotNum(val);
                          handleStartFromSlot(val);
                        }}
                        className={`w-10 text-center py-0.5 rounded-lg border font-mono font-bold outline-none ${
                          isDark ? 'bg-zinc-900 border-white/10 text-emerald-400' : 'bg-white border-slate-300 text-emerald-700'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* 40-Slot Virtual Sheet Grid (4 Cols × 10 Rows) */}
                <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-2">
                  <div 
                    className={`w-full max-w-[540px] aspect-[210/297] rounded-xl border p-2 shadow-inner grid grid-cols-4 grid-rows-10 gap-1 select-none ${
                      isDark ? 'bg-[#0a0c12] border-white/10' : 'bg-slate-200/60 border-slate-300'
                    }`}
                  >
                    {Array.from({ length: 40 }).map((_, slotIdx) => {
                      const isSelected = currentSlots[slotIdx];
                      const assignedLabel = currentActivePageGrid[slotIdx];

                      return (
                        <div
                          key={slotIdx}
                          onClick={() => toggleSlot(slotIdx)}
                          className={`relative rounded-md border transition flex flex-col justify-between p-1 cursor-pointer overflow-hidden leading-none ${
                            isSelected
                              ? (assignedLabel 
                                  ? (isDark ? 'bg-emerald-950/40 border-emerald-500/80 text-white shadow-xs' : 'bg-white border-emerald-600 text-black shadow-xs')
                                  : (isDark ? 'bg-emerald-900/20 border-emerald-500/40 text-emerald-400' : 'bg-emerald-50 border-emerald-400 text-emerald-800'))
                              : (isDark ? 'bg-zinc-900/40 border-white/5 opacity-35 hover:opacity-75' : 'bg-slate-100 border-slate-300 opacity-40 hover:opacity-80')
                          }`}
                        >
                          <div className="flex items-center justify-between text-[7.5px] font-mono font-bold">
                            <span>#{slotIdx + 1}</span>
                            {isSelected && (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            )}
                          </div>

                          {assignedLabel ? (
                            <div className="text-center overflow-hidden my-auto">
                              <div className="font-mono font-black text-[8px] truncate leading-tight">
                                {assignedLabel.partNumber}
                              </div>
                              <div className="font-mono text-[6.5px] text-zinc-400 truncate">
                                {assignedLabel.serialNumber}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center text-[7px] text-zinc-500 my-auto">
                              {isSelected ? 'خانة جاهزة' : 'فارغ'}
                            </div>
                          )}

                          <div className="text-[6px] text-zinc-500 text-center">
                            52.5×29.7mm
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Page Navigation if multiple A4 pages */}
                {totalPagesNeeded > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2 shrink-0">
                    <button
                      type="button"
                      disabled={activePageIndex === 0}
                      onClick={() => setActivePageIndex(p => Math.max(0, p - 1))}
                      className="px-3 py-1 rounded-lg text-xs font-bold border disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5 inline" /> الصفحة السابقة
                    </button>
                    <span className="text-xs font-bold font-mono">
                      صفحة {activePageIndex + 1} من {totalPagesNeeded}
                    </span>
                    <button
                      type="button"
                      disabled={activePageIndex >= totalPagesNeeded - 1}
                      onClick={() => setActivePageIndex(p => Math.min(totalPagesNeeded - 1, p + 1))}
                      className="px-3 py-1 rounded-lg text-xs font-bold border disabled:opacity-40"
                    >
                      الصفحة التالية <ChevronLeft className="w-3.5 h-3.5 inline" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Thermal Roll View */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <Zap className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold mb-1">وضع الطابعة الحرارية (Thermal Roll)</h3>
                <p className={`text-xs max-w-md ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  سيتم إرسال كل ملصق كصفحة فردية مستقلة بمقاس <strong>52.5mm × 29.7mm</strong> متمركزة ومضبوطة للطابعات الحرارية المباشرة.
                </p>
                <div className="mt-4 font-bold text-sm text-emerald-400">
                  إجمالي الملصقات المراد طباعتها: {rawLabelQueue.length} ملصق
                </div>
              </div>
            )}

          </div>

        </div>

        {/* ========================================================= */}
        {/* 3. Footer Action Bar                                      */}
        {/* ========================================================= */}
        <div 
          className={`px-5 py-3.5 border-t flex items-center justify-between gap-3 shrink-0 ${
            isDark ? 'bg-[#151822] border-white/10' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold">
              <span>إجمالي الملصقات: </span>
              <strong className="text-emerald-400 text-sm font-mono font-black">
                {printLayout === 'SHEET_40' ? actualPrintedLabels.length : rawLabelQueue.length}
              </strong>
              <span className="text-zinc-400 text-[11px] ms-1">
                ({selectedItems.reduce((s, it) => s + it.quantity, 0)} قطعة مطلوبة)
              </span>
            </div>

            {printSuccessMsg && (
              <span className="text-xs font-bold text-emerald-400 animate-fadeIn">
                {printSuccessMsg}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              إغلاق
            </button>

            <button
              type="button"
              onClick={handleExecutePrint}
              disabled={isPrinting || (printLayout === 'SHEET_40' ? actualPrintedLabels.length === 0 : rawLabelQueue.length === 0)}
              className="px-6 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'جاري الطباعة...' : 'طباعة الملصقات المحددة (Print)'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
