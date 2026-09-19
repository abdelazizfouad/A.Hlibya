import React, { useState } from 'react';
import { 
  Users, 
  Building2, 
  Wrench, 
  PlusCircle, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Star, 
  FileText, 
  CheckCircle2,
  Globe,
  Briefcase,
  Trash2,
  Edit3
} from 'lucide-react';
import { Supplier, Customer } from '../../types/erp';
import { 
  addSupplier, 
  updateSupplier, 
  deleteSupplier, 
  addCustomer, 
  updateCustomer, 
  deleteCustomer 
} from '../../lib/firestoreService';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';

interface PartnersViewProps {
  suppliers: Supplier[];
  customers: Customer[];
}

export const PartnersView: React.FC<PartnersViewProps> = ({
  suppliers,
  customers
}) => {
  const { isDark } = useTheme();
  const { language, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'SUPPLIERS' | 'CUSTOMERS'>('SUPPLIERS');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Add Supplier Modal
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supCompany, setSupCompany] = useState('');
  const [supCountry, setSupCountry] = useState('ألمانيا');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supTax, setSupTax] = useState('');
  const [supNotes, setSupNotes] = useState('');

  // Edit Supplier Modal
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editSupName, setEditSupName] = useState('');
  const [editSupCompany, setEditSupCompany] = useState('');
  const [editSupCountry, setEditSupCountry] = useState('ألمانيا');
  const [editSupPhone, setEditSupPhone] = useState('');
  const [editSupEmail, setEditSupEmail] = useState('');
  const [editSupTax, setEditSupTax] = useState('');
  const [editSupNotes, setEditSupNotes] = useState('');

  // Add Customer Modal
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custWorkshop, setCustWorkshop] = useState('');
  const [custType, setCustType] = useState<'WORKSHOP' | 'INDIVIDUAL'>('WORKSHOP');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custNotes, setCustNotes] = useState('');

  // Edit Customer Modal
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustWorkshop, setEditCustWorkshop] = useState('');
  const [editCustType, setEditCustType] = useState<'WORKSHOP' | 'INDIVIDUAL'>('WORKSHOP');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustEmail, setEditCustEmail] = useState('');
  const [editCustAddress, setEditCustAddress] = useState('');
  const [editCustNotes, setEditCustNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;

    setIsSubmitting(true);
    try {
      await addSupplier({
        name: supName.trim(),
        companyName: supCompany.trim() || undefined,
        country: supCountry.trim(),
        city: 'شتوتغارت',
        phone: supPhone.trim(),
        email: supEmail.trim() || undefined,
        address: 'ألمانيا',
        taxNumber: supTax.trim() || undefined,
        rating: 5,
        notes: supNotes.trim() || undefined,
        totalOrdersCount: 0
      });
      setIsAddSupplierOpen(false);
      setSupName('');
      setSupCompany('');
      setSupPhone('');
      setSupEmail('');
      setSupNotes('');
      showToast(t('تمت إضافة المورد بنجاح!', 'Supplier added successfully!'));
    } catch (err: any) {
      console.error('Error adding supplier:', err);
      showToast(t('خطأ أثناء إضافة المورد: ', 'Error: ') + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setEditSupName(sup.name);
    setEditSupCompany(sup.companyName || '');
    setEditSupCountry(sup.country || 'ألمانيا');
    setEditSupPhone(sup.phone || '');
    setEditSupEmail(sup.email || '');
    setEditSupTax(sup.taxNumber || '');
    setEditSupNotes(sup.notes || '');
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier || !editSupName.trim()) return;

    setIsSubmitting(true);
    try {
      await updateSupplier(editingSupplier.id, {
        name: editSupName.trim(),
        companyName: editSupCompany.trim() || undefined,
        country: editSupCountry.trim(),
        phone: editSupPhone.trim(),
        email: editSupEmail.trim() || undefined,
        taxNumber: editSupTax.trim() || undefined,
        notes: editSupNotes.trim() || undefined
      });
      setEditingSupplier(null);
      showToast(t('تم تحديث بيانات المورد بنجاح!', 'Supplier updated successfully!'));
    } catch (err: any) {
      console.error('Error updating supplier:', err);
      showToast(t('خطأ أثناء تعديل المورد: ', 'Error: ') + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSupplier = async (sup: Supplier) => {
    if (!window.confirm(t(`هل أنت متأكد من حذف المورد "${sup.name}"؟`, `Delete supplier "${sup.name}"?`))) {
      return;
    }
    try {
      await deleteSupplier(sup.id);
      showToast(t('تم حذف المورد بنجاح.', 'Supplier deleted.'));
    } catch (err: any) {
      console.error('Error deleting supplier:', err);
      showToast(t('خطأ أثناء الحذف: ', 'Error: ') + err.message, 'error');
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) return;

    setIsSubmitting(true);
    try {
      await addCustomer({
        name: custName.trim(),
        workshopName: custWorkshop.trim() || undefined,
        type: custType,
        phone: custPhone.trim(),
        email: custEmail.trim() || undefined,
        address: custAddress.trim() || undefined,
        notes: custNotes.trim() || undefined,
        totalOrdersCount: 0
      });
      setIsAddCustomerOpen(false);
      setCustName('');
      setCustWorkshop('');
      setCustPhone('');
      setCustEmail('');
      setCustAddress('');
      setCustNotes('');
      showToast(t('تمت إضافة العميل بنجاح!', 'Customer added successfully!'));
    } catch (err: any) {
      console.error('Error adding customer:', err);
      showToast(t('خطأ أثناء إضافة العميل: ', 'Error: ') + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditCustomer = (cust: Customer) => {
    setEditingCustomer(cust);
    setEditCustName(cust.name);
    setEditCustWorkshop(cust.workshopName || '');
    setEditCustType(cust.type);
    setEditCustPhone(cust.phone || '');
    setEditCustEmail(cust.email || '');
    setEditCustAddress(cust.address || '');
    setEditCustNotes(cust.notes || '');
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editCustName.trim()) return;

    setIsSubmitting(true);
    try {
      await updateCustomer(editingCustomer.id, {
        name: editCustName.trim(),
        workshopName: editCustWorkshop.trim() || undefined,
        type: editCustType,
        phone: editCustPhone.trim(),
        email: editCustEmail.trim() || undefined,
        address: editCustAddress.trim() || undefined,
        notes: editCustNotes.trim() || undefined
      });
      setEditingCustomer(null);
      showToast(t('تم تحديث بيانات العميل بنجاح!', 'Customer updated successfully!'));
    } catch (err: any) {
      console.error('Error updating customer:', err);
      showToast(t('خطأ أثناء تعديل العميل: ', 'Error: ') + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (cust: Customer) => {
    if (!window.confirm(t(`هل أنت متأكد من حذف العميل "${cust.workshopName || cust.name}"؟`, `Delete customer "${cust.workshopName || cust.name}"?`))) {
      return;
    }
    try {
      await deleteCustomer(cust.id);
      showToast(t('تم حذف العميل بنجاح.', 'Customer deleted.'));
    } catch (err: any) {
      console.error('Error deleting customer:', err);
      showToast(t('خطأ أثناء الحذف: ', 'Error: ') + err.message, 'error');
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    const term = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term) || (s.companyName && s.companyName.toLowerCase().includes(term)) || s.country.toLowerCase().includes(term);
  });

  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(term) || (c.workshopName && c.workshopName.toLowerCase().includes(term)) || c.phone.includes(term);
  });

  return (
    <div className="space-y-6">
      
      {/* Toast Feedback */}
      {feedback && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold border ${
          feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-zinc-400 hover:text-white px-2">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
            <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('دليل الموردين والعملاء (Partners & Contacts)', 'Suppliers & Customers Directory')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            {t('إدارة وكلاء التوريد الرسميين، ومراكز الخدمة والورش والعملاء المعتمدين', 'Manage authorized suppliers, workshops, and certified customers')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'SUPPLIERS' ? (
            <button
              onClick={() => setIsAddSupplierOpen(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('إضافة مورد معتمد جديد', 'Add Supplier')}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddCustomerOpen(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('إضافة ورشة / عميل جديد', 'Add Workshop/Customer')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher & Search */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        
        {/* Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-white/10 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('SUPPLIERS')}
            className={`flex-1 sm:flex-none px-5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SUPPLIERS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t('الموردين والوكلاء', 'Suppliers')} ({suppliers.length})
          </button>
          <button
            onClick={() => setActiveTab('CUSTOMERS')}
            className={`flex-1 sm:flex-none px-5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'CUSTOMERS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t('الورش والعملاء', 'Customers')} ({customers.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeTab === 'SUPPLIERS' ? t('بحث في الموردين...', 'Search suppliers...') : t('بحث في العملاء والورش...', 'Search customers...')}
            className={`w-full px-4 py-2 rounded-xl text-xs border transition-all focus:outline-hidden ${
              isDark
                ? 'bg-zinc-900 border-white/10 text-white focus:border-blue-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
            }`}
          />
          <Search className={`w-3.5 h-3.5 absolute top-2.5 text-zinc-400 ${language === 'ar' ? 'left-3' : 'right-3'}`} />
        </div>

      </div>

      {/* Content Grid */}
      {activeTab === 'SUPPLIERS' ? (
        filteredSuppliers.length === 0 ? (
          <div className={`p-12 text-center rounded-2xl border ${isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200'}`}>
            <Building2 className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
            <p className={`text-base font-bold mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
              {suppliers.length === 0 ? 'لا يوجد موردين مسجلين حالياً' : 'لا توجد نتائج بحث مطابقة'}
            </p>
            <p className="text-xs text-zinc-500 mb-4 max-w-sm mx-auto">
              يمكنك إضافة وكلاء التوريد ومستوردي قطع مرسيدس مباشرة للبدء بإصدار أوامر الشراء.
            </p>
            <button
              onClick={() => setIsAddSupplierOpen(true)}
              className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              + إضافة أول مورد
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((sup) => (
              <div key={sup.id} className={`p-5 rounded-2xl border transition-all ${
                isDark ? 'bg-[#0a0a0c] border-white/10 hover:border-blue-500/30' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditSupplier(sup)}
                      title="تعديل"
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSupplier(sup)}
                      title="حذف"
                      className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className={`text-sm font-bold mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {sup.name}
                </h3>
                {sup.companyName && (
                  <p className="text-xs text-zinc-400 mb-3">{sup.companyName}</p>
                )}

                <div className="space-y-1.5 text-xs text-zinc-400 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{sup.country}</span>
                  </div>
                  {sup.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="font-mono">{sup.phone}</span>
                    </div>
                  )}
                  {sup.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="font-mono truncate">{sup.email}</span>
                    </div>
                  )}
                  {sup.notes && (
                    <p className="text-[11px] text-zinc-500 pt-1 line-clamp-2">{sup.notes}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{t('أوامر الشراء المسجلة:', 'Total POs:')}</span>
                  <span className="font-mono font-bold text-blue-400">{sup.totalOrdersCount}</span>
                </div>

              </div>
            ))}
          </div>
        )
      ) : (
        filteredCustomers.length === 0 ? (
          <div className={`p-12 text-center rounded-2xl border ${isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200'}`}>
            <Wrench className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
            <p className={`text-base font-bold mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
              {customers.length === 0 ? 'لا يوجد عملاء أو ورش مسجلة حالياً' : 'لا توجد نتائج بحث مطابقة'}
            </p>
            <p className="text-xs text-zinc-500 mb-4 max-w-sm mx-auto">
              يمكنك إضافة ورش الصيانة ومراكز خدمة مرسيدس لإصدار فواتير المبيعات مباشرة.
            </p>
            <button
              onClick={() => setIsAddCustomerOpen(true)}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              + إضافة أول ورشة / عميل
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((cust) => (
              <div key={cust.id} className={`p-5 rounded-2xl border transition-all ${
                isDark ? 'bg-[#0a0a0c] border-white/10 hover:border-emerald-500/30' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      cust.type === 'WORKSHOP'
                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}>
                      {cust.type === 'WORKSHOP' ? t('مركز صيانة', 'Workshop') : t('عميل فردي', 'Individual')}
                    </span>
                    <button
                      onClick={() => handleOpenEditCustomer(cust)}
                      title="تعديل"
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(cust)}
                      title="حذف"
                      className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className={`text-sm font-bold mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {cust.workshopName || cust.name}
                </h3>
                {cust.workshopName && cust.name && (
                  <p className="text-xs text-zinc-400 mb-3">{t('المسؤول:', 'Contact:')} {cust.name}</p>
                )}

                <div className="space-y-1.5 text-xs text-zinc-400 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-mono">{cust.phone}</span>
                  </div>
                  {cust.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="truncate">{cust.address}</span>
                    </div>
                  )}
                  {cust.notes && (
                    <p className="text-[11px] text-zinc-500 pt-1 line-clamp-2">{cust.notes}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{t('فواتير المبيعات:', 'Sales Count:')}</span>
                  <span className="font-mono font-bold text-emerald-400">{cust.totalOrdersCount}</span>
                </div>

              </div>
            ))}
          </div>
        )
      )}

      {/* Add Supplier Modal */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
            isDark ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-slate-300'
          }`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('إضافة مورد معتمد جديد', 'Add New Supplier')}</h3>
              <button onClick={() => setIsAddSupplierOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('اسم المورد / الوكيل', 'Supplier Name')} *</label>
                <input required value={supName} onChange={e => setSupName(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('الشركة / جهة التوريد', 'Company')}</label>
                <input value={supCompany} onChange={e => setSupCompany(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">{t('بلد التوريد', 'Country')}</label>
                  <input value={supCountry} onChange={e => setSupCountry(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">{t('الهاتف', 'Phone')}</label>
                  <input value={supPhone} onChange={e => setSupPhone(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs font-mono border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('البريد الإلكتروني', 'Email')}</label>
                <input type="email" value={supEmail} onChange={e => setSupEmail(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs font-mono border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddSupplierOpen(false)} className="px-3 py-1.5 text-xs text-zinc-400">{t('إلغاء', 'Cancel')}</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">{t('حفظ المورد', 'Save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
            isDark ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-slate-300'
          }`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('تعديل بيانات المورد', 'Edit Supplier')}</h3>
              <button onClick={() => setEditingSupplier(null)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleUpdateSupplier} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('اسم المورد / الوكيل', 'Supplier Name')} *</label>
                <input required value={editSupName} onChange={e => setEditSupName(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('الشركة', 'Company')}</label>
                <input value={editSupCompany} onChange={e => setEditSupCompany(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">{t('بلد التوريد', 'Country')}</label>
                  <input value={editSupCountry} onChange={e => setEditSupCountry(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">{t('الهاتف', 'Phone')}</label>
                  <input value={editSupPhone} onChange={e => setEditSupPhone(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs font-mono border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('البريد الإلكتروني', 'Email')}</label>
                <input type="email" value={editSupEmail} onChange={e => setEditSupEmail(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs font-mono border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingSupplier(null)} className="px-3 py-1.5 text-xs text-zinc-400">{t('إلغاء', 'Cancel')}</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">{t('حفظ التعديلات', 'Update')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
            isDark ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-slate-300'
          }`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('إضافة ورشة / عميل صيانة جديد', 'Add New Workshop/Customer')}</h3>
              <button onClick={() => setIsAddCustomerOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('اسم ورشة الصيانة / المركز', 'Workshop Name')}</label>
                <input value={custWorkshop} onChange={e => setCustWorkshop(e.target.value)} placeholder="مركز النجم الفضي..." className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('اسم المهندس / المسؤول', 'Contact Name')} *</label>
                <input required value={custName} onChange={e => setCustName(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">{t('رقم الهاتف / الواتساب', 'Phone')} *</label>
                  <input required value={custPhone} onChange={e => setCustPhone(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs font-mono border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">{t('نوع العميل', 'Type')}</label>
                  <select value={custType} onChange={e => setCustType(e.target.value as any)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}>
                    <option value="WORKSHOP">{t('مركز صيانة', 'Workshop')}</option>
                    <option value="INDIVIDUAL">{t('عميل خاص', 'Individual')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('العنوان وملاحظات النشاط', 'Address & Notes')}</label>
                <input value={custAddress} onChange={e => setCustAddress(e.target.value)} placeholder="الحرفيين، القاهرة..." className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddCustomerOpen(false)} className="px-3 py-1.5 text-xs text-zinc-400">{t('إلغاء', 'Cancel')}</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">{t('حفظ العميل', 'Save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
            isDark ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-slate-300'
          }`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('تعديل بيانات العميل / الورشة', 'Edit Customer')}</h3>
              <button onClick={() => setEditingCustomer(null)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleUpdateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('اسم ورشة الصيانة / المركز', 'Workshop Name')}</label>
                <input value={editCustWorkshop} onChange={e => setEditCustWorkshop(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('اسم المهندس / المسؤول', 'Contact Name')} *</label>
                <input required value={editCustName} onChange={e => setEditCustName(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">{t('رقم الهاتف', 'Phone')} *</label>
                  <input required value={editCustPhone} onChange={e => setEditCustPhone(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs font-mono border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">{t('نوع العميل', 'Type')}</label>
                  <select value={editCustType} onChange={e => setEditCustType(e.target.value as any)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}>
                    <option value="WORKSHOP">{t('مركز صيانة', 'Workshop')}</option>
                    <option value="INDIVIDUAL">{t('عميل خاص', 'Individual')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1">{t('العنوان وملاحظات النشاط', 'Address & Notes')}</label>
                <input value={editCustAddress} onChange={e => setEditCustAddress(e.target.value)} className={`w-full px-3 py-2 rounded-xl text-xs border ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`} />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingCustomer(null)} className="px-3 py-1.5 text-xs text-zinc-400">{t('إلغاء', 'Cancel')}</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">{t('حفظ التعديلات', 'Update')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
