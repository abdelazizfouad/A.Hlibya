import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Boxes, 
  Truck, 
  ShoppingCart, 
  AlertOctagon, 
  Download, 
  Calendar, 
  PieChart, 
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { PartMaster, StockMovement, PurchaseOrder, SalesInvoice, ShortageItem } from '../../types/erp';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';
import { formatEGP } from '../../lib/formatters';

interface ReportsViewProps {
  parts: PartMaster[];
  movements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
  salesInvoices: SalesInvoice[];
  shortages: ShortageItem[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  parts,
  movements,
  purchaseOrders,
  salesInvoices,
  shortages
}) => {
  const { isDark } = useTheme();
  const { language, t } = useLanguage();

  const [timeRange, setTimeRange] = useState<'WEEK' | 'MONTH' | 'ALL'>('ALL');

  // Calculations
  const totalStockUnits = parts.reduce((sum, p) => sum + (p.totalStock || 0), 0);
  const totalCostValuation = parts.reduce((sum, p) => sum + ((p.totalStock || 0) * (p.costPrice || 0)), 0);
  const totalMarketValuation = parts.reduce((sum, p) => sum + ((p.totalStock || 0) * (p.sellingPrice || 0)), 0);
  const totalSalesRevenue = salesInvoices.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPurchasesCost = purchaseOrders.filter(po => po.status === 'RECEIVED').reduce((sum, po) => sum + po.totalAmount, 0);

  // Fast-moving parts (by sales count in movements)
  const salesMovements = movements.filter(m => m.movementType === 'SALE');
  const partSaleCount: { [partNumber: string]: { count: number; name: string; revenue: number } } = {};
  
  salesMovements.forEach(m => {
    if (!partSaleCount[m.partNumber]) {
      partSaleCount[m.partNumber] = { count: 0, name: m.partName, revenue: 0 };
    }
    partSaleCount[m.partNumber].count += Math.abs(m.quantity);
  });

  const fastMoving = Object.entries(partSaleCount)
    .map(([pn, data]) => ({ partNumber: pn, ...data }))
    .sort((a, b) => b.count - a.count);

  // Slow moving / zero movement parts
  const slowMoving = parts.filter(p => p.totalStock > 0 && !partSaleCount[p.partNumber]);

  const handleExportFullReport = () => {
    const lines = [
      'تقرير الأداء المالي والمخزني — AH.Libya Store',
      `تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}`,
      '',
      `إجمالي قطع الغيار في المخزن: ${totalStockUnits} قطعة`,
      `إجمالي تقييم المخزون بسعر التكلفة: ${totalCostValuation} ج.م`,
      `إجمالي تقييم المخزون بسعر السوق: ${totalMarketValuation} ج.م`,
      `إجمالي المبيعات المحققة: ${totalSalesRevenue} ج.م`,
      `إجمالي المشتريات والتوريدات: ${totalPurchasesCost} ج.م`,
      '',
      '--- قائمة أرصدة قطع الغيار ---',
      'رقم القطعة,اسم الصنف,الشاسيه,الرصيد المتاح,سعر التكلفة,سعر البيع,إجمالي القيمة'
    ];

    parts.forEach(p => {
      lines.push(`"${p.partNumber}","${p.nameAr}","${p.compatibility?.[0]?.chassis || ''}",${p.totalStock},${p.costPrice},${p.sellingPrice},${p.totalStock * p.sellingPrice}`);
    });

    const csvContent = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AH_Libya_WMS_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('التقارير التحليلية والمؤشرات المالية (WMS Analytics)', 'Warehouse Analytics & Financial Reports')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            {t('تقييم المخزون بالجنيه المصري (EGP)، حركة الأصناف الأكثر دورانًا، وتوازن المشتريات والمبيعات', 'Inventory valuation in EGP, fast-moving items, and purchase vs sales metrics')}
          </p>
        </div>

        <button
          onClick={handleExportFullReport}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold border transition-all ${
            isDark
              ? 'bg-zinc-900 border-white/10 hover:bg-zinc-800 text-white'
              : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800 shadow-xs'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>{t('تصدير التقرير المالي والمخزني الكامل CSV', 'Export Full WMS Report')}</span>
        </button>
      </div>

      {/* Financial Valuation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">{t('إجمالي تقييم المخزون (سعر التكلفة)', 'Stock Valuation (Cost)')}</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-400">
            {formatEGP(totalCostValuation)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">{t('رأس المال المستثمر في البضاعة', 'Invested capital in stock')}</p>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">{t('القيمة السوقية للمخزون (سعر البيع)', 'Market Value (Selling)')}</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {formatEGP(totalMarketValuation)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">{t('القيمة البيعية المتوقعة', 'Expected sales revenue')}</p>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">{t('إجمالي المبيعات المحققة', 'Total Sales Revenue')}</span>
            <ShoppingCart className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400">
            {formatEGP(totalSalesRevenue)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">{salesInvoices.length} {t('فاتورة مبيعات معتمدة', 'invoices issued')}</p>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">{t('إجمالي المشتريات الموردة', 'Purchases Cost')}</span>
            <Truck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {formatEGP(totalPurchasesCost)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">{purchaseOrders.filter(p => p.status === 'RECEIVED').length} {t('أمر توريد مستلم', 'POs received')}</p>
        </div>

      </div>

      {/* Tables: Fast-Moving vs Slow-Moving */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Fast Moving Parts */}
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0a0a0c] border-white/10 shadow-md' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white dark:text-white">
              {t('الأصناف الأكثر طلبًا وحركة (Fast-Moving)', 'Fast-Moving Parts')}
            </h3>
          </div>

          {fastMoving.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              {t('سيتم احتساب الأصناف الأكثر حركة مع تسجيل فواتير المبيعات', 'Fast-moving stats will populate as sales occur')}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {fastMoving.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-emerald-400 block">{item.partNumber}</span>
                    <span className="text-zinc-300 font-medium">{item.name}</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-xs">
                      {item.count} {t('قطعة مباعة', 'sold')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Slow Moving / Stagnant Stock */}
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0a0a0c] border-white/10 shadow-md' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
            <Boxes className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white dark:text-white">
              {t('الأصناف الراكدة والمخزنة (Stagnant Stock)', 'Stagnant Stock Items')}
            </h3>
          </div>

          <div className="divide-y divide-white/5">
            {slowMoving.slice(0, 5).map((part) => (
              <div key={part.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-bold text-blue-400 block">{part.partNumber}</span>
                  <span className="text-zinc-300 font-medium">{part.nameAr}</span>
                </div>
                <div className="text-left font-mono">
                  <span className="text-zinc-400 block">{t('الرصيد:', 'Stock:')} <strong className="text-white">{part.totalStock}</strong></span>
                  <span className="text-emerald-400 font-bold">{formatEGP(part.sellingPrice * part.totalStock)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
