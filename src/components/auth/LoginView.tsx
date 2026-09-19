import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight,
  Sun,
  Moon,
  Globe,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';
import { ThreeDBackground } from '../common/ThreeDBackground';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();

  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUser.trim() || !password.trim()) {
      setError(t('يرجى إدخال البريد الإلكتروني وكلمة المرور.', 'Please enter your email and password.'));
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await login(emailOrUser, password);
      if (!result.success) {
        setError(result.error || t('بيانات الدخول غير صحيحة. يرجى التحقق وإعادة المحاولة.', 'Invalid credentials. Please verify and try again.'));
      }
    } catch (err: any) {
      setError(err?.message || t('حدث خطأ أثناء الاتصال بالخادم.', 'Server communication error.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between relative overflow-hidden selection:bg-emerald-500 selection:text-white ${
      isDark ? 'bg-[#050505] text-[#D4D4D8]' : 'bg-slate-50 text-slate-800'
    }`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Background Mercedes Subtle Aesthetics */}
      <div className="absolute inset-0 bg-radial from-emerald-500/[0.03] via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
      <ThreeDBackground variant="login" />

      {/* Top Navbar */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20">
            ★
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white dark:text-white">
                AH.Libya Store
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                WMS / ERP
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {t('نظام إدارة مستودعات قطع غيار مرسيدس-بنز — فرع الحرفيين', 'Mercedes-Benz Spare Parts WMS — El-Harefeyin Branch')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isDark
                ? 'bg-zinc-900 border-white/10 hover:bg-zinc-800 text-zinc-300'
                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700 shadow-xs'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'English' : 'عربي'}</span>
          </button>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-all ${
              isDark
                ? 'bg-zinc-900 border-white/10 hover:bg-zinc-800 text-amber-400'
                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700 shadow-xs'
            }`}
            title={t('تبديل الوضع', 'Toggle Theme')}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className={`w-full max-w-md rounded-2xl border p-6 sm:p-8 shadow-2xl transition-all ${
          isDark 
            ? 'bg-[#0c0c0e]/95 border-white/10 backdrop-blur-xl shadow-black/80' 
            : 'bg-white border-slate-200 shadow-slate-300/50'
        }`}>
          
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white dark:text-white">
              {t('تسجيل الدخول — لوحة الإدارة', 'System Login — Admin Panel')}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {t('يرجى إدخال البريد الإلكتروني وكلمة المرور للوصول للنظام', 'Enter your email and password to access the ERP system')}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-2 animate-fadeIn">
              <ShieldCheck className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 dark:text-zinc-300 mb-1.5">
                {t('البريد الإلكتروني أو اسم المستخدم (Email / Username)', 'Email or Username')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={emailOrUser}
                  onChange={(e) => setEmailOrUser(e.target.value)}
                  required
                  placeholder="name@company.com"
                  autoComplete="username"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm border font-mono transition-all focus:outline-hidden ${
                    isDark
                      ? 'bg-zinc-900/90 border-white/10 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                />
                <Mail className={`w-4 h-4 absolute top-3 text-zinc-400 ${language === 'ar' ? 'left-3' : 'right-3'}`} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 dark:text-zinc-300 mb-1.5">
                {t('كلمة المرور (Password)', 'Password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm border font-mono transition-all focus:outline-hidden ${
                    language === 'ar' ? 'pl-10 pr-4' : 'pr-10 pl-4'
                  } ${
                    isDark
                      ? 'bg-zinc-900/90 border-white/10 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className={`absolute top-3 text-zinc-400 hover:text-zinc-200 transition-colors ${
                    language === 'ar' ? 'left-3' : 'right-3'
                  }`}
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('جاري التحقق من الهوية...', 'Authenticating...')}</span>
                </div>
              ) : (
                <>
                  <span>{t('تسجيل الدخول والوصول للنظام', 'Sign In to ERP System')}</span>
                  <ArrowRight className={`w-4 h-4 ${language === 'ar' ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
          </form>

          {/* Warehouse Features Checklist */}
          <div className="mt-5 pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>{t('تتبع الأرفف والمخزون', 'Shelf & Bin Tracking')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>{t('فك شاسيهات VIN مرسيدس', 'Real Mercedes VIN')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>{t('أوامر المشتريات والمبيعات', 'Purchases & Sales')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>{t('حماية وتدقيق كامل للعمليات', 'Audit & Security')}</span>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-3 text-center text-xs text-zinc-500 border-t border-white/5">
        <span>AH.Libya Store — {t('فرع الحرفيين، القاهرة', 'El-Harefeyin Branch, Cairo')} © {new Date().getFullYear()}</span>
      </footer>

    </div>
  );
};
