import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './lib/authContext';
import { ThemeProvider, useTheme } from './lib/themeContext';
import { LanguageProvider, useLanguage } from './lib/languageContext';
import { 
  PartMaster, 
  WarehouseLocation, 
  InventoryItem, 
  StockMovement, 
  EpcCategory, 
  Branch, 
  Warehouse, 
  AuditLog,
  ShortageItem,
  Supplier,
  Customer,
  PurchaseOrder,
  SalesInvoice
} from './types/erp';
import { 
  subscribeParts, 
  subscribeInventory, 
  subscribeStockMovements, 
  subscribeLocations, 
  subscribeCategories, 
  subscribeBranches, 
  subscribeWarehouses, 
  subscribeAuditLogs,
  subscribeShortages,
  subscribeSuppliers,
  subscribeCustomers,
  subscribePurchaseOrders,
  subscribeSalesInvoices,
  subscribeQuotaState,
  ensureDatabaseSeeded,
  addShortageItem
} from './lib/firestoreService';
import { fetchLocalData } from './lib/localServerService';
import { LocalServerModal } from './components/system/LocalServerModal';
import { Database, AlertTriangle, X, ExternalLink, CheckCircle2, Server, HardDrive } from 'lucide-react';
import {
  INITIAL_PARTS,
  INITIAL_INVENTORY,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_LOCATIONS,
  INITIAL_EPC_CATEGORIES,
  INITIAL_BRANCHES,
  INITIAL_WAREHOUSES,
  INITIAL_SHORTAGES,
  INITIAL_SUPPLIERS,
  INITIAL_CUSTOMERS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SALES_INVOICES
} from './lib/seedData';

import { LoginView } from './components/auth/LoginView';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ThreeDBackground } from './components/common/ThreeDBackground';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { BarcodeQrScannerModal } from './components/scanner/BarcodeQrScannerModal';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { PartsMasterView } from './components/parts/PartsMasterView';
import { PartDetailModal } from './components/parts/PartDetailModal';
import { AddEditPartModal } from './components/parts/AddEditPartModal';
import { VinDecoderView } from './components/vin/VinDecoderView';
import { SalesView } from './components/sales/SalesView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { ShortagesView } from './components/shortages/ShortagesView';
import { InventoryLocationsView } from './components/inventory/InventoryLocationsView';
import { StockMovementModal } from './components/inventory/StockMovementModal';
import { MovementsLedgerView } from './components/inventory/MovementsLedgerView';
import { PartnersView } from './components/partners/PartnersView';
import { ReportsView } from './components/reports/ReportsView';
import { WarehouseManagementView } from './components/warehouse/WarehouseManagementView';
import { BranchesManagementView } from './components/branches/BranchesManagementView';
import { AuditLogsView } from './components/audit/AuditLogsView';
import { EpcSetupView } from './components/system/EpcSetupView';

const USE_LOCAL_PC_SERVER = true;

