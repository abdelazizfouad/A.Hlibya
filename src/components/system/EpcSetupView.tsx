import React, { useState } from 'react';
import { 
  RotateCw, 
  Layers, 
  CheckCircle2, 
  Boxes,
  Trash2,
  PlusCircle,
  Edit3,
  AlertTriangle,
  Flame,
  Check
} from 'lucide-react';
import { EpcCategory, PartMaster, WarehouseLocation, Branch } from '../../types/erp';
import { useTheme } from '../../lib/themeContext';
import { 
  forceReseedDatabase, 
  wipeAllDatabaseData, 
  zeroOutAllCosts,
  zeroOutAllSellingPrices,
  zeroOutAllPrices,
  addEpcCategory, 
  updateEpcCategory, 
  deleteEpcCategory 
} from '../../lib/firestoreService';

interface EpcSetupViewProps {
  categories: EpcCategory[];
  parts: PartMaster[];
  locations: WarehouseLocation[];
  branches: Branch[];
  onRefreshData: () => void;
}

export const EpcSetupView: React.FC<EpcSetupViewProps> = ({
  categories,
  parts,
  locations,
  branches,
  onRefreshData
}) => {
  const { isDark } = useTheme();
  const [isReseeding, setIsReseeding] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isZeroingCost, setIsZeroingCost] = useState(false);
  const [isZeroingSelling, setIsZeroingSelling] = useState(false);
  const [isZeroingAll, setIsZeroingAll] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Category Modal State
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [catCode, setCatCode] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catNameAr, setCatNameAr] = useState('');
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);

  // Edit Category Modal State
  const [editingCategory, setEditingCategory] = useState<EpcCategory | null>(null);
  const [editCatCode, setEditCatCode] = useState('');
  const [editCatNameEn, setEditCatNameEn] = useState('');
  const [editCatNameAr, setEditCatNameAr] = useState('');

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 6000);
  };

  // Full Database Wipe (Zero all items, transactions, shortages, etc.)
  const handleWipeAll = async () => {
    const confirmation = window.prompt(
      'تحذير أمني هام:\nسيتم مسح وتصفير كافة الأصناف، المخزون، الحركات، النواقص، أوامر الشراء، والمبيعات لتصبح المنظومة خالية تماماً وجديدة.\n\nلتأكيد العملية اكتب كلمة "تصفير" أدناه:'
    );

    if (confirmation !== 'تصفير') {
      if (confirmation !== null) {
        alert('لم يتم كتابة كلمة التأكيد بشكل صحيح. تم إلغاء العملية.');
      }
      return;
    }

    setIsWiping(true);
    showStatus('جاري مسح وتصفير كافة الأصناف والمعاملات في قاعدة البيانات السحابية...', 'success');
    try {
      await wipeAllDatabaseData();
      showStatus('تم تصفير المنظومة بنجاح! قاعدة البيانات الآن جديدة وخالية تماماً من كافة الأصناف والمعاملات.', 'success');
      onRefreshData();
    } catch (err: any) {
      console.error('Wipe error:', err);
      showStatus(`خطأ أثناء تصفير البيانات: ${err.message}`, 'error');
    } finally {
      setIsWiping(false);
    }
  };

  // Zero Out All Selling Prices (Make all selling prices 0 EGP for all active items)
  const handleZeroAllSellingPricesAction = async () => {
    if (!window.confirm('هل تريد تصفير سعر البيع لكافة الأصناف المسجلة في المنظومة وجعل سعر البيع 0 جنيه مصري؟')) {
      return;
    }

    setIsZeroingSelling(true);
    showStatus('جاري تصفير سعر البيع لكافة الأصناف المسجلة في قاعدة البيانات...', 'success');
    try {
      const res = await zeroOutAllSellingPrices();
      showStatus(res.message, res.success ? 'success' : 'error');
      onRefreshData();
    } catch (err: any) {
      console.error('Zero selling price error:', err);
      showStatus(`خطأ أثناء تصفير سعر البيع: ${err.message}`, 'error');
    } finally {
      setIsZeroingSelling(false);
    }
  };

  // Zero Out ALL Prices (Selling, Wholesale & Cost to 0 EGP)
  const handleZeroAllPricesAction = async () => {
    if (!window.confirm('هل تريد تصفير جميع الأسعار والتكاليف (سعر البيع، الجملة، والتكلفة) لكافة الأصناف وجعلها 0 جنيه؟')) {
      return;
    }

    setIsZeroingAll(true);
    showStatus('جاري تصفير كافة الأسعار والتكاليف لكافة الأصناف...', 'success');
    try {
      const res = await zeroOutAllPrices();
      showStatus(res.message, res.success ? 'success' : 'error');
      onRefreshData();
    } catch (err: any) {
      console.error('Zero all prices error:', err);
      showStatus(`خطأ أثناء تصفير الأسعار: ${err.message}`, 'error');
    } finally {
      setIsZeroingAll(false);
    }
  };

  // Zero Out All Cost Prices (Make all costs 0 EGP)
  const handleZeroAllCostsAction = async () => {
    if (!window.confirm('هل تريد تصفير تكلفة كافة البنود والقطع في المنظومة وجعلها 0 جنيه مصري؟')) {
      return;
    }

    setIsZeroingCost(true);
    showStatus('جاري تصفير تكلفة كافة الأصناف والبنود في قاعدة البيانات...', 'success');
    try {
      const res = await zeroOutAllCosts();
      showStatus(res.message, res.success ? 'success' : 'error');
      onRefreshData();
    } catch (err: any) {
      console.error('Zero cost error:', err);
      showStatus(`خطأ أثناء تصفير التكلفة: ${err.message}`, 'error');
    } finally {
      setIsZeroingCost(false);
    }
  };

  const handleReseed = async () => {
    if (!window.confirm('هل تريد إعادة تعيين التهيئة الافتراضية مع نموذج تجريبي؟')) {
      return;
    }

    setIsReseeding(true);
    showStatus('جاري تهيئة قاعدة بيانات AH.Libya Store في Firestore...', 'success');
    try {
      await forceReseedDatabase();
      showStatus('تمت تهيئة قاعدة البيانات بنجاح مع الصنف التجريبي وفرع الحرفيين!', 'success');
      onRefreshData();
    } catch (err: any) {
      console.error('Reseed error:', err);
      showStatus(`خطأ أثناء تهيئة قاعدة البيانات: ${err.message}`, 'error');
    } finally {
      setIsReseeding(false);
    }
  };

  // Handle Add Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catCode.trim() || !catNameEn.trim() || !catNameAr.trim()) return;

    setIsSubmittingCat(true);
    try {
      await addEpcCategory({
        groupCode: catCode.trim().toUpperCase(),
        nameEn: catNameEn.trim(),
        nameAr: catNameAr.trim(),
        iconName: 'Layers',
        subgroups: []
      });
      setIsAddCatModalOpen(false);
      setCatCode('');
      setCatNameEn('');
      setCatNameAr('');
      showStatus('تمت إضافة مجموعة EPC بنجاح!');
      onRefreshData();
    } catch (err: any) {
      console.error('Error adding category:', err);
      showStatus(`خطأ أثناء الإضافة: ${err.message}`, 'error');
    } finally {
      setIsSubmittingCat(false);
    }
  };

  // Handle Edit Category
  const handleOpenEditCat = (cat: EpcCategory) => {
    setEditingCategory(cat);
    setEditCatCode(cat.groupCode || '');
    setEditCatNameEn(cat.nameEn);
    setEditCatNameAr(cat.nameAr || '');
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    setIsSubmittingCat(true);
    try {
      await updateEpcCategory(editingCategory.id, {
        groupCode: editCatCode.trim().toUpperCase(),
        nameEn: editCatNameEn.trim(),
        nameAr: editCatNameAr.trim()
      });
      setEditingCategory(null);
      showStatus('تم تحديث بيانات المجموعة بنجاح!');
      onRefreshData();
    } catch (err: any) {
      console.error('Error updating category:', err);
      showStatus(`خطأ أثناء التعديل: ${err.message}`, 'error');
    } finally {
      setIsSubmittingCat(false);
    }
  };

  // Handle Delete Category
  const handleDeleteCategory = async (cat: EpcCategory) => {
    if (!window.confirm(`هل أنت متأكد من حذف مجموعة التصنيف "${cat.groupCode} - ${cat.nameAr || cat.nameEn}"؟`)) {
      return;
    }
    try {
      await deleteEpcCategory(cat.id);
      showStatus('تم حذف مجموعة التصنيف بنجاح.');
      onRefreshData();
    } catch (err: any) {
      console.error('Error deleting category:', err);
      showStatus(`خطأ أثناء الحذف: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              كتالوج EPC وإعدادات النظام وتصفير البيانات
            </h1>
            <span
              className={`text-xs px-3 py-1 rounded-full font-mono font-bold border ${
                isDark ? 'bg-zinc-800 text-emerald-400 border-white/10' : 'bg-slate-200 text-emerald-800 border-slate-300'
              }`}
            >
              AH.Libya Store
            </span>
          </div>
          <p className={`text-xs font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
            تصنيف مجموعات مرسيدس-بنز القياسية EPC، إدارة قاعدة بيانات Firestore، وخيار مسح وتصفير البيانات بالكامل
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Zero Out All Selling Prices Button */}
          <button
            onClick={handleZeroAllSellingPricesAction}
            disabled={isZeroingSelling}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isZeroingSelling ? 'animate-spin' : ''}`} />
            <span>{isZeroingSelling ? 'جاري تصفير سعر البيع...' : 'تصفير أسعار البيع لكافة الأصناف (0 EGP)'}</span>
          </button>

          {/* Zero Out All Prices (Selling + Cost) Button */}
          <button
            onClick={handleZeroAllPricesAction}
            disabled={isZeroingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isZeroingAll ? 'animate-spin' : ''}`} />
            <span>{isZeroingAll ? 'جاري تصفير كافة الأسعار...' : 'تصفير كافة الأسعار والتكاليف (0 EGP)'}</span>
          </button>

          {/* Zero Out All Costs Button */}
          <button
            onClick={handleZeroAllCostsAction}
            disabled={isZeroingCost}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 transition cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isZeroingCost ? 'animate-spin' : ''}`} />
            <span>{isZeroingCost ? 'جاري تصفير التكلفة...' : 'تصفير التكاليف (0 EGP)'}</span>
          </button>

          {/* Wipe / Clean Reset Button */}
          <button
            onClick={handleWipeAll}
            disabled={isWiping}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition cursor-pointer"
          >
            <Flame className={`w-3.5 h-3.5 ${isWiping ? 'animate-bounce' : ''}`} />
            <span>{isWiping ? 'جاري مسح البيانات...' : 'تصفير ومسح كافة البيانات'}</span>
          </button>

          <button
            onClick={handleReseed}
            disabled={isReseeding}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition shadow-xs ${
              isDark
                ? 'bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-zinc-300'
                : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isReseeding ? 'animate-spin' : ''}`} />
            <span>{isReseeding ? 'جاري التحديث...' : 'تهيئة البنية الافتراضية'}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold border ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-zinc-400 hover:text-white px-2">✕</button>
        </div>
      )}

      {/* System Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#111116] border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>القطع في الكتالوج</div>
          <div className="text-2xl font-bold mt-1 font-mono text-emerald-600 dark:text-emerald-400">{parts.length}</div>
          <div className={`text-xs font-medium mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
            {parts.length === 0 ? 'خالية وجاهزة للإضافة' : 'قطعة مرسيدس مسجلة'}
          </div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#111116] border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>أرفف ومواقع التخزين</div>
          <div className="text-2xl font-bold mt-1 font-mono text-emerald-600 dark:text-emerald-400">{locations.length}</div>
          <div className={`text-xs font-medium mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>أرفف معرفة بكود QR</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#111116] border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>مجموعات EPC</div>
          <div className="text-2xl font-bold mt-1 font-mono text-emerald-600 dark:text-emerald-400">{categories.length}</div>
          <div className={`text-xs font-medium mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>تصنيف دايملر المعتمد</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#111116] border-white/10' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>قاعدة البيانات</div>
          <div className="text-sm font-bold mt-2.5 flex items-center gap-1.5 font-mono text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Firestore Cloud Live</span>
          </div>
          <div className={`text-xs font-medium mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>تزامن فوري ونشط</div>
        </div>
      </div>

      {/* EPC Groups Taxonomy */}
      <div className={`rounded-2xl p-4 sm:p-6 space-y-4 shadow-xs border transition-colors ${isDark ? 'bg-[#111116] border-white/10' : 'bg-white border-slate-200'}`}>
        
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Layers className={`w-4 h-4 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
              <span>المجموعات الرئيسية لكتالوج مرسيدس-بنز EPC (Category Master)</span>
            </h2>
            <span className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              معايير التصنيف الفني لشركة دايملر — يمكنك إضافة أو تعديل أو حذف المجموعات
            </span>
          </div>

          <button
            onClick={() => setIsAddCatModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إضافة مجموعة EPC جديدة</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => {
            const count = parts.filter(p => p.categoryGroup === cat.nameEn || p.categoryGroup === cat.groupCode).length;
            return (
              <div
                key={cat.id}
                className={`p-4 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                  isDark ? 'bg-[#141418] border-white/5 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      {cat.groupCode}
                    </span>
                    <span className="font-bold text-xs truncate">
                      {cat.nameAr || cat.nameEn}
                    </span>
                  </div>
                  <div className={`text-xs font-medium mt-0.5 truncate ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    {cat.nameEn}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${isDark ? 'bg-zinc-900 text-zinc-300 border-white/10' : 'bg-white text-slate-700 border-slate-300'}`}>
                    {count}
                  </span>

                  <button
                    onClick={() => handleOpenEditCat(cat)}
                    title="تعديل المجموعة"
                    className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    title="حذف المجموعة"
                    className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Category Modal */}
      {isAddCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
            isDark ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-slate-300'
          }`} dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>إضافة مجموعة تصنيف EPC جديدة</h3>
              <button onClick={() => setIsAddCatModalOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">كود المجموعة (Group Code) *</label>
                <input 
                  required 
                  placeholder="e.g. 54" 
                  value={catCode} 
                  onChange={e => setCatCode(e.target.value)} 
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">الاسم بالعربية *</label>
                <input 
                  required 
                  placeholder="e.g. الكهرباء والمعدات الإلكترونية" 
                  value={catNameAr} 
                  onChange={e => setCatNameAr(e.target.value)} 
                  className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">الاسم بالإنجليزية (EPC English Name) *</label>
                <input 
                  required 
                  placeholder="e.g. ELECTRICAL SYSTEM & SAM UNITS" 
                  value={catNameEn} 
                  onChange={e => setCatNameEn(e.target.value)} 
                  className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} 
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddCatModalOpen(false)} className="px-3 py-1.5 text-xs text-zinc-400">إلغاء</button>
                <button type="submit" disabled={isSubmittingCat} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                  {isSubmittingCat ? 'جاري الحفظ...' : 'حفظ المجموعة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
            isDark ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-slate-300'
          }`} dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>تعديل مجموعة EPC</h3>
              <button onClick={() => setEditingCategory(null)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleUpdateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">كود المجموعة *</label>
                <input 
                  required 
                  value={editCatCode} 
                  onChange={e => setEditCatCode(e.target.value)} 
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">الاسم بالعربية *</label>
                <input 
                  required 
                  value={editCatNameAr} 
                  onChange={e => setEditCatNameAr(e.target.value)} 
                  className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">الاسم بالإنجليزية *</label>
                <input 
                  required 
                  value={editCatNameEn} 
                  onChange={e => setEditCatNameEn(e.target.value)} 
                  className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} 
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingCategory(null)} className="px-3 py-1.5 text-xs text-zinc-400">إلغاء</button>
                <button type="submit" disabled={isSubmittingCat} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                  {isSubmittingCat ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
