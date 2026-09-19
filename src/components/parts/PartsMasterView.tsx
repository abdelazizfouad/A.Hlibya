import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  PlusCircle, 
  Download, 
  Eye, 
  ArrowLeftRight, 
  Edit3, 
  MapPin, 
  Boxes,
  Building2,
  Package,
  FileSpreadsheet,
  Trash2,
  Barcode as BarcodeIcon,
  Printer,
  CheckSquare,
  Square,
  Layers,
  RotateCw
} from 'lucide-react';
import { PartMaster, InventoryItem, WarehouseLocation, EpcCategory, Warehouse, Branch } from '../../types/erp';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { formatEGP } from '../../lib/formatters';
import { ExcelImportModal } from './ExcelImportModal';
import { BarcodePrintModal, SelectedPrintItem } from './BarcodePrintModal';
import { deletePart, zeroOutAllSellingPrices } from '../../lib/firestoreService';
import { matchPartFlexible } from '../../utils/searchUtils';
import { fetchPartsPage } from '../../lib/firestoreService';

interface PartsMasterViewProps {
  parts: PartMaster[];
  inventory: InventoryItem[];
  locations: WarehouseLocation[];
  categories?: EpcCategory[];
  warehouses?: Warehouse[];
  branches?: Branch[];
  onSelectPart: (part: PartMaster) => void;
  onOpenAddPart: () => void;
  onOpenEditPart: (part: PartMaster) => void;
  onOpenMovementModal: (part: PartMaster) => void;
}

