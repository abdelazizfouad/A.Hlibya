import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  MapPin, 
  Car, 
  ArrowLeftRight, 
  Edit3, 
  Sparkles, 
  Printer, 
  Info,
  Building2,
  Barcode as BarcodeIcon
} from 'lucide-react';
import { PartMaster, InventoryItem, StockMovement, WarehouseLocation } from '../../types/erp';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { formatEGP } from '../../lib/formatters';
import { recommendOptimalBinLocation } from '../../lib/firestoreService';
import { BarcodePrintModal } from './BarcodePrintModal';

interface PartDetailModalProps {
  part: PartMaster | null;
  onClose: () => void;
  inventory: InventoryItem[];
  movements: StockMovement[];
  allLocations: WarehouseLocation[];
  allParts?: PartMaster[];
  onOpenEditPart: (part: PartMaster) => void;
  onOpenMovementModal: (part: PartMaster) => void;
}

export const PartDetailModal: React.FC<PartDetailModalProps> = ({
  part,
  onClose,
  inventory,
  movements,
  allLocations,
  allParts = [],
  onOpenEditPart,
  onOpenMovementModal
}) => {
  const { canEditParts, canPerformStockMovements, canViewFinancials } = useAuth();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LOCATIONS' | 'COMPATIBILITY' | 'LEDGER' | 'LABEL'>('OVERVIEW');
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

  if (!part) return null;

  // Inventory locations for this part
  const partInventory = (inventory || []).filter((inv) => inv && inv.partId === part.id);
  
  // Stock movements for this part
  const partMovements = (movements || []).filter((m) => m && (m.partId === part.id || m.partNumber === part.partNumber));

  // Recommended bin
  const recommendedBin = recommendOptimalBinLocation(part.categoryGroup, allLocations || [], inventory || []);

  // Print Label Handler opens the standard 52.5x29.7mm Barcode modal
  const handlePrintLabel = () => {
    setIsBarcodeModalOpen(true);
  };

  const isLow = (part.totalStock || 0) > 0 && (part.totalStock || 0) <= (part.minStock || 0);
  const isOut = (part.totalStock || 0) === 0;

  const getQualityLabel = (quality: string) => {
    switch (quality) {
      case 'GENUINE_OEM': return 'أصلي وكالة OEM';
      case 'ORIGINAL': return 'أصلي مرسيدس Genuine';
      case 'AFTERMARKET': return 'بديل معتمد Aftermarket';
      case 'REMANUFACTURED': return 'مجدد معتمد Reman';
      default: return quality;
    }
  };

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'NEW': return 'جديد';
      case 'REFURBISHED': return 'مجدد';
      case 'USED': return 'مستعمل بحالة ممتازة';
      default: return condition;
    }
  };

  const getMovementTypeArabic = (type: string) => {
    switch (type) {
      case 'INITIAL_STOCK': return 'رصيد افتتاحي';
      case 'PURCHASE': return 'توريد / شراء';
      case 'SALE': return 'صرف / مبيعات';
      case 'TRANSFER': return 'نقل بين الأرفف';
      case 'ADJUSTMENT': return 'تسوية جرد';
      case 'DAMAGED': return 'تالف / هالك';
      case 'CUSTOMER_RETURN': return 'مرتجع عميل';
      case 'SUPPLIER_RETURN': return 'مرتجع مورد';
      default: return type;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div 
        className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors ${
          isDark
            ? 'bg-[#0f0f13] border-white/10 text-zinc-200'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Top Header */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b ${
            isDark ? 'bg-[#09090c] border-white/10' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                isDark ? 'bg-zinc-800 border-white/10 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'
              }`}
            >
              MB
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-mono font-bold text-sm sm:text-base tracking-wider text-emerald-600 dark:text-emerald-400">
                  {part.partNumber}
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                    isDark ? 'bg-zinc-900 border-white/10 text-zinc-300' : 'bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                >
                  {getQualityLabel(part.quality)}
                </span>
              </div>
              <p className={`text-xs font-bold truncate mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {part.nameAr || part.nameEn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Direct Barcode Print Button */}
            <button
              onClick={() => setIsBarcodeModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/30 transition shadow-sm"
              title="طباعة باركود وسيريال الصنف (52.5×29.7mm)"
            >
              <BarcodeIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">طباعة باركود</span>
            </button>

            {canPerformStockMovements && (
              <button
                onClick={() => onOpenMovementModal(part)}
                className={`hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${
                  isDark
                    ? 'bg-zinc-900 hover:bg-white hover:text-black border-white/10 text-zinc-200'
                    : 'bg-slate-100 hover:bg-slate-900 hover:text-white border-slate-300 text-slate-800'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>حركة مخزنية</span>
              </button>
            )}

            {canEditParts && (
              <button
                onClick={() => onOpenEditPart(part)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition shadow-sm ${
                  isDark
                    ? 'bg-white hover:bg-zinc-200 text-black'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تعديل</span>
              </button>
            )}

            <button
              onClick={onClose}
              className={`p-1.5 rounded-full transition ${
                isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`flex items-center gap-1 px-4 sm:px-6 border-b text-xs overflow-x-auto ${
            isDark ? 'bg-[#09090c]/80 border-white/10' : 'bg-slate-50/80 border-slate-200'
          }`}
        >
          {[
            { id: 'OVERVIEW', label: 'نظرة عامة والأسعار' },
            { id: 'LOCATIONS', label: `مواقع الأرفف (${(partInventory || []).length})` },
            { id: 'COMPATIBILITY', label: `توافقية السيارات (${(part?.compatibility || []).length})` },
            { id: 'LEDGER', label: `سجل الحركات (${(partMovements || []).length})` },
            { id: 'LABEL', label: 'طباعة الباركود' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 sm:px-4 font-bold border-b-2 transition whitespace-nowrap text-xs ${
                activeTab === tab.id
                  ? isDark
                    ? 'border-white text-white bg-white/5'
                    : 'border-slate-900 text-slate-900 bg-slate-200/50'
                  : isDark
                  ? 'border-transparent text-zinc-400 hover:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              
              {/* Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                
                {/* Stock on Hand */}
                <div
                  className={`p-4 sm:p-5 rounded-xl border space-y-1 ${
                    isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-[10px] font-bold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    الرصيد الفعلي المتوفر
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {part.totalStock}
                    </span>
                    <span className="text-xs opacity-75">{part.unit === 'PCS' ? 'قطعة' : part.unit}</span>
                  </div>
                  <div className="text-[11px] mt-2 font-medium">
                    {isOut ? (
                      <span className="text-rose-500">نفد المخزون (0)</span>
                    ) : isLow ? (
                      <span className="text-amber-500">مخزون منخفض (≤ {part.minStock})</span>
                    ) : (
                      <span className="text-emerald-500 font-bold">متوفر في المستودع الرئيسي</span>
                    )}
                  </div>
                </div>

                {/* Selling Price in EGP */}
                <div
                  className={`p-4 sm:p-5 rounded-xl border space-y-1 ${
                    isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-[10px] font-bold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    سعر البيع قطاعي (EGP)
                  </span>
                  <div className="text-2xl sm:text-3xl font-bold font-mono mt-1 text-emerald-600 dark:text-emerald-400">
                    {formatEGP(part.sellingPrice, { short: true })}
                  </div>
                  <div className={`text-[11px] mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    سعر الجملة / الورش: <strong className="font-mono">{formatEGP(part.wholesalePrice || part.sellingPrice, { short: true })}</strong>
                  </div>
                </div>

                {/* Cost in EGP */}
                <div
                  className={`p-4 sm:p-5 rounded-xl border space-y-1 ${
                    isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-[10px] font-bold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    سعر التكلفة الاستيرادية (EGP)
                  </span>
                  <div className="text-2xl sm:text-3xl font-bold font-mono mt-1">
                    {canViewFinancials ? formatEGP(part.costPrice, { short: true }) : '••••••'}
                  </div>
                  <div className={`text-[11px] mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    هامش الربح التقديري: {canViewFinancials ? (part.sellingPrice > 0 ? `${Math.round(((part.sellingPrice - (part.costPrice || 0)) / part.sellingPrice) * 100)}%` : '0%') : '••••'}
                  </div>
                </div>

              </div>

              {/* EPC Metadata & Specifications */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div
                  className={`p-4 sm:p-5 rounded-xl border space-y-3 ${
                    isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <h4 className="text-xs font-bold flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    <span>بيانات كتالوج مرسيدس EPC</span>
                  </h4>
                  
                  <div className="space-y-2 text-xs divide-y divide-inherit">
                    <div className="flex justify-between py-1.5">
                      <span className="opacity-70">المجموعة الرئيسية:</span>
                      <span className="font-bold">{part.categoryGroup}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="opacity-70">المجموعة الفرعية:</span>
                      <span className="font-bold">{part.subgroup || 'افتراضي'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="opacity-70">مخطط EPC / الموضع:</span>
                      <span className="font-mono font-bold">
                        {part.epcIllustration || '—'} / رقم: {part.epcPosition || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="opacity-70">الجانب والموقع:</span>
                      <span className="font-bold">
                        {part.side || 'يسار'} • {part.position || 'أمامي'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="opacity-70">الماركة:</span>
                      <span className="font-bold">{part.brand}</span>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-4 sm:p-5 rounded-xl border space-y-3 ${
                    isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <h4 className="text-xs font-bold flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-emerald-500" />
                    <span>الاسم والمواصفات</span>
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[11px] opacity-70 block">الاسم بالعربي:</span>
                      <p className="font-bold text-sm mt-0.5">{part.nameAr || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[11px] opacity-70 block">الاسم بالإنجليزي:</span>
                      <p className="text-xs mt-0.5 opacity-90">{part.nameEn}</p>
                    </div>
                    {part.description && (
                      <div>
                        <span className="text-[11px] opacity-70 block">الوصف الفني:</span>
                        <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{part.description}</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: WAREHOUSE BINS & INVENTORY */}
          {activeTab === 'LOCATIONS' && (
            <div className="space-y-4">
              {recommendedBin && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    isDark ? 'bg-[#141418] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold">توصية التخزين الذكي</h4>
                    <p className="text-xs opacity-80 mt-0.5">
                      موقع الرف المقترح لهذا الصنف: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{recommendedBin.code}</strong> (المنطقة {recommendedBin.zone} • {recommendedBin.notes || 'فرع الحرفيين'})
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold mb-3">
                  أرفف التخزين الحالية في مستودع الحرفيين
                </h4>

                {partInventory.length === 0 ? (
                  <div className={`p-8 text-center rounded-xl border ${isDark ? 'bg-[#141418] border-white/5 text-zinc-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    لا يوجد رصيد مخصص على أي رف حالياً.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {partInventory.map((inv) => (
                      <div
                        key={inv.id}
                        className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                          isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                              isDark ? 'bg-zinc-900 border-white/10 text-emerald-400' : 'bg-slate-200 border-slate-300 text-emerald-700'
                            }`}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-mono font-bold text-xs tracking-wider">
                              الرف: {inv.locationCode}
                            </div>
                            <div className="text-xs opacity-70">
                              فرع الحرفيين • المستودع الرئيسي
                            </div>
                          </div>
                        </div>

                        <div className="text-left">
                          <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {inv.quantity} {part.unit === 'PCS' ? 'قطعة' : part.unit}
                          </div>
                          <div className="text-[10px] opacity-70">
                            متاح للصرف: {inv.availableQuantity}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VEHICLE COMPATIBILITY */}
          {activeTab === 'COMPATIBILITY' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold">
                دليل توافقية سيارات مرسيدس-بنز ({(part?.compatibility || []).length})
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(part?.compatibility || []).map((comp, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border space-y-1.5 ${
                      isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-mono font-bold text-xs tracking-wider">
                          {comp.chassis}
                        </span>
                      </div>
                      <span className="text-xs font-mono opacity-75">
                        {comp.yearFrom ? `${comp.yearFrom} – ${comp.yearTo || '2026'}` : 'جميع السنوات'}
                      </span>
                    </div>

                    <div className="text-xs font-bold">
                      {comp.model}
                    </div>

                    {comp.engine && (
                      <div className="text-[11px] font-mono opacity-75">
                        كود المحرك: <strong>{comp.engine}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: MOVEMENT HISTORY LEDGER */}
          {activeTab === 'LEDGER' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold">
                سجل حركات المخزون للقطعة {part.partNumber}
              </h4>

              {partMovements.length === 0 ? (
                <div className={`p-8 text-center rounded-xl border ${isDark ? 'bg-[#141418] border-white/5 text-zinc-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                  لا توجد حركات مخزنية مسجلة.
                </div>
              ) : (
                <div className="space-y-2">
                  {partMovements.map((mov) => {
                    const isPositive = mov.quantity > 0;
                    return (
                      <div
                        key={mov.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                          isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {getMovementTypeArabic(mov.movementType)}
                            </span>
                            <span className="font-mono opacity-70 text-[10px]">
                              إذن: {mov.reference || '—'}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {isPositive ? `+${mov.quantity}` : mov.quantity} قطعة (الرصيد: {mov.newQuantity})
                          </span>
                        </div>

                        <div className="opacity-80 text-xs">
                          {mov.reason}
                        </div>

                        <div className="flex items-center justify-between text-[10px] opacity-60 pt-1.5 border-t border-inherit">
                          <span>بواسطة: <strong>{mov.userName}</strong></span>
                          <span>{new Date(mov.timestamp).toLocaleString('ar-EG')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: BARCODE & QR LABEL */}
          {activeTab === 'LABEL' && (
            <div className="space-y-5 max-w-lg mx-auto text-center">
              <div className="p-6 bg-white text-zinc-950 rounded-2xl border border-zinc-300 shadow-xl space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 border-b border-zinc-200 pb-1 flex justify-between">
                  <span>AH.Libya Store</span>
                  <span>مقاس: 52.5mm × 29.7mm (40 ملصق/ورقة)</span>
                </div>

                <div className="font-mono font-bold text-2xl tracking-wider text-black">
                  {part.partNumber}
                </div>

                <div className="text-xs font-bold text-zinc-800">
                  {part.nameAr || part.nameEn}
                </div>

                <div className="text-[11px] text-zinc-600 font-sans">
                  {part.nameEn}
                </div>

                <div className="py-2 px-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1.5">
                  <div className="text-[11px] text-zinc-700 font-medium">
                    ⚡ يدعم توليد أرقام تسلسلية فريدة (Serial Number) لكل ملصق تلقائياً دون تكرار
                  </div>
                  <div className="font-mono text-xs text-emerald-700 font-bold">
                    باركود Code 128 قياسي متوافق مع كافة قارئات الباركود والطابعات
                  </div>
                </div>

                <div className="text-[10px] text-zinc-600 border-t border-zinc-200 pt-2 flex justify-between font-bold">
                  <span>السعر: {formatEGP(part.sellingPrice)}</span>
                  <span>الرف: {partInventory[0]?.locationCode || 'A-03-02-07'}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handlePrintLabel}
                  className="px-6 py-2.5 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition flex items-center justify-center gap-2"
                >
                  <BarcodeIcon className="w-4 h-4" />
                  <span>فتح نافذة طباعة الباركود (52.5×29.7mm) 🖨️</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div
          className={`px-4 sm:px-6 py-3 border-t text-xs flex items-center justify-between font-medium ${
            isDark ? 'bg-[#09090c] border-white/10 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <span className="font-mono text-[11px]">AH.Libya Store — فرع الحرفيين</span>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-full font-bold transition border text-xs ${
              isDark
                ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/10'
                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
            }`}
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* Barcode Printing Modal for this Part */}
      <BarcodePrintModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        initialItems={[{
          part,
          quantity: 1
        }]}
        allParts={(allParts || []).length > 0 ? allParts : [part]}
        inventory={inventory || []}
        locations={allLocations || []}
      />
    </div>
  );
};
