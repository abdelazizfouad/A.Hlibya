import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Boxes, 
  MapPin, 
  Layers, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  ShieldAlert
} from 'lucide-react';
import { InventoryItem, PartMaster, StocktakeSession, WarehouseLocation } from '../../types/erp';
import { approveStocktakeSession } from '../../lib/firestoreService';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';
import { formatEGP } from '../../lib/formatters';

interface StocktakeViewProps {
  inventory: InventoryItem[];
  parts: PartMaster[];
  locations: WarehouseLocation[];
}

export const StocktakeView: React.FC<StocktakeViewProps> = ({
  inventory,
  parts,
  locations
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { language, t } = useLanguage();

  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [counts, setCounts] = useState<{ [invId: string]: number }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const zones = ['ALL', 'A', 'B', 'C', 'D'];

  const filteredInventory = inventory.filter(item => {
    if (selectedZone === 'ALL') return true;
    const loc = locations.find(l => l.code === item.locationCode);
    return loc ? loc.zone === selectedZone : item.locationCode.startsWith(selectedZone);
  });

  const handleCountChange = (invId: string, value: string) => {
    const num = parseInt(value);
    setCounts(prev => ({
      ...prev,
      [invId]: isNaN(num) ? 0 : num
    }));
  };

  const getCountedQty = (item: InventoryItem) => {
    return counts[item.id] !== undefined ? counts[item.id] : item.quantity;
  };

  // Calculate variances
  const itemsWithVariance = filteredInventory.map(item => {
    const counted = getCountedQty(item);
    const system = item.quantity;
    const variance = counted - system;
    const valueDiscrepancy = variance * item.costPrice;
    return {
      item,
      counted,
      system,
      variance,
      valueDiscrepancy
    };
  });

  const totalVarianceCount = itemsWithVariance.filter(i => i.variance !== 0).length;
  const netValueDiscrepancy = itemsWithVariance.reduce((sum, i) => sum + i.valueDiscrepancy, 0);

  const handleApproveAdjustments = async () => {
    if (totalVarianceCount === 0) {
      alert(t('الجرد مطابق 100% — لا توجد أي فروقات للتسوية.', 'All counts match system. No variance to adjust.'));
      return;
    }

    if (!confirm(t(`هل أنت متأكد من اعتماد تسوية فروقات الجرد لعدد ${totalVarianceCount} صنف؟`, `Approve stock adjustment for ${totalVarianceCount} items?`))) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const session: StocktakeSession = {
        id: `st_${Date.now()}`,
        warehouseId: 'wh_elharefeyin_main',
        zone: selectedZone,
        conductedBy: user?.id || 'admin',
        conductedAt: new Date().toISOString(),
        status: 'COMPLETED',
        items: itemsWithVariance.map(i => ({
          partId: i.item.partId,
          partNumber: i.item.partNumber,
          partName: i.item.partNameAr,
          locationCode: i.item.locationCode,
          systemQty: i.system,
          countedQty: i.counted,
          variance: i.variance,
          costPrice: i.item.costPrice
        }))
      };

      await approveStocktakeSession(session, {
        id: user?.id || 'admin',
        name: user?.displayName || 'المسؤول'
      });

      setSuccessMessage(t('تم اعتماد وتسوية الفروقات المخزنية بنجاح وتحديث كافة الأرصدة وسجلات الحركة!', 'Stocktake adjustments approved successfully!'));
      setCounts({});
    } catch (err) {
      console.error('Error approving stocktake:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('جرد المستودع والتسويات المخزنية (Stocktake & Audit)', 'Warehouse Stocktake & Physical Count')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            {t('المطابقة بين الرصيد الفعلي على الأرفف والرصيد الدفتري بالنظام مع اعتماد التسويات الآلية', 'Compare on-shelf physical counts with system stock and approve audit adjustments')}
          </p>
        </div>

        <button
          onClick={handleApproveAdjustments}
          disabled={isSubmitting || totalVarianceCount === 0}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md ${
            totalVarianceCount > 0
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-purple-500/25 cursor-pointer'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{t('اعتماد تسوية الفروقات المخزنية', 'Approve Adjustments')} ({totalVarianceCount})</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
          <span className="text-xs text-zinc-400 font-medium">{t('إجمالي الأصناف الخاضعة للجرد', 'Items in Scope')}</span>
          <div className="text-2xl font-bold font-mono text-white dark:text-white mt-1">
            {filteredInventory.length}
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
          <span className="text-xs text-zinc-400 font-medium">{t('عدد الأصناف التي بها فروقات', 'Items with Variance')}</span>
          <div className={`text-2xl font-bold font-mono mt-1 ${totalVarianceCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {totalVarianceCount}
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
          <span className="text-xs text-zinc-400 font-medium">{t('صافي القيمة المالية للفروقات', 'Net Financial Variance')}</span>
          <div className={`text-2xl font-bold font-mono mt-1 ${netValueDiscrepancy < 0 ? 'text-rose-400' : netValueDiscrepancy > 0 ? 'text-emerald-400' : 'text-zinc-200'}`}>
            {formatEGP(netValueDiscrepancy)}
          </div>
        </div>

      </div>

      {/* Zone Selector */}
      <div className={`p-4 rounded-2xl border flex items-center gap-2 flex-wrap ${
        isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <span className="text-xs font-bold text-zinc-400 mr-2">{t('تصفية حسب المنطقة / البلوك:', 'Filter by Zone:')}</span>
        {zones.map(z => (
          <button
            key={z}
            onClick={() => setSelectedZone(z)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
              selectedZone === z
                ? 'bg-purple-500 text-white shadow-xs'
                : isDark ? 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {z === 'ALL' ? t('كافة المناطق', 'All Zones') : `${t('منطقة', 'Zone')} ${z}`}
          </button>
        ))}
      </div>

      {/* Count Sheet Table */}
      <div className={`rounded-2xl border overflow-hidden transition-all ${
        isDark ? 'bg-[#0a0a0c] border-white/10 shadow-xl' : 'bg-white border-slate-200 shadow-md'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <thead className={`border-b text-zinc-400 font-semibold uppercase tracking-wider ${
              isDark ? 'bg-zinc-900/80 border-white/10' : 'bg-slate-100/90 border-slate-200 text-slate-600'
            }`}>
              <tr>
                <th className="px-4 py-3.5">{t('الرف / البن كود', 'Bin Location')}</th>
                <th className="px-4 py-3.5">{t('رقم القطعة', 'Part Number')}</th>
                <th className="px-4 py-3.5">{t('اسم القطعة', 'Part Name')}</th>
                <th className="px-4 py-3.5 text-center">{t('الرصيد الدفتري (النظام)', 'System Qty')}</th>
                <th className="px-4 py-3.5 text-center">{t('العدد الفعلي (الجرد)', 'Physical Count')}</th>
                <th className="px-4 py-3.5 text-center">{t('الفارق', 'Variance')}</th>
                <th className="px-4 py-3.5 text-center">{t('قيمة الفارق (EGP)', 'Variance Value')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {itemsWithVariance.map(({ item, system, counted, variance, valueDiscrepancy }) => (
                <tr key={item.id} className={`hover:bg-white/[0.02] transition-colors ${variance !== 0 ? 'bg-amber-500/[0.03]' : ''}`}>
                  
                  <td className="px-4 py-3.5 font-mono font-bold text-purple-400">
                    {item.locationCode}
                  </td>

                  <td className="px-4 py-3.5 font-mono font-bold text-white">
                    {item.partNumber}
                  </td>

                  <td className="px-4 py-3.5 font-medium text-zinc-200">
                    {item.partNameAr}
                  </td>

                  <td className="px-4 py-3.5 text-center font-mono font-bold text-zinc-300 text-sm">
                    {system}
                  </td>

                  <td className="px-4 py-3.5 text-center">
                    <input
                      type="number"
                      min={0}
                      value={counted}
                      onChange={(e) => handleCountChange(item.id, e.target.value)}
                      className={`w-20 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-center border transition-all ${
                        variance !== 0
                          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                          : isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </td>

                  <td className="px-4 py-3.5 text-center">
                    {variance === 0 ? (
                      <span className="text-zinc-500 font-mono">0</span>
                    ) : variance > 0 ? (
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        +{variance} (زيادة)
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                        {variance} (عجز)
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3.5 text-center font-mono font-bold">
                    {valueDiscrepancy === 0 ? (
                      <span className="text-zinc-500">0.00</span>
                    ) : (
                      <span className={valueDiscrepancy < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                        {formatEGP(valueDiscrepancy)}
                      </span>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
