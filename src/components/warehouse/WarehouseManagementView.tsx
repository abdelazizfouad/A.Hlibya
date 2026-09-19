import React, { useState } from 'react';
import { 
  Building2, 
  Warehouse as WhIcon, 
  Layers, 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  AlertTriangle,
  MapPin,
  Boxes,
  RotateCcw,
  Sparkles,
  Search
} from 'lucide-react';
import { Warehouse, WarehouseLocation, InventoryItem } from '../../types/erp';
import { 
  createWarehouse, 
  updateWarehouse, 
  deleteWarehouse,
  createWarehouseLocation,
  updateWarehouseLocation,
  deleteWarehouseLocation,
  clearAllLocations
} from '../../lib/firestoreService';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';

interface WarehouseManagementViewProps {
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  inventory: InventoryItem[];
}

export const WarehouseManagementView: React.FC<WarehouseManagementViewProps> = ({
  warehouses,
  locations,
  inventory
}) => {
  const { activeBranch } = useAuth();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(warehouses[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');

  // Warehouse Modal States
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [whName, setWhName] = useState('');
  const [whCode, setWhCode] = useState('');
  const [whCity, setWhCity] = useState('');
  const [whAddress, setWhAddress] = useState('');
  const [whType, setWhType] = useState<'MAIN_HUB' | 'BRANCH_WH' | 'TRANSIT'>('MAIN_HUB');
  const [whDescription, setWhDescription] = useState('');

  // Location Modal States
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);
  const [locZone, setLocZone] = useState('A');
  const [locAisle, setLocAisle] = useState('01');
  const [locShelf, setLocShelf] = useState('01');
  const [locBin, setLocBin] = useState('01');
  const [locCapacity, setLocCapacity] = useState(50);
  const [locStatus, setLocStatus] = useState<'ACTIVE' | 'FULL' | 'MAINTENANCE'>('ACTIVE');
  const [locDescription, setLocDescription] = useState('');

  // Delete Confirm State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'WAREHOUSE' | 'LOCATION' | 'CLEAR_LOCATIONS';
    id?: string;
    name?: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeWarehouse = warehouses.find(w => w.id === selectedWarehouseId) || warehouses[0];
  const whLocations = locations.filter(l => !l.warehouseId || l.warehouseId === activeWarehouse?.id);

  const filteredLocations = whLocations.filter(loc => {
    const matchesZone = zoneFilter === 'ALL' || loc.zone === zoneFilter;
    const matchesSearch = searchTerm === '' || 
      loc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (loc.notes && loc.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesZone && matchesSearch;
  });

  // Open Add/Edit Warehouse Modal
  const handleOpenWarehouseModal = (wh?: Warehouse) => {
    if (wh) {
      setEditingWarehouse(wh);
      setWhName(wh.name);
      setWhCode(wh.code);
      setWhCity(wh.city || 'طرابلس');
      setWhAddress(wh.address || '');
      setWhType(wh.type || 'MAIN_HUB');
      setWhDescription(wh.description || '');
    } else {
      setEditingWarehouse(null);
      setWhName('');
      setWhCode(`WH-${warehouses.length + 1}`);
      setWhCity('طرابلس');
      setWhAddress('');
      setWhType('MAIN_HUB');
      setWhDescription('');
    }
    setIsWarehouseModalOpen(true);
  };

  // Save Warehouse
  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whCode.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.id, {
          name: whName,
          code: whCode.toUpperCase(),
          city: whCity,
          address: whAddress,
          type: whType,
          description: whDescription
        });
      } else {
        const newId = await createWarehouse({
          name: whName,
          code: whCode.toUpperCase(),
          branchId: activeBranch?.id || 'branch_tripoli',
          branchName: activeBranch?.name || 'فرع طرابلس الرئيسي',
          city: whCity,
          address: whAddress,
          type: whType,
          description: whDescription,
          totalCapacityBins: 100,
          active: true
        });
        setSelectedWarehouseId(newId);
      }
      setIsWarehouseModalOpen(false);
    } catch (err) {
      console.error('Error saving warehouse:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Add/Edit Location Modal
  const handleOpenLocationModal = (loc?: WarehouseLocation) => {
    if (loc) {
      setEditingLocation(loc);
      setLocZone(loc.zone || 'A');
      setLocAisle(loc.aisle || '01');
      setLocShelf(loc.shelf || '01');
      setLocBin(loc.bin || '01');
      setLocCapacity(loc.capacity || 50);
      setLocStatus(loc.status || 'ACTIVE');
      setLocDescription(loc.notes || '');
    } else {
      setEditingLocation(null);
      setLocZone('A');
      setLocAisle('01');
      setLocShelf('01');
      setLocBin('01');
      setLocCapacity(50);
      setLocStatus('ACTIVE');
      setLocDescription('');
    }
    setIsLocationModalOpen(true);
  };

  // Save Location
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedAisle = locAisle.padStart(2, '0');
    const formattedShelf = locShelf.padStart(2, '0');
    const formattedBin = locBin.padStart(2, '0');
    const fullCode = `${locZone}-${formattedAisle}-${formattedShelf}-${formattedBin}`;

    setIsSubmitting(true);
    try {
      if (editingLocation) {
        await updateWarehouseLocation(editingLocation.id, {
          code: fullCode,
          zone: locZone,
          aisle: formattedAisle,
          shelf: formattedShelf,
          bin: formattedBin,
          capacity: Number(locCapacity) || 50,
          status: locStatus,
          notes: locDescription
        });
      } else {
        await createWarehouseLocation({
          code: fullCode,
          warehouseId: activeWarehouse?.id || warehouses[0]?.id || 'wh_tripoli',
          warehouseName: activeWarehouse?.name || 'مستودع طرابلس الرئيسي',
          branchId: activeBranch?.id || 'branch_tripoli',
          zone: locZone,
          aisle: formattedAisle,
          shelf: formattedShelf,
          bin: formattedBin,
          capacity: Number(locCapacity) || 50,
          currentUnits: 0,
          status: locStatus,
          notes: locDescription
        });
      }
      setIsLocationModalOpen(false);
    } catch (err) {
      console.error('Error saving location:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Deletion
  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    setIsSubmitting(true);
    try {
      if (deleteConfirmTarget.type === 'WAREHOUSE' && deleteConfirmTarget.id) {
        await deleteWarehouse(deleteConfirmTarget.id);
        const remaining = warehouses.filter(w => w.id !== deleteConfirmTarget.id);
        if (remaining.length > 0) {
          setSelectedWarehouseId(remaining[0].id);
        }
      } else if (deleteConfirmTarget.type === 'LOCATION' && deleteConfirmTarget.id) {
        await deleteWarehouseLocation(deleteConfirmTarget.id);
      } else if (deleteConfirmTarget.type === 'CLEAR_LOCATIONS') {
        await clearAllLocations();
      }
      setDeleteConfirmTarget(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {t('إدارة المستودعات ومواقع الأرفف والتخزين', 'Warehouse & Bin Storage Infrastructure')}
              </h1>
              <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                {t('إضافة وتعديل وحذف المستودعات، توزيع المناطق (A, B, C, D)، وتعيين مسارات الأرفف وسعتها', 'Manage warehouses, zones, aisles, shelf bins and storage capacities')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => handleOpenWarehouseModal()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('إضافة مستودع جديد', 'Add Warehouse')}</span>
          </button>
          <button
            onClick={() => handleOpenLocationModal()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>{t('إضافة رف تخزين (Bin)', 'Add Shelf / Bin')}</span>
          </button>
          <button
            onClick={() => setDeleteConfirmTarget({ type: 'CLEAR_LOCATIONS', name: 'كافة الأرفف والمواقع' })}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              isDark ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('تفريغ كافة الأرفف', 'Clear All Bins')}</span>
          </button>
        </div>
      </div>

      {/* Warehouse Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {warehouses.map((wh) => {
          const locs = locations.filter(l => !l.warehouseId || l.warehouseId === wh.id);
          const isSelected = wh.id === selectedWarehouseId;

          return (
            <div
              key={wh.id}
              onClick={() => setSelectedWarehouseId(wh.id)}
              className={`p-5 rounded-2xl border cursor-pointer transition relative group shadow-sm ${
                isSelected
                  ? isDark
                    ? 'bg-[#141418] border-emerald-500/50 ring-1 ring-emerald-500/30'
                    : 'bg-white border-emerald-600 ring-2 ring-emerald-500/20'
                  : isDark
                  ? 'bg-[#111116] border-white/10 hover:border-white/25'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                    isDark ? 'bg-zinc-900 border-white/10 text-emerald-400' : 'bg-slate-100 border-slate-200 text-emerald-700'
                  }`}
                >
                  <WhIcon className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenWarehouseModal(wh);
                    }}
                    className={`p-1.5 rounded-lg border transition ${
                      isDark ? 'bg-zinc-900 border-white/10 hover:bg-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
                    }`}
                    title={t('تعديل المستودع', 'Edit Warehouse')}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmTarget({ type: 'WAREHOUSE', id: wh.id, name: wh.name });
                    }}
                    className={`p-1.5 rounded-lg border transition text-red-400 ${
                      isDark ? 'bg-zinc-900 border-white/10 hover:bg-red-500/20' : 'bg-slate-100 border-slate-200 hover:bg-red-100'
                    }`}
                    title={t('حذف المستودع', 'Delete Warehouse')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span
                    className={`text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded font-bold border ${
                      isDark ? 'bg-[#09090c] text-zinc-300 border-white/10' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {wh.code}
                  </span>
                </div>
              </div>

              <h3 className="font-bold text-base">{wh.name}</h3>
              <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                {wh.address ? `${wh.address}، ` : ''}{wh.city || 'ليبيا'}
              </p>

              <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs font-medium ${isDark ? 'border-white/10 text-zinc-400' : 'border-slate-200 text-slate-500'}`}>
                <span>{locs.length} {t('رف تخزين معرف', 'Configured Bins')}</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  {wh.type === 'MAIN_HUB' ? 'مركز لوجستي رئيسي' : wh.type === 'TRANSIT' ? 'مستودع عبور' : 'مستودع فرعي'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Warehouse Deep Details */}
      {activeWarehouse && (
        <div className={`rounded-2xl p-4 sm:p-6 space-y-6 shadow-sm border transition-colors ${isDark ? 'bg-[#111116] border-white/10' : 'bg-white border-slate-200'}`}>
          
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>{activeWarehouse.name}</span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${isDark ? 'bg-zinc-900 text-zinc-300 border-white/10' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                  {activeWarehouse.code}
                </span>
              </h2>
              <p className={`text-xs font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                {t('الموقع الجغرافي:', 'Location:')} {activeWarehouse.address || 'العنوان الرئيسي'} ({activeWarehouse.city || 'طرابلس'})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenLocationModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('إضافة رف لهذا المستودع', 'Add Bin to this Warehouse')}</span>
              </button>
            </div>
          </div>

          {/* Zones Breakdown */}
          <div className="space-y-3">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {t('المناطق التخزينية والتوزيع الهندسي للأقسام', 'Storage Zones & Engineering Layout')}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { zone: 'A', title: 'المنطقة A — المحرك ونواقل الحركة', desc: 'مكونات المحركات، أعمدة الكامات، المكابس، التيمن، والتيربو', aisles: 'الممرات 01 - 04' },
                { zone: 'B', title: 'المنطقة B — الشاسيه ونظام التعليق', desc: 'مقصات وعفشة ومساعدين مرسيدس S-Class و E-Class و GLC', aisles: 'الممرات 01 - 04' },
                { zone: 'C', title: 'المنطقة C — الهيكل الخارجي والإضاءة', desc: 'المصدات، المصابيح الأمامية والخلفية، المرايا، الرادياتيرات', aisles: 'الممرات 01 - 03' },
                { zone: 'D', title: 'المنطقة D — الكهرباء وعقول SAM', desc: 'وحدات التحكم SAM، الحساسات، الضفائر الكهربائية، شمعات الاحتراق', aisles: 'الممرات 01 - 02' }
              ].map((z) => {
                const count = whLocations.filter(l => l.zone === z.zone).length;
                return (
                  <div
                    key={z.zone}
                    onClick={() => setZoneFilter(zoneFilter === z.zone ? 'ALL' : z.zone)}
                    className={`p-4 rounded-xl border space-y-2 cursor-pointer transition ${
                      zoneFilter === z.zone 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                        : isDark ? 'bg-[#141418] border-white/5 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">منطقة {z.zone}</span>
                      <span className={`text-xs font-mono px-2 py-0.5 rounded border font-bold ${isDark ? 'bg-zinc-900 text-zinc-300 border-white/10' : 'bg-white text-slate-700 border-slate-300'}`}>
                        {count} رفوف
                      </span>
                    </div>
                    <div className="text-xs font-bold">{z.title}</div>
                    <p className={`text-xs leading-relaxed font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{z.desc}</p>
                    <div className={`text-xs font-mono pt-2 border-t font-bold flex items-center justify-between ${isDark ? 'border-white/5 text-zinc-500' : 'border-slate-200 text-slate-400'}`}>
                      <span>{z.aisles}</span>
                      <span className="text-[10px] text-emerald-500 font-bold">{zoneFilter === z.zone ? 'محدد' : 'انقر للتصفية'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter & Search Bar for Locations */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('بحث برمز الرف (مثال: A-01-02-03)...', 'Search bin code (e.g. A-01-02-03)...')}
                className={`w-full px-4 py-2 rounded-xl text-xs border transition focus:outline-hidden ${
                  isDark
                    ? 'bg-zinc-900 border-white/10 text-white focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
              <Search className={`w-3.5 h-3.5 absolute top-2.5 text-zinc-400 ${language === 'ar' ? 'left-3' : 'right-3'}`} />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className={`px-3 py-2 rounded-xl text-xs border font-semibold ${
                  isDark ? 'bg-zinc-900 border-white/10 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="ALL">{t('كافة المناطق (A, B, C, D)', 'All Zones')}</option>
                <option value="A">المنطقة A (محرك ونواقل)</option>
                <option value="B">المنطقة B (شاسيه وتعليق)</option>
                <option value="C">المنطقة C (هيكل وإضاءة)</option>
                <option value="D">المنطقة D (كهرباء وSAM)</option>
              </select>
            </div>
          </div>

          {/* Detailed Storage Locations List with Action Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                {t('قائمة الأرفف التخزينية المعينة بالمستودع', 'Assigned Storage Bins List')} ({filteredLocations.length} رف)
              </h4>
            </div>

            {filteredLocations.length === 0 ? (
              <div className={`p-8 rounded-2xl border text-center ${isDark ? 'bg-zinc-900/50 border-white/10 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                <Boxes className="w-10 h-10 mx-auto mb-2 opacity-40 text-emerald-500" />
                <p className="text-xs font-bold">{t('لا توجد أرفف تخزين مطابقة في هذا المستودع', 'No matching shelf bins found')}</p>
                <button
                  onClick={() => handleOpenLocationModal()}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('إضافة أول رف تخزين', 'Add First Bin Location')}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {filteredLocations.map(l => (
                  <div
                    key={l.id}
                    className={`p-3 rounded-xl border transition relative group ${
                      isDark ? 'bg-[#09090c] border-white/10 hover:border-emerald-500/40' : 'bg-slate-50 border-slate-200 hover:border-emerald-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-xs tracking-wider text-emerald-600 dark:text-emerald-400">{l.code}</span>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={() => handleOpenLocationModal(l)}
                          className="text-zinc-400 hover:text-blue-400 p-0.5 cursor-pointer"
                          title="تعديل"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmTarget({ type: 'LOCATION', id: l.id, name: l.code })}
                          className="text-zinc-400 hover:text-red-400 p-0.5 cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className={`text-[11px] font-mono mt-0.5 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                      {t('السعة:', 'Cap:')} {l.capacity} | {l.status === 'ACTIVE' ? 'نشط' : l.status === 'FULL' ? 'ممتلئ' : 'صيانة'}
                    </div>
                    {l.notes && (
                      <div className={`text-[10px] truncate mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                        {l.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL: Add/Edit Warehouse */}
      {isWarehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'bg-[#111116] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2.5">
                <WhIcon className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm sm:text-base">
                  {editingWarehouse ? t('تعديل بيانات المستودع', 'Edit Warehouse') : t('إضافة مستودع جديد', 'Add New Warehouse')}
                </h3>
              </div>
              <button
                onClick={() => setIsWarehouseModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1.5">{t('اسم المستودع', 'Warehouse Name')} *</label>
                  <input
                    type="text"
                    required
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    placeholder="مثال: مستودع بنغازي المركزي"
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1.5">{t('كود المستودع (الكودي)', 'Code')} *</label>
                  <input
                    type="text"
                    required
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value)}
                    placeholder="مثال: WH-BEN"
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono uppercase ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1.5">{t('المدينة', 'City')}</label>
                  <input
                    type="text"
                    value={whCity}
                    onChange={(e) => setWhCity(e.target.value)}
                    placeholder="مثال: طرابلس / بنغازي / مصراتة"
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1.5">{t('نوع المنشأة اللوجستية', 'Warehouse Type')}</label>
                  <select
                    value={whType}
                    onChange={(e) => setWhType(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  >
                    <option value="MAIN_HUB">{t('مركز توزيع ولوجستيات رئيسي (Main Hub)', 'Main Distribution Hub')}</option>
                    <option value="BRANCH_WH">{t('مستودع فرعي ملحق بفرع (Branch Warehouse)', 'Branch Warehouse')}</option>
                    <option value="TRANSIT">{t('مستودع عبور واستلام شحنات (Transit)', 'Transit Hub')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1.5">{t('العنوان التفصيلي', 'Address')}</label>
                <input
                  type="text"
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  placeholder="مثال: طريق السواني، المنطقة الصناعية"
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1.5">{t('ملاحظات ووصف المستودع', 'Description & Notes')}</label>
                <textarea
                  rows={2}
                  value={whDescription}
                  onChange={(e) => setWhDescription(e.target.value)}
                  placeholder="ملاحظات تشغيلية، مسؤول المستودع، مواعيد العمل..."
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsWarehouseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-zinc-400 hover:bg-white/5"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer transition"
                >
                  {isSubmitting ? t('جاري الحفظ...', 'Saving...') : t('حفظ بيانات المستودع', 'Save Warehouse')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add/Edit Shelf Bin Location */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'bg-[#111116] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2.5">
                <Boxes className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-sm sm:text-base">
                  {editingLocation ? t('تعديل رف التخزين', 'Edit Shelf Location') : t('إضافة رف تخزين جديد (Bin Location)', 'Add Shelf Location')}
                </h3>
              </div>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-mono text-center font-bold text-sm">
                رمز الرف الناتج: {locZone}-{locAisle.padStart(2, '0')}-{locShelf.padStart(2, '0')}-{locBin.padStart(2, '0')}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold mb-1.5">{t('المنطقة (Zone)', 'Zone')} *</label>
                  <select
                    value={locZone}
                    onChange={(e) => setLocZone(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-bold ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  >
                    <option value="A">Zone A</option>
                    <option value="B">Zone B</option>
                    <option value="C">Zone C</option>
                    <option value="D">Zone D</option>
                    <option value="E">Zone E</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1.5">{t('الممر (Aisle)', 'Aisle')} *</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={locAisle}
                    onChange={(e) => setLocAisle(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1.5">{t('العمود (Shelf)', 'Shelf')} *</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={locShelf}
                    onChange={(e) => setLocShelf(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1.5">{t('الرف (Bin)', 'Bin')} *</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={locBin}
                    onChange={(e) => setLocBin(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1.5">{t('سعة التخزين القصوى (قطعة)', 'Max Capacity (Units)')}</label>
                  <input
                    type="number"
                    min="1"
                    value={locCapacity}
                    onChange={(e) => setLocCapacity(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1.5">{t('حالة الرف', 'Status')}</label>
                  <select
                    value={locStatus}
                    onChange={(e) => setLocStatus(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                  >
                    <option value="ACTIVE">{t('نشط وجاهز للتخزين', 'Active')}</option>
                    <option value="FULL">{t('ممتلئ بالكامل', 'Full')}</option>
                    <option value="MAINTENANCE">{t('تحت الصيانة / معطل', 'Maintenance')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1.5">{t('ملاحظات الرف (نوع القطع الموصى بها)', 'Notes / Category Recommendation')}</label>
                <input
                  type="text"
                  value={locDescription}
                  onChange={(e) => setLocDescription(e.target.value)}
                  placeholder="مثال: مخصص لفلاتر الزيت، حساسات ABS، طلمبات مياه..."
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-slate-50 border-slate-300'}`}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-zinc-400 hover:bg-white/5"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer transition"
                >
                  {isSubmitting ? t('جاري الحفظ...', 'Saving...') : t('حفظ الرف', 'Save Location')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl text-center space-y-4 ${isDark ? 'bg-[#111116] border-red-500/20 text-white' : 'bg-white border-red-200 text-slate-900'}`}>
            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-base">
              {t('تأكيد الحذف النهائي', 'Confirm Permanent Deletion')}
            </h3>

            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {deleteConfirmTarget.type === 'CLEAR_LOCATIONS'
                ? t('هل أنت متأكد من رغبتك في حذف وتفريغ كافة أرفف ومواقع التخزين في المستودعات؟', 'Are you sure you want to delete all shelf bin locations?')
                : `${t('هل أنت متأكد من حذف:', 'Are you sure you want to delete:')} ${deleteConfirmTarget.name}؟`}
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-zinc-400 hover:bg-white/5 cursor-pointer"
              >
                {t('تراجع', 'Cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md cursor-pointer transition"
              >
                {isSubmitting ? t('جاري الحذف...', 'Deleting...') : t('نعم، حذف نهائي', 'Yes, Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
