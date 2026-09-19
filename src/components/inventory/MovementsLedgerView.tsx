import React, { useState, useMemo } from 'react';
import { 
  ArrowLeftRight, 
  Search, 
  Download, 
  Calendar, 
  MapPin, 
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { StockMovement } from '../../types/erp';
import { useTheme } from '../../lib/themeContext';
import { deleteStockMovement, clearAllMovements } from '../../lib/firestoreService';
import { Trash2 } from 'lucide-react';

interface MovementsLedgerViewProps {
  movements: StockMovement[];
  onOpenMovementModal: () => void;
}

const getMovementTypeArabic = (type: string) => {
  switch (type) {
    case 'INITIAL_STOCK': return 'رصيد افتتاحي';
    case 'PURCHASE':
    case 'INWARD_PURCHASE': return 'استلام مشتريات (توريد)';
    case 'SALE':
    case 'OUTWARD_SALE': return 'صرف مبيعات (فاتورة)';
    case 'TRANSFER':
    case 'TRANSFER_LOCATION':
    case 'TRANSFER_BRANCH': return 'نقل بين الأرفف';
    case 'ADJUSTMENT':
    case 'ADJUSTMENT_IN':
    case 'ADJUSTMENT_OUT': return 'تسوية جردية';
    case 'DAMAGED':
    case 'DISPOSAL': return 'هالك / تالف';
    case 'CUSTOMER_RETURN':
    case 'RETURN_CUSTOMER': return 'مرتجع عميل';
    case 'SUPPLIER_RETURN':
    case 'RETURN_SUPPLIER': return 'مرتجع مورد';
    default: return type.replace('_', ' ');
  }
};

export const MovementsLedgerView: React.FC<MovementsLedgerViewProps> = ({
  movements,
  onOpenMovementModal
}) => {
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const typeAliases: Record<string, string[]> = {
        PURCHASE: ['PURCHASE', 'INWARD_PURCHASE'],
        SALE: ['SALE', 'OUTWARD_SALE'],
        TRANSFER: ['TRANSFER', 'TRANSFER_LOCATION', 'TRANSFER_BRANCH'],
        ADJUSTMENT: ['ADJUSTMENT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'],
        DAMAGED: ['DAMAGED', 'DISPOSAL'],
        CUSTOMER_RETURN: ['CUSTOMER_RETURN', 'RETURN_CUSTOMER']
      };
      if (selectedType !== 'ALL' && !(typeAliases[selectedType] || [selectedType]).includes(m.movementType)) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesNum = m.partNumber.toLowerCase().includes(term);
        const matchesName = m.partName.toLowerCase().includes(term);
        const matchesRef = (m.reference || '').toLowerCase().includes(term);
        const matchesUser = m.userName.toLowerCase().includes(term);
        const matchesReason = m.reason.toLowerCase().includes(term);
        if (!matchesNum && !matchesName && !matchesRef && !matchesUser && !matchesReason) return false;
      }
      return true;
    });
  }, [movements, searchTerm, selectedType]);

  // Reset page to 1 on filter or search change
  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedMovements = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredMovements.slice(start, start + pageSize);
  }, [filteredMovements, validPage, pageSize]);

  const handleExportCSV = () => {
    const headers = ['التاريخ والوقت', 'رقم القطعة', 'اسم الصنف', 'نوع الحركة', 'الكمية', 'الرصيد السابق', 'الرصيد الجديد', 'موقع الرف', 'رقم المرجع / الفاتورة', 'السبب / البيان', 'المستخدم المسجل'];
    const rows = filteredMovements.map(m => [
      `"${m.timestamp}"`,
      `"${m.partNumber}"`,
      `"${m.partName}"`,
      `"${getMovementTypeArabic(m.movementType)}"`,
      m.quantity,
      m.previousQuantity,
      m.newQuantity,
      `"${m.destinationLocation || m.sourceLocation || 'غير محدد'}"`,
      `"${m.reference || ''}"`,
      `"${m.reason}"`,
      `"${m.userName}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `سجل_حركات_المخزون_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              سجل حركات المخزون والرقابة
            </h1>
            <span
              className={`text-xs px-3 py-1 rounded-full font-mono font-bold border ${
                isDark ? 'bg-zinc-800 text-emerald-400 border-white/10' : 'bg-slate-200 text-emerald-800 border-slate-300'
              }`}
            >
              {filteredMovements.length} حركة مسجلة
            </span>
          </div>
          <p className={`text-xs font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
            AH.Libya Store (فرع الحرفيين): سجل تدقيق شامل لجميع عمليات الإدخال والصرف ونقل الأرفف
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition border ${
              isDark
                ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير Excel</span>
          </button>

          {movements.length > 0 && (
            <button
              onClick={async () => {
                if (window.confirm('هل أنت متأكد من تفريغ ومسح سجل الحركات بالكامل؟')) {
                  await clearAllMovements();
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تفريغ سجل الحركات</span>
            </button>
          )}

          <button
            onClick={onOpenMovementModal}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition shadow-sm ${
              isDark
                ? 'bg-white hover:bg-zinc-200 text-black'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>تسجيل حركة مخزنية +</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className={`rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 shadow-sm border transition-colors ${
          isDark ? 'bg-[#111116] border-white/10' : 'bg-white border-slate-200'
        }`}
      >
        <div className="relative flex-1 w-full">
          <Search className={`w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="بحث برقم القطعة، الوصف، رقم السند أو الفاتورة، أو اسم الموظف..."
            className={`w-full rounded-xl pr-10 pl-4 py-2.5 text-xs focus:outline-none transition border ${
              isDark
                ? 'bg-[#09090c] border-white/10 text-white placeholder-zinc-500 focus:border-emerald-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
            }`}
          />
        </div>

        <div className="w-full sm:w-60">
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-bold border ${
              isDark
                ? 'bg-[#09090c] border-white/10 text-white focus:border-emerald-500'
                : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-600'
            }`}
          >
            <option value="ALL">جميع أنواع الحركات</option>
            <option value="INITIAL_STOCK">رصيد افتتاحي</option>
            <option value="PURCHASE">استلام مشتريات (توريد)</option>
            <option value="SALE">صرف مبيعات (فاتورة)</option>
            <option value="TRANSFER">نقل بين الأرفف</option>
            <option value="ADJUSTMENT">تسوية جردية</option>
            <option value="DAMAGED">هالك / تالف</option>
            <option value="CUSTOMER_RETURN">مرتجع عميل</option>
          </select>
        </div>
      </div>

      {/* Responsive View: Cards for Mobile, Table for Desktop */}
      <div className="block lg:hidden space-y-3">
        {paginatedMovements.length === 0 ? (
          <div className={`p-8 text-center rounded-2xl border text-xs ${isDark ? 'bg-[#111116] border-white/5 text-zinc-500' : 'bg-white border-slate-200 text-slate-400'}`}>
            لا توجد حركات مخزنية مسجلة مطابقة للبحث.
          </div>
        ) : (
          paginatedMovements.map((m) => {
            const isPositive = m.quantity > 0;
            return (
              <div
                key={m.id}
                className={`p-4 rounded-2xl border space-y-2 ${
                  isDark ? 'bg-[#111116] border-white/5' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {getMovementTypeArabic(m.movementType)}
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {isPositive ? `+${m.quantity}` : m.quantity} قطعة
                  </span>
                </div>

                <div>
                  <div className="font-mono font-bold text-xs tracking-wider text-emerald-600 dark:text-emerald-400">
                    {m.partNumber}
                  </div>
                  <div className="text-xs font-bold mt-0.5">
                    {m.partName}
                  </div>
                </div>

                <div className={`text-xs p-2 rounded-xl border flex items-center justify-between font-mono ${isDark ? 'bg-[#09090c] border-white/5 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <span>الرصيد: {m.previousQuantity} ← <strong className="text-emerald-600 dark:text-emerald-400">{m.newQuantity}</strong></span>
                  <span>الرف: {m.destinationLocation || m.sourceLocation || 'A-03-02-07'}</span>
                </div>

                {m.reason && (
                  <div className="text-xs opacity-75">
                    {m.reason} {m.reference ? `(مستند: ${m.reference})` : ''}
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] opacity-60 pt-2 border-t border-inherit">
                  <span>بواسطة: <strong>{m.userName}</strong></span>
                  <span>{new Date(m.timestamp).toLocaleString('ar-EG')}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View */}
      <div className={`hidden lg:block rounded-2xl overflow-hidden shadow-sm border transition-colors ${isDark ? 'bg-[#111116] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            
            <thead className={`border-b ${isDark ? 'bg-[#09090c] text-zinc-400 border-white/10' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              <tr>
                <th className="py-3.5 px-4 font-bold">التاريخ والوقت</th>
                <th className="py-3.5 px-3 font-bold">رقم القطعة والصنف</th>
                <th className="py-3.5 px-3 font-bold">نوع الحركة</th>
                <th className="py-3.5 px-3 font-bold">الكمية والتأثير</th>
                <th className="py-3.5 px-3 font-bold">موقع الرف</th>
                <th className="py-3.5 px-3 font-bold">المرجع / السبب</th>
                <th className="py-3.5 px-4 font-bold">المستخدم</th>
                <th className="py-3.5 px-3 text-center font-bold">إجراءات</th>
              </tr>
            </thead>

            <tbody className={`divide-y ${isDark ? 'divide-white/5 text-zinc-300' : 'divide-slate-100 text-slate-700'}`}>
              {paginatedMovements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs opacity-50">
                    لا توجد حركات مخزنية مسجلة مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                paginatedMovements.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id} className={`transition ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                      
                      {/* Date */}
                      <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap opacity-75">
                        {new Date(m.timestamp).toLocaleDateString('ar-EG')}{' '}
                        <span className="opacity-60">{new Date(m.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>

                      {/* Part */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono text-xs font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                          {m.partNumber}
                        </div>
                        <div className="text-xs truncate max-w-[220px] font-bold">
                          {m.partName}
                        </div>
                      </td>

                      {/* Movement Type */}
                      <td className="py-3.5 px-3">
                        <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold border ${isDark ? 'bg-zinc-900 text-zinc-300 border-white/10' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                          {getMovementTypeArabic(m.movementType)}
                        </span>
                      </td>

                      {/* Delta */}
                      <td className="py-3.5 px-3 font-mono">
                        <div className={`font-bold text-sm ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                          {isPositive ? `+${m.quantity}` : m.quantity} قطعة
                        </div>
                        <div className="text-[11px] opacity-70">
                          الرصيد: {m.previousQuantity} ← <strong className="text-emerald-600 dark:text-emerald-400">{m.newQuantity}</strong>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-3 font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        {m.destinationLocation || m.sourceLocation || '—'}
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-3 max-w-[240px]">
                        {m.reference && (
                          <div className="font-mono text-[11px] opacity-75">
                            مستند: {m.reference}
                          </div>
                        )}
                        <div className="text-xs truncate" title={m.reason}>
                          {m.reason}
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-xs">
                          {m.userName}
                        </div>
                        <div className="text-[11px] opacity-60 font-mono">
                          فرع الحرفيين
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={async () => {
                            if (window.confirm(`هل أنت متأكد من حذف هذا السجل من سجل الحركات؟`)) {
                              await deleteStockMovement(m.id);
                            }
                          }}
                          className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 cursor-pointer transition"
                          title="حذف السجل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {filteredMovements.length > 0 && (
        <div
          className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border text-xs ${
            isDark ? 'bg-[#111116] border-white/10 text-zinc-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>عرض</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className={`rounded-lg px-2 py-1 text-xs border font-mono font-bold ${
                isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'
              }`}
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>حركة في الصفحة (إجمالي: {filteredMovements.length})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={validPage === 1}
              className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1 transition ${
                validPage === 1
                  ? 'opacity-40 cursor-not-allowed border-transparent'
                  : isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>

            <span className="font-mono px-2 font-bold">
              صفحة {validPage} من {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={validPage >= totalPages}
              className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1 transition ${
                validPage >= totalPages
                  ? 'opacity-40 cursor-not-allowed border-transparent'
                  : isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <span>التالي</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
