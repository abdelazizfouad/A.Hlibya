import React from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Car, 
  ShoppingCart, 
  Menu,
  QrCode,
  AlertOctagon
} from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';
import { NavView } from './Sidebar';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: NavView) => void;
  onOpenScanner: () => void;
  onToggleMenu: () => void;
  lowStockCount?: number;
  shortagesCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenScanner,
  onToggleMenu,
  lowStockCount = 0,
  shortagesCount = 0
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const navItems = [
    {
      id: 'dashboard' as NavView,
      label: t('الرئيسية', 'Home'),
      icon: LayoutDashboard
    },
    {
      id: 'parts' as NavView,
      label: t('القطع EPC', 'Parts'),
      icon: Layers,
      badge: lowStockCount > 0 ? `${lowStockCount}` : null
    },
    {
      id: 'scanner' as any,
      label: t('مسح باركود', 'Scanner'),
      icon: QrCode,
      isSpecial: true
    },
    {
      id: 'vin_decoder' as NavView,
      label: t('الشاسيه VIN', 'VIN'),
      icon: Car
    },
    {
      id: 'sales' as NavView,
      label: t('المبيعات', 'Sales'),
      icon: ShoppingCart
    },
    {
      id: 'more' as any,
      label: t('المزيد', 'More'),
      icon: Menu,
      badge: shortagesCount > 0 ? `${shortagesCount}` : null
    }
  ];

  return (
    <nav
      aria-label="شريط التنقل السفلي للهواتف"
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-lg safe-area-pb transition-colors ${
        isDark
          ? 'bg-[#08080a]/95 border-white/10 text-zinc-400'
          : 'bg-white/95 border-slate-200 text-slate-600 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]'
      }`}
    >
      <div className="flex items-center justify-around px-1.5 py-1.5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = 
            item.id === 'scanner' 
              ? false 
              : item.id === 'more' 
              ? false 
              : currentView.toLowerCase() === item.id.toLowerCase();

          if (item.isSpecial) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={onOpenScanner}
                className="flex flex-col items-center justify-center -mt-4 group focus:outline-none"
              >
                <div className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 group-active:scale-95 transition-transform border-2 border-black/20">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'more') {
                  onToggleMenu();
                } else {
                  onNavigate(item.id);
                }
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all relative focus:outline-none ${
                isActive
                  ? isDark
                    ? 'text-emerald-400 font-bold'
                    : 'text-slate-900 font-bold'
                  : isDark
                  ? 'hover:text-zinc-200'
                  : 'hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110' : 'opacity-80'
                  }`}
                />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-mono font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 truncate max-w-[55px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
