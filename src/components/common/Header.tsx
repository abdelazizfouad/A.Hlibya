import React, { useState } from 'react';
import { 
  Search, 
  QrCode, 
  Plus, 
  Sun, 
  Moon, 
  Menu, 
  Building2, 
  ChevronDown,
  Globe,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Server
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  onOpenGlobalSearch: () => void;
  onOpenScanner: () => void;
  onOpenAddPart: () => void;
  onToggleMobileMenu: () => void;
  onOpenLocalServer?: () => void;
  activeView: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenGlobalSearch,
  onOpenScanner,
  onOpenAddPart,
  onToggleMobileMenu,
  onOpenLocalServer,
  activeView
}) => {
  const { currentUser, canEditParts, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutClick = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setIsLoggingOut(false);
      setIsUserMenuOpen(false);
    }
  };

  return (
    <header
      className={`premium-header sticky top-0 z-30 transition-all duration-150 border-b backdrop-blur-md shadow-xs ${
        isDark
          ? 'bg-[#060709]/95 border-white/[0.08] text-[#E4E4E7]'
          : 'bg-white/95 border-slate-200/90 text-slate-800'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-3">
          
          {/* Left: Mobile Menu Toggle & Mercedes-Benz Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={onToggleMobileMenu}
              aria-label="فتح القائمة الرئيسية"
              className={`md:hidden flex items-center justify-center w-9 h-9 rounded-xl border transition-colors shrink-0 ${
                isDark
                  ? 'bg-zinc-900/90 border-white/10 text-zinc-200 hover:bg-zinc-800'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Official Mercedes-Benz Genuine Parts Logo */}
            <BrandLogo size="sm" isDark={isDark} showSubtitle={false} className="sm:hidden" />
            <BrandLogo size="md" isDark={isDark} showSubtitle={true} className="hidden sm:flex" />
          </div>

          {/* Center: MBUX Style Global Search Bar */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-1 sm:mx-2">
            <button
              onClick={onOpenGlobalSearch}
              className={`w-full flex items-center justify-between h-9 px-3.5 rounded-full text-xs transition-all border group relative overflow-hidden ${
                isDark
                  ? 'bg-gradient-to-r from-[#0d0f14] to-[#12141c] hover:from-[#131620] hover:to-[#1a1e29] border-white/10 hover:border-emerald-500/40 text-zinc-400 hover:text-zinc-100 shadow-inner'
                  : 'bg-slate-100 hover:bg-slate-150 border-slate-200/90 hover:border-emerald-500/40 text-slate-500 hover:text-slate-900 shadow-inner'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Search className="w-3.5 h-3.5 shrink-0 text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="truncate tracking-normal text-[11px] sm:text-xs font-medium">
                  {t('بحث ذكي: القطعة (A223..)، البدائل، الشاسيه...', 'Smart Search: Part (A223..), Alternates, VIN...')}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-bold hidden lg:inline">
                  MBUX
                </span>
                <kbd
                  className={`hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border shrink-0 ${
                    isDark
                      ? 'bg-black/60 text-zinc-300 border-white/10'
                      : 'bg-white text-slate-600 border-slate-200 shadow-2xs'
                  }`}
                >
                  Ctrl+K
                </kbd>
              </div>
            </button>
          </div>

          {/* Right Action Controls: Unified 36px/38px height, balanced icons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              title={language === 'ar' ? 'Switch to English' : 'التحويل للغة العربية'}
              className={`flex items-center justify-center h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-semibold transition-all ${
                isDark
                  ? 'bg-zinc-900/90 border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline mr-1.5 text-[11px] font-bold font-mono">
                {language === 'ar' ? 'EN' : 'عربي'}
              </span>
            </button>

            {/* Dark / Light Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'التبديل إلى الوضع الفاتح ☀️' : 'التبديل إلى الوضع الداكن 🌙'}
              className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all ${
                isDark
                  ? 'bg-zinc-900/90 border-white/10 text-amber-400 hover:bg-zinc-800 hover:border-amber-400/30'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* Barcode / QR Scanner Button */}
            <button
              onClick={onOpenScanner}
              title="فتح ماسح الباركود و QR"
              className={`flex items-center justify-center h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-medium transition-all ${
                isDark
                  ? 'bg-zinc-900/90 border-white/10 text-zinc-300 hover:bg-zinc-800 hover:border-cyan-500/40 hover:text-cyan-400'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline mr-1.5 text-[11px] font-medium">مسح باركود</span>
            </button>

            {/* Local PC Server Button */}
            {onOpenLocalServer && (
              <button
                onClick={onOpenLocalServer}
                title="سيرفر PC والوصول عن بعد من أي مكان (انقر للإدارة والرابط الخارجي والنوت)"
                className={`flex items-center justify-center h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-medium transition-all ${
                  isDark
                    ? 'bg-zinc-900/90 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/30 hover:border-emerald-500/50'
                    : 'bg-emerald-50 border-emerald-300/80 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Server className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="hidden xl:inline mr-1.5 text-[11px] font-bold">سيرفر PC + ريموت</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1.5 shrink-0" />
              </button>
            )}

            {/* Quick Add Part Button (Mercedes Petrol Emerald Accent) */}
            {canEditParts && (
              <button
                onClick={onOpenAddPart}
                title="إضافة قطعة غيار جديدة"
                className={`hidden sm:flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                  isDark
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="text-[11px]">إضافة قطعة</span>
              </button>
            )}

            {/* Branch Badge - فرع الحرفيين */}
            <div
              className={`hidden xl:flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-medium ${
                isDark
                  ? 'bg-[#0e1015] border-white/10 text-zinc-300'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-[11px] font-medium">فرع الحرفيين</span>
            </div>

            {/* Administrator Profile Dropdown & Status */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(prev => !prev)}
                  aria-label="حساب المسؤول العام"
                  className={`flex items-center gap-2 h-9 px-2 sm:px-2.5 rounded-xl border transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-zinc-900/90 hover:bg-zinc-800 border-white/10 text-zinc-300'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold font-mono shadow-xs ${
                      isDark
                        ? 'bg-emerald-600 text-white border border-emerald-400/30'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    ع
                  </div>
                  <div className="hidden md:block text-right">
                    <div
                      className={`text-xs font-bold leading-none truncate max-w-[90px] ${
                        isDark ? 'text-zinc-100' : 'text-slate-900'
                      }`}
                    >
                      {currentUser.displayName}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
                </button>

                {/* Dropdown Menu Modal */}
                {isUserMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div
                      className={`absolute left-0 mt-2 w-72 rounded-2xl border shadow-2xl p-3 z-50 animate-fadeIn backdrop-blur-xl ${
                        isDark
                          ? 'bg-[#0c0d12] border-white/10 text-zinc-200 shadow-black/80'
                          : 'bg-white border-slate-200 text-slate-800 shadow-slate-400/30'
                      }`}
                    >
                      {/* User Info Card */}
                      <div
                        className={`p-3 rounded-xl border mb-3 ${
                          isDark ? 'bg-zinc-900/90 border-white/10' : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-base shrink-0">
                            ع
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-white dark:text-white truncate">
                              {currentUser.displayName}
                            </h3>
                            <p className="text-[11px] text-zinc-400 font-mono truncate">
                              {currentUser.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/5">
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                            المسؤول العام
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium">
                            فرع الحرفيين
                          </span>
                        </div>
                      </div>

                      {/* Security Status Notice */}
                      <div className="px-2 py-1.5 mb-2 flex items-center gap-2 text-[11px] text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{t('جلسة مصادقة سحابية نشطة وآمنة', 'Active Secure Cloud Session')}</span>
                      </div>

                      {/* Prominent Logout Button */}
                      <div className="pt-2 border-t border-white/10">
                        <button
                          onClick={handleLogoutClick}
                          disabled={isLoggingOut}
                          className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] flex items-center justify-center gap-2 transition-all shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>
                            {isLoggingOut
                              ? t('جاري إنهاء الجلسة...', 'Terminating session...')
                              : t('تسجيل الخروج وإنهاء الجلسة', 'Sign Out & Terminate Session')}
                          </span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Direct Quick Logout Action Button on Navbar for Immediate Access */}
            <button
              onClick={handleLogoutClick}
              disabled={isLoggingOut}
              title={t('تسجيل الخروج السريع', 'Quick Logout')}
              className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white hover:border-rose-500'
                  : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white hover:border-rose-600'
              }`}
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
