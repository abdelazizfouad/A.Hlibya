import React, { useState, useMemo } from 'react';
import { ShieldCheck, Search, Clock, User, FileText } from 'lucide-react';
import { AuditLog } from '../../types/erp';
import { useTheme } from '../../lib/themeContext';

interface AuditLogsViewProps {
  logs: AuditLog[];
}

const getActionArabic = (action: string) => {
  switch (action) {
    case 'CREATE_PART': return 'إضافة قطعة جديدة';
    case 'UPDATE_PART': return 'تعديل بيانات قطعة';
    case 'STOCK_MOVEMENT': return 'حركة مخزنية';
    case 'CREATE_LOCATION': return 'إنشاء موقع رف';
    case 'SYSTEM_SEED': return 'تهيئة أولية للنظام';
    default: return action;
  }
};

const getEntityArabic = (entity: string) => {
  switch (entity) {
    case 'PART': return 'قطعة غيار';
    case 'STOCK_MOVEMENT': return 'حركة مخزنية';
    case 'LOCATION': return 'موقع رف';
    case 'SYSTEM': return 'النظام';
    default: return entity;
  }
};

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs }) => {
  const { isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (selectedAction !== 'ALL' && l.action !== selectedAction) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesAction = l.action.toLowerCase().includes(term);
        const matchesEntity = l.entityType.toLowerCase().includes(term);
        const matchesUser = l.userName.toLowerCase().includes(term);
        const matchesDetails = JSON.stringify(l.details || {}).toLowerCase().includes(term);
        if (!matchesAction && !matchesEntity && !matchesUser && !matchesDetails) return false;
      }
      return true;
    });
  }, [logs, searchTerm, selectedAction]);

  return (
    <div className="space-y-6 pb-12 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              سجل التدقيق الأمني والرقابة التشغيلية
            </h1>
            <span
              className={`text-xs px-3 py-1 rounded-full font-mono font-bold border ${
                isDark ? 'bg-zinc-800 text-emerald-400 border-white/10' : 'bg-slate-200 text-emerald-800 border-slate-300'
              }`}
            >
              {filteredLogs.length} حدث مسجل
            </span>
          </div>
          <p className={`text-xs font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
            AH.Libya Store (فرع الحرفيين): سجل فوري غير قابل للتعديل يتتبع العمليات المخزنية والبيانات
          </p>
        </div>
      </div>

      {/* Filter */}
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
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث في سجل العمليات باسم الموظف، نوع الحدث، الكيان، أو البيانات..."
            className={`w-full rounded-xl pr-10 pl-4 py-2.5 text-xs focus:outline-none transition border ${
              isDark
                ? 'bg-[#09090c] border-white/10 text-white placeholder-zinc-500 focus:border-emerald-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
            }`}
          />
        </div>

        <div className="w-full sm:w-60">
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-bold border ${
              isDark
                ? 'bg-[#09090c] border-white/10 text-white focus:border-emerald-500'
                : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-600'
            }`}
          >
            <option value="ALL">جميع أنواع الأحداث</option>
            <option value="CREATE_PART">إضافة قطعة جديدة</option>
            <option value="UPDATE_PART">تعديل بيانات قطعة</option>
            <option value="STOCK_MOVEMENT">حركة مخزنية</option>
            <option value="CREATE_LOCATION">إنشاء موقع رف</option>
            <option value="SYSTEM_SEED">تهيئة النظام الأولية</option>
          </select>
        </div>
      </div>

      {/* Mobile Card Stream */}
      <div className="block lg:hidden space-y-3">
        {filteredLogs.length === 0 ? (
          <div className={`p-8 text-center rounded-2xl border text-xs ${isDark ? 'bg-[#111116] border-white/5 text-zinc-500' : 'bg-white border-slate-200 text-slate-400'}`}>
            لا توجد سجلات تدقيق مطابقة لمعايير البحث.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`p-4 rounded-2xl border space-y-2.5 ${
                isDark ? 'bg-[#111116] border-white/5' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-bold text-xs px-2.5 py-1 rounded-full border ${isDark ? 'bg-zinc-900 text-emerald-400 border-white/10' : 'bg-slate-100 text-emerald-700 border-slate-300'}`}>
                  {getActionArabic(log.action)}
                </span>
                <span className="text-[11px] font-mono opacity-70">
                  {new Date(log.timestamp).toLocaleDateString('ar-EG')} {new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="opacity-75">الكيان: </span>
                  <strong className="text-emerald-600 dark:text-emerald-400">{getEntityArabic(log.entityType)}</strong>
                </div>
                <div className="font-mono text-[11px] opacity-75">
                  بواسطة: <strong>{log.userName}</strong>
                </div>
              </div>

              {log.details && Object.keys(log.details).length > 0 && (
                <div dir="ltr" className={`p-2 rounded-xl border text-[10px] font-mono truncate ${isDark ? 'bg-[#09090c] border-white/5 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  {JSON.stringify(log.details)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop Audit Log Table */}
      <div className={`hidden lg:block rounded-2xl overflow-hidden shadow-sm border transition-colors ${isDark ? 'bg-[#111116] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className={`border-b ${isDark ? 'bg-[#09090c] text-zinc-400 border-white/10' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              <tr>
                <th className="py-3.5 px-4 font-bold">التاريخ والوقت</th>
                <th className="py-3.5 px-3 font-bold">نوع الحدث</th>
                <th className="py-3.5 px-3 font-bold">الكيان المتأثر</th>
                <th className="py-3.5 px-3 font-bold">المستخدم المنفذ</th>
                <th className="py-3.5 px-4 text-left font-bold">تفاصيل الحمولة (Payload)</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/5 text-zinc-300' : 'divide-slate-100 text-slate-700'}`}>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs opacity-50">
                    لا توجد سجلات تدقيق مطابقة لمعايير البحث.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className={`transition ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                    <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap opacity-75">
                      {new Date(log.timestamp).toLocaleDateString('ar-EG')}{' '}
                      <span className="opacity-60">{new Date(log.timestamp).toLocaleTimeString('ar-EG')}</span>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className={`inline-block px-2.5 py-1 rounded font-bold text-xs border ${isDark ? 'bg-zinc-900 text-zinc-200 border-white/10' : 'bg-slate-100 text-slate-800 border-slate-300'}`}>
                        {getActionArabic(log.action)}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">{getEntityArabic(log.entityType)}</div>
                      <div className="font-mono text-xs opacity-60">{log.entityId}</div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-bold">{log.userName}</div>
                      <div className="text-[11px] opacity-60 font-mono">معرف: {log.userId}</div>
                    </td>

                    <td className="py-3.5 px-4 text-left" dir="ltr">
                      <pre className={`inline-block text-[11px] font-mono p-1.5 rounded-lg border max-w-xs truncate ${isDark ? 'bg-[#09090c] border-white/5 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        {JSON.stringify(log.details || {})}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
