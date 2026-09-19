import React from 'react';
import { Building2, MapPin, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { Branch } from '../../types/erp';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';

interface BranchesManagementViewProps {
  branches: Branch[];
}

export const BranchesManagementView: React.FC<BranchesManagementViewProps> = ({
  branches
}) => {
  const { activeBranch, setActiveBranch } = useAuth();
  const { isDark } = useTheme();

  return (
    <div className="space-y-6 pb-12 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              إدارة الفروع ومراكز التوزيع
            </h1>
            <span
              className={`text-xs px-3 py-1 rounded-full font-mono font-bold border ${
                isDark ? 'bg-zinc-800 text-emerald-400 border-white/10' : 'bg-slate-200 text-emerald-800 border-slate-300'
              }`}
            >
              {branches.length} فرع نشط
            </span>
          </div>
          <p className={`text-xs font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
            AH.Libya Store — المركز الرئيسي وفرع الحرفيين لقطع غيار مرسيدس-بنز
          </p>
        </div>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {branches.map((b) => {
          const isActive = b.id === activeBranch.id;

          return (
            <div
              key={b.id}
              className={`p-6 rounded-2xl border transition shadow-sm space-y-4 ${
                isActive 
                  ? isDark
                    ? 'bg-[#141418] border-emerald-500/50 ring-1 ring-emerald-500/30'
                    : 'bg-white border-emerald-600 ring-2 ring-emerald-500/20'
                  : isDark
                  ? 'bg-[#111116] border-white/10 hover:border-white/25'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                      isDark ? 'bg-zinc-900 border-white/10 text-emerald-400' : 'bg-slate-100 border-slate-200 text-emerald-700'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base">{b.name}</h3>
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded font-bold border ${
                          isDark ? 'bg-[#09090c] text-emerald-400 border-white/10' : 'bg-slate-100 text-emerald-700 border-slate-200'
                        }`}
                      >
                        {b.code}
                      </span>
                    </div>
                    <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{b.city}</p>
                  </div>
                </div>

                {isActive ? (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>الفرع النشط</span>
                  </span>
                ) : (
                  <button
                    onClick={() => setActiveBranch(b)}
                    className={`text-xs font-bold px-4 py-1.5 rounded-full border transition shrink-0 ${
                      isDark
                        ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border-white/10'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                    }`}
                  >
                    اختيار الفرع
                  </button>
                )}
              </div>

              <div className={`space-y-2 text-xs font-medium pt-3 border-t ${isDark ? 'border-white/10 text-zinc-400' : 'border-slate-200 text-slate-600'}`}>
                <div className="flex items-center gap-2.5">
                  <MapPin className={`w-4 h-4 shrink-0 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
                  <span>{b.address}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className={`w-4 h-4 shrink-0 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
                  <span className="font-mono">{b.phone}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className={`w-4 h-4 shrink-0 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
                  <span className="font-mono">{b.email}</span>
                </div>
              </div>

              <div className={`pt-2 flex items-center justify-between text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                <span>حالة الفرع: <strong className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-xs">{b.status === 'ACTIVE' ? 'نشط ويعمل' : 'مغلق'}</strong></span>
                <span className="text-xs font-mono">AH.Libya Store</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