export const PartsMasterView: React.FC<PartsMasterViewProps> = ({
  parts,
  inventory,
  locations,
  categories = [],
  warehouses = [],
  branches = [],
  onSelectPart,
  onOpenAddPart,
  onOpenEditPart,
  onOpenMovementModal
}) => {
  const { canEditParts, canPerformStockMovements, canViewFinancials } = useAuth();
  const { isDark } = useTheme();

  // Excel Bulk Import Modal State
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Barcode Printing State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeModalInitialItems, setBarcodeModalInitialItems] = useState<SelectedPrintItem[]>([]);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [isZeroingSelling, setIsZeroingSelling] = useState(false);
  const [zeroStatusMsg, setZeroStatusMsg] = useState<string | null>(null);

  const handleZeroAllSellingPrices = async () => {
    if (!window.confirm(`هل تريد تصفير سعر البيع لكافة الأصناف المسجلة في المنظومة (${parts.length} صنف) وجعل سعر البيع 0 جنيه مصري؟`)) {
      return;
    }

    setIsZeroingSelling(true);
    try {
      const res = await zeroOutAllSellingPrices();
      setZeroStatusMsg(res.message);
      setTimeout(() => setZeroStatusMsg(null), 5000);
    } catch (err: any) {
      console.error('Error zeroing prices:', err);
      alert('خطأ أثناء تصفير سعر البيع: ' + err.message);
    } finally {
      setIsZeroingSelling(false);
    }
  };

  const handleToggleSelectPart = (e: React.MouseEvent, partId: string) => {
    e.stopPropagation();
    setSelectedPartIds(prev => {
      const next = new Set(prev);
      if (next.has(partId)) {
        next.delete(partId);
      } else {
        next.add(partId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedPartIds.size === filteredParts.length && filteredParts.length > 0) {
      setSelectedPartIds(new Set());
    } else {
      setSelectedPartIds(new Set(filteredParts.map(p => p.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedPartIds(new Set());
  };

  // Open Barcode Modal for Single Part
  const handleOpenBarcodeForSingle = (e: React.MouseEvent, part: PartMaster) => {
    e.stopPropagation();
    setBarcodeModalInitialItems([{
      part,
      quantity: 1
    }]);
    setIsBarcodeModalOpen(true);
  };

  // Open Barcode Modal for Selected Parts
  const handleOpenBarcodeForSelected = () => {
    const selected = parts.filter(p => selectedPartIds.has(p.id));
    if (selected.length === 0) {
      // If none selected, open with all filtered or first
      setBarcodeModalInitialItems(filteredParts.slice(0, 10).map(p => ({
        part: p,
        quantity: 1
      })));
    } else {
      setBarcodeModalInitialItems(selected.map(p => ({
        part: p,
        quantity: 1
      })));
    }
    setIsBarcodeModalOpen(true);
  };

  const handleDeletePart = async (e: React.MouseEvent, part: PartMaster) => {
    e.stopPropagation();
    if (!window.confirm(`هل أنت متأكد من حذف القطعة "${part.partNumber} - ${part.nameAr}" نهائياً من قاعدة البيانات؟`)) {
      return;
    }
    setDeletingId(part.id);
    try {
      await deletePart(part.id);
    } catch (err: any) {
      console.error('Error deleting part:', err);
      alert('خطأ أثناء حذف القطعة: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedChassis, setSelectedChassis] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedQuality, setSelectedQuality] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'partNumber' | 'totalStock' | 'sellingPrice' | 'nameEn'>('partNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [serverParts, setServerParts] = useState<PartMaster[]>(parts.slice(0, pageSize));
  const [serverTotalCount, setServerTotalCount] = useState<number>(parts.length);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchPartsPage({
        page: currentPage,
        pageSize,
        query: searchTerm,
        categoryGroup: selectedGroup,
        quality: selectedQuality,
        status: selectedStatus,
        sortBy,
        sortDirection: sortOrder
      }).then(result => {
        if (!cancelled) {
          setServerParts(result.parts);
          setServerTotalCount(result.totalCount);
        }
      }).catch(error => {
        console.warn('Catalog page load failed:', error);
      });
    }, searchTerm ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentPage, pageSize, searchTerm, selectedGroup, selectedQuality, selectedStatus, sortBy, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedGroup, selectedChassis, selectedStatus, selectedQuality, sortBy, sortOrder, pageSize]);

  // Extract distinct Chassis list
  const chassisList = useMemo(() => {
    const set = new Set<string>();
    (parts || []).forEach((p) => {
      (p.compatibility || []).forEach((c) => {
        if (c?.chassis) set.add(c.chassis);
      });
    });
    return Array.from(set).sort();
  }, [parts]);

  // Extract distinct Category Groups
  const categoryGroups = useMemo(() => {
    const set = new Set<string>();
    (parts || []).forEach((p) => {
      if (p.categoryGroup) set.add(p.categoryGroup);
    });
    return Array.from(set).sort();
  }, [parts]);

  // Filtered and Sorted Parts
  const filteredParts = useMemo(() => {
    return serverParts;
  }, [serverParts]);

  const totalPages = Math.max(1, Math.ceil(serverTotalCount / pageSize));

  // Slice for fast performance & zero lag
  const paginatedParts = useMemo(() => {
    return filteredParts;
  }, [filteredParts]);

  // Export CSV in EGP
  const handleExportCSV = () => {
    const headers = ['رقم القطعة', 'الاسم بالعربي', 'الاسم بالإنجليزي', 'مجموعة EPC', 'الماركة', 'الجودة', 'المخزون الفعلي', 'سعر التكلفة EGP', 'سعر البيع EGP', 'الحد الأدنى'];
    const rows = filteredParts.map(p => [
      `"${p.partNumber}"`,
      `"${p.nameAr}"`,
      `"${p.nameEn}"`,
      `"${p.categoryGroup}"`,
      `"${p.brand}"`,
      `"${p.quality}"`,
      p.totalStock,
      p.costPrice,
      p.sellingPrice,
      p.minStock
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AH_Libya_Store_Parts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getQualityLabel = (quality: string) => {
    switch (quality) {
      case 'GENUINE_OEM': return 'أصلي وكالة OEM';
      case 'ORIGINAL': return 'أصلي مرسيدس Genuine';
      case 'AFTERMARKET': return 'بديل معتمد Aftermarket';
      case 'REMANUFACTURED': return 'مجدد معتمد Reman';
      default: return quality;
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1
              className={`text-xl sm:text-2xl lg:text-3xl font-serif-luxury font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              كتالوج وقطع غيار مرسيدس EPC
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold border ${
                isDark
                  ? 'bg-zinc-900 border-white/10 text-emerald-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              {filteredParts.length} قطعة
            </span>
          </div>
          <p
            className={`text-xs sm:text-sm mt-1 font-medium ${
              isDark ? 'text-zinc-400' : 'text-slate-500'
            }`}
          >
            كتالوج قطع غيار مرسيدس-بنز الرسمية — فرع الحرفيين بالجنيه المصري (EGP)
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Zero Selling Prices Button */}
          {canEditParts && (
            <button
              onClick={handleZeroAllSellingPrices}
              disabled={isZeroingSelling}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold bg-amber-600/90 hover:bg-amber-600 text-white shadow-sm transition-all cursor-pointer"
              title={`تصفير سعر البيع لجميع البنود المسجلة (${parts.length} صنف)`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isZeroingSelling ? 'animate-spin' : ''}`} />
              <span>{isZeroingSelling ? 'جاري تصفير سعر البيع...' : 'تصفير سعر البيع (0 EGP)'}</span>
            </button>
          )}

          {/* Barcode Print Modal Button */}
          <button
            onClick={handleOpenBarcodeForSelected}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all ${
              selectedPartIds.size > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md animate-pulse'
                : isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border-emerald-500/30'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
            }`}
          >
            <BarcodeIcon className="w-3.5 h-3.5" />
            <span>
              {selectedPartIds.size > 0 
                ? `طباعة باركود (${selectedPartIds.size}) صنف محدد 🖨️` 
                : 'طباعة باركود وسيريال (52.5×29.7mm)'}
            </span>
          </button>

          {canEditParts && (
            <button
              onClick={() => setIsExcelImportOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                isDark
                  ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>استيراد إكسل / CSV 🚀</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
              isDark
                ? 'bg-zinc-900 hover:bg-white hover:text-black border-white/10 text-zinc-300'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-xs'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير CSV</span>
          </button>

          {canEditParts && (
            <button
              onClick={onOpenAddPart}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all shadow-md ${
                isDark
                  ? 'bg-white hover:bg-zinc-200 text-black shadow-white/10'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة قطعة جديدة</span>
            </button>
          )}
        </div>
      </div>

      {zeroStatusMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <span>{zeroStatusMsg}</span>
          <button 
            onClick={() => setZeroStatusMsg(null)}
            className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Bulk Selection Floating / Inline Banner */}
      {selectedPartIds.size > 0 && (
        <div className={`p-3 rounded-2xl border shadow-lg flex flex-wrap items-center justify-between gap-3 animate-fadeIn ${
          isDark ? 'bg-[#121218] border-emerald-500/30 text-white' : 'bg-emerald-50 border-emerald-200 text-slate-900'
        }`}>
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              {selectedPartIds.size}
            </span>
            <div>
              <span className="font-bold text-xs block">
                تم تحديد ({selectedPartIds.size}) صنف من الكتالوج
              </span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-400">
                جاهز لتوليد وطباعة ملصقات الباركود والسيريال نمبر (40 ملصق بالورقة 52.5×29.7mm)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenBarcodeForSelected}
              className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              <span>تخصيص وطباعة الباركود ({selectedPartIds.size}) 🖨️</span>
            </button>
            <button
              onClick={handleSelectAllFiltered}
              className={`px-3 py-2 rounded-full border text-xs font-medium transition ${
                isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              {selectedPartIds.size === filteredParts.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </button>
            <button
              onClick={handleClearSelection}
              className="px-3 py-2 rounded-full text-rose-500 hover:bg-rose-500/10 text-xs font-bold transition"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Multi-Filter Bar */}
      <div
        className={`rounded-2xl p-4 sm:p-5 space-y-4 border shadow-sm ${
          isDark ? 'bg-[#0f0f13] border-white/10' : 'bg-white border-slate-200'
        }`}
      >
        
        {/* Primary Search Input */}
        <div className="relative">
          <Search
            className={`w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 ${
              isDark ? 'text-zinc-500' : 'text-slate-400'
            }`}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث برقم القطعة (A2233302303)، الاسم العربي/الإنجليزي، الماركة، الشاسيه (W223)، الباركود..."
            className={`w-full rounded-xl pr-11 pl-4 py-2.5 text-xs focus:outline-none transition-all ${
              isDark
                ? 'bg-[#141418] border border-white/10 text-white placeholder-zinc-500 focus:border-white/30'
                : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400'
            }`}
          />
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
          
          {/* Category Group */}
          <div>
            <label className={`block text-[10px] font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              مجموعة EPC
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className={`w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none ${
                isDark
                  ? 'bg-[#141418] border border-white/10 text-zinc-300'
                  : 'bg-slate-50 border border-slate-200 text-slate-800'
              }`}
            >
              <option value="ALL">جميع المجموعات ({categoryGroups.length})</option>
              {categoryGroups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Vehicle Chassis */}
          <div>
            <label className={`block text-[10px] font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              شاسيه مرسيدس
            </label>
            <select
              value={selectedChassis}
              onChange={(e) => setSelectedChassis(e.target.value)}
              className={`w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none ${
                isDark
                  ? 'bg-[#141418] border border-white/10 text-zinc-300'
                  : 'bg-slate-50 border border-slate-200 text-slate-800'
              }`}
            >
              <option value="ALL">جميع الموديلات</option>
              {chassisList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Stock Status */}
          <div>
            <label className={`block text-[10px] font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              حالة المخزون
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={`w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none ${
                isDark
                  ? 'bg-[#141418] border border-white/10 text-zinc-300'
                  : 'bg-slate-50 border border-slate-200 text-slate-800'
              }`}
            >
              <option value="ALL">جميع الحالات</option>
              <option value="IN_STOCK">متوفر في المخزن</option>
              <option value="LOW_STOCK">مخزون منخفض</option>
              <option value="OUT_OF_STOCK">نفد من المخزن</option>
            </select>
          </div>

          {/* Quality */}
          <div>
            <label className={`block text-[10px] font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              درجة الجودة
            </label>
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              className={`w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none ${
                isDark
                  ? 'bg-[#141418] border border-white/10 text-zinc-300'
                  : 'bg-slate-50 border border-slate-200 text-slate-800'
              }`}
            >
              <option value="ALL">جميع الدرجات</option>
              <option value="GENUINE_OEM">أصلي وكالة OEM</option>
              <option value="ORIGINAL">أصلي مرسيدس</option>
              <option value="AFTERMARKET">بديل معتمد</option>
            </select>
          </div>

          {/* Sort */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-1">
            <label className={`block text-[10px] font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              الترتيب
            </label>
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('_');
                setSortBy(sb as any);
                setSortOrder(so as any);
              }}
              className={`w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none ${
                isDark
                  ? 'bg-[#141418] border border-white/10 text-zinc-300'
                  : 'bg-slate-50 border border-slate-200 text-slate-800'
              }`}
            >
              <option value="partNumber_asc">رقم القطعة (تصاعدي)</option>
              <option value="totalStock_desc">المخزون (الأعلى أولاً)</option>
              <option value="sellingPrice_desc">السعر (الأعلى أولاً)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Responsive View: Desktop Table + Mobile Card Stack */}
      <div
        className={`rounded-2xl border overflow-hidden shadow-sm ${
          isDark ? 'bg-[#0f0f13] border-white/10' : 'bg-white border-slate-200'
        }`}
      >
        
        {/* Mobile View: Cards (Visible only on screens < md) */}
        <div className="md:hidden divide-y divide-inherit">
          {filteredParts.length === 0 ? (
            <div className={`p-8 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              لا توجد قطع مطابقة للبحث.
            </div>
          ) : (
            paginatedParts.map((part) => {
              const partInvs = inventory.filter(inv => inv.partId === part.id && inv.quantity > 0);
              const primaryBin = partInvs.length > 0 ? partInvs[0].locationCode : 'A-03-02-07';
              const isSelected = selectedPartIds.has(part.id);

              return (
                <div
                  key={part.id}
                  onClick={() => onSelectPart(part)}
                  className={`p-4 space-y-3 cursor-pointer transition ${
                    isSelected
                      ? isDark ? 'bg-emerald-950/20 border-r-4 border-r-emerald-500' : 'bg-emerald-50/60 border-r-4 border-r-emerald-500'
                      : isDark ? 'hover:bg-white/5 text-white' : 'hover:bg-slate-50 text-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelectPart(e, part.id)}
                        className="mt-0.5 text-emerald-500 hover:scale-110 transition"
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 opacity-50" />}
                      </button>
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {part.partNumber}
                        </span>
                        <h3 className="text-xs font-bold truncate mt-0.5">{part.nameAr}</h3>
                        <p className={`text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{part.nameEn}</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      {part.totalStock} قطع
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-inherit">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="font-mono text-[11px]">الرف: {primaryBin}</span>
                    </div>
                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                      {formatEGP(part.sellingPrice)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={(e) => handleOpenBarcodeForSingle(e, part)}
                      className="py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 transition flex items-center gap-1.5"
                      title="طباعة باركود الصنف (52.5×29.7mm)"
                    >
                      <BarcodeIcon className="w-3.5 h-3.5" />
                      <span>طباعة باركود</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMovementModal(part);
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                        isDark
                          ? 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200'
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                      }`}
                    >
                      تسجيل حركة
                    </button>
                    {canEditParts && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditPart(part);
                        }}
                        title="تعديل بيانات القطعة"
                        className={`p-1.5 rounded-lg border transition ${
                          isDark
                            ? 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200'
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                        }`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {canEditParts && (
                      <button
                        onClick={(e) => handleDeletePart(e, part)}
                        title="حذف القطعة نهائياً"
                        className={`p-1.5 rounded-lg border transition ${
                          isDark
                            ? 'bg-zinc-900 hover:bg-rose-500/20 hover:text-rose-400 border-white/10 text-zinc-400'
                            : 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border-slate-200 text-slate-600'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Table (Visible on md and above) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead
              className={`text-[11px] font-bold border-b ${
                isDark
                  ? 'bg-[#0a0a0c] text-zinc-400 border-white/10'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <tr>
                <th className="py-4 px-3 text-center w-10">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    title="تحديد الكل / إلغاء تحديد الكل"
                    className="text-emerald-500 hover:scale-110 transition flex items-center justify-center mx-auto"
                  >
                    {selectedPartIds.size > 0 && selectedPartIds.size === filteredParts.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4 opacity-50" />
                    )}
                  </button>
                </th>
                <th className="py-4 px-5">رقم القطعة والاسم</th>
                <th className="py-4 px-4">مجموعة EPC والجودة</th>
                <th className="py-4 px-4">شاسيه مرسيدس المتوافق</th>
                <th className="py-4 px-4">موقع الرف الرئيسي</th>
                <th className="py-4 px-4">المخزون الفعلي</th>
                <th className="py-4 px-4 text-left">السعر (EGP)</th>
                <th className="py-4 px-5 text-center">إجراءات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-inherit">
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Package className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
                    <p className={`text-base font-bold mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                      {parts.length === 0 ? 'قاعدة بيانات الأصناف فارغة حالياً' : 'لا توجد قطع مطابقة للبحث أو التصفية'}
                    </p>
                    <p className="text-xs text-zinc-500 mb-4 max-w-md mx-auto">
                      {parts.length === 0 
                        ? 'البرنامج جاهز وخالي من الأصناف، يمكنك البدء بإضافة صنف يدوي جديد أو استيراد ملف إكسل مباشرة.' 
                        : 'جرب البحث برقم أو اسم قطعة آخر أو إعادة تعيين الفلاتر.'}
                    </p>
                    {parts.length === 0 && (
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={onOpenAddPart}
                          className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer flex items-center gap-2"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>إضافة صنف مرسيدس جديد</span>
                        </button>
                        <button
                          onClick={() => setIsExcelImportOpen(true)}
                          className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md cursor-pointer flex items-center gap-2"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>استيراد شيت إكسل</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedParts.map((part) => {
                  const partInvs = inventory.filter(inv => inv.partId === part.id && inv.quantity > 0);
                  const primaryBin = partInvs.length > 0 ? partInvs[0].locationCode : 'A-03-02-07';
                  const isSelected = selectedPartIds.has(part.id);

                  return (
                    <tr 
                      key={part.id}
                      onClick={() => onSelectPart(part)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? isDark ? 'bg-emerald-950/20 text-white font-medium' : 'bg-emerald-50/70 text-slate-900'
                          : isDark ? 'hover:bg-white/5 text-zinc-200' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td className="py-4 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleSelectPart(e, part.id)}
                          className="text-emerald-500 hover:scale-110 transition flex items-center justify-center mx-auto"
                        >
                          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 opacity-40" />}
                        </button>
                      </td>

                      {/* Part Number & Titles */}
                      <td className="py-4 px-5">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                              isDark
                                ? 'bg-zinc-900 border-white/10 text-white'
                                : 'bg-slate-100 border-slate-200 text-slate-900'
                            }`}
                          >
                            MB
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm tracking-wide text-emerald-600 dark:text-emerald-400">
                                {part.partNumber}
                              </span>
                            </div>
                            <div className={`font-bold text-xs mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {part.nameAr}
                            </div>
                            <div className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                              {part.nameEn}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* EPC Group & Quality */}
                      <td className="py-4 px-4">
                        <div className="font-medium">{part.categoryGroup}</div>
                        <span
                          className={`inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full border ${
                            isDark
                              ? 'bg-zinc-900 border-white/10 text-zinc-300'
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          {getQualityLabel(part.quality)}
                        </span>
                      </td>

                      {/* Compatibility */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(part.compatibility || []).map((c, i) => (
                            <span
                              key={i}
                              className={`text-[9px] px-2 py-0.5 rounded-full font-mono border ${
                                isDark
                                  ? 'bg-zinc-900 border-white/10 text-zinc-300'
                                  : 'bg-slate-100 border-slate-200 text-slate-700'
                              }`}
                            >
                              {c.chassis}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Primary Bin Location */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{primaryBin}</span>
                        </div>
                      </td>

                      {/* Stock Level */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">
                            {part.totalStock} {part.unit === 'PCS' ? 'قطعة' : part.unit}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                            متوفر
                          </span>
                        </div>
                      </td>

                      {/* Price in EGP */}
                      <td className="py-4 px-4 text-left">
                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatEGP(part.sellingPrice)}
                        </div>
                        {canViewFinancials && (
                          <div className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                            التكلفة: {formatEGP(part.costPrice, { short: true })}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Direct Barcode Print Button */}
                          <button
                            onClick={(e) => handleOpenBarcodeForSingle(e, part)}
                            title="طباعة باركود الصنف (52.5mm × 29.7mm)"
                            className="p-1.5 rounded-full border border-emerald-500/30 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white transition"
                          >
                            <BarcodeIcon className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onSelectPart(part)}
                            title="عرض تفاصيل القطعة"
                            className={`p-1.5 rounded-full border transition ${
                              isDark
                                ? 'bg-zinc-900 hover:bg-white hover:text-black border-white/10 text-zinc-300'
                                : 'bg-slate-100 hover:bg-slate-900 hover:text-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canPerformStockMovements && (
                            <button
                              onClick={() => onOpenMovementModal(part)}
                              title="حركة مخزنية"
                              className={`p-1.5 rounded-full border transition ${
                                isDark
                              ? 'bg-zinc-900 hover:bg-white hover:text-black border-white/10 text-zinc-300'
                              : 'bg-slate-100 hover:bg-slate-900 hover:text-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canEditParts && (
                            <button
                              onClick={() => onOpenEditPart(part)}
                              title="تعديل بيانات القطعة"
                              className={`p-1.5 rounded-full border transition ${
                                isDark
                              ? 'bg-zinc-900 hover:bg-white hover:text-black border-white/10 text-zinc-300'
                              : 'bg-slate-100 hover:bg-slate-900 hover:text-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canEditParts && (
                            <button
                              onClick={(e) => handleDeletePart(e, part)}
                              disabled={deletingId === part.id}
                              title="حذف القطعة نهائياً"
                              className={`p-1.5 rounded-full border transition ${
                                isDark
                              ? 'bg-zinc-900 hover:bg-rose-500/20 hover:text-rose-400 border-white/10 text-zinc-400'
                              : 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border-slate-200 text-slate-600'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination Controls */}
        <div
          className={`px-4 sm:px-5 py-3.5 border-t flex flex-col md:flex-row items-center justify-between gap-3 text-xs ${
            isDark ? 'bg-[#0a0a0c] border-white/10 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span>
              عرض <strong className={isDark ? 'text-white' : 'text-slate-900'}>{Math.min((currentPage - 1) * pageSize + 1, filteredParts.length)}-{Math.min(currentPage * pageSize, filteredParts.length)}</strong> من أصل <strong className={isDark ? 'text-white' : 'text-slate-900'}>{filteredParts.length}</strong> صنف
            </span>
            {selectedPartIds.size > 0 && (
              <span className="text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                محدد: {selectedPartIds.size} صنف
              </span>
            )}
          </div>

          {/* Pagination Navigation */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition disabled:opacity-30 disabled:pointer-events-none ${
                  isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                الأولى
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition disabled:opacity-30 disabled:pointer-events-none ${
                  isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                السابق
              </button>
              <span className="px-3 py-1 text-xs font-mono font-bold">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition disabled:opacity-30 disabled:pointer-events-none ${
                  isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                التالي
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition disabled:opacity-30 disabled:pointer-events-none ${
                  isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                الأخيرة
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-[11px] opacity-70">عدد العناصر:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className={`rounded-lg px-2 py-1 text-xs font-mono focus:outline-none border ${
                isDark ? 'bg-zinc-900 border-white/10 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>
        </div>

      </div>

      {/* Excel Bulk Import Modal */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        categories={categories}
        locations={locations}
        warehouses={warehouses}
        branches={branches}
        onImportSuccess={() => {
          // Real-time Firestore sync handles state updates automatically
        }}
      />

      {/* Barcode & Serial Print Modal (52.5mm x 29.7mm) */}
      <BarcodePrintModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        initialItems={barcodeModalInitialItems}
        allParts={parts}
        inventory={inventory}
        locations={locations}
      />

    </div>
  );
};
