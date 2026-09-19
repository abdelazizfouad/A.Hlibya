import React, { useState } from 'react';
import { 
  AlertOctagon, 
  PlusCircle, 
  Search, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Trash2, 
  Download, 
  Edit3,
  User,
  Phone,
  Car
} from 'lucide-react';
import { ShortageItem, PartMaster } from '../../types/erp';
import { addShortageItem, updateShortageStatus, updateShortageItem, deleteShortageItem } from '../../lib/firestoreService';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';

interface ShortagesViewProps {
  shortages: ShortageItem[];
  parts?: PartMaster[];
  onOpenCreatePO?: (shortage: ShortageItem) => void;
}

export const ShortagesView: React.FC<ShortagesViewProps> = ({
  shortages,
  parts = [],
  onOpenCreatePO
}) => {
  const { isDark } = useTheme();
  const { language, t } = useLanguage();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');
  
  // Add shortage modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newNameAr, setNewNameAr] = useState('');
  const [newChassis, setNewChassis] = useState('W223');
  const [newQty, setNewQty] = useState(2);
  const [newUrgency, setNewUrgency] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Edit modal state
  const [editingItem, setEditingItem] = useState<ShortageItem | null>(null);
  const [editPartNumber, setEditPartNumber] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [editChassis, setEditChassis] = useState('');
  const [editQty, setEditQty] = useState(1);
  const [editUrgency, setEditUrgency] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [editStatus, setEditStatus] = useState<ShortageItem['status']>('PENDING');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Auto-fill name when part number matches catalog
  const handlePartNumberChange = (pn: string) => {
    setNewPartNumber(pn.toUpperCase());
    const matched = parts.find(p => p.partNumber.toUpperCase() === pn.trim().toUpperCase());
    if (matched) {
      setNewNameAr(matched.nameAr);
      if (matched.compatibility?.[0]?.chassis) {
        setNewChassis(matched.compatibility[0].chassis);
      }
    }
  };

  const handleCreateShortage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartNumber.trim() || !newNameAr.trim()) {
      showToast(t('يرجى كتابة رقم الصنف واسم القطعة', 'Please provide part number and name'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addShortageItem({
        partNumber: newPartNumber.trim().toUpperCase(),
        nameAr: newNameAr.trim(),
        nameEn: newNameAr.trim(),
        chassis: newChassis.trim().toUpperCase() || 'W223',
        requestedQty: Math.max(1, Number(newQty) || 1),
        requestCount: 1,
        urgency: newUrgency,
        customerName: newCustomerName.trim() || undefined,
        customerPhone: newCustomerPhone.trim() || undefined,
        status: 'PENDING',
        notes: newNotes.trim() || undefined
      });

      setIsAddModalOpen(false);
      setNewPartNumber('');
      setNewNameAr('');
      setNewNotes('');
      setNewCustomerName('');
      setNewCustomerPhone('');
      showToast(t('تم تسجيل الصنف في سجل النواقص بنجاح!', 'Shortage item added successfully!'));
    } catch (err: any) {
      console.error('Error adding shortage:', err);
      showToast(t('حدث خطأ أثناء حفظ الصنف: ', 'Error adding shortage: ') + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (item: ShortageItem) => {
    setEditingItem(item);
    setEditPartNumber(item.partNumber);
    setEditNameAr(item.nameAr);
    setEditChassis(item.chassis || '');
    setEditQty(item.requestedQty);
    setEditUrgency(item.urgency);
    setEditStatus(item.status);
    setEditCustomerName(item.customerName || '');
    setEditCustomerPhone(item.customerPhone || '');
    setEditNotes(item.notes || '');
  };

  const handleUpdateShortage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSubmitting(true);
    try {
      await updateShortageItem(editingItem.id, {
        partNumber: editPartNumber.trim().toUpperCase(),
        nameAr: editNameAr.trim(),
        nameEn: editNameAr.trim(),
        chassis: editChassis.trim().toUpperCase(),
        requestedQty: Math.max(1, Number(editQty) || 1),
        urgency: editUrgency,
        status: editStatus,
        customerName: editCustomerName.trim() || undefined,
        customerPhone: editCustomerPhone.trim() || undefined,
        notes: editNotes.trim() || undefined
      });

      setEditingItem(null);
      showToast(t('تم تحديث بيانات الصنف بنجاح!', 'Shortage item updated successfully!'));
    } catch (err: any) {
      console.error('Error updating shortage:', err);
      showToast(t('حدث خطأ أثناء التعديل: ', 'Error updating: ') + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(t(`هل أنت متأكد من حذف الصنف "${name}" من سجل النواقص؟`, `Delete shortage item "${name}"?`))) {
      return;
    }
    try {
      await deleteShortageItem(id);
      showToast(t('تم حذف الصنف من سجل النواقص.', 'Shortage item deleted.'));
    } catch (err: any) {
      console.error('Error deleting shortage:', err);
      showToast(t('خطأ أثناء الحذف: ', 'Delete error: ') + err.message, 'error');
    }
  };

  const handleStatusChange = async (id: string, status: ShortageItem['status']) => {
    try {
      await updateShortageStatus(id, status);
      showToast(t('تم تحديث حالة الصنف بنجاح.', 'Status updated.'));
    } catch (err: any) {
      console.error('Error updating status:', err);
      showToast(t('خطأ أثناء التحديث: ', 'Status error: ') + err.message, 'error');
    }
  };

  const filteredShortages = shortages.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      item.partNumber.toLowerCase().includes(term) ||
      item.nameAr.toLowerCase().includes(term) ||
      (item.customerName && item.customerName.toLowerCase().includes(term)) ||
      (item.chassis && item.chassis.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'ALL' || item.urgency === urgencyFilter;

    return matchesSearch && matchesStatus && matchesUrgency;
  });

  const pendingCount = shortages.filter(s => s.status === 'PENDING').length;
  const orderedCount = shortages.filter(s => s.status === 'ORDERED').length;
  const receivedCount = shortages.filter(s => s.status === 'RECEIVED').length;
  const highUrgencyCount = shortages.filter(s => s.urgency === 'HIGH' && s.status === 'PENDING').length;

  const handleExportCSV = () => {
    const headers = ['رقم القطعة', 'اسم الصنف', 'الشاسيه', 'الكمية المطلوبة', 'مرات الطلب', 'درجة الأهمية', 'الحالة', 'العميل', 'رقم الهاتف', 'ملاحظات', 'تاريخ التسجيل'];
    const rows = filteredShortages.map(s => [
      s.partNumber,
      s.nameAr,
      s.chassis || '',
      s.requestedQty,
      s.requestCount,
      s.urgency === 'HIGH' ? 'عاجل جدًا' : s.urgency === 'MEDIUM' ? 'متوسط' : 'عادي',
      s.status === 'PENDING' ? 'قيد الانتظار' : s.status === 'ORDERED' ? 'تم الطلب' : 'تم الاستلام',
      s.customerName || '',
      s.customerPhone || '',
      s.notes || '',
      new Date(s.createdAt).toLocaleDateString('ar-EG')
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AH_Libya_Shortages_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold shadow-lg transition-all animate-fadeIn ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-zinc-400 hover:text-white px-2 py-0.5">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('سجل النواقص وطلبيات العجز (Shortages & Deficits)', 'Warehouse Shortages & Reorder Requests')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            {t('تتبع الأصناف غير المتوفرة ومعدلات الطلب لإصدار أوامر الشراء وإعادة تعبئة المخزون', 'Track out-of-stock items and customer demands to trigger purchase orders')}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {shortages.length > 0 && (
            <button
              onClick={handleExportCSV}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                isDark
                  ? 'bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-xs'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('تصدير CSV', 'Export CSV')}</span>
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-md shadow-rose-500/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('تسجيل صنف ناقص جديد', 'Add Shortage Item')}</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        
        <div className={`p-4 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">{t('إجمالي النواقص المعلقة', 'Pending Shortages')}</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {pendingCount}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">{t('تتطلب إدراج في أوامر الشراء', 'Require purchase orders')}</p>
        </div>

        <div className={`p-4 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">{t('نواقص عالية الأهمية', 'Critical Urgency')}</span>
            <AlertOctagon className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">
            {highUrgencyCount}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">{t('طلب عاجل من عملاء وورش', 'Urgent orders')}</p>
        </div>

        <div className={`p-4 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">{t('تم طلبها من الموردين', 'Ordered')}</span>
            <Truck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 font-mono">
            {orderedCount}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">{t('بانتظار وصول الشحنة', 'Awaiting shipment')}</p>
        </div>

        <div className={`p-4 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">{t('تم توفيرها للمخزن', 'Received')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {receivedCount}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">{t('تم الاستلام وتحديث الرصيد', 'Fulfilled')}</p>
        </div>

      </div>

      {/* Filter Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('بحث برقم القطعة، الاسم، الشاسيه، العميل...', 'Search part, chassis, customer...')}
            className={`w-full px-4 py-2 rounded-xl text-xs border transition-all focus:outline-hidden ${
              isDark
                ? 'bg-zinc-900 border-white/10 text-white focus:border-rose-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500'
            }`}
          />
          <Search className={`w-3.5 h-3.5 absolute top-2.5 text-zinc-400 ${language === 'ar' ? 'left-3' : 'right-3'}`} />
        </div>

        {/* Filters */}
        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border font-semibold ${
              isDark ? 'bg-zinc-900 border-white/10 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <option value="ALL">{t('جميع الحالات', 'All Statuses')}</option>
            <option value="PENDING">{t('قيد الانتظار', 'Pending')}</option>
            <option value="ORDERED">{t('تم إدراجها بأمر شراء', 'Ordered')}</option>
            <option value="RECEIVED">{t('تم التوريد', 'Received')}</option>
          </select>

          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border font-semibold ${
              isDark ? 'bg-zinc-900 border-white/10 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <option value="ALL">{t('جميع درجات الأهمية', 'All Urgencies')}</option>
            <option value="HIGH">{t('عاجل جدًا (High)', 'High')}</option>
            <option value="MEDIUM">{t('متوسط (Medium)', 'Medium')}</option>
            <option value="LOW">{t('عادي (Low)', 'Low')}</option>
          </select>

        </div>

      </div>

      {/* Shortages Table */}
      <div className={`rounded-2xl border overflow-hidden transition-all ${
        isDark ? 'bg-[#0a0a0c] border-white/10 shadow-xl' : 'bg-white border-slate-200 shadow-md'
      }`}>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <thead className={`border-b text-zinc-400 font-semibold uppercase tracking-wider ${
              isDark ? 'bg-zinc-900/80 border-white/10' : 'bg-slate-100/90 border-slate-200 text-slate-600'
            }`}>
              <tr>
                <th className="px-4 py-3.5">{t('رقم القطعة', 'Part Number')}</th>
                <th className="px-4 py-3.5">{t('اسم القطعة / الشاسيه', 'Part Name / Chassis')}</th>
                <th className="px-4 py-3.5 text-center">{t('الكمية المطلوبة', 'Qty Req.')}</th>
                <th className="px-4 py-3.5 text-center">{t('درجة الأهمية', 'Urgency')}</th>
                <th className="px-4 py-3.5">{t('العميل / الورشة', 'Customer / Workshop')}</th>
                <th className="px-4 py-3.5 text-center">{t('الحالة', 'Status')}</th>
                <th className="px-4 py-3.5">{t('التاريخ', 'Date')}</th>
                <th className="px-4 py-3.5 text-center">{t('إجراءات', 'Actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {filteredShortages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <AlertOctagon className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
                    <p className={`text-base font-bold mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                      {t('سجل النواقص فارغ حالياً', 'Shortages list is currently empty')}
                    </p>
                    <p className="text-xs text-zinc-500 mb-4 max-w-md mx-auto">
                      {t('يمكنك تسجيل الأصناف غير المتوفرة أو طلبات العملاء العاجلة لإصدار أوامر التوريد والشراء', 'You can register out-of-stock parts and customer requests')}
                    </p>
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-500/20 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>{t('تسجيل صنف ناقص جديد الآن', 'Add Shortage Item Now')}</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredShortages.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    
                    {/* Part Number */}
                    <td className="px-4 py-3.5 font-mono font-bold text-rose-400">
                      {item.partNumber}
                    </td>

                    {/* Name & Chassis */}
                    <td className="px-4 py-3.5">
                      <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {item.nameAr}
                      </div>
                      {item.chassis && (
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-mono bg-zinc-800 text-emerald-400">
                          {item.chassis}
                        </span>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                          {item.notes}
                        </p>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-sm">
                      {item.requestedQty}
                    </td>

                    {/* Urgency */}
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        item.urgency === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : item.urgency === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}>
                        {item.urgency === 'HIGH' ? t('عاجل جدًا', 'High') : item.urgency === 'MEDIUM' ? t('متوسط', 'Medium') : t('عادي', 'Low')}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3.5">
                      {item.customerName ? (
                        <div>
                          <div className={`font-medium ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>{item.customerName}</div>
                          {item.customerPhone && (
                            <div className="text-[11px] text-zinc-400 font-mono">{item.customerPhone}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-500">{t('طلب مخزن عام', 'General Restock')}</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        item.status === 'PENDING'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : item.status === 'ORDERED'
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {item.status === 'PENDING' ? t('قيد الانتظار', 'Pending') : item.status === 'ORDERED' ? t('تم الطلب', 'Ordered') : t('تم الاستلام', 'Received')}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 text-zinc-400 font-mono text-[11px]">
                      {new Date(item.createdAt).toLocaleDateString('ar-EG')}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        
                        {item.status === 'PENDING' && onOpenCreatePO && (
                          <button
                            onClick={() => onOpenCreatePO(item)}
                            title={t('تحويل لأمر شراء', 'Create PO')}
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {item.status === 'PENDING' && (
                          <button
                            onClick={() => handleStatusChange(item.id, 'ORDERED')}
                            title={t('تحديد كـ تم الطلب', 'Mark Ordered')}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {item.status === 'ORDERED' && (
                          <button
                            onClick={() => handleStatusChange(item.id, 'RECEIVED')}
                            title={t('تحديد كـ تم الاستلام بالمخزن', 'Mark Received')}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEdit(item)}
                          title={t('تعديل بيانات الصنف', 'Edit')}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(item.id, item.nameAr)}
                          title={t('حذف من النواقص', 'Delete')}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Add Shortage Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
            isDark ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-slate-300'
          }`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-400" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('تسجيل صنف ناقص للمخزن / طلب عميل', 'Add Missing Part / Customer Shortage')}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateShortage} className="space-y-3.5">
              
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t('رقم القطعة (Mercedes Part Number)', 'Mercedes Part Number')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A2233302303"
                  value={newPartNumber}
                  onChange={(e) => handlePartNumberChange(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl text-xs font-mono font-bold uppercase border focus:outline-hidden ${
                    isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t('اسم القطعة وتوصيفها', 'Part Name & Description')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. طقم مقصات أمامية سفلية مرسيدس"
                  value={newNameAr}
                  onChange={(e) => setNewNameAr(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border focus:outline-hidden ${
                    isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('الشاسيه', 'Chassis')}
                  </label>
                  <input
                    type="text"
                    value={newChassis}
                    onChange={(e) => setNewChassis(e.target.value.toUpperCase())}
                    placeholder="W223, W213..."
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold uppercase border focus:outline-hidden ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('الكمية المطلوبة', 'Quantity')} *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(parseInt(e.target.value) || 1)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border focus:outline-hidden ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500'
                    }`}
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('درجة الأهمية', 'Urgency')}
                  </label>
                  <select
                    value={newUrgency}
                    onChange={(e) => setNewUrgency(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="HIGH">{t('عاجل جدًا', 'High')}</option>
                    <option value="MEDIUM">{t('متوسط', 'Medium')}</option>
                    <option value="LOW">{t('عادي', 'Low')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('اسم العميل / الورشة (اختياري)', 'Customer / Workshop')}
                  </label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g. مركز الأهرام لمرسيدس"
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-hidden ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('رقم الهاتف', 'Phone')}
                  </label>
                  <input
                    type="text"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="+20 1..."
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border focus:outline-hidden ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t('ملاحظات وتفاصيل إضافية', 'Notes')}
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. يفضل الأصلي وكالة أو ليمفوردر ألماني"
                  className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-hidden ${
                    isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500'
                  }`}
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 text-zinc-400 hover:text-white cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 cursor-pointer"
                >
                  {isSubmitting ? t('جاري الحفظ...', 'Saving...') : t('حفظ في قائمة النواقص', 'Save Shortage')}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Edit Shortage Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
            isDark ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-slate-300'
          }`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('تعديل بيانات الصنف في سجل النواقص', 'Edit Shortage Item')}
                </h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateShortage} className="space-y-3.5">
              
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t('رقم القطعة', 'Mercedes Part Number')} *
                </label>
                <input
                  type="text"
                  required
                  value={editPartNumber}
                  onChange={(e) => setEditPartNumber(e.target.value.toUpperCase())}
                  className={`w-full px-3.5 py-2 rounded-xl text-xs font-mono font-bold uppercase border focus:outline-hidden ${
                    isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-amber-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t('اسم القطعة وتوصيفها', 'Part Name & Description')} *
                </label>
                <input
                  type="text"
                  required
                  value={editNameAr}
                  onChange={(e) => setEditNameAr(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border focus:outline-hidden ${
                    isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-amber-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('الشاسيه', 'Chassis')}
                  </label>
                  <input
                    type="text"
                    value={editChassis}
                    onChange={(e) => setEditChassis(e.target.value.toUpperCase())}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold uppercase border focus:outline-hidden ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('الكمية', 'Quantity')} *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editQty}
                    onChange={(e) => setEditQty(parseInt(e.target.value) || 1)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border focus:outline-hidden ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('درجة الأهمية', 'Urgency')}
                  </label>
                  <select
                    value={editUrgency}
                    onChange={(e) => setEditUrgency(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="HIGH">{t('عاجل جدًا', 'High')}</option>
                    <option value="MEDIUM">{t('متوسط', 'Medium')}</option>
                    <option value="LOW">{t('عادي', 'Low')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t('حالة الطلب', 'Status')}
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                    isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="PENDING">{t('قيد الانتظار (Pending)', 'Pending')}</option>
                  <option value="ORDERED">{t('تم إدراجها بأمر شراء (Ordered)', 'Ordered')}</option>
                  <option value="RECEIVED">{t('تم التوريد للمخزن (Received)', 'Received')}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('اسم العميل / الورشة', 'Customer')}
                  </label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-hidden ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('رقم الهاتف', 'Phone')}
                  </label>
                  <input
                    type="text"
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border focus:outline-hidden ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t('ملاحظات', 'Notes')}
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-hidden ${
                    isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 text-zinc-400 hover:text-white cursor-pointer"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs shadow-md cursor-pointer"
                >
                  {isSubmitting ? t('جاري الحفظ...', 'Saving...') : t('حفظ التعديلات', 'Update Shortage')}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
