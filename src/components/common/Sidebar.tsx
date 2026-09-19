import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Layers, 
  Boxes, 
  ArrowLeftRight, 
  Warehouse, 
  RotateCcw, 
  ShieldCheck,
  Tag,
  X,
  Building2,
  Car,
  ShoppingCart,
  Truck,
  AlertOctagon,
  Users,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';
import { BrandLogo } from './BrandLogo';

export type NavView = 
  | 'dashboard'
  | 'parts'
  | 'vin_decoder'
  | 'sales'
  | 'purchases'
  | 'shortages'
  | 'inventory'
  | 'movements'
  | 'partners'
  | 'reports'
  | 'warehouses'
  | 'audit'
  | 'system';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  lowStockCount: number;
  shortagesCount?: number;
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  lowStockCount,
  shortagesCount = 0,
  mobileMenuOpen = false,
  onCloseMobileMenu
}) => {
  const { canAccessAuditLogs, canViewFinancials } = useAuth();
  const { isDark } = useTheme();
  const { language, t } = useLanguage();

  // Grouped Navigation for Mercedes-Benz Spare Parts Workshop Layout
  const primaryOperations = [
    {
      id: 'dashboard' as NavView,
      label: t('لوحة التحكم والمؤشرات', 'Dashboard Overview'),
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'sales' as NavView,
      label: t('المبيعات وفواتير الصرف', 'Sales & Invoicing'),
      icon: ShoppingCart,
      badge: null
    },
    {
      id: 'purchases' as NavView,
      label: t('المشتريات وأوامر التوريد', 'Purchase Orders'),
      icon: Truck,
      badge: null
    },
    {
      id: 'movements' as NavView,
      label: t('سجل الحركات والأذونات', 'Stock Movements'),
      icon: ArrowLeftRight,
      badge: null
    }
  ];

  const inventoryAndEpc = [
    {
      id: 'parts' as NavView,
      label: t('كتالوج وقطع مرسيدس', 'Parts Master & EPC'),
      icon: Layers,
      badge: lowStockCount > 0 ? `${lowStockCount}` : null,
      badgeType: 'warning'
    },
    {
      id: 'vin_decoder' as NavView,
      label: t('فك شاسيهات VIN ومطابقة', 'VIN Decoder & Matcher'),
      icon: Car,
      badge: null
    },
    {
      id: 'inventory' as NavView,
      label: t('المخازن ومواقع الأرفف', 'Bin Locations & Stock'),
      icon: Boxes,
      badge: null
    },
    {
      id: 'shortages' as NavView,
      label: t('سجل النواقص والطلبيات', 'Shortages & Reorders'),
      icon: AlertOctagon,
      badge: shortagesCount > 0 ? `${shortagesCount}` : null,
      badgeType: 'danger'
    }
  ];

  const partnersAndReports = [
    {
      id: 'partners' as NavView,
      label: t('الموردين والعملاء والورش', 'Suppliers & Customers'),
      icon: Users,
      badge: null
    }
  ];

  if (canViewFinancials) {
    partnersAndReports.push({
      id: 'reports' as NavView,
      label: t('التقارير المالية والتحليلات', 'Reports & Analytics'),
      icon: BarChart3,
      badge: null
    });
  }

  const systemAndWarehouse = [
    {
      id: 'warehouses' as NavView,
      label: t('المستودع الرئيسي (الحرفيين)', 'Warehouse & Zones'),
      icon: Warehouse,
      badge: null
    }
  ];

  if (canAccessAuditLogs) {
    systemAndWarehouse.push({
      id: 'audit' as NavView,
      label: t('سجل تدقيق العمليات', 'Security & Audit Logs'),
      icon: ShieldCheck,
      badge: null
    });
  }

  systemAndWarehouse.push({
    id: 'system' as NavView,
    label: t('إعدادات النظام والبيانات', 'System & Seeder'),
    icon: RotateCcw,
    badge: null
  });

  const handleNavClick = (view: NavView) => {
    onNavigate(view);
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    }
  };

  const renderNavGroup = (title: string, items: Array<{ id: NavView; label: string; icon: any; badge: string | null; badgeType?: string }>) => (
    <div className="space-y-0.5">
      <div
        className={`px-3 pt-2 pb-1 text-[10px] uppercase font-bold tracking-wider ${
          isDark ? 'text-zinc-400' : 'text-slate-400'
        }`}
      >
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentView.toLowerCase() === item.id.toLowerCase();

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isActive
                ? isDark
                  ? 'bg-white text-black font-bold shadow-[0_2px_12px_rgba(255,255,255,0.15)]'
                  : 'bg-slate-900 text-white font-bold shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:bg-zinc-900/90 hover:text-zinc-100'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive
                    ? isDark ? 'text-black' : 'text-white'
                    : isDark ? 'text-zinc-400' : 'text-slate-500'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </div>

            {item.badge && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 font-bold ${
                  isActive
                    ? isDark ? 'bg-black text-white' : 'bg-white text-slate-900'
                    : item.badgeType === 'danger'
                    ? 'border border-rose-500/30 text-rose-400 bg-rose-500/10'
                    : 'border border-amber-500/30 text-amber-400 bg-amber-500/10'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const navContent = (
    <div className="flex flex-col justify-between h-full p-2.5 sm:p-3 select-none overflow-y-auto">
      {/* Top Navigation Sections */}
      <div className="space-y-3">
        
        {/* Mobile Header in Drawer */}
        <div className="flex items-center justify-between pb-2 mb-1 border-b md:hidden border-inherit">
          <BrandLogo size="sm" isDark={isDark} showSubtitle={true} />
          {onCloseMobileMenu && (
            <button
              onClick={onCloseMobileMenu}
              className={`p-1.5 rounded-lg border transition ${
                isDark
                  ? 'bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Group 1: Operations */}
        {renderNavGroup(t('العمليات والتشغيل', 'Daily Operations'), primaryOperations)}

        {/* Group 2: Mercedes EPC & Inventory */}
        {renderNavGroup(t('المخزون وكتالوج مرسيدس', 'EPC & Inventory'), inventoryAndEpc)}

        {/* Group 3: Partners & Analytics */}
        {renderNavGroup(t('الشركاء والتقارير', 'Partners & Reports'), partnersAndReports)}

        {/* Group 4: System Management */}
        {renderNavGroup(t('إدارة النظام والمستودع', 'System & Warehouses'), systemAndWarehouse)}

      </div>

      {/* Bottom Branch & EPC Info Box */}
      <div
        className={`mt-4 p-3 rounded-xl border text-xs shadow-2xs ${
          isDark
            ? 'bg-[#0e1015] border-white/10 text-zinc-300'
            : 'bg-slate-100/90 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2 font-bold text-xs mb-1">
          <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>AH.Libya — {t('فرع الحرفيين', 'El-Harefeyin')}</span>
        </div>
        <p
          className={`text-[11px] leading-relaxed ${
            isDark ? 'text-zinc-400' : 'text-slate-500'
          }`}
        >
          {t('نظام الكتالوج المعتمد', 'Official EPC Catalog')} <strong className={isDark ? 'text-zinc-200 font-mono' : 'text-slate-800 font-mono'}>A2233302303</strong>. {t('العملة:', 'Currency:')} <span className="font-bold text-emerald-600 dark:text-emerald-400">EGP</span>
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed) */}
      <aside
        className={`premium-sidebar w-64 shrink-0 border-l hidden md:flex flex-col h-[calc(100vh-4rem)] sticky top-16 transition-colors duration-200 ${
          isDark
            ? 'bg-[#09090b] border-white/10 text-zinc-400'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}
      >
        {navContent}
      </aside>

      {/* Mobile Drawer (Slide-over overlay) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-fadeIn">
          {/* Backdrop */}
          <div
            onClick={onCloseMobileMenu}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div
            className={`premium-sidebar fixed inset-y-0 right-0 w-4/5 max-w-sm h-full shadow-2xl z-50 transform transition-transform ease-in-out duration-300 ${
              isDark
                ? 'bg-[#0c0c0f] border-l border-white/10 text-zinc-200'
                : 'bg-white border-l border-slate-200 text-slate-800'
            }`}
          >
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
