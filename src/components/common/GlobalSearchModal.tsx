import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  X, 
  Layers, 
  MapPin, 
  Car, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Tag, 
  Boxes,
  Sparkles,
  RefreshCw,
  Copy,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  CornerDownRight,
  Flame
} from 'lucide-react';
import { PartMaster, WarehouseLocation } from '../../types/erp';
import { matchPartFlexible, PartSearchResult } from '../../utils/searchUtils';
import { searchPartsFirestore } from '../../lib/firestoreService';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: PartMaster[];
  locations: WarehouseLocation[];
  onSelectPart: (part: PartMaster) => void;
  onSelectLocation?: (location: WarehouseLocation) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  parts,
  locations,
  onSelectPart,
  onSelectLocation
}) => {
  const { isDark } = useTheme();
  const { language, t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'PARTS' | 'ALTERNATIVES' | 'LOCATIONS'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [remoteParts, setRemoteParts] = useState<PartMaster[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchCache = useRef(new Map<string, { expiresAt: number; parts: PartMaster[] }>());
  const searchController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setSearchTerm('');
      setActiveTab('ALL');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !searchTerm.trim()) {
      searchController.current?.abort();
      setRemoteParts([]);
      return;
    }
    let cancelled = false;
    const normalizedTerm = searchTerm.trim().toUpperCase();
    const timer = window.setTimeout(() => {
      const cached = searchCache.current.get(normalizedTerm);
      if (cached && cached.expiresAt > Date.now()) {
        setRemoteParts(cached.parts);
        return;
      }
      searchController.current?.abort();
      const controller = new AbortController();
      searchController.current = controller;
      searchPartsFirestore(normalizedTerm, 100, controller.signal).then(results => {
        // Keep the client cache short-lived so a part registered from another
        // browser becomes searchable without waiting for a long poll cycle.
        searchCache.current.set(normalizedTerm, { expiresAt: Date.now() + 5_000, parts: results });
        if (!cancelled) setRemoteParts(results);
      }).catch(error => {
        if (error?.name !== 'AbortError') console.warn('Global search failed:', error);
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      searchController.current?.abort();
    };
  }, [isOpen, searchTerm]);

  // Global hotkey Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const copyPartNumber = (e: React.MouseEvent, pNum: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(pNum);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Perform flexible fuzzy/partial/superseded search
  const partResults = useMemo(() => {
    return remoteParts.map(part => matchPartFlexible(searchTerm, part));
  }, [remoteParts, searchTerm]);

  // Filtered locations
  const termLower = searchTerm.trim().toLowerCase();
  const locationResults = useMemo(() => {
    if (!termLower) return [];
    return (locations || []).filter((l) =>
      l.code.toLowerCase().includes(termLower) ||
      l.zone.toLowerCase().includes(termLower) ||
      (l.notes && l.notes.toLowerCase().includes(termLower))
    );
  }, [locations, termLower]);

  // Filter parts with superseded or alternative matches specifically
  const alternativeMatches = useMemo(() => {
    return partResults.filter(r => r.matchType === 'superseded' || r.matchType === 'alternative');
  }, [partResults]);

  // Sliced items for display
  const displayedParts = useMemo(() => {
    if (activeTab === 'ALTERNATIVES') return alternativeMatches.slice(0, 50);
    if (activeTab === 'LOCATIONS') return [];
    return partResults.slice(0, 50);
  }, [partResults, alternativeMatches, activeTab]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-14 px-3 sm:px-4 bg-black/80 backdrop-blur-xl select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -20 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`w-full max-w-3xl rounded-2xl sm:rounded-3xl border shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[85vh] ${
            isDark
              ? 'bg-[#0b0c10]/95 border-white/15 text-zinc-100'
              : 'bg-white/95 border-slate-200/90 text-slate-900'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Header & Search Input Box */}
          <div
            className={`p-4 sm:p-5 border-b relative ${
              isDark
                ? 'bg-gradient-to-b from-[#14161f] to-[#0c0d12] border-white/10'
                : 'bg-gradient-to-b from-slate-50 to-slate-100 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Mercedes-Benz Star Badge */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner ${
                  isDark
                    ? 'bg-zinc-900/90 border-white/20 text-white'
                    : 'bg-slate-900 border-slate-800 text-white'
                }`}
              >
                <Search className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>

              {/* Interactive Search Input */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-500 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    MBUX SMART SEARCH • محرك البحث الذكي لقطع مرسيدس
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline">
                    بحث ذكي بالأرقام الجزئية، البدائل والشاسيه
                  </span>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="اكتب رقم القطعة (223330 / A223)، البديل، الشاسيه (W223)، كود الرف، أو الاسم..."
                  className={`w-full bg-transparent text-sm sm:text-base font-medium focus:outline-none placeholder:text-zinc-500 mt-1 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                />
              </div>

              {/* Clear & Esc Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className={`p-1.5 rounded-lg border transition ${
                      isDark
                        ? 'bg-zinc-800 hover:bg-zinc-700 border-white/10 text-zinc-300'
                        : 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-700'
                    }`}
                    title="مسح البحث"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold uppercase transition ${
                    isDark
                      ? 'bg-zinc-800/80 hover:bg-zinc-700 border-white/10 text-zinc-300'
                      : 'bg-slate-200/80 hover:bg-slate-300 border-slate-300 text-slate-700'
                  }`}
                >
                  ESC
                </button>
              </div>
            </div>

            {/* Quick Suggestion Chips & Fast Tabs */}
            <div className="mt-3.5 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
              
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'ALL'
                      ? isDark
                        ? 'bg-white text-black shadow-xs'
                        : 'bg-slate-900 text-white shadow-xs'
                      : isDark
                      ? 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/5'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>الكل ({partResults.length + locationResults.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('PARTS')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'PARTS'
                      ? isDark
                        ? 'bg-white text-black shadow-xs'
                        : 'bg-slate-900 text-white shadow-xs'
                      : isDark
                      ? 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/5'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>قطع الغيار ({partResults.length})</span>
                </button>

                {alternativeMatches.length > 0 && (
                  <button
                    onClick={() => setActiveTab('ALTERNATIVES')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      activeTab === 'ALTERNATIVES'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : isDark
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>البدائل والمستبدلة ({alternativeMatches.length})</span>
                  </button>
                )}

                {locationResults.length > 0 && (
                  <button
                    onClick={() => setActiveTab('LOCATIONS')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      activeTab === 'LOCATIONS'
                        ? isDark
                          ? 'bg-white text-black shadow-xs'
                          : 'bg-slate-900 text-white shadow-xs'
                        : isDark
                        ? 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/5'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>الأرفف ({locationResults.length})</span>
                  </button>
                )}
              </div>

              {/* Fast Example Tags */}
              <div className="hidden lg:flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 font-mono">أمثلة سريعة:</span>
                {['223330', 'W223', 'W213', 'تيل فرامل', 'تيربو', 'مساعد', 'A-03'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSearchTerm(tag)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition border ${
                      isDark
                        ? 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white border-white/5'
                        : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

            </div>
          </div>

          {/* Results List Container */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 custom-scrollbar">
            
            {/* No matches state */}
            {displayedParts.length === 0 && (activeTab !== 'LOCATIONS' || locationResults.length === 0) && (
              <div
                className={`p-12 text-center rounded-2xl border ${
                  isDark ? 'bg-zinc-900/30 border-white/5 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800/60 border border-white/10 flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 text-zinc-400 opacity-60" />
                </div>
                <div className="text-sm font-bold text-white mb-1">
                  لا توجد نتائج مطابقة للبحث "{searchTerm}"
                </div>
                <div className="text-xs max-w-md mx-auto leading-relaxed text-zinc-400">
                  جرّب البحث بأرقام جزئية (بدون شرطات أو مسافات)، أو باسم الشاسيه (مثل <strong className="text-emerald-400 font-mono">W223</strong> أو <strong className="text-emerald-400 font-mono">W213</strong>)، أو اسم القطعة بالعربي أو الإنجليزي.
                </div>
              </div>
            )}

            {/* Render Parts Cards with 3D Motion */}
            {activeTab !== 'LOCATIONS' && displayedParts.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1 text-[11px] font-bold text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-emerald-400" />
                    <span>نتائج قطع الغيار الذكية ({displayedParts.length})</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-70">
                    انقر على أي بطاقة لفتح التفاصيل والأرفف والبدائل
                  </span>
                </div>

                {displayedParts.map(({ part, matchType, matchedReason, matchedValue }, idx) => {
                  const isLow = part.totalStock <= part.minStock && part.totalStock > 0;
                  const isOut = part.totalStock === 0;
                  const isCopied = copiedId === part.id;

                  return (
                    <motion.div
                      key={part.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: idx * 0.02 }}
                      onClick={() => {
                        onSelectPart(part);
                        onClose();
                      }}
                      className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border cursor-pointer transition-all duration-150 relative group ${
                        isDark
                          ? 'bg-[#101217] hover:bg-[#151821] border-white/10 hover:border-emerald-500/50 shadow-xs hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]'
                          : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-emerald-500/50 shadow-xs hover:shadow-md'
                      }`}
                    >
                      
                      {/* Match Type Badge Highlight (Superseded, Alternative, Exact, Chassis) */}
                      {matchedReason && (
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono ${
                              matchType === 'exact'
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                : matchType === 'superseded'
                                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                                : matchType === 'alternative'
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                : matchType === 'chassis'
                                ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                                : 'bg-zinc-800/80 border-white/10 text-zinc-300'
                            }`}
                          >
                            <Sparkles className="w-3 h-3" />
                            {matchedReason}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        
                        {/* Part Main Info */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          
                          {/* MB Emblem Icon */}
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border transition-transform group-hover:scale-105 ${
                              isDark
                                ? 'bg-gradient-to-b from-zinc-800 to-black border-white/15 text-white shadow-inner'
                                : 'bg-slate-100 border-slate-300 text-slate-900 shadow-xs'
                            }`}
                          >
                            MB
                          </div>

                          {/* Part Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              
                              {/* Part Number & Quick Copy */}
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-sm sm:text-base tracking-wider text-emerald-500">
                                  {part.partNumber}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => copyPartNumber(e, part.partNumber, part.id)}
                                  title="نسخ رقم القطعة"
                                  className={`p-1 rounded-md border transition ${
                                    isCopied
                                      ? 'bg-emerald-500 text-white border-emerald-500'
                                      : isDark
                                      ? 'bg-zinc-800/80 hover:bg-zinc-700 border-white/10 text-zinc-400 hover:text-white'
                                      : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600'
                                  }`}
                                >
                                  {isCopied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>

                              {/* Quality Pill */}
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border ${
                                  part.quality === 'GENUINE_OEM'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : part.quality === 'ORIGINAL'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-zinc-800 text-zinc-300 border-white/10'
                                }`}
                              >
                                {part.quality === 'GENUINE_OEM' ? 'وكالة OEM' : part.quality === 'ORIGINAL' ? 'أصلي مرسيدس' : 'بديل معتمد'}
                              </span>

                              {/* Brand */}
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                                  isDark ? 'bg-zinc-900 border-white/10 text-zinc-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                                }`}
                              >
                                {part.brand || 'Mercedes-Benz'}
                              </span>

                            </div>

                            {/* Arabic Name & English Name */}
                            <div className={`text-xs sm:text-sm font-bold truncate mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {part.nameAr || part.nameEn}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate font-mono mt-0.5">
                              {part.nameEn}
                            </div>

                            {/* Alternative / Superseded Numbers if available */}
                            {((part.supersededNumbers && part.supersededNumbers.length > 0) || (part.alternativeNumbers && part.alternativeNumbers.length > 0)) && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-1">
                                  <CornerDownRight className="w-3 h-3 text-amber-400" />
                                  <span>البدائل والمستبدلات:</span>
                                </span>
                                {(part.supersededNumbers || []).slice(0, 2).map((sup, idx) => (
                                  <span key={idx} className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 line-through">
                                    {sup}
                                  </span>
                                ))}
                                {(part.alternativeNumbers || []).slice(0, 2).map((alt, idx) => (
                                  <span key={idx} className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                                    {alt}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Compatible Chassis Chips */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {(part.compatibility || []).slice(0, 3).map((comp, idx) => (
                                <span
                                  key={idx}
                                  className={`text-[9px] px-2 py-0.5 rounded-full font-mono border flex items-center gap-1 ${
                                    isDark ? 'bg-zinc-900/90 border-white/10 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <Car className="w-2.5 h-2.5 text-emerald-400" />
                                  {comp.chassis} ({comp.model})
                                </span>
                              ))}
                              {(part.compatibility?.length || 0) > 3 && (
                                <span className="text-[9px] text-zinc-500 font-mono">
                                  +{(part.compatibility?.length || 0) - 3} شاسيه إضافي
                                </span>
                              )}
                            </div>

                          </div>
                        </div>

                        {/* Price & Real-Time Stock Status */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5 shrink-0 min-w-[120px]">
                          
                          {/* Selling Price in EGP */}
                          <div className="text-right">
                            <div className="text-base sm:text-lg font-black font-mono text-emerald-500">
                              {(part.sellingPrice || 0).toLocaleString()} <span className="text-xs font-normal">EGP</span>
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              تكلفة: {(part.costPrice || 0).toLocaleString()} EGP
                            </div>
                          </div>

                          {/* Live Stock Badge */}
                          <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5">
                            <span
                              className={`text-[10px] px-2.5 py-1 rounded-lg font-mono font-bold border flex items-center gap-1 ${
                                isOut
                                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                                  : isLow
                                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                                  : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isOut ? 'bg-rose-400' : isLow ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                              <span>{part.totalStock} {part.unit === 'PCS' ? 'قطعة' : part.unit}</span>
                            </span>
                          </div>

                        </div>

                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Render Locations Matches */}
            {activeTab !== 'PARTS' && activeTab !== 'ALTERNATIVES' && locationResults.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between px-1 text-[11px] font-bold text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <span>مواقع وأرفف التخزين بالمستودع ({locationResults.length})</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {locationResults.map((loc) => (
                    <div
                      key={loc.id}
                      onClick={() => {
                        if (onSelectLocation) {
                          onSelectLocation(loc);
                          onClose();
                        }
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                        isDark
                          ? 'bg-[#12141a] hover:bg-[#181b24] border-white/10 text-white'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                          {loc.zone}
                        </div>
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-xs tracking-wider text-emerald-400">
                            {loc.code}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            المنطقة {loc.zone} • الحامل {loc.shelf} ({loc.notes || 'تخزين عام'})
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-white/10 text-zinc-400 bg-zinc-900/50">
                        السعة: {loc.capacity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Footer Bar */}
          <div
            className={`px-4 sm:px-5 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono ${
              isDark ? 'bg-[#0a0b0e] border-white/10 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>نظام الكتالوج المعتمد — البحث يقبل أرقام جزئية، بدون بادئات (A)، وبالبدائل</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span>العملة: <strong className="text-emerald-500">EGP</strong></span>
              <span>ESC للإغلاق</span>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
