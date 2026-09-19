import React, { useState } from 'react';
import { 
  Truck, 
  PlusCircle, 
  Search, 
  CheckCircle2, 
  Clock, 
  ArrowDownToLine, 
  Eye, 
  MapPin, 
  DollarSign, 
  Calendar, 
  User, 
  Printer, 
  Building2,
  Trash2,
  Boxes
} from 'lucide-react';
import { PurchaseOrder, Supplier, PartMaster, WarehouseLocation } from '../../types/erp';
import { 
  createPurchaseOrder, 
  receivePurchaseOrder,
  deletePurchaseOrder,
  clearAllPurchaseOrders
} from '../../lib/firestoreService';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';
import { formatEGP } from '../../lib/formatters';

interface PurchasesViewProps {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  parts: PartMaster[];
  locations: WarehouseLocation[];
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  purchaseOrders,
  suppliers,
  parts,
  locations
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { language, t } = useLanguage();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create PO modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [poNotes, setPoNotes] = useState('');
  const [orderItems, setOrderItems] = useState<Array<{
    partId: string;
    partNumber: string;
    nameAr: string;
    quantity: number;
    costPrice: number;
    locationCode: string;
  }>>([
    {
      partId: parts[0]?.id || '',
      partNumber: parts[0]?.partNumber || '',
      nameAr: parts[0]?.nameAr || '',
      quantity: 5,
      costPrice: parts[0]?.costPrice || 1000,
      locationCode: locations[0]?.code || 'A-01-01-01'
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected PO details modal
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  const handleAddItemRow = () => {
    const defaultPart = parts[0];
    setOrderItems([
      ...orderItems,
      {
        partId: defaultPart ? defaultPart.id : '',
        partNumber: defaultPart ? defaultPart.partNumber : '',
        nameAr: defaultPart ? defaultPart.nameAr : '',
        quantity: 2,
        costPrice: defaultPart ? defaultPart.costPrice : 1000,
        locationCode: locations[0]?.code || 'A-01-01-01'
      }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  };

  const handlePartSelect = (idx: number, partId: string) => {
    const selected = parts.find(p => p.id === partId);
    if (!selected) return;

    const updated = [...orderItems];
    updated[idx] = {
      ...updated[idx],
      partId: selected.id,
      partNumber: selected.partNumber,
      nameAr: selected.nameAr,
      costPrice: selected.costPrice
    };
    setOrderItems(updated);
  };

  const totalOrderAmount = orderItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) return;

    const sup = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];
    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    setIsSubmitting(true);
    try {
      await createPurchaseOrder({
        poNumber,
        supplierId: sup ? sup.id : 'sup_01',
        supplierName: sup ? sup.name : 'دايملر شتوتغارت المباشرة',
        branchId: 'branch_elharefeyin',
        warehouseId: 'wh_elharefeyin_main',
        status: 'ORDERED',
        items: orderItems.map(item => ({
          ...item,
          totalCost: item.quantity * item.costPrice
        })),
        totalAmount: totalOrderAmount,
        currency: 'EGP',
        createdDate: new Date().toISOString(),
        notes: poNotes.trim() || undefined,
        userId: user?.id || 'admin',
        userName: user?.displayName || 'المسؤول'
      });

      setIsCreateModalOpen(false);
      setPoNotes('');
    } catch (err) {
      console.error('Error creating purchase order:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceivePO = async (po: PurchaseOrder) => {
    if (!confirm(t(`هل أنت متأكد من استلام شحنة أمر الشراء ${po.poNumber} وتحديث رصيد المخزن تلقائيًا؟`, `Confirm receiving PO ${po.poNumber} and increment stock?`))) {
      return;
    }

    try {
      await receivePurchaseOrder(po, {
        id: user?.id || 'admin',
        name: user?.displayName || 'المسؤول'
      });
      if (selectedPO && selectedPO.id === po.id) {
        setSelectedPO(null);
      }
    } catch (err) {
      console.error('Error receiving PO:', err);
    }
  };

  const filteredPOs = (purchaseOrders || []).filter(po => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (po.poNumber || '').toLowerCase().includes(term) ||
      (po.supplierName || '').toLowerCase().includes(term) ||
      (po.items || []).some(i => (i.partNumber || '').toLowerCase().includes(term) || (i.nameAr || '').toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Truck className="w-5 h-5" />
            </div>
            <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('إدارة المشتريات والتوريدات (Purchases & Stock IN)', 'Purchasing & Stock IN Invoices')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            {t('أوامر الشراء واستلام الشحنات وتغذية أرفف المستودع مع احتساب التكاليف بالجنيه المصري (EGP)', 'Manage vendor purchase orders, receive shipments, and update shelf stock in EGP')}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('إنشاء أمر شراء وتوريد جديد', 'New Purchase Order')}</span>
          </button>

          {purchaseOrders.length > 0 && (
            <button
              onClick={async () => {
                if (window.confirm('هل أنت متأكد من تفريغ ومسح كافة أوامر الشراء والتوريد؟')) {
                  await clearAllPurchaseOrders();
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('تفريغ كافة أوامر الشراء', 'Clear All Orders')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isDark ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('بحث برقم الأمر، اسم المورد، رقم القطعة...', 'Search PO, supplier, part...')}
            className={`w-full px-4 py-2 rounded-xl text-xs border transition-all focus:outline-hidden ${
              isDark
                ? 'bg-zinc-900 border-white/10 text-white focus:border-blue-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
            }`}
          />
          <Search className={`w-3.5 h-3.5 absolute top-2.5 text-zinc-400 ${language === 'ar' ? 'left-3' : 'right-3'}`} />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`px-3 py-2 rounded-xl text-xs border font-semibold ${
            isDark ? 'bg-zinc-900 border-white/10 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <option value="ALL">{t('جميع أوامر الشراء', 'All Orders')}</option>
          <option value="ORDERED">{t('قيد الشحن والتوريد', 'In Transit / Ordered')}</option>
          <option value="RECEIVED">{t('تم الاستلام وتغذية الرفوف', 'Received & Stocked')}</option>
        </select>
      </div>

      {/* Purchase Orders Table */}
      <div className={`rounded-2xl border overflow-hidden transition-all ${
        isDark ? 'bg-[#0a0a0c] border-white/10 shadow-xl' : 'bg-white border-slate-200 shadow-md'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <thead className={`border-b text-zinc-400 font-semibold uppercase tracking-wider ${
              isDark ? 'bg-zinc-900/80 border-white/10' : 'bg-slate-100/90 border-slate-200 text-slate-600'
            }`}>
              <tr>
                <th className="px-4 py-3.5">{t('رقم الأمر (PO#)', 'PO Number')}</th>
                <th className="px-4 py-3.5">{t('المورد', 'Supplier')}</th>
                <th className="px-4 py-3.5">{t('عدد الأصناف', 'Items')}</th>
                <th className="px-4 py-3.5 text-center">{t('إجمالي القيمة (EGP)', 'Total (EGP)')}</th>
                <th className="px-4 py-3.5 text-center">{t('الحالة', 'Status')}</th>
                <th className="px-4 py-3.5">{t('تاريخ الإنشاء', 'Date')}</th>
                <th className="px-4 py-3.5 text-center">{t('إجراءات', 'Actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    <Truck className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                    <p className="text-sm font-semibold">{t('لا توجد أوامر شراء مطابقة', 'No purchase orders found')}</p>
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-white/[0.02] transition-colors">
                    
                    <td className="px-4 py-3.5 font-mono font-bold text-blue-400">
                      {po.poNumber}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white dark:text-white">
                        {po.supplierName}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {po.userName}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-zinc-200">
                        {(po.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0)} {t('قطعة', 'units')}
                      </span>
                      <span className="text-[11px] text-zinc-400 block">
                        ({(po.items || []).length} {t('أصناف', 'items')})
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-400 text-sm">
                      {formatEGP(po.totalAmount)}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        po.status === 'RECEIVED'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      }`}>
                        {po.status === 'RECEIVED' ? t('تم الاستلام وتغذية الرف', 'Received') : t('قيد الشحن', 'Ordered')}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-zinc-400 font-mono text-[11px]">
                      {new Date(po.createdDate).toLocaleDateString('ar-EG')}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        
                        <button
                          onClick={() => setSelectedPO(po)}
                          title={t('عرض التفاصيل', 'View Details')}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={async () => {
                            if (window.confirm(`هل أنت متأكد من حذف أمر الشراء #${po.poNumber}؟`)) {
                              await deletePurchaseOrder(po.id);
                            }
                          }}
                          title={t('حذف أمر الشراء', 'Delete PO')}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {po.status === 'ORDERED' && (
                          <button
                            onClick={() => handleReceivePO(po)}
                            title={t('استلام وتغذية المخزن الآن', 'Receive Shipment')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                            <span>{t('استلام', 'Receive')}</span>
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PO Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-slate-300'
          }`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('إنشاء أمر شراء وتوريد بضاعة جديد', 'Create New Purchase Order')}
                </h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-white p-1 rounded-lg">✕</button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4">
              
              {/* Supplier Selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t('المورد المعتمد', 'Authorized Supplier')} *
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border ${
                    isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.country})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-300">
                    {t('الأصناف والكميات وأماكن التخزين', 'Parts, Quantities & Shelf Bins')}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{t('إضافة صنف آخر', 'Add Item')}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {orderItems.map((item, idx) => (
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
                              {p.partNumber} — {p.nameAr.slice(0, 30)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].quantity = parseInt(e.target.value) || 1;
                            setOrderItems(updated);
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
                          value={item.costPrice}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].costPrice = parseFloat(e.target.value) || 0;
                            setOrderItems(updated);
                          }}
                          placeholder={t('التكلفة EGP', 'Cost')}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono font-bold text-center border ${
                            isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>

                      <div className="col-span-2">
                        <select
                          value={item.locationCode}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].locationCode = e.target.value;
                            setOrderItems(updated);
                          }}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono font-bold border ${
                            isDark ? 'bg-zinc-900 border-white/10 text-emerald-400' : 'bg-white border-slate-300 text-emerald-700'
                          }`}
                        >
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.code}>
                              {loc.code}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-1 text-center">
                        {orderItems.length > 1 && (
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

              {/* Total Card */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                isDark ? 'bg-zinc-900 border-white/10' : 'bg-slate-100 border-slate-300'
              }`}>
                <span className="text-xs font-bold text-zinc-300">{t('إجمالي قيمة أمر الشراء التقديرية:', 'Estimated Total Cost:')}</span>
                <span className="text-lg font-bold font-mono text-emerald-400">{formatEGP(totalOrderAmount)}</span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t('ملاحظات الشحن ومستندات الفاتورة', 'Shipping Notes / Invoice Ref')}
                </label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="e.g. شحنة جوية معتمدة برقم بوليصة 12345"
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border focus:outline-hidden ${
                    isDark ? 'bg-zinc-900 border-white/10 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                />
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
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20"
                >
                  {isSubmitting ? t('جاري الإنشاء...', 'Creating...') : t('تأكيد وإصدار أمر الشراء', 'Issue Purchase Order')}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* PO Details Modal */}
      {selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-xl rounded-2xl border p-6 shadow-2xl ${
            isDark ? 'bg-[#0c0c0e] border-white/10' : 'bg-white border-slate-300'
          }`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div>
                <span className="font-mono font-bold text-sm text-blue-400">{selectedPO.poNumber}</span>
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {selectedPO.supplierName}
                </h3>
              </div>
              <button onClick={() => setSelectedPO(null)} className="text-zinc-400 hover:text-white p-1 rounded-lg">✕</button>
            </div>

            <div className="space-y-3">
              <div className="divide-y divide-white/5">
                {selectedPO.items.map((item, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold text-emerald-400">{item.partNumber}</div>
                      <div className="text-zinc-300">{item.nameAr}</div>
                      <div className="text-[11px] text-zinc-500 font-mono">الرف: {item.locationCode}</div>
                    </div>
                    <div className="text-left font-mono">
                      <div>{item.quantity} × {formatEGP(item.costPrice)}</div>
                      <div className="font-bold text-emerald-400">{formatEGP(item.totalCost)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between font-mono font-bold ${
                isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
              }`}>
                <span>{t('الإجمالي:', 'Total:')}</span>
                <span className="text-emerald-400 text-base">{formatEGP(selectedPO.totalAmount)}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              {selectedPO.status === 'ORDERED' && (
                <button
                  onClick={() => handleReceivePO(selectedPO)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>{t('استلام وتغذية الرفوف الآن', 'Receive Shipment')}</span>
                </button>
              )}
              <button
                onClick={() => setSelectedPO(null)}
                className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                {t('إغلاق', 'Close')}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
