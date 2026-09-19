import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Layers, 
  Boxes, 
  Coins, 
  AlertTriangle, 
  ShieldAlert, 
  ArrowLeftRight, 
  PlusCircle, 
  QrCode, 
  Clock, 
  ChevronLeft, 
  Building2, 
  CheckCircle2, 
  Car, 
  ShoppingCart, 
  Truck, 
  AlertOctagon, 
  BarChart3 
} from 'lucide-react';
import { PartMaster, InventoryItem, StockMovement, WarehouseLocation } from '../../types/erp';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';
import { formatEGP } from '../../lib/formatters';

interface DashboardOverviewProps {
  parts: PartMaster[];
  inventory: InventoryItem[];
  movements: StockMovement[];
  locations: WarehouseLocation[];
  onOpenAddPart: () => void;
  onOpenScanner: () => void;
  onOpenMovementModal: (part?: PartMaster) => void;
  onSelectPart: (part: PartMaster) => void;
  onNavigateToParts: () => void;
  onNavigateToMovements: () => void;
  onNavigateToInventory: () => void;
  onNavigateToVinDecoder?: () => void;
  onNavigateToSales?: () => void;
  onNavigateToPurchases?: () => void;
  onNavigateToShortages?: () => void;
  onNavigateToReports?: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  parts,
  inventory,
  movements,
  locations,
  onOpenAddPart,
  onOpenScanner,
  onOpenMovementModal,
  onSelectPart,
  onNavigateToParts,
  onNavigateToMovements,
  onNavigateToInventory,
  onNavigateToVinDecoder,
  onNavigateToSales,
  onNavigateToPurchases,
  onNavigateToShortages,
  onNavigateToReports
}) => {
  const { activeBranch, canViewFinancials, canEditParts, canPerformStockMovements } = useAuth();
  const { isDark } = useTheme();
  const { language, t } = useLanguage();

  // Metrics calculations memoized for ultra-fast rendering & zero lag
  const safeParts = useMemo(() => parts || [], [parts]);
  const safeLocations = useMemo(() => locations || [], [locations]);
  const safeMovements = useMemo(() => movements || [], [movements]);

  const {
    totalParts,
    totalStockUnits,
    totalCostValuationEGP,
    totalRetailValuationEGP,
    lowStockParts,
    outOfStockParts,
    criticalCount,
    categoryCounts
  } = useMemo(() => {
    let stockUnits = 0;
    let costVal = 0;
    let retailVal = 0;
    const low: PartMaster[] = [];
    const out: PartMaster[] = [];
    const cats: Record<string, { count: number; units: number; val: number }> = {};

    for (let i = 0; i < safeParts.length; i++) {
      const p = safeParts[i];
      const stock = p.totalStock || 0;
      const cost = p.costPrice || 0;
      const sell = p.sellingPrice || 0;
      const min = p.minStock || 0;

      stockUnits += stock;
      costVal += stock * cost;
      retailVal += stock * sell;

      if (stock === 0) {
        out.push(p);
      } else if (stock <= min) {
        low.push(p);
      }

      const cat = p.categoryGroup || 'أخرى';
      if (!cats[cat]) {
        cats[cat] = { count: 0, units: 0, val: 0 };
      }
      cats[cat].count += 1;
      cats[cat].units += stock;
      cats[cat].val += stock * sell;
    }

    return {
      totalParts: safeParts.length,
      totalStockUnits: stockUnits,
      totalCostValuationEGP: costVal,
      totalRetailValuationEGP: retailVal,
      lowStockParts: low,
      outOfStockParts: out,
      criticalCount: low.length + out.length,
      categoryCounts: cats
    };
  }, [safeParts]);

  // Latest 10 active parts (newest to oldest)
  const recentParts = useMemo(() => {
    if (!safeParts || safeParts.length === 0) return [];
    return [...safeParts]
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (dateA && dateB && dateA !== dateB) return dateB - dateA;
        return 0;
      })
      .slice(0, 10);
  }, [safeParts]);

  // Latest 10 movements (newest to oldest)
  const recentMovements = useMemo(() => {
    if (!safeMovements || safeMovements.length === 0) return [];
    return [...safeMovements]
      .sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        if (dateA && dateB && dateA !== dateB) return dateB - dateA;
        return 0;
      })
      .slice(0, 10);
  }, [safeMovements]);

  const getMovementTypeArabic = (type: string) => {
    switch (type) {
      case 'INITIAL_STOCK': return t('رصيد افتتاحي', 'Initial Stock');
      case 'PURCHASE':
      case 'INWARD_PURCHASE': return t('توريد / شراء', 'Purchase / Inbound');
      case 'SALE':
      case 'OUTWARD_SALE': return t('صرف / مبيعات', 'Sale / Outbound');
      case 'TRANSFER':
      case 'TRANSFER_LOCATION':
      case 'TRANSFER_BRANCH': return t('نقل بين الأرفف', 'Bin Transfer');
      case 'ADJUSTMENT':
      case 'ADJUSTMENT_IN':
      case 'ADJUSTMENT_OUT': return t('تسوية جرد', 'Stocktake Adjustment');
      case 'DAMAGED':
      case 'DISPOSAL': return t('تالف / هالك', 'Damaged');
      case 'CUSTOMER_RETURN':
      case 'RETURN_CUSTOMER': return t('مرتجع عميل', 'Customer Return');
      case 'SUPPLIER_RETURN':
      case 'RETURN_SUPPLIER': return t('مرتجع مورد', 'Supplier Return');
      default: return type;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-12 select-none premium-dashboard">
      
      {/* Top Banner / Welcome with Quick Actions */}
      <div
        className={`premium-card rounded-2xl p-5 sm:p-7 lg:p-8 border shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative overflow-hidden transition-colors duration-200 ${
          isDark
            ? 'bg-[#0f0f13] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
        }`}
      >
        <div className="relative z-10 space-y-1 sm:space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`text-[10px] sm:text-[11px] px-3 py-0.5 rounded-full font-medium border flex items-center gap-1.5 ${
                isDark
                  ? 'bg-zinc-900 border-white/10 text-emerald-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              <Building2 className="w-3 h-3" />
              {t('الفرع التشغيلي: فرع الحرفيين', 'Operational Branch: El-Harefeyin')}
            </span>
            <span
              className={`text-[10px] sm:text-[11px] font-medium flex items-center gap-1 ${
                isDark ? 'text-zinc-400' : 'text-slate-500'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              {t('مزامنة مباشرة (EGP)', 'Live Database Sync (EGP)')}
            </span>
          </div>

          <h1
            className={`text-xl sm:text-2xl lg:text-3xl font-serif-luxury font-bold tracking-tight leading-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            {t('لوحة التحكم والمؤشرات — AH.Libya Store', 'Dashboard & WMS Overview — AH.Libya Store')}
          </h1>

          <p
            className={`text-xs sm:text-sm font-normal max-w-xl leading-relaxed ${
              isDark ? 'text-zinc-400' : 'text-slate-600'
            }`}
          >
            {t('نظام إدارة قطع غيار مرسيدس-بنز، تنظيم مصفوفات الرفوف، وتتبع العمليات المالية بالجنيه المصري (EGP).', 'Mercedes-Benz spare parts WMS, bin location tracking, and real-time inventory valuations.')}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5 relative z-10 w-full sm:w-auto">
          
          {onNavigateToVinDecoder && (
            <button
              onClick={onNavigateToVinDecoder}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold border transition-all ${
                isDark
                  ? 'bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border-emerald-500/30 text-emerald-400'
                  : 'bg-emerald-50 hover:bg-emerald-600 hover:text-white border-emerald-300 text-emerald-800'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>{t('فك الشاسيه VIN', 'VIN Decoder')}</span>
            </button>
          )}

          <button
            onClick={onOpenScanner}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium border transition-all ${
              isDark
                ? 'bg-zinc-900 hover:bg-white hover:text-black border-white/10 text-zinc-200'
                : 'bg-slate-100 hover:bg-slate-900 hover:text-white border-slate-300 text-slate-800'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{t('مسح باركود', 'Scanner')}</span>
          </button>

          {canPerformStockMovements && (
            <button
              onClick={() => onOpenMovementModal()}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium border transition-all ${
                isDark
                  ? 'bg-zinc-900 hover:bg-white hover:text-black border-white/10 text-zinc-200'
                  : 'bg-slate-100 hover:bg-slate-900 hover:text-white border-slate-300 text-slate-800'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{t('تسجيل حركة', 'Stock Move')}</span>
            </button>
          )}

          {canEditParts && (
            <button
              onClick={onOpenAddPart}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md ${
                isDark
                  ? 'bg-white hover:bg-zinc-200 text-black shadow-white/10'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('إضافة قطعة جديدة', 'Add Part')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Access Modules Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 perspective-container">
        {onNavigateToSales && (
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNavigateToSales}
            className={`p-4 rounded-xl border cursor-pointer transition-all card-3d flex items-center justify-between ${
              isDark ? 'bg-zinc-900/60 hover:bg-zinc-900/90 border-white/10 hover:border-emerald-500/40 glow-emerald' : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold">{t('صرف مبيعات', 'Sales Invoices')}</div>
                <div className="text-[10px] text-zinc-400">{t('فواتير وصرف عملاء', 'Issue sales')}</div>
              </div>
            </div>
            <ChevronLeft className={`w-4 h-4 text-zinc-500 ${language === 'en' ? 'rotate-180' : ''}`} />
          </motion.div>
        )}

        {onNavigateToPurchases && (
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNavigateToPurchases}
            className={`p-4 rounded-xl border cursor-pointer transition-all card-3d flex items-center justify-between ${
              isDark ? 'bg-zinc-900/60 hover:bg-zinc-900/90 border-white/10 hover:border-cyan-500/40 glow-cyan' : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold">{t('أوامر المشتريات', 'Purchase Orders')}</div>
                <div className="text-[10px] text-zinc-400">{t('استلام وتوريد', 'Inbound & receiving')}</div>
              </div>
            </div>
            <ChevronLeft className={`w-4 h-4 text-zinc-500 ${language === 'en' ? 'rotate-180' : ''}`} />
          </motion.div>
        )}

        {onNavigateToShortages && (
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNavigateToShortages}
            className={`p-4 rounded-xl border cursor-pointer transition-all card-3d flex items-center justify-between ${
              isDark ? 'bg-zinc-900/60 hover:bg-zinc-900/90 border-white/10 hover:border-rose-500/40' : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold">{t('سجل النواقص', 'Shortage Requests')}</div>
                <div className="text-[10px] text-zinc-400">{t('إعادة الطلب والاستيراد', 'Reorder tracking')}</div>
              </div>
            </div>
            <ChevronLeft className={`w-4 h-4 text-zinc-500 ${language === 'en' ? 'rotate-180' : ''}`} />
          </motion.div>
        )}

        {onNavigateToReports && (
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNavigateToReports}
            className={`p-4 rounded-xl border cursor-pointer transition-all card-3d flex items-center justify-between ${
              isDark ? 'bg-zinc-900/60 hover:bg-zinc-900/90 border-white/10 hover:border-purple-500/40' : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold">{t('التقارير المالية', 'Financial Reports')}</div>
                <div className="text-[10px] text-zinc-400">{t('تحليلات وتقييم المخزون', 'Analytics & Valuation')}</div>
              </div>
            </div>
            <ChevronLeft className={`w-4 h-4 text-zinc-500 ${language === 'en' ? 'rotate-180' : ''}`} />
          </motion.div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 perspective-container">
        
        {/* Total Catalog Parts */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNavigateToParts}
          className={`rounded-2xl p-5 sm:p-6 border cursor-pointer transition-all shadow-sm hover:shadow-xl group relative overflow-hidden card-3d ${
            isDark
              ? 'bg-[#0f0f13] border-white/10 hover:border-white/30 text-white'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              قطع الغيار المسجلة
            </span>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-transform group-hover:scale-110 ${
                isDark ? 'bg-zinc-900 border-white/10 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tracking-tight mt-3">
            {totalParts}
          </div>
          <div
            className={`flex items-center justify-between text-xs mt-4 pt-3 border-t font-light ${
              isDark ? 'border-white/5 text-zinc-400' : 'border-slate-100 text-slate-500'
            }`}
          >
            <span>المخزون الإجمالي: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{totalStockUnits} قطعة</strong></span>
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          </div>
        </motion.div>

        {/* Inventory Valuation in EGP */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          className={`rounded-2xl p-5 sm:p-6 border shadow-sm hover:shadow-xl relative overflow-hidden card-3d ${
            isDark
              ? 'bg-[#0f0f13] border-white/10 hover:border-emerald-500/30 text-white'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              تقييم المخزون (بالتكلفة)
            </span>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                isDark ? 'bg-zinc-900 border-white/10 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}
            >
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight mt-3 text-emerald-600 dark:text-emerald-400">
            {canViewFinancials ? formatEGP(totalCostValuationEGP, { short: true }) : '••••••'}
          </div>
          <div
            className={`flex items-center justify-between text-xs mt-4 pt-3 border-t font-light ${
              isDark ? 'border-white/5 text-zinc-400' : 'border-slate-100 text-slate-500'
            }`}
          >
            <span>القيمة بسعر البيع:</span>
            <strong className={isDark ? 'text-zinc-200 font-mono' : 'text-slate-800 font-mono'}>
              {canViewFinancials ? formatEGP(totalRetailValuationEGP, { short: true }) : '••••'}
            </strong>
          </div>
        </motion.div>

        {/* Stock Alerts */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNavigateToParts}
          className={`rounded-2xl p-5 sm:p-6 border cursor-pointer transition-all shadow-sm hover:shadow-xl group relative overflow-hidden card-3d ${
            isDark
              ? 'bg-[#0f0f13] border-white/10 hover:border-amber-500/30 text-white'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              تنبيهات نواقص المخزون
            </span>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-transform group-hover:scale-110 ${
                isDark ? 'bg-zinc-900 border-white/10 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tracking-tight mt-3">
            {criticalCount} <span className="text-xs font-sans font-normal opacity-70">صنف</span>
          </div>
          <div
            className={`flex items-center justify-between text-xs mt-4 pt-3 border-t font-light ${
              isDark ? 'border-white/5 text-zinc-400' : 'border-slate-100 text-slate-500'
            }`}
          >
            <span>{outOfStockParts.length} نفد • {lowStockParts.length} منخفض</span>
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          </div>
        </motion.div>

        {/* Warehouse Bin Occupancy */}
        <div 
          onClick={onNavigateToInventory}
          className={`rounded-2xl p-5 sm:p-6 border cursor-pointer transition-all shadow-xs group relative overflow-hidden ${
            isDark
              ? 'bg-[#0f0f13] border-white/10 hover:border-white/25 text-white'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              مواقع الأرفف (الحرفيين)
            </span>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                isDark ? 'bg-zinc-900 border-white/10 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-mono tracking-tight mt-3">
            {safeLocations.length} <span className="text-xs font-sans font-normal opacity-70">خانة / رف</span>
          </div>
          <div
            className={`flex items-center justify-between text-xs mt-4 pt-3 border-t font-light ${
              isDark ? 'border-white/5 text-zinc-400' : 'border-slate-100 text-slate-500'
            }`}
          >
            <span>المجموعات: <strong className={isDark ? 'text-white' : 'text-slate-900'}>A, B, C</strong></span>
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>

      </div>

      {/* Main Content Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 spans): Active Parts & EPC Categories */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Mercedes Spare Part Card */}
          <div
            className={`rounded-2xl p-5 sm:p-6 border shadow-sm flex flex-col justify-between ${
              isDark ? 'bg-[#0f0f13] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-500" />
                  <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    القطع المسجلة بالكتالوج (ACTIVE ITEM)
                  </h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                    isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    آخر {recentParts.length} أصناف
                  </span>
                </div>
                <button
                  onClick={onNavigateToParts}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline transition flex items-center gap-1"
                >
                  <span>عرض الكتالوج</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentParts.length === 0 ? (
                <div className={`text-xs py-10 text-center ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  لا توجد قطع مسجلة بالكتالوج.
                </div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {recentParts.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      onClick={() => onSelectPart(p)}
                      className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isDark
                          ? 'bg-[#141418] hover:bg-zinc-900 border-white/10 hover:border-white/20 text-white'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300 text-slate-900'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                            {p.partNumber}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {p.brand || 'Mercedes-Benz'}
                          </span>
                          {p.categoryGroup && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              isDark ? 'bg-zinc-900 text-zinc-400 border border-white/5' : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {p.categoryGroup}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold truncate">{p.nameAr}</h4>
                        <p className={`text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{p.nameEn}</p>
                        
                        <div className="flex items-center gap-3 text-xs pt-0.5">
                          <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>
                            الرصيد: <strong className="font-mono text-emerald-500">{p.totalStock} قطع</strong>
                          </span>
                          <span className={isDark ? 'text-zinc-600' : 'text-slate-300'}>•</span>
                          <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>
                            سعر البيع: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatEGP(p.sellingPrice)}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenMovementModal(p);
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                            isDark
                              ? 'bg-zinc-800 hover:bg-white hover:text-black border-white/10 text-white'
                              : 'bg-slate-200 hover:bg-slate-900 hover:text-white border-slate-300 text-slate-800'
                          }`}
                        >
                          تسجيل حركة +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clear Button: عرض الكتالوج */}
            <div className={`mt-4 pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <button
                onClick={onNavigateToParts}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                  isDark
                    ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border-emerald-500/30'
                    : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border-emerald-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>عرض الكتالوج ({totalParts} صنف مسجل)</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* EPC Groups Distribution */}
          <div
            className={`rounded-2xl p-5 sm:p-6 border shadow-sm ${
              isDark ? 'bg-[#0f0f13] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  مجموعات كتالوج مرسيدس-بنز EPC
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  توزيع المخزون حسب الأقسام الميكانيكية المعتمدة
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(categoryCounts).map(([catName, rawData]) => {
                const data = rawData as { count: number; units: number; val: number };
                return (
                  <div
                    key={catName}
                    className={`p-3.5 rounded-xl border transition ${
                      isDark ? 'bg-[#141418] border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-bold truncate">{catName}</span>
                      <span className="font-mono text-xs opacity-75">{data.count} صنف</span>
                    </div>
                    <div className={`w-full rounded-full h-1.5 overflow-hidden mb-2 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}>
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className={`flex items-center justify-between text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                      <span>المخزون: <strong className="font-mono text-emerald-500">{data.units} قطعة</strong></span>
                      <span className="font-mono">{formatEGP(data.val, { short: true })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column (1 span): Recent Stock Movement Feed */}
        <div
          className={`rounded-2xl p-5 sm:p-6 border shadow-sm flex flex-col justify-between ${
            isDark ? 'bg-[#0f0f13] border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  سجل حركة المخزون
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                  isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-600'
                }`}>
                  آخر {recentMovements.length} حركات
                </span>
              </div>
              <button
                onClick={onNavigateToMovements}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline transition flex items-center gap-1"
              >
                <span>السجل الكامل</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentMovements.length === 0 ? (
              <div className={`text-xs py-10 text-center ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                لا توجد حركات مسجلة حتى الآن.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {recentMovements.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${
                        isDark ? 'bg-[#141418] hover:bg-zinc-900/80 border-white/5' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs tracking-wider">
                          {m.partNumber}
                        </span>
                        <span
                          className={`font-mono px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isPositive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {isPositive ? `+${m.quantity}` : m.quantity} قطعة
                        </span>
                      </div>

                      <div className={`text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                        {m.partName}
                      </div>

                      <div
                        className={`flex items-center justify-between text-[10px] pt-1.5 border-t ${
                          isDark ? 'border-white/5 text-zinc-500' : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {getMovementTypeArabic(m.movementType)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium opacity-80">
                            {m.destinationLocation ? `الرف ${m.destinationLocation}` : m.sourceLocation ? `الرف ${m.sourceLocation}` : ''}
                          </span>
                          {m.timestamp && (
                            <span className="opacity-60 text-[9px] font-mono">
                              {new Date(m.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`mt-4 pt-3 border-t space-y-2 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <button
              onClick={onNavigateToMovements}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                isDark
                  ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border-emerald-500/30'
                  : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border-emerald-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>عرض سجل الحركات الكامل</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onOpenMovementModal()}
              className={`w-full py-2 rounded-xl text-xs font-medium transition-all border flex items-center justify-center gap-2 ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>تسجيل حركة مخزنية جديدة</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
