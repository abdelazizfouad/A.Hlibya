import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { 
  PartMaster, 
  VehicleCompatibility, 
  PartCondition, 
  PartQuality, 
  WarehouseLocation, 
  Branch, 
  Warehouse, 
  EpcCategory 
} from '../../types/erp';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { createPart, updatePart, recommendOptimalBinLocation } from '../../lib/firestoreService';

interface AddEditPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  partToEdit?: PartMaster | null;
  categories: EpcCategory[];
  locations: WarehouseLocation[];
  warehouses: Warehouse[];
  branches: Branch[];
  onSuccess: (partId: string) => void;
}

export const AddEditPartModal: React.FC<AddEditPartModalProps> = ({
  isOpen,
  onClose,
  partToEdit,
  categories,
  locations,
  warehouses,
  branches,
  onSuccess
}) => {
  const { currentUser, activeBranch } = useAuth();
  const { isDark } = useTheme();
  const isEditing = !!partToEdit;

  // Form State
  const [partNumber, setPartNumber] = useState('');
  const [originalPartNumber, setOriginalPartNumber] = useState('');
  const [supersededInput, setSupersededInput] = useState('');
  const [alternativeInput, setAlternativeInput] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [categoryGroup, setCategoryGroup] = useState('01 ENGINE & TIMING');
  const [subgroup, setSubgroup] = useState('');
  const [epcIllustration, setEpcIllustration] = useState('');
  const [epcPosition, setEpcPosition] = useState('');
  const [brand, setBrand] = useState('Mercedes-Benz Genuine Parts');
  const [quality, setQuality] = useState<PartQuality>('GENUINE_OEM');
  const [condition, setCondition] = useState<PartCondition>('NEW');
  const [side, setSide] = useState<'LEFT' | 'RIGHT' | 'BOTH' | 'N/A'>('LEFT');
  const [position, setPosition] = useState<'FRONT' | 'REAR' | 'UPPER' | 'LOWER' | 'CENTER' | 'N/A'>('FRONT');
  const [unit, setUnit] = useState('PCS');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [wholesalePrice, setWholesalePrice] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(2);
  const [maxStock, setMaxStock] = useState<number>(20);
  const [reorderLevel, setReorderLevel] = useState<number>(3);
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');

  // Compatibility List
  const [compatibilityList, setCompatibilityList] = useState<VehicleCompatibility[]>([
    { chassis: 'W223', model: 'S500 / S580', engine: 'M256', yearFrom: 2021, yearTo: 2026 }
  ]);

  // Initial Stock Allocation (only for new parts)
  const [allocateInitialStock, setAllocateInitialStock] = useState<boolean>(true);
  const [initialQuantity, setInitialQuantity] = useState<number>(5);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Prefill when editing
  useEffect(() => {
    if (partToEdit) {
      setPartNumber(partToEdit.partNumber);
      setOriginalPartNumber(partToEdit.originalPartNumber || '');
      setSupersededInput(partToEdit.supersededNumbers.join(', '));
      setAlternativeInput(partToEdit.alternativeNumbers.join(', '));
      setNameEn(partToEdit.nameEn);
      setNameAr(partToEdit.nameAr);
      setDescription(partToEdit.description || '');
      setCategoryGroup(partToEdit.categoryGroup);
      setSubgroup(partToEdit.subgroup || '');
      setEpcIllustration(partToEdit.epcIllustration || '');
      setEpcPosition(partToEdit.epcPosition || '');
      setBrand(partToEdit.brand);
      setQuality(partToEdit.quality);
      setCondition(partToEdit.condition);
      setSide(partToEdit.side || 'LEFT');
      setPosition(partToEdit.position || 'FRONT');
      setUnit(partToEdit.unit);
      setCostPrice(partToEdit.costPrice || 0);
      setSellingPrice(partToEdit.sellingPrice || 0);
      setWholesalePrice(partToEdit.wholesalePrice || partToEdit.sellingPrice || 0);
      setMinStock(partToEdit.minStock);
      setMaxStock(partToEdit.maxStock);
      setReorderLevel(partToEdit.reorderLevel);
      setBarcode(partToEdit.barcode || '');
      setNotes(partToEdit.notes || '');
      setCompatibilityList(partToEdit.compatibility || []);
      setAllocateInitialStock(false);
    } else {
      // Reset form
      setPartNumber('');
      setOriginalPartNumber('');
      setSupersededInput('');
      setAlternativeInput('');
      setNameEn('');
      setNameAr('');
      setDescription('');
      setCategoryGroup(categories[0]?.nameEn || '01 ENGINE & TIMING');
      setSubgroup('');
      setEpcIllustration('');
      setEpcPosition('');
      setBrand('Mercedes-Benz Genuine Parts');
      setQuality('GENUINE_OEM');
      setCondition('NEW');
      setCostPrice(0);
      setSellingPrice(0);
      setWholesalePrice(0);
      setMinStock(2);
      setMaxStock(20);
      setReorderLevel(3);
      setBarcode('');
      setNotes('');
      setCompatibilityList([{ chassis: 'W223', model: 'S500 / S580', engine: 'M256', yearFrom: 2021, yearTo: 2026 }]);
      setAllocateInitialStock(true);
      setInitialQuantity(5);
    }
  }, [partToEdit, categories, isOpen]);

  // Set default recommended location when location list changes
  useEffect(() => {
    if (!selectedLocationId && locations.length > 0) {
      const rec = recommendOptimalBinLocation(categoryGroup, locations, []);
      if (rec) setSelectedLocationId(rec.id);
      else setSelectedLocationId(locations[0].id);
    }
  }, [categoryGroup, locations, selectedLocationId]);

  if (!isOpen) return null;

  // Add compatibility row
  const addCompatibilityRow = () => {
    setCompatibilityList([
      ...compatibilityList,
      { chassis: 'W222', model: 'S400 / S500', engine: 'M276', yearFrom: 2014, yearTo: 2020 }
    ]);
  };

  const removeCompatibilityRow = (idx: number) => {
    setCompatibilityList(compatibilityList.filter((_, i) => i !== idx));
  };

  const updateCompatibilityRow = (idx: number, field: keyof VehicleCompatibility, value: any) => {
    const updated = [...compatibilityList];
    updated[idx] = { ...updated[idx], [field]: value };
    setCompatibilityList(updated);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanPartNumber = partNumber.trim().toUpperCase();
    if (!cleanPartNumber) {
      setErrorMsg('رقم قطعة مرسيدس مطلوب (مثال: A2233302303).');
      return;
    }

    if (!nameEn.trim()) {
      setErrorMsg('اسم القطعة بالإنجليزية مطلوب.');
      return;
    }

    if (!nameAr.trim()) {
      setErrorMsg('اسم القطعة بالعربية مطلوب (مثال: مقص أمامي سفلي).');
      return;
    }

    const supersededArr = supersededInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const altArr = alternativeInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    setLoading(true);

    try {
      if (isEditing && partToEdit) {
        await updatePart(partToEdit.id, {
          partNumber: cleanPartNumber,
          originalPartNumber: originalPartNumber.trim().toUpperCase() || cleanPartNumber,
          supersededNumbers: supersededArr,
          alternativeNumbers: altArr,
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          description: description.trim(),
          categoryGroup,
          subgroup,
          epcIllustration,
          epcPosition,
          brand,
          quality,
          condition,
          side,
          position,
          unit,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          wholesalePrice: Number(wholesalePrice),
          minStock: Number(minStock),
          maxStock: Number(maxStock),
          reorderLevel: Number(reorderLevel),
          barcode: barcode.trim() || cleanPartNumber,
          qrCode: `MB-PART-${cleanPartNumber}`,
          notes: notes.trim(),
          compatibility: compatibilityList
        }, {
          id: currentUser.id,
          name: currentUser.displayName
        });

        onSuccess(partToEdit.id);
      } else {
        // Create new Part
        let initialAlloc;
        if (allocateInitialStock && initialQuantity > 0 && selectedLocationId) {
          const loc = locations.find(l => l.id === selectedLocationId);
          if (loc) {
            initialAlloc = {
              branchId: activeBranch.id,
              branchName: activeBranch.name,
              warehouseId: loc.warehouseId,
              warehouseName: loc.warehouseName || 'المستودع الرئيسي',
              locationId: loc.id,
              locationCode: loc.code,
              quantity: Number(initialQuantity),
              user: {
                id: currentUser.id,
                name: currentUser.displayName
              }
            };
          }
        }

        const newId = await createPart({
          partNumber: cleanPartNumber,
          originalPartNumber: originalPartNumber.trim().toUpperCase() || cleanPartNumber,
          supersededNumbers: supersededArr,
          alternativeNumbers: altArr,
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          description: description.trim(),
          categoryGroup,
          subgroup,
          epcIllustration,
          epcPosition,
          brand,
          quality,
          condition,
          side,
          position,
          unit,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          wholesalePrice: Number(wholesalePrice),
          minStock: Number(minStock),
          maxStock: Number(maxStock),
          reorderLevel: Number(reorderLevel),
          barcode: barcode.trim() || cleanPartNumber,
          qrCode: `MB-PART-${cleanPartNumber}`,
          notes: notes.trim(),
          compatibility: compatibilityList
        }, initialAlloc);

        onSuccess(newId);
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving part:', err);
      setErrorMsg(err.message || 'فشل حفظ بيانات القطعة.');
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
        className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors ${
          isDark
            ? 'bg-[#0f0f13] border-white/10 text-zinc-200'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b ${
            isDark ? 'bg-[#09090c] border-white/10' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                isDark ? 'bg-zinc-800 border-white/10 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'
              }`}
            >
              MB
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base">
                {isEditing ? `تعديل صنف: ${partToEdit?.partNumber}` : 'إضافة رقم قطعة مرسيدس جديد'}
              </h2>
              <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                AH.Libya Store — كتالوج الأصناف والمستودع الرئيسي (فرع الحرفيين)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition ${
              isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-xl flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Identification */}
          <div className="space-y-3">
            <h3 className={`text-xs font-bold border-b pb-2 ${isDark ? 'border-white/10 text-emerald-400' : 'border-slate-200 text-emerald-700'}`}>
              ١. تعريف القطعة وأرقام المطابقة
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">
                  رقم قطعة مرسيدس الرئيسي *
                </label>
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="مثال: A2233302303"
                  className={`${inputClass} font-mono uppercase tracking-wider`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">
                  رقم الكتالوج الأصلي / SKU
                </label>
                <input
                  type="text"
                  value={originalPartNumber}
                  onChange={(e) => setOriginalPartNumber(e.target.value)}
                  placeholder="مثال: A2233302303"
                  className={`${inputClass} font-mono uppercase tracking-wider`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">
                  الباركود (EAN-13 / UPC)
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="مثال: 4047437482910"
                  className={`${inputClass} font-mono tracking-wider`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">
                  الاسم بالإنجليزي (English Name) *
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Front Lower Control Arm (Left)"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">
                  الاسم بالعربي *
                </label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: مقص أمامي سفلي يسار أصلي"
                  className={inputClass}
                  dir="rtl"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">
                  أرقام بديلة ومستبدلة (مفصولة بفواصل)
                </label>
                <input
                  type="text"
                  value={supersededInput}
                  onChange={(e) => setSupersededInput(e.target.value)}
                  placeholder="مثال: A2233302103, A2233302203"
                  className={`${inputClass} font-mono uppercase`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">
                  أرقام مطابقة من موردين / شركات
                </label>
                <input
                  type="text"
                  value={alternativeInput}
                  onChange={(e) => setAlternativeInput(e.target.value)}
                  placeholder="مثال: LEM-3945801, TRW-JTC2291"
                  className={`${inputClass} font-mono uppercase`}
                />
              </div>
            </div>
          </div>

          {/* Section 2: EPC Classification & Quality */}
          <div className="space-y-3">
            <h3 className={`text-xs font-bold border-b pb-2 ${isDark ? 'border-white/10 text-emerald-400' : 'border-slate-200 text-emerald-700'}`}>
              ٢. تصنيف EPC والمصنع ودرجة الجودة
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">مجموعة EPC</label>
                <select
                  value={categoryGroup}
                  onChange={(e) => setCategoryGroup(e.target.value)}
                  className={inputClass}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.nameEn}>{c.nameAr || c.nameEn}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">الشركة المصنعة</label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="مثال: Mercedes-Benz Genuine"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">درجة الجودة</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="GENUINE_OEM">أصلي وكالة (OEM)</option>
                  <option value="ORIGINAL">أصلي مرسيدس Genuine</option>
                  <option value="AFTERMARKET">بديل تجاري معتمد Aftermarket</option>
                  <option value="REMANUFACTURED">مجدد معتمد Reman</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">الحالة</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="NEW">جديد بالكرتونة</option>
                  <option value="USED">مستعمل بحالة ممتازة</option>
                  <option value="REFURBISHED">مجدد</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">الجانب</label>
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="N/A">غير محدد</option>
                  <option value="LEFT">يسار (Left)</option>
                  <option value="RIGHT">يمين (Right)</option>
                  <option value="BOTH">الجهتين (طقم Both)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">الموضع</label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="N/A">غير محدد</option>
                  <option value="FRONT">أمامي (Front)</option>
                  <option value="REAR">خلفي (Rear)</option>
                  <option value="UPPER">علوي (Upper)</option>
                  <option value="LOWER">سفلي (Lower)</option>
                  <option value="CENTER">أوسط (Center)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">رقم مخطط EPC</label>
                <input
                  type="text"
                  value={epcIllustration}
                  onChange={(e) => setEpcIllustration(e.target.value)}
                  placeholder="مثال: 33-050"
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">رقم الموضع على المخطط</label>
                <input
                  type="text"
                  value={epcPosition}
                  onChange={(e) => setEpcPosition(e.target.value)}
                  placeholder="مثال: 07"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Pricing & Stock Parameters (in EGP) */}
          <div className="space-y-3">
            <h3 className={`text-xs font-bold border-b pb-2 ${isDark ? 'border-white/10 text-emerald-400' : 'border-slate-200 text-emerald-700'}`}>
              ٣. الأسعار بالجنيه المصري (EGP) ومحددات المخزون
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">سعر التكلفة (EGP)</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={costPrice}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  className={`${inputClass} font-mono`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">سعر البيع قطاعي (EGP)</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(Number(e.target.value))}
                  className={`${inputClass} font-mono font-bold text-emerald-600 dark:text-emerald-400`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">سعر الجملة / الورش (EGP)</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(Number(e.target.value))}
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">الحد الأدنى للطلب</label>
                <input
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(Number(e.target.value))}
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">نقطة إعادة الطلب</label>
                <input
                  type="number"
                  min="0"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(Number(e.target.value))}
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">الحد الأقصى للسعة</label>
                <input
                  type="number"
                  min="0"
                  value={maxStock}
                  onChange={(e) => setMaxStock(Number(e.target.value))}
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Vehicle Compatibility Matrix */}
          <div className="space-y-3">
            <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <h3 className={`text-xs font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                ٤. مصفوفة توافق موديلات السيارات ({compatibilityList.length})
              </h3>
              <button
                type="button"
                onClick={addCompatibilityRow}
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition border ${
                  isDark
                    ? 'bg-zinc-900 hover:bg-white hover:text-black text-zinc-200 border-white/10'
                    : 'bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-800 border-slate-300'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة موديل +</span>
              </button>
            </div>

            <div className="space-y-2">
              {compatibilityList.map((comp, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-xl border flex items-center gap-2 flex-wrap sm:flex-nowrap ${
                    isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="w-24">
                    <input
                      type="text"
                      placeholder="الشاسيه (W223)"
                      value={comp.chassis}
                      onChange={(e) => updateCompatibilityRow(idx, 'chassis', e.target.value.toUpperCase())}
                      className={`${inputClass} uppercase`}
                    />
                  </div>

                  <div className="flex-1 min-w-[120px]">
                    <input
                      type="text"
                      placeholder="الموديل (S500 / S580)"
                      value={comp.model}
                      onChange={(e) => updateCompatibilityRow(idx, 'model', e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="w-24">
                    <input
                      type="text"
                      placeholder="المحرك (M256)"
                      value={comp.engine || ''}
                      onChange={(e) => updateCompatibilityRow(idx, 'engine', e.target.value.toUpperCase())}
                      className={`${inputClass} uppercase`}
                    />
                  </div>

                  <div className="w-20">
                    <input
                      type="number"
                      placeholder="من"
                      value={comp.yearFrom || ''}
                      onChange={(e) => updateCompatibilityRow(idx, 'yearFrom', Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>

                  <div className="w-20">
                    <input
                      type="number"
                      placeholder="إلى"
                      value={comp.yearTo || ''}
                      onChange={(e) => updateCompatibilityRow(idx, 'yearTo', Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>

                  {compatibilityList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCompatibilityRow(idx)}
                      className="text-rose-500 hover:text-rose-600 p-1.5 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Initial Stock Allocation (New Parts Only) */}
          {!isEditing && (
            <div 
              className={`space-y-3 p-4 rounded-xl border ${
                isDark ? 'bg-[#141418] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="allocStock"
                    checked={allocateInitialStock}
                    onChange={(e) => setAllocateInitialStock(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <label htmlFor="allocStock" className="text-xs font-bold cursor-pointer">
                    تخصيص رصيد افتتاحي في رف المستودع الرئيسي (فرع الحرفيين)
                  </label>
                </div>
                <span className="text-[11px] opacity-70">حركة استلام تلقائية</span>
              </div>

              {allocateInitialStock && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-80">
                      الكمية الافتتاحية (قطعة)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={initialQuantity}
                      onChange={(e) => setInitialQuantity(Number(e.target.value))}
                      className={`${inputClass} font-mono`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 opacity-80">
                      تحديد رف التخزين
                    </label>
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className={inputClass}
                    >
                      {locations.map(l => (
                        <option key={l.id} value={l.id}>
                          الرف: {l.code} (المنطقة {l.zone} • {l.notes || 'موقع تخزين'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer buttons */}
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
              className={`px-6 py-2.5 rounded-full font-bold transition shadow-sm flex items-center gap-2 text-xs ${
                isDark
                  ? 'bg-white hover:bg-zinc-200 text-black'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {loading ? (
                <span>جاري الحفظ في النظام...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'حفظ تعديلات القطعة' : 'تسوية وحفظ الصنف الجديد'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
