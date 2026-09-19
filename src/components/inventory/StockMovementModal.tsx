import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowLeftRight, 
  AlertTriangle,
  Search,
  CheckCircle2
} from 'lucide-react';
import { PartMaster, WarehouseLocation, Branch, Warehouse, MovementType, InventoryItem } from '../../types/erp';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { executeStockMovement, searchPartsFirestore } from '../../lib/firestoreService';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: PartMaster[];
  inventory?: InventoryItem[];
  locations: WarehouseLocation[];
  warehouses: Warehouse[];
  branches: Branch[];
  preselectedPart?: PartMaster | null;
  onSuccess: () => void;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  isOpen,
  onClose,
  parts,
  inventory = [],
  locations,
  warehouses,
  branches,
  preselectedPart,
  onSuccess
}) => {
  const { currentUser, activeBranch } = useAuth();
  const { isDark } = useTheme();

  const [selectedPart, setSelectedPart] = useState<PartMaster | null>(null);
  const [partQuery, setPartQuery] = useState('');
  const [partResults, setPartResults] = useState<PartMaster[]>([]);
  const [isSearchingParts, setIsSearchingParts] = useState(false);
  const [movementType, setMovementType] = useState<MovementType>('SALE');
  const [quantity, setQuantity] = useState<number>(1);
  const [sourceLocationId, setSourceLocationId] = useState<string>('AUTO');
  const [targetLocationId, setTargetLocationId] = useState<string>('');
  const [referenceDoc, setReferenceDoc] = useState<string>('');
  const [reason, setReason] = useState<string>('صرف مبيعات معتمد');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const searchController = React.useRef<AbortController | null>(null);

  const activePart = selectedPart;

  // Smart resolution of the part's actual shelf in warehouse inventory
  const partOccupiedLocation = React.useMemo(() => {
    if (!activePart) return null;
    const invRowWithStock = inventory.find(i => i.partId === activePart.id && Number(i.quantity || 0) > 0);
    if (invRowWithStock) {
      const matched = locations.find(l => l.code === invRowWithStock.locationCode || l.id === invRowWithStock.locationId);
      return {
        code: invRowWithStock.locationCode,
        id: matched?.id || invRowWithStock.locationId || invRowWithStock.locationCode,
        quantity: invRowWithStock.quantity
      };
    }
    const anyInvRow = inventory.find(i => i.partId === activePart.id);
    if (anyInvRow) {
      const matched = locations.find(l => l.code === anyInvRow.locationCode || l.id === anyInvRow.locationId);
      return {
        code: anyInvRow.locationCode,
        id: matched?.id || anyInvRow.locationId || anyInvRow.locationCode,
        quantity: anyInvRow.quantity
      };
    }
    if (activePart.defaultLocationId) {
      const defaultLoc = locations.find(l => l.id === activePart.defaultLocationId);
      if (defaultLoc) {
        return {
          code: defaultLoc.code,
          id: defaultLoc.id,
          quantity: activePart.totalStock
        };
      }
    }
    return null;
  }, [activePart, inventory, locations]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedPart(preselectedPart || null);
    setPartQuery('');
    setPartResults([]);
    setSourceLocationId('AUTO');
    if (preselectedPart) {
      setQuantity(1);
    }
  }, [isOpen, preselectedPart]);

  useEffect(() => {
    if (activePart) {
      setSourceLocationId('AUTO');
    }
  }, [activePart]);

  useEffect(() => {
    if (movementType === 'SALE') {
      if (!reason || reason === 'استلام وتوريد بضاعة للمستودع' || reason === 'نقل مخزني بين الأرفف') {
        setReason('صرف مبيعات لعميل');
      }
    } else if (movementType === 'PURCHASE') {
      if (!reason || reason === 'صرف مبيعات لعميل' || reason === 'نقل مخزني بين الأرفف') {
        setReason('استلام وتوريد بضاعة للمستودع');
      }
    } else if (movementType === 'TRANSFER') {
      if (!reason || reason === 'صرف مبيعات لعميل' || reason === 'استلام وتوريد بضاعة للمستودع') {
        setReason('نقل مخزني بين الأرفف');
      }
    }
  }, [movementType]);

  useEffect(() => {
    if (!isOpen || partQuery.trim().length < 2) {
      setPartResults([]);
      setIsSearchingParts(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      searchController.current?.abort();
      const controller = new AbortController();
      searchController.current = controller;
      setIsSearchingParts(true);
      try {
        const results = await searchPartsFirestore(partQuery.trim(), 20, controller.signal);
        if (!cancelled) setPartResults(results);
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') console.warn('Part movement search failed:', error);
        if (!cancelled) setPartResults([]);
      } finally {
        if (!cancelled) setIsSearchingParts(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      searchController.current?.abort();
    };
  }, [isOpen, partQuery]);

  useEffect(() => {
    if (locations.length > 0) {
      if (!targetLocationId && locations.length > 1) setTargetLocationId(locations[1].id);
    }
  }, [locations, targetLocationId]);

  if (!isOpen) return null;

  const isAutoLocation = sourceLocationId === 'AUTO' || !sourceLocationId;
  const resolvedSourceCode = isAutoLocation
    ? (partOccupiedLocation?.code || 'AUTO')
    : (locations.find(l => l.id === sourceLocationId)?.code || sourceLocationId);

  const sourceLoc = locations.find(l => l.id === sourceLocationId)
    || (partOccupiedLocation ? locations.find(l => l.id === partOccupiedLocation.id || l.code === partOccupiedLocation.code) : undefined)
    || locations[0]
    || { id: 'loc_auto', code: resolvedSourceCode, zone: 'A', aisle: '01', shelf: '01', bin: '01', warehouseId: 'wh_main', branchId: 'branch_elharefeyin', capacity: 100, status: 'ACTIVE' as const, createdAt: new Date().toISOString() };

  const targetLoc = locations.find(l => l.id === targetLocationId) || locations[1] || locations[0];
  const defaultWarehouse = warehouses[0] || { id: 'wh_main', name: 'المستودع الرئيسي' };

  // Calculate delta based on movement type
  let quantityDelta = Math.abs(quantity);
  if (['SALE', 'DAMAGED', 'LOST', 'SUPPLIER_RETURN'].includes(movementType)) {
    quantityDelta = -Math.abs(quantity);
  } else if (movementType === 'TRANSFER') {
    quantityDelta = Math.abs(quantity);
  }

  const projectedNewTotal = !activePart ? 0 : movementType === 'TRANSFER'
    ? activePart.totalStock
    : Math.max(0, activePart.totalStock + quantityDelta);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!activePart) {
      setErrorMsg('يرجى البحث عن الصنف واختياره أولاً.');
      return;
    }

    if (quantity <= 0) {
      setErrorMsg('يجب أن تكون الكمية أكبر من الصفر.');
      return;
    }

    if (['SALE', 'DAMAGED', 'LOST', 'SUPPLIER_RETURN'].includes(movementType) && activePart.totalStock < quantity) {
      setErrorMsg(`الرصيد الكلي للصنف في المخزن (${activePart.totalStock}) غير كافٍ لصرف كمية (${quantity}).`);
      return;
    }

    if (movementType === 'TRANSFER' && sourceLoc.id === targetLoc.id) {
      setErrorMsg('يجب أن يكون موقع الرف المصدر مختلفاً عن موقع الرف الوجهة لإجراء النقل.');
      return;
    }

    setLoading(true);
    try {
      await executeStockMovement({
        part: activePart,
        partId: activePart.id,
        partNumber: activePart.partNumber,
        movementType,
        quantityDelta,
        quantity,
        branch: activeBranch,
        warehouse: defaultWarehouse,
        location: sourceLoc,
        sourceLocation: resolvedSourceCode,
        targetLocation: movementType === 'TRANSFER' ? targetLoc : undefined,
        destinationLocation: movementType === 'TRANSFER' ? targetLoc?.code : undefined,
        reference: referenceDoc.trim() || `${movementType}-${Date.now().toString().slice(-6)}`,
        reason: reason.trim() || 'صرف مبيعات معتمد',
        user: {
          id: currentUser.id,
          name: currentUser.displayName
        }
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Movement execution error:', err);
      setErrorMsg(err.message || 'فشل تسجيل الحركة المخزنية.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full rounded-xl px-3.5 py-2.5 text-xs font-medium border transition ${
    isDark 
      ? 'bg-[#09090c] border-white/10 text-white focus:border-emerald-500' 
      : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600'
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div 
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
          isDark ? 'bg-[#0f0f13] border-white/10 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b ${isDark ? 'bg-[#09090c] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${isDark ? 'bg-zinc-800 border-white/10 text-emerald-400' : 'bg-slate-200 border-slate-300 text-emerald-700'}`}>
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base">
                تسجيل حركة مخزنية
              </h2>
              <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                AH.Libya Store (فرع الحرفيين): استلام، صرف، تحويل، أو تسوية جردية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-xl flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Part Selection — server-side search across the entire catalogue */}
          <div>
            <label className="block text-xs font-bold mb-1 opacity-80">
              اختر قطعة غيار مرسيدس *
            </label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
              <input
                value={partQuery}
                onChange={(event) => setPartQuery(event.target.value)}
                placeholder="ابحث برقم القطعة أو الاسم أو الباركود…"
                className={`${inputClass} pr-10 font-mono`}
                autoComplete="off"
              />
              {(partQuery.trim().length >= 2 || isSearchingParts) && (
                <div className={`absolute z-30 top-full mt-1 w-full max-h-52 overflow-y-auto rounded-xl border shadow-xl ${isDark ? 'bg-[#121217] border-white/10' : 'bg-white border-slate-200'}`}>
                  {isSearchingParts ? (
                    <div className="px-3 py-3 text-xs text-zinc-400">جارٍ البحث في كل الأصناف…</div>
                  ) : partResults.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-zinc-400">لا توجد نتائج مطابقة.</div>
                  ) : partResults.map((part) => (
                    <button
                      type="button"
                      key={part.id}
                      onClick={() => {
                        setSelectedPart(part);
                        setPartQuery('');
                        setPartResults([]);
                      }}
                      className={`w-full px-3 py-2.5 text-right border-b last:border-b-0 transition ${isDark ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'}`}
                    >
                      <span className="block font-mono font-bold text-emerald-500">{part.partNumber}</span>
                      <span className="block truncate text-[11px] opacity-80">{part.nameAr || part.nameEn} — الرصيد: {part.totalStock} {part.unit}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {activePart && (
              <div className={`mt-2 p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-mono font-bold text-sm">{activePart.partNumber}</span>
                  <span className="truncate">{activePart.nameAr || activePart.nameEn}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                  <span className="opacity-75">موقع الرف:</span>
                  <span className="font-bold text-emerald-400">
                    {partOccupiedLocation ? `الرف ${partOccupiedLocation.code}` : 'الرف الافتراضي (سحب تلقائي)'}
                  </span>
                  <span className="opacity-75">• الرصيد: {activePart.totalStock} {activePart.unit || 'قطعة'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Movement Type */}
          <div>
            <label className="block text-xs font-bold mb-1.5 opacity-80">
              نوع المعاملة المخزنية *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'SALE', label: 'صرف مبيعات (سحب آلي)' },
                { id: 'PURCHASE', label: 'استلام توريد' },
                { id: 'TRANSFER', label: 'نقل بين الأرفف' },
                { id: 'ADJUSTMENT', label: 'تسوية جردية' },
                { id: 'DAMAGED', label: 'هالك / تالف' },
                { id: 'CUSTOMER_RETURN', label: 'مرتجع عميل' }
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setMovementType(m.id as MovementType)}
                  className={`p-2.5 rounded-xl text-center text-xs transition font-bold ${
                    movementType === m.id
                      ? isDark
                        ? 'bg-white text-black shadow-sm'
                        : 'bg-slate-900 text-white shadow-sm'
                      : isDark
                      ? 'bg-[#141418] border border-white/10 text-zinc-400 hover:text-white'
                      : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity & Balance Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 opacity-80">
                الكمية ({activePart?.unit || 'PCS'}) *
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className={`${inputClass} font-mono font-bold text-base`}
                required
              />
            </div>

            {/* Projected Balance Pill */}
            <div className={`p-3 rounded-xl border flex flex-col justify-center text-center ${isDark ? 'bg-[#141418] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-[11px] opacity-75">الرصيد المتوقع بعد الحركة</span>
              <div className="font-mono text-sm sm:text-base font-bold mt-0.5">
                {activePart?.totalStock ?? 0} ← <span className="text-emerald-600 dark:text-emerald-400">{projectedNewTotal}</span> {activePart?.unit || 'PCS'}
              </div>
            </div>
          </div>

          {/* Storage Locations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 opacity-80 flex items-center justify-between">
                <span>{movementType === 'TRANSFER' ? 'رف التخزين المصدر' : 'موقع الرف بالمستودع'}</span>
                {movementType === 'SALE' && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    ⚡ سحب تلقائي فوري
                  </span>
                )}
              </label>
              <select
                value={sourceLocationId}
                onChange={(e) => setSourceLocationId(e.target.value)}
                className={inputClass}
              >
                <option value="AUTO">
                  ✨ سحب تلقائي من موقع القطعة {partOccupiedLocation ? `(الرف: ${partOccupiedLocation.code})` : ''}
                </option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>
                    الرف: {l.code} (المنطقة {l.zone} • {l.notes || 'موقع'})
                  </option>
                ))}
              </select>
            </div>

            {movementType === 'TRANSFER' && (
              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">
                  رف التخزين الوجهة (المستقبل) *
                </label>
                <select
                  value={targetLocationId}
                  onChange={(e) => setTargetLocationId(e.target.value)}
                  className={inputClass}
                >
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>
                      الرف: {l.code} (المنطقة {l.zone} • {l.notes || 'موقع'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Reference & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 opacity-80">
                رقم السند / الفاتورة / أمر التوريد
              </label>
              <input
                type="text"
                value={referenceDoc}
                onChange={(e) => setReferenceDoc(e.target.value)}
                placeholder="مثال: INV-2026-089"
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 opacity-80">
                الموظف المسؤول
              </label>
              <input
                type="text"
                disabled
                value={`${currentUser.displayName} (${currentUser.role === 'ADMIN' ? 'مدير النظام' : 'أمين مخزن'})`}
                className={`${inputClass} opacity-70`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 opacity-80">
              السبب والمبرر المخزني للعملية *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: توريد شحنة جديدة لمستودع فرع الحرفيين"
              className={inputClass}
              required
            />
          </div>

          {/* Footer Buttons */}
          <div className={`pt-4 border-t flex items-center justify-end gap-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2.5 rounded-full font-bold transition border text-xs ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2.5 rounded-full font-bold transition shadow-sm text-xs ${
                isDark
                  ? 'bg-white hover:bg-zinc-200 text-black'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {loading ? 'جاري الاعتماد...' : 'اعتماد وتسجيل الحركة'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
