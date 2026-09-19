import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Search, 
  Plus, 
  X,
  Boxes
} from 'lucide-react';
import { WarehouseLocation, InventoryItem, PartMaster, Warehouse, Branch } from '../../types/erp';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { createWarehouseLocation } from '../../lib/firestoreService';

interface InventoryLocationsViewProps {
  locations: WarehouseLocation[];
  inventory: InventoryItem[];
  parts: PartMaster[];
  warehouses: Warehouse[];
  branches: Branch[];
  onSelectPart: (part: PartMaster) => void;
  onOpenMovementModal: (part?: PartMaster) => void;
}

export const InventoryLocationsView: React.FC<InventoryLocationsViewProps> = ({
  locations,
  inventory,
  parts,
  warehouses,
  branches,
  onSelectPart,
  onOpenMovementModal
}) => {
  const { activeBranch, canManageWarehouseLocations } = useAuth();
  const { isDark } = useTheme();

  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBinForInspect, setSelectedBinForInspect] = useState<WarehouseLocation | null>(null);
  
  // New Location Form State
  const [showAddLocModal, setShowAddLocModal] = useState<boolean>(false);
  const [newZone, setNewZone] = useState('A');
  const [newAisle, setNewAisle] = useState('01');
  const [newShelf, setNewShelf] = useState('01');
  const [newBin, setNewBin] = useState('01');
  const [newCapacity, setNewCapacity] = useState(30);
  const [newNotes, setNewNotes] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);

  // Distinct Zones
  const zones = useMemo(() => {
    const set = new Set<string>();
    locations.forEach(l => set.add(l.zone));
    return Array.from(set).sort();
  }, [locations]);

  // Filtered Locations
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      if (selectedZone !== 'ALL' && loc.zone !== selectedZone) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesCode = loc.code.toLowerCase().includes(term);
        const matchesNotes = (loc.notes || '').toLowerCase().includes(term);
        if (!matchesCode && !matchesNotes) return false;
      }
      return true;
    });
  }, [locations, selectedZone, searchTerm]);

  // Aggregate inventory by location
  const inventoryByLocation = useMemo(() => {
    const map: Record<string, { items: InventoryItem[]; totalUnits: number }> = {};
    inventory.forEach((inv) => {
      const key = inv.locationId || inv.locationCode;
      if (!map[key]) {
        map[key] = { items: [], totalUnits: 0 };
      }
      map[key].items.push(inv);
      map[key].totalUnits += inv.quantity;
    });
    return map;
  }, [inventory]);

  // Handle Add Location
  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLoc(true);
    try {
      const code = `${newZone}-${newAisle.padStart(2, '0')}-${newShelf.padStart(2, '0')}-${newBin.padStart(2, '0')}`;
      const defaultWh = warehouses[0] || { id: 'wh_main', name: 'المستودع الرئيسي' };
      
      await createWarehouseLocation({
        warehouseId: defaultWh.id,
        warehouseName: defaultWh.name,
        branchId: activeBranch.id,
        zone: newZone.toUpperCase(),
        aisle: newAisle.padStart(2, '0'),
        shelf: newShelf.padStart(2, '0'),
        bin: newBin.padStart(2, '0'),
        code,
        capacity: Number(newCapacity),
        status: 'ACTIVE',
        notes: newNotes.trim()
      });

      setShowAddLocModal(false);
      setNewNotes('');
    } catch (err) {
      console.error('Failed to create location:', err);
    } finally {
      setSavingLoc(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              إدارة أرفف ومواقع التخزين بالمستودع
            </h1>
            <span
              className={`text-xs px-3 py-1 rounded-full font-mono font-bold border ${
                isDark ? 'bg-zinc-800 text-emerald-400 border-white/10' : 'bg-slate-200 text-emerald-800 border-slate-300'
              }`}
            >
              {filteredLocations.length} رف نشط
            </span>
          </div>
          <p className={`text-xs font-medium mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
            المستودع الرئيسي (فرع الحرفيين): المنطقة (Zone) ← الممر (Aisle) ← الرف (Shelf) ← الصندوق (Bin)
          </p>
        </div>

        {canManageWarehouseLocations && (
          <button
            onClick={() => setShowAddLocModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition shadow-sm self-start sm:self-auto ${
              isDark
                ? 'bg-white hover:bg-zinc-200 text-black'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة رف جديد +</span>
          </button>
        )}
      </div>

      {/* Filter and Zone Selector Tabs */}
      <div
        className={`rounded-2xl p-4 space-y-3 shadow-sm border transition-colors ${
          isDark ? 'bg-[#111116] border-white/10' : 'bg-white border-slate-200'
        }`}
      >
        
        {/* Zone selection buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className={`font-bold ml-1 text-xs shrink-0 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
            مناطق المستودع:
          </span>
          <button
            onClick={() => setSelectedZone('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
              selectedZone === 'ALL'
                ? isDark
                  ? 'bg-white text-black'
                  : 'bg-slate-900 text-white'
                : isDark
                ? 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/5'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            جميع المناطق ({locations.length})
          </button>

          {zones.map((z) => {
            const count = locations.filter(l => l.zone === z).length;
            let zoneDesc = 'عام';
            if (z === 'A') zoneDesc = 'المحرك والشاسيه';
            else if (z === 'B') zoneDesc = 'الفرامل والتعليق';
            else if (z === 'C') zoneDesc = 'الهيكل والإضاءة';
            else if (z === 'D') zoneDesc = 'الكهرباء';

            return (
              <button
                key={z}
                onClick={() => setSelectedZone(z)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                  selectedZone === z
                    ? isDark
                      ? 'bg-white text-black'
                      : 'bg-slate-900 text-white'
                    : isDark
                    ? 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/5'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <span>المنطقة {z}</span>
                <span className="text-[10px] opacity-75 font-normal">({zoneDesc} • {count})</span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className={`w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث برمز الرف (مثل A-03-02-07)، المنطقة، أو ملاحظات الصنف..."
            className={`w-full rounded-xl pr-9 pl-4 py-2.5 text-xs focus:outline-none transition border ${
              isDark
                ? 'bg-[#09090c] border-white/10 text-white placeholder-zinc-500 focus:border-emerald-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
            }`}
          />
        </div>

      </div>

      {/* Grid of Storage Bins */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredLocations.map((loc) => {
          const locInv = inventoryByLocation[loc.id] || inventoryByLocation[loc.code] || { items: [], totalUnits: 0 };
          const occupancyRate = Math.min(100, Math.round((locInv.totalUnits / (loc.capacity || 1)) * 100));

          return (
            <div
              key={loc.id}
              onClick={() => setSelectedBinForInspect(loc)}
              className={`rounded-2xl p-4 cursor-pointer transition shadow-sm group flex flex-col justify-between border ${
                isDark
                  ? 'bg-[#111116] border-white/5 hover:border-white/20'
                  : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                        isDark ? 'bg-zinc-900 border-white/10 text-emerald-400' : 'bg-slate-100 border-slate-200 text-emerald-700'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-mono font-bold text-xs tracking-wider text-emerald-600 dark:text-emerald-400">
                      {loc.code}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                      isDark ? 'bg-zinc-900 text-zinc-300 border-zinc-800' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    المنطقة {loc.zone}
                  </span>
                </div>

                <div className={`text-xs truncate mb-3 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  {loc.notes || `الممر ${loc.aisle} • الرف ${loc.shelf} • الخانة ${loc.bin}`}
                </div>

                {/* Occupancy Meter */}
                <div className="space-y-1 mb-3">
                  <div className={`flex items-center justify-between text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    <span>نسبة الإشغال</span>
                    <span className="font-mono text-xs font-bold">
                      {locInv.totalUnits} / {loc.capacity} ({occupancyRate}%)
                    </span>
                  </div>
                  <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`}>
                    <div
                      className={`h-1.5 rounded-full ${occupancyRate > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${occupancyRate}%` }}
                    />
                  </div>
                </div>

                {/* Parts Preview in this bin */}
                <div className="space-y-1.5">
                  <div className={`text-[11px] font-bold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                    القطع المخزنة ({locInv.items.length}):
                  </div>
                  {locInv.items.length === 0 ? (
                    <div className={`text-xs italic ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>رف شاغر (فارغ)</div>
                  ) : (
                    <div className="space-y-1">
                      {locInv.items.slice(0, 2).map((item) => (
                        <div key={item.id} className="text-xs flex items-center justify-between font-medium">
                          <span className="font-mono font-bold truncate ml-1 text-emerald-600 dark:text-emerald-400">
                            {item.partNumber}
                          </span>
                          <span className="font-mono shrink-0 opacity-80">
                            {item.quantity} قطعة
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={`mt-4 pt-2.5 border-t flex items-center justify-between text-xs font-medium ${isDark ? 'border-white/5 text-zinc-400' : 'border-slate-100 text-slate-500'}`}>
                <span>معاينة الرف</span>
                <span className="font-bold group-hover:underline text-emerald-600 dark:text-emerald-400">عرض المحتويات ←</span>
              </div>

            </div>
          );
        })}
      </div>

      {/* Bin Inspector Modal */}
      {selectedBinForInspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
          <div 
            className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
              isDark ? 'bg-[#0f0f13] border-white/10 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header */}
            <div className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b ${isDark ? 'bg-[#09090c] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${isDark ? 'bg-zinc-800 border-white/10 text-emerald-400' : 'bg-slate-200 border-slate-300 text-emerald-700'}`}>
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-mono font-bold text-base tracking-wider text-emerald-600 dark:text-emerald-400">
                      الرف: {selectedBinForInspect.code}
                    </h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold border ${isDark ? 'bg-zinc-900 text-zinc-300 border-zinc-800' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                      المنطقة {selectedBinForInspect.zone}
                    </span>
                  </div>
                  <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    الممر {selectedBinForInspect.aisle} • الرف {selectedBinForInspect.shelf} • الخانة {selectedBinForInspect.bin}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedBinForInspect(null)}
                className={`p-1.5 rounded-full transition ${isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              
              {/* Bin Summary */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>السعة القصوى</span>
                  <div className="text-xl font-bold font-mono mt-1">
                    {selectedBinForInspect.capacity} قطعة
                  </div>
                </div>
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>القطع المخزنة</span>
                  <div className="text-xl font-bold font-mono mt-1 text-emerald-600 dark:text-emerald-400">
                    {inventoryByLocation[selectedBinForInspect.id]?.totalUnits || inventoryByLocation[selectedBinForInspect.code]?.totalUnits || 0} قطعة
                  </div>
                </div>
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>الحالة</span>
                  <div className="text-xs font-mono font-bold mt-2 text-emerald-600 dark:text-emerald-400">
                    {selectedBinForInspect.status === 'ACTIVE' ? 'نشط متاح' : selectedBinForInspect.status}
                  </div>
                </div>
              </div>

              {/* Stored Parts Table */}
              <div>
                <h4 className="text-xs font-bold mb-3">
                  قطع الغيار المخزنة فعلياً في هذا الموقع
                </h4>

                {(() => {
                  const items = inventoryByLocation[selectedBinForInspect.id]?.items || inventoryByLocation[selectedBinForInspect.code]?.items || [];
                  if (items.length === 0) {
                    return (
                      <div className={`p-8 text-center rounded-xl border text-xs ${isDark ? 'bg-[#141418] border-white/5 text-zinc-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                        هذا الرف شاغر حالياً. جاهز لاستقبال وتخزين قطع جديدة.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {items.map((item) => {
                        const matchedPart = parts.find(p => p.id === item.partId || p.partNumber === item.partNumber);
                        return (
                          <div
                            key={item.id}
                            className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                              isDark ? 'bg-[#141418] border-white/5' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs tracking-wider text-emerald-600 dark:text-emerald-400">
                                  {item.partNumber}
                                </span>
                                {matchedPart && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-200 border-slate-300 text-slate-700'}`}>
                                    {matchedPart.brand}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-bold mt-1">
                                {item.partNameAr || item.partNameEn}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-left">
                                <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                  {item.quantity} قطعة
                                </div>
                                <div className="text-[10px] opacity-70">
                                  متاح للصرف: {item.availableQuantity}
                                </div>
                              </div>

                              {matchedPart && (
                                <button
                                  onClick={() => {
                                    onSelectPart(matchedPart);
                                    setSelectedBinForInspect(null);
                                  }}
                                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition border ${
                                    isDark
                                      ? 'bg-zinc-900 hover:bg-white hover:text-black text-zinc-200 border-white/10'
                                      : 'bg-white hover:bg-slate-900 hover:text-white text-slate-800 border-slate-300'
                                  }`}
                                >
                                  تفاصيل ←
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Footer */}
            <div className={`px-4 sm:px-6 py-3 border-t text-xs flex justify-end ${isDark ? 'bg-[#09090c] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <button
                onClick={() => setSelectedBinForInspect(null)}
                className={`px-4 py-1.5 rounded-full font-bold transition border text-xs ${
                  isDark
                    ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Add New Bin Location Modal */}
      {showAddLocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
          <div 
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
              isDark ? 'bg-[#0f0f13] border-white/10 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'bg-[#09090c] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <h3 className="font-bold text-sm">إضافة رف / موقع تخزين جديد</h3>
              <button onClick={() => setShowAddLocModal(false)} className={`p-1.5 rounded-full ${isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLocation} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-bold mb-1 opacity-80">المنطقة</label>
                  <input
                    type="text"
                    value={newZone}
                    onChange={(e) => setNewZone(e.target.value.toUpperCase())}
                    placeholder="A"
                    className={`w-full rounded-xl p-2.5 font-mono font-bold uppercase text-center border ${
                      isDark ? 'bg-[#09090c] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    maxLength={2}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 opacity-80">الممر</label>
                  <input
                    type="text"
                    value={newAisle}
                    onChange={(e) => setNewAisle(e.target.value)}
                    placeholder="01"
                    className={`w-full rounded-xl p-2.5 font-mono text-center border ${
                      isDark ? 'bg-[#09090c] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    maxLength={2}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 opacity-80">المستوى</label>
                  <input
                    type="text"
                    value={newShelf}
                    onChange={(e) => setNewShelf(e.target.value)}
                    placeholder="01"
                    className={`w-full rounded-xl p-2.5 font-mono text-center border ${
                      isDark ? 'bg-[#09090c] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    maxLength={2}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 opacity-80">الخانة</label>
                  <input
                    type="text"
                    value={newBin}
                    onChange={(e) => setNewBin(e.target.value)}
                    placeholder="01"
                    className={`w-full rounded-xl p-2.5 font-mono text-center border ${
                      isDark ? 'bg-[#09090c] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                    maxLength={2}
                    required
                  />
                </div>
              </div>

              <div className={`p-3 rounded-xl border text-center font-mono ${isDark ? 'bg-[#09090c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-xs opacity-75">رمز الرف: </span>
                <span className="font-bold text-xs tracking-wider text-emerald-600 dark:text-emerald-400">
                  {newZone}-{newAisle.padStart(2, '0')}-{newShelf.padStart(2, '0')}-{newBin.padStart(2, '0')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">سعة الرف الاستيعابية (قطعة)</label>
                <input
                  type="number"
                  min="1"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(Number(e.target.value))}
                  className={`w-full rounded-xl p-2.5 font-mono border ${
                    isDark ? 'bg-[#09090c] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 opacity-80">ملاحظات / وصف الموقع</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="مثال: مقصات ومساعدين مرسيدس S-Class"
                  className={`w-full rounded-xl p-2.5 border ${
                    isDark ? 'bg-[#09090c] border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddLocModal(false)}
                  className={`px-4 py-2 rounded-full font-bold text-xs transition border ${
                    isDark ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingLoc}
                  className={`px-5 py-2 rounded-full font-bold transition text-xs ${
                    isDark ? 'bg-white hover:bg-zinc-200 text-black' : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {savingLoc ? 'جاري الإنشاء...' : 'إنشاء موقع الرف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