function ErpAppContent() {
  const { isAuthenticated, isLoading, activeBranch } = useAuth();
  const { isDark } = useTheme();
  const { language, dir, t } = useLanguage();

  // Navigation State
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Firestore Live State (Pre-populated with rich Mercedes-Benz catalog for instant load)
  const [parts, setParts] = useState<PartMaster[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_PARTS);
  const [inventory, setInventory] = useState<InventoryItem[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_INVENTORY);
  const [movements, setMovements] = useState<StockMovement[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_STOCK_MOVEMENTS);
  const [locations, setLocations] = useState<WarehouseLocation[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_LOCATIONS);
  const [categories, setCategories] = useState<EpcCategory[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_EPC_CATEGORIES);
  const [branches, setBranches] = useState<Branch[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_BRANCHES);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_WAREHOUSES);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  // Extended ERP State
  const [shortages, setShortages] = useState<ShortageItem[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_SHORTAGES);
  const [suppliers, setSuppliers] = useState<Supplier[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_SUPPLIERS);
  const [customers, setCustomers] = useState<Customer[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_CUSTOMERS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_PURCHASE_ORDERS);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>(USE_LOCAL_PC_SERVER ? [] : INITIAL_SALES_INVOICES);

  // Modals State
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [selectedPartForDetail, setSelectedPartForDetail] = useState<PartMaster | null>(null);
  const [partToEdit, setPartToEdit] = useState<PartMaster | null>(null);
  const [isAddEditPartOpen, setIsAddEditPartOpen] = useState<boolean>(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState<boolean>(false);
  const [movementTargetPart, setMovementTargetPart] = useState<PartMaster | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);
  const [isLocalServerModalOpen, setIsLocalServerModalOpen] = useState<boolean>(false);

  // Primary Live Local PC Server Engine (On-Premise Hard Drive Storage)
  useEffect(() => {
    fetchLocalData().then((d) => {
      if (d) {
        if (d.parts) setParts(d.parts);
        if (d.inventory) setInventory(d.inventory);
        if (d.locations) setLocations(d.locations);
        if (d.movements) setMovements(d.movements);
        if (d.categories) setCategories(d.categories);
        if (d.branches) setBranches(d.branches);
        if (d.warehouses) setWarehouses(d.warehouses);
        if (d.shortages) setShortages(d.shortages);
        if (d.suppliers) setSuppliers(d.suppliers);
        if (d.customers) setCustomers(d.customers);
        if (d.purchaseOrders) setPurchaseOrders(d.purchaseOrders);
        if (d.salesInvoices) setSalesInvoices(d.salesInvoices);
      }
    }).catch((err) => {
      console.warn('Initial local server load error:', err);
    });
  }, []);

  // The local PC database is authoritative; do not overwrite it with stale cloud data.
  useEffect(() => {
    if (USE_LOCAL_PC_SERVER) return;
    ensureDatabaseSeeded().catch(() => {});
  }, []);

  // Local-server cache subscriptions. They receive the small bootstrap pages
  // after a mutation/poll; catalogue searches themselves remain server-side.
  useEffect(() => {
    const unsubParts = subscribeParts((newParts) => {
      if (newParts) setParts(newParts);
    });
    const unsubInv = subscribeInventory((newInv) => {
      if (newInv) setInventory(newInv);
    });
    const unsubMov = subscribeStockMovements((newMov) => {
      if (newMov) setMovements(newMov);
    });
    const unsubLoc = subscribeLocations(setLocations);
    const unsubCat = subscribeCategories(setCategories);
    const unsubBr = subscribeBranches(setBranches);
    const unsubWh = subscribeWarehouses(setWarehouses);
    const unsubLog = subscribeAuditLogs(setAuditLogs);
    const unsubShort = subscribeShortages(setShortages);
    const unsubSup = subscribeSuppliers(setSuppliers);
    const unsubCust = subscribeCustomers(setCustomers);
    const unsubPO = subscribePurchaseOrders(setPurchaseOrders);
    const unsubSale = subscribeSalesInvoices(setSalesInvoices);

    return () => {
      unsubParts();
      unsubInv();
      unsubMov();
      unsubLoc();
      unsubCat();
      unsubBr();
      unsubWh();
      unsubLog();
      unsubShort();
      unsubSup();
      unsubCust();
      unsubPO();
      unsubSale();
    };
  }, []);

  // Keyboard shortcuts for Global Search (Cmd+K / Ctrl+K) and Barcode Scanner (F2 / Ctrl+B) + Global Hardware Scanner
  useEffect(() => {
    let globalBuffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Search shortcut
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }

      // Barcode Scanner shortcut (F2 or Ctrl+B / Cmd+B)
      if (e.key === 'F2' || ((e.metaKey || e.ctrlKey) && e.key === 'b')) {
        e.preventDefault();
        setIsScannerOpen(true);
        return;
      }

      // Hardware Barcode Scanner listener (Datalogic QuickScan, Zebra, Honeywell, etc.)
      const now = Date.now();
      const delta = now - lastKeyTime;
      lastKeyTime = now;

      // Don't capture when typing in an active text input unless it's an ultra-fast hardware burst
      const activeEl = document.activeElement;
      const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

      if (e.key === 'Enter' || e.key === 'Tab') {
        // Fast burst from hardware scanner Datalogic
        if (globalBuffer.length >= 2 && (delta < 100 || !isInput)) {
          const scannedCode = globalBuffer.trim();
          globalBuffer = '';
          if (scannedCode.length >= 2) {
            if (!isInput) {
              e.preventDefault();
              e.stopPropagation();
            }
            setIsScannerOpen(true);
          }
        } else {
          globalBuffer = '';
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (delta > 100) {
          globalBuffer = e.key;
        } else {
          globalBuffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Handlers
  const handleSelectPart = useCallback((part: PartMaster) => {
    setSelectedPartForDetail(part);
  }, []);

  const handleOpenAddPart = useCallback(() => {
    setPartToEdit(null);
    setIsAddEditPartOpen(true);
  }, []);

  const handleOpenEditPart = useCallback((part: PartMaster) => {
    setPartToEdit(part);
    setIsAddEditPartOpen(true);
  }, []);

  const handleOpenMovement = useCallback((part?: PartMaster) => {
    setMovementTargetPart(part || null);
    setIsMovementModalOpen(true);
  }, []);

  const handleAddShortageFromVin = useCallback(async (partNumber: string, nameAr: string, chassis: string) => {
    await addShortageItem({
      partNumber,
      nameAr,
      nameEn: nameAr,
      chassis,
      requestedQty: 2,
      requestCount: 1,
      urgency: 'HIGH',
      status: 'PENDING',
      notes: 'طلب نقص ناتج عن بحث فك شاسيه VIN'
    });
    setCurrentView('shortages');
  }, []);

  // Calculate Low Stock Count
  const lowStockCount = parts.filter(p => p.totalStock <= p.minStock).length;
  const pendingShortagesCount = shortages.filter(s => s.status === 'PENDING').length;

  const normalizedView = currentView.toLowerCase();

  // If session is being verified on startup
  if (isLoading) {
    return (
      <div 
        className={`min-h-screen flex flex-col items-center justify-center p-6 ${
          isDark ? 'bg-[#050505] text-white' : 'bg-slate-50 text-slate-800'
        }`}
        dir={dir}
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-emerald-500/20 mb-4 animate-pulse">
          ★
        </div>
        <div className="w-8 h-8 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-zinc-400 font-mono">
          {t('جاري التحقق من مصادقة الجلسة...', 'Verifying session authentication...')}
        </p>
      </div>
    );
  }

  // If user is not authenticated, show professional Login Screen
  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div 
      className={`premium-shell min-h-screen flex flex-col antialiased transition-colors duration-200 selection:bg-cyan-400 selection:text-black ${
        isDark ? 'bg-[#050505] text-[#D4D4D8]' : 'bg-slate-50 text-slate-800'
      }`} 
      dir={dir}
    >
      
      {/* Top Application Header */}
      <Header
        onOpenGlobalSearch={() => setIsSearchOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenAddPart={handleOpenAddPart}
        onOpenLocalServer={() => setIsLocalServerModalOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
        activeView={currentView}
      />

      {/* Active Local PC Server Status Banner */}
      {!isBannerDismissed && (
        <div 
          className={`w-full border-b px-4 py-2.5 flex items-center justify-between text-xs transition-all z-20 ${
            isDark 
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2 max-w-5xl">
            <div className={`p-1.5 rounded-lg shrink-0 ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
              <Server className="w-4 h-4" />
            </div>
            <div className="leading-snug">
              <span className="font-bold">
                {language === 'ar' ? 'الخادم المحلي على جهاز الكمبيوتر متصل ونشط (Local PC Server): ' : 'Local PC Server Connected: '}
              </span>
              <span className="opacity-90">
                {language === 'ar'
                  ? 'تم نقل كافة البيانات والمخزون إلى القرص الصلب (Hard Drive) لجهاز الكمبيوتر الخاص بك. لا حاجة للإنترنت ولا استخدام لأي سيرفرات سحابية خارجية.'
                  : 'All ERP inventory and data are stored directly on your PC local storage with zero cloud dependencies.'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={() => setIsLocalServerModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow transition cursor-pointer flex items-center gap-1.5"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'إدارة السيرفر والنسخ الاحتياطي' : 'Server & Backup'}</span>
            </button>
            <button
              onClick={() => setIsBannerDismissed(true)}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="إغلاق التنبيه"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Navigation Sidebar */}
        <Sidebar
          currentView={currentView as any}
          onNavigate={(v) => setCurrentView(v.toLowerCase())}
          lowStockCount={lowStockCount}
          shortagesCount={pendingShortagesCount}
          mobileMenuOpen={mobileMenuOpen}
          onCloseMobileMenu={() => setMobileMenuOpen(false)}
        />

        {/* Viewport Content Area */}
        <main 
          className={`flex-1 overflow-y-auto p-3 sm:p-5 lg:p-7 pb-24 md:pb-8 relative transition-colors duration-200 ${
            isDark ? 'bg-transparent' : 'bg-slate-50'
          }`}
        >
          {/* Subtle ambient light gradient background */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#050505] via-transparent to-white/[0.02] pointer-events-none" />
          <ThreeDBackground />
          
          <div className="relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={normalizedView}
                initial={{ opacity: 0, y: 6, scale: 0.998 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.998 }}
                transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {normalizedView === 'dashboard' && (
                  <DashboardOverview
                    parts={parts}
                    inventory={inventory}
                    movements={movements}
                    locations={locations}
                    onSelectPart={handleSelectPart}
                    onOpenAddPart={handleOpenAddPart}
                    onOpenScanner={() => setIsScannerOpen(true)}
                    onOpenMovementModal={() => handleOpenMovement()}
                    onNavigateToParts={() => setCurrentView('parts')}
                    onNavigateToLocations={() => setCurrentView('inventory')}
                    onNavigateToMovements={() => setCurrentView('movements')}
                    onNavigateToInventory={() => setCurrentView('inventory')}
                    onNavigateToVinDecoder={() => setCurrentView('vin_decoder')}
                    onNavigateToSales={() => setCurrentView('sales')}
                    onNavigateToPurchases={() => setCurrentView('purchases')}
                    onNavigateToShortages={() => setCurrentView('shortages')}
                    onNavigateToReports={() => setCurrentView('reports')}
                  />
                )}

                {normalizedView === 'parts' && (
                  <PartsMasterView
                    parts={parts}
                    inventory={inventory}
                    locations={locations}
                    categories={categories}
                    warehouses={warehouses}
                    branches={branches}
                    onSelectPart={handleSelectPart}
                    onOpenAddPart={handleOpenAddPart}
                    onOpenEditPart={handleOpenEditPart}
                    onOpenMovementModal={(p) => handleOpenMovement(p)}
                  />
                )}

                {(normalizedView === 'vin_decoder' || normalizedView === 'vin') && (
                  <VinDecoderView
                    parts={parts}
                    onSelectPart={handleSelectPart}
                    onOpenSaleInvoice={(part) => {
                      setCurrentView('sales');
                    }}
                    onOpenPurchaseOrder={(part) => {
                      setCurrentView('purchases');
                    }}
                    onAddShortage={handleAddShortageFromVin}
                  />
                )}

                {normalizedView === 'sales' && (
                  <SalesView
                    salesInvoices={salesInvoices}
                    parts={parts}
                    inventory={inventory}
                    customers={customers}
                    locations={locations}
                    branches={branches}
                    warehouses={warehouses}
                    onSelectPart={handleSelectPart}
                  />
                )}

                {normalizedView === 'purchases' && (
                  <PurchasesView
                    purchaseOrders={purchaseOrders}
                    parts={parts}
                    suppliers={suppliers}
                    locations={locations}
                    warehouses={warehouses}
                    branches={branches}
                    onSelectPart={handleSelectPart}
                  />
                )}

                {normalizedView === 'shortages' && (
                  <ShortagesView
                    shortages={shortages}
                    parts={parts}
                    onSelectPart={handleSelectPart}
                    onOpenCreatePO={() => setCurrentView('purchases')}
                  />
                )}

                {(normalizedView === 'inventory' || normalizedView === 'locations') && (
                  <InventoryLocationsView
                    locations={locations}
                    inventory={inventory}
                    parts={parts}
                    warehouses={warehouses}
                    branches={branches}
                    onSelectPart={handleSelectPart}
                    onOpenMovementModal={(p) => handleOpenMovement(p)}
                  />
                )}

                {normalizedView === 'movements' && (
                  <MovementsLedgerView
                    movements={movements}
                    onOpenMovementModal={() => handleOpenMovement()}
                  />
                )}

                {normalizedView === 'partners' && (
                  <PartnersView
                    suppliers={suppliers}
                    customers={customers}
                    purchaseOrders={purchaseOrders}
                    salesInvoices={salesInvoices}
                  />
                )}

                {normalizedView === 'reports' && (
                  <ReportsView
                    parts={parts}
                    inventory={inventory}
                    movements={movements}
                    purchaseOrders={purchaseOrders}
                    salesInvoices={salesInvoices}
                    shortages={shortages}
                  />
                )}

                {normalizedView === 'warehouses' && (
                  <WarehouseManagementView
                    warehouses={warehouses}
                    locations={locations}
                    inventory={inventory}
                  />
                )}

                {normalizedView === 'branches' && (
                  <BranchesManagementView
                    branches={branches}
                  />
                )}

                {(normalizedView === 'audit' || normalizedView === 'audit_logs') && (
                  <AuditLogsView
                    logs={auditLogs}
                  />
                )}

                {(normalizedView === 'system' || normalizedView === 'epc_setup') && (
                  <EpcSetupView
                    categories={categories}
                    parts={parts}
                    locations={locations}
                    branches={branches}
                    onRefreshData={() => {
                      // Refreshed state handled via snapshot listeners
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        currentView={currentView}
        onNavigate={(v) => setCurrentView(v.toLowerCase())}
        onOpenScanner={() => setIsScannerOpen(true)}
        onToggleMenu={() => setMobileMenuOpen(prev => !prev)}
        lowStockCount={lowStockCount}
        shortagesCount={pendingShortagesCount}
      />

      {/* Global Modals */}
      
      {/* 1. Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        parts={parts}
        locations={locations}
        onSelectPart={(part) => {
          setSelectedPartForDetail(part);
          setIsSearchOpen(false);
        }}
        onSelectLocation={(loc) => {
          setCurrentView('inventory');
          setIsSearchOpen(false);
        }}
      />

      {/* 2. Barcode & QR Scanner Modal */}
      <BarcodeQrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        parts={parts}
        locations={locations}
        inventory={inventory}
        onSelectPart={(part) => {
          setSelectedPartForDetail(part);
          setIsScannerOpen(false);
        }}
        onSelectLocation={(loc) => {
          setCurrentView('inventory');
          setIsScannerOpen(false);
        }}
      />

      {/* 3. Part Detail Modal */}
      <PartDetailModal
        part={selectedPartForDetail}
        onClose={() => setSelectedPartForDetail(null)}
        inventory={inventory}
        movements={movements}
        allLocations={locations}
        onOpenEditPart={(part) => {
          setSelectedPartForDetail(null);
          handleOpenEditPart(part);
        }}
        onOpenMovementModal={(part) => {
          setSelectedPartForDetail(null);
          handleOpenMovement(part);
        }}
      />

      {/* 4. Add / Edit Part Modal */}
      <AddEditPartModal
        isOpen={isAddEditPartOpen}
        onClose={() => setIsAddEditPartOpen(false)}
        partToEdit={partToEdit}
        categories={categories}
        locations={locations}
        warehouses={warehouses}
        branches={branches}
        onSuccess={(partId) => {
          const savedPart = parts.find(p => p.id === partId);
          if (savedPart) setSelectedPartForDetail(savedPart);
        }}
      />

      {/* 5. Stock Movement Modal */}
      <StockMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        parts={parts}
        inventory={inventory}
        locations={locations}
        warehouses={warehouses}
        branches={branches}
        preselectedPart={movementTargetPart}
        onSuccess={() => {
          // Live Local Server updates automatically
        }}
      />

      {/* 6. Local Server PC & Backup Modal */}
      <LocalServerModal
        isOpen={isLocalServerModalOpen}
        onClose={() => setIsLocalServerModalOpen(false)}
        isDark={isDark}
      />

    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ErpAppContent />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
