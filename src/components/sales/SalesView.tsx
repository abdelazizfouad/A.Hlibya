import React, { useState } from 'react';
import { 
  ShoppingCart, 
  PlusCircle, 
  Search, 
  CheckCircle2, 
  Eye, 
  Printer, 
  User, 
  Phone, 
  CreditCard, 
  DollarSign, 
  Trash2, 
  MapPin, 
  FileText,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';
import { SalesInvoice, Customer, PartMaster, InventoryItem } from '../../types/erp';
import { 
  createSalesInvoice,
  deleteSalesInvoice,
  clearAllSalesInvoices
} from '../../lib/firestoreService';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';
import { formatEGP } from '../../lib/formatters';

interface SalesViewProps {
  salesInvoices: SalesInvoice[];
  customers: Customer[];
  parts: PartMaster[];
  inventory: InventoryItem[];
}

export const SalesView: React.FC<SalesViewProps> = ({
  salesInvoices,
  customers,
  parts,
  inventory
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { language, t } = useLanguage();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [customCustomerPhone, setCustomCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [discount, setDiscount] = useState(0);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Invoice for printing / details
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);

  // Available in-stock parts for selling
  const availableParts = parts.filter(p => p.totalStock > 0);

  const getPartLocation = (partId: string): string => {
    const invWithStock = (inventory || []).find(i => i.partId === partId && Number(i.quantity || 0) > 0);
    if (invWithStock?.locationCode) return invWithStock.locationCode;
    const anyInv = (inventory || []).find(i => i.partId === partId);
    if (anyInv?.locationCode) return anyInv.locationCode;
    return 'A-01-01-01';
  };

  const [saleItems, setSaleItems] = useState<Array<{
    partId: string;
    partNumber: string;
    nameAr: string;
    quantity: number;
    unitPrice: number;
    locationCode: string;
    maxStock: number;
  }>>([
    {
      partId: availableParts[0]?.id || '',
      partNumber: availableParts[0]?.partNumber || '',
      nameAr: availableParts[0]?.nameAr || '',
      quantity: 1,
      unitPrice: availableParts[0]?.sellingPrice || 1000,
      locationCode: availableParts[0] ? getPartLocation(availableParts[0].id) : 'A-01-01-01',
      maxStock: availableParts[0]?.totalStock || 1
    }
  ]);

  const handleAddItemRow = () => {
    const p = availableParts[0];
    if (!p) return;
    setSaleItems([
      ...saleItems,
      {
        partId: p.id,
        partNumber: p.partNumber,
        nameAr: p.nameAr,
        quantity: 1,
        unitPrice: p.sellingPrice,
        locationCode: getPartLocation(p.id),
        maxStock: p.totalStock
      }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setSaleItems(saleItems.filter((_, i) => i !== idx));
  };

  const handlePartSelect = (idx: number, partId: string) => {
    const selected = parts.find(p => p.id === partId);
    if (!selected) return;

    const loc = getPartLocation(partId);

    const updated = [...saleItems];
    updated[idx] = {
      ...updated[idx],
      partId: selected.id,
      partNumber: selected.partNumber,
      nameAr: selected.nameAr,
      unitPrice: selected.sellingPrice,
      maxStock: selected.totalStock,
      locationCode: loc,
      quantity: Math.min(updated[idx].quantity, selected.totalStock || 1)
    };
    setSaleItems(updated);
  };

  const subtotal = saleItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalAmount = Math.max(0, subtotal - discount);

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate quantities
    for (const item of saleItems) {
      if (item.quantity > item.maxStock) {
        setError(t(`الكمية المطلوبة للقطعة ${item.partNumber} تتجاوز الرصيد المتاح (${item.maxStock})`, `Quantity for ${item.partNumber} exceeds available stock (${item.maxStock})`));
        return;
      }
    }

    const customerObj = customers.find(c => c.id === selectedCustomerId);
    const customerName = customCustomerName.trim() || (customerObj ? (customerObj.workshopName || customerObj.name) : 'عميل قطاعي');
    const customerPhone = customCustomerPhone.trim() || (customerObj ? customerObj.phone : undefined);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    setIsSubmitting(true);
    try {
      const invId = await createSalesInvoice({
        invoiceNumber,
        customerId: customerObj ? customerObj.id : undefined,
        customerName,
        customerPhone,
        branchId: 'branch_elharefeyin',
        warehouseId: 'wh_elharefeyin_main',
        status: 'COMPLETED',
        items: saleItems.map(item => ({
          partId: item.partId,
          partNumber: item.partNumber,
          nameAr: item.nameAr,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          locationCode: item.locationCode
        })),
        subtotal,
        discount,
        totalAmount,
        paymentMethod,
        currency: 'EGP',
        createdDate: new Date().toISOString(),
        notes: invoiceNotes.trim() || undefined,
        userId: user?.id || 'admin',
        userName: user?.displayName || 'المسؤول'
      }, {
        id: user?.id || 'admin',
        name: user?.displayName || 'المسؤول'
      });

      setIsCreateModalOpen(false);
      setDiscount(0);
      setInvoiceNotes('');
      setCustomCustomerName('');
      setCustomCustomerPhone('');
    } catch (err: any) {
      setError(err.message || 'Error issuing sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvoices = (salesInvoices || []).filter(inv => {
    const term = searchTerm.toLowerCase();
    return (
      (inv.invoiceNumber || '').toLowerCase().includes(term) ||
      (inv.customerName || '').toLowerCase().includes(term) ||
      (inv.items || []).some(i => (i.partNumber || '').toLowerCase().includes(term) || (i.nameAr || '').toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('إدارة المبيعات وفواتير الصرف (Sales & Stock OUT)', 'Sales Invoicing & Stock OUT')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            {t('إصدار فواتير بيع قطع الغيار وخصم الأرصدة آليًا من أرفف المستودع بالجنيه المصري (EGP)', 'Issue sales invoices and automatically decrement shelf stock in EGP')}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('إصدار فاتورة بيع جديدة', 'New Sales Invoice')}</span>
          </button>

          {salesInvoices.length > 0 && (
            <button
              onClick={async () => {
                if (window.confirm('هل أنت متأكد من تفريغ ومسح كافة فواتير المبيعات بالكامل؟')) {
                  await clearAllSalesInvoices();
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('تفريغ كافة فواتير المبيعات', 'Clear All Invoices')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
        isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('بحث برقم الفاتورة، العميل، رقم القطعة...', 'Search invoice, customer, part...')}
            className={`w-full px-4 py-2 rounded-xl text-xs border transition-all focus:outline-hidden ${
              isDark
                ? 'bg-zinc-900 border-white/10 text-white focus:border-emerald-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
            }`}
          />
          <Search className={`w-3.5 h-3.5 absolute top-2.5 text-zinc-400 ${language === 'ar' ? 'left-3' : 'right-3'}`} />
        </div>

        <div className="text-xs text-zinc-400 font-medium">
          {t('إجمالي الفواتير الصادرة:', 'Total Invoices:')} <strong className="text-white dark:text-white font-mono">{filteredInvoices.length}</strong>
        </div>
      </div>

      {/* Invoices Table */}
      <div className={`rounded-2xl border overflow-hidden transition-all ${
        isDark ? 'bg-[#0a0a0c] border-white/10 shadow-xl' : 'bg-white border-slate-200 shadow-md'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <thead className={`border-b text-zinc-400 font-semibold uppercase tracking-wider ${
              isDark ? 'bg-zinc-900/80 border-white/10' : 'bg-slate-100/90 border-slate-200 text-slate-600'
            }`}>
              <tr>
                <th className="px-4 py-3.5">{t('رقم الفاتورة', 'Invoice#')}</th>
                <th className="px-4 py-3.5">{t('العميل / الورشة', 'Customer / Workshop')}</th>
                <th className="px-4 py-3.5">{t('القطع المباعة', 'Items Sold')}</th>
                <th className="px-4 py-3.5 text-center">{t('طريقة الدفع', 'Payment')}</th>
                <th className="px-4 py-3.5 text-center">{t('الإجمالي (EGP)', 'Total (EGP)')}</th>
                <th className="px-4 py-3.5">{t('التاريخ', 'Date')}</th>
                <th className="px-4 py-3.5 text-center">{t('إجراءات', 'Actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    <ShoppingCart className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                    <p className="text-sm font-semibold">{t('لا توجد فواتير مبيعات مسجلة', 'No sales invoices found')}</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                    
                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-400">
                      {inv.invoiceNumber}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white dark:text-white">{inv.customerName}</div>
                      {inv.customerPhone && (
                        <div className="text-[11px] text-zinc-400 font-mono">{inv.customerPhone}</div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-zinc-200">
                        {(inv.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0)} {t('قطعة', 'units')}
                      </span>
                      <span className="text-[11px] text-zinc-400 block">
                        ({(inv.items || []).map(i => i.partNumber).join(', ')})
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {inv.paymentMethod === 'CASH' ? t('كاش نقدي', 'Cash') : inv.paymentMethod === 'BANK_TRANSFER' ? t('تحويل بنكي', 'Bank Transfer') : t('شيك بنكي', 'Cheque')}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-400 text-sm">
                      {formatEGP(inv.totalAmount)}
                    </td>

                    <td className="px-4 py-3.5 text-zinc-400 font-mono text-[11px]">
                      {new Date(inv.createdDate).toLocaleDateString('ar-EG')}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          title={t('عرض وطباعة الفاتورة', 'View / Print Invoice')}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm(`هل أنت متأكد من حذف فاتورة المبيعات #${inv.invoiceNumber}؟`)) {
                              await deleteSalesInvoice(inv.id);
                            }
                          }}
                          title={t('حذف الفاتورة', 'Delete Invoice')}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer"
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

      {/* Create Sales Invoice Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-slate-300'
          }`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('إصدار فاتورة صرف ومبيعات جديدة', 'Issue New Sales Invoice')}
                </h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-white p-1 rounded-lg">✕</button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateSale} className="space-y-4">
              
              {/* Customer Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('العميل / الورشة المسجلة', 'Registered Workshop / Customer')}
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.workshopName || c.name}
                      </option>
                    ))}
                    <option value="OTHER">{t('عميل قطاعي / جهة أخرى', 'Walk-in / Other')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('طريقة الدفع', 'Payment Method')}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="CASH">{t('كاش نقدي', 'Cash')}</option>
                    <option value="BANK_TRANSFER">{t('تحويل بنكي / فودافون كاش', 'Bank / Wallet Transfer')}</option>
                    <option value="CHEQUE">{t('شيك بنكي معتمد', 'Certified Cheque')}</option>
                  </select>
                </div>
              </div>

              {/* Items Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-300">
                    {t('القطع المراد بيعها وصرفها من الرفوف', 'Parts to Sell & Decrement from Shelf')}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{t('إضافة قطعة أخرى', 'Add Another Part')}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {saleItems.map((item, idx) => (
                    <div key={idx} className={`p-3 rounded-xl border grid grid-cols-12 gap-2 items-center ${
                      isDark ? 'bg-zinc-900/60 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}>
                      
                      <div className="col-span-5">
                        <select
                          value={item.partId}
                          onChange={(e) => handlePartSelect(idx, e.target.value)}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                            isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          {parts.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.partNumber} ({p.totalStock} متاح)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          min={1}
                          max={item.maxStock}
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...saleItems];
                            updated[idx].quantity = parseInt(e.target.value) || 1;
                            setSaleItems(updated);
                          }}
                          placeholder={t('الكمية', 'Qty')}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono font-bold text-center border ${
                            isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const updated = [...saleItems];
                            updated[idx].unitPrice = parseFloat(e.target.value) || 0;
                            setSaleItems(updated);
                          }}
                          placeholder={t('السعر', 'Price')}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono font-bold text-center border ${
                            isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>

                      <div className="col-span-2 text-center font-mono text-xs text-emerald-400 font-bold">
                        {formatEGP(item.quantity * item.unitPrice)}
                      </div>

                      <div className="col-span-1 text-center">
                        {saleItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-1 rounded-md text-zinc-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              {/* Summary and Discount */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    {t('الخصم الممنوح (EGP)', 'Discount (EGP)')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border ${
                      isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className={`p-3 rounded-xl border flex flex-col justify-center ${
                  isDark ? 'bg-zinc-900 border-white/10' : 'bg-slate-100 border-slate-300'
                }`}>
                  <span className="text-[11px] text-zinc-400">{t('الصافي المطلوب سداده:', 'Net Amount Due:')}</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">{formatEGP(totalAmount)}</span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 text-zinc-400 hover:text-white"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20"
                >
                  {isSubmitting ? t('جاري الصرف...', 'Processing...') : t('اعتماد وصرف الفاتورة', 'Issue Sales Invoice')}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Invoice Print Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white text-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            {/* Invoice Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">AH.Libya Store</h2>
                <p className="text-xs text-slate-600 font-medium">مستودع قطع غيار مرسيدس-بنز — فرع الحرفيين، القاهرة</p>
                <p className="text-xs text-slate-500 font-mono">هاتف: +20 100 234 5678</p>
              </div>
              <div className="text-left font-mono">
                <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold block mb-1">فاتورة مبيعات معتمدة</span>
                <span className="text-sm font-bold text-slate-900">{selectedInvoice.invoiceNumber}</span>
                <p className="text-[11px] text-slate-500">{new Date(selectedInvoice.createdDate).toLocaleDateString('ar-EG')}</p>
              </div>
            </div>

            {/* Customer Info */}
            <div className="py-3 border-b border-slate-200 text-xs">
              <span className="text-slate-500">العميل / الجهة:</span> <strong className="text-slate-900 mr-2">{selectedInvoice.customerName}</strong>
              {selectedInvoice.customerPhone && (
                <span className="text-slate-600 font-mono mr-3">({selectedInvoice.customerPhone})</span>
              )}
            </div>

            {/* Items */}
            <div className="py-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 font-bold">
                    <th className="pb-2 text-right">الصنف / رقم القطعة</th>
                    <th className="pb-2 text-center">الكمية</th>
                    <th className="pb-2 text-center">السعر</th>
                    <th className="pb-2 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoice.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-2.5">
                        <div className="font-bold text-slate-900">{it.nameAr}</div>
                        <div className="text-slate-500 font-mono">{it.partNumber} (الرف: {it.locationCode})</div>
                      </td>
                      <td className="py-2.5 text-center font-bold font-mono">{it.quantity}</td>
                      <td className="py-2.5 text-center font-mono">{formatEGP(it.unitPrice)}</td>
                      <td className="py-2.5 text-left font-bold font-mono text-emerald-700">{formatEGP(it.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="pt-3 border-t border-slate-200 space-y-1 text-xs text-right">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي:</span>
                <span className="font-mono font-bold">{formatEGP(selectedInvoice.subtotal)}</span>
              </div>
              {selectedInvoice.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>الخصم الممنوح:</span>
                  <span className="font-mono font-bold">-{formatEGP(selectedInvoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>الصافي الإجمالي (EGP):</span>
                <span className="font-mono text-emerald-700">{formatEGP(selectedInvoice.totalAmount)}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الفاتورة</span>
              </button>

              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
