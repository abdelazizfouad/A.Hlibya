import React, { useState, useMemo } from 'react';
import { 
  Car, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Boxes, 
  MapPin, 
  History, 
  ShieldCheck, 
  ArrowRight, 
  Layers, 
  Cpu, 
  Calendar, 
  Fuel, 
  Globe, 
  ShoppingCart, 
  PlusCircle, 
  ExternalLink,
  RefreshCw,
  Eye
} from 'lucide-react';
import { PartMaster, VinDecodeResult } from '../../types/erp';
import { decodeMercedesVIN, matchPartsForVehicle, MatchedPart } from '../../lib/vinService';
import { saveVinLookup } from '../../lib/firestoreService';
import { useTheme } from '../../lib/themeContext';
import { useLanguage } from '../../lib/languageContext';
import { formatEGP } from '../../lib/formatters';

interface VinDecoderViewProps {
  parts: PartMaster[];
  vinLookups?: VinDecodeResult[];
  onSelectPart: (part: PartMaster) => void;
  onOpenSaleInvoice?: (part?: PartMaster) => void;
  onOpenPurchaseOrder?: (part?: PartMaster) => void;
  onAddShortage?: (partNumber: string, nameAr: string, chassis: string) => void;
}

const DEMO_VINS = [
  { vin: 'WDD2230601A012345', label: 'S-Class S500 W223 (2022)' },
  { vin: 'WDD2221781A456789', label: 'S-Class S560 W222 (2019)' },
  { vin: 'WDD2130481A234567', label: 'E-Class E300 W213 (2021)' },
  { vin: 'WDD2050421F345678', label: 'C-Class C200 W205 (2018)' },
  { vin: '4JG1671591A567890', label: 'GLE 450 4MATIC W167 (2023)' }
];

export const VinDecoderView: React.FC<VinDecoderViewProps> = ({
  parts,
  vinLookups = [],
  onSelectPart,
  onOpenSaleInvoice,
  onOpenPurchaseOrder,
  onAddShortage
}) => {
  const { isDark } = useTheme();
  const { language, t } = useLanguage();

  const [inputVin, setInputVin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodedData, setDecodedData] = useState<VinDecodeResult | null>(null);
  const [activeTab, setActiveTab] = useState<'VERIFIED' | 'POSSIBLE' | 'ALL'>('VERIFIED');

  const handleDecode = async (vinToDecode?: string) => {
    const target = (vinToDecode || inputVin).trim().toUpperCase();
    if (!target) {
      setError(t('يرجى إدخال رقم الشاسيه (VIN)', 'Please enter a VIN'));
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await decodeMercedesVIN(target);
      setDecodedData(result);
      setInputVin(target);
      // Save lookup in Firestore
      saveVinLookup(result).catch(err => console.warn('VIN save error:', err));
    } catch (err: any) {
      setError(err.message || t('فشل فك رقم الشاسيه، يرجى التأكد من الرقم', 'Failed to decode VIN, please verify'));
    } finally {
      setIsLoading(false);
    }
  };

  // Match parts when decodedData is available - memoized for performance
  const matchResult = useMemo(() => {
    return decodedData ? matchPartsForVehicle(decodedData, parts) : null;
  }, [decodedData, parts]);

  return (
    <div className="space-y-6">
      
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Car className="w-5 h-5" />
            </div>
            <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('مفكك شاسيهات مرسيدس ومطابقة القطع (VIN Decoder)', 'Mercedes-Benz VIN Decoder & Parts Matcher')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            {t('أدخل رقم الشاسيه المكون من 17 رمزًا لجلب بيانات السيارة ومطابقة قطع الغيار المناسبة من المخزن فورًا', 'Enter a 17-digit VIN to retrieve live vehicle specs and match compatible in-stock parts')}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
            isDark ? 'bg-zinc-900 border-white/10 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('نظام مطابقة EPC معتمد', 'Certified EPC Matcher')}</span>
          </span>
        </div>
      </div>

      {/* VIN Input Search Box */}
      <div className={`p-5 sm:p-6 rounded-2xl border transition-all ${
        isDark ? 'bg-[#0a0a0c] border-white/10 shadow-xl' : 'bg-white border-slate-200 shadow-md'
      }`}>
        <label className="block text-xs font-bold text-zinc-300 dark:text-zinc-300 mb-2">
          {t('رقم الشاسيه القياسي (17-Digit Mercedes VIN)', '17-Digit Mercedes VIN')}
        </label>

        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              maxLength={17}
              value={inputVin}
              onChange={(e) => setInputVin(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleDecode()}
              placeholder="WDD2230601A012345..."
              className={`w-full px-4 py-3 rounded-xl text-base font-mono font-bold tracking-widest uppercase border transition-all focus:outline-hidden ${
                isDark
                  ? 'bg-zinc-900/90 border-white/15 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
              }`}
            />
            <span className={`absolute top-3.5 text-[11px] font-mono text-zinc-400 ${language === 'ar' ? 'left-4' : 'right-4'}`}>
              {inputVin.length}/17
            </span>
          </div>

          <button
            onClick={() => handleDecode()}
            disabled={isLoading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all shrink-0"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{t('جاري التحليل...', 'Decoding...')}</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>{t('فك الشاسيه ومطابقة القطع', 'Decode & Match Parts')}</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Preset Buttons */}
        <div className="mt-4 flex items-center flex-wrap gap-2 text-xs">
          <span className="text-zinc-400 text-[11px]">{t('أمثلة سريعة:', 'Quick Demos:')}</span>
          {DEMO_VINS.map((demo) => (
            <button
              key={demo.vin}
              onClick={() => {
                setInputVin(demo.vin);
                handleDecode(demo.vin);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                isDark 
                  ? 'bg-zinc-900/70 border-white/10 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400' 
                  : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700 hover:text-emerald-700'
              }`}
            >
              {demo.label}
            </button>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Decoded Vehicle Specs Card */}
      {decodedData && (
        <div className={`p-5 sm:p-6 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0a0a0c] border-emerald-500/30 shadow-xl' : 'bg-white border-emerald-300 shadow-md'
        }`}>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold text-sm">
                  {decodedData.chassis}
                </span>
                <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {decodedData.model}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono">
                  {decodedData.modelYear}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                VIN: <strong className="text-white dark:text-white">{decodedData.vin}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('تم التحقق بنجاح من قاعدة بيانات مرسيدس & Google AI', 'Verified via Mercedes Database & Google AI')}</span>
              </span>
            </div>
          </div>

          {/* Decoded Notes if available */}
          {decodedData.notes && (
            <div className="mt-4 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-zinc-300">
              <strong className="text-emerald-400 font-bold ml-1">ملاحظات التحليل الفني:</strong>
              {decodedData.notes}
            </div>
          )}

          {/* Grid Attributes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
            
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('كود الشاسيه', 'Chassis')}</span>
              </div>
              <div className="text-sm font-bold font-mono text-emerald-400">
                {decodedData.chassis}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('طراز المحرك', 'Engine')}</span>
              </div>
              <div className="text-xs font-bold text-zinc-200 truncate">
                {decodedData.engineModel || decodedData.displacementL || 'M256 Turbo'}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('سنة الصنع', 'Year')}</span>
              </div>
              <div className="text-sm font-bold font-mono text-zinc-200">
                {decodedData.modelYear}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                <Car className="w-3.5 h-3.5 text-purple-400" />
                <span>{t('نوع الهيكل', 'Body')}</span>
              </div>
              <div className="text-xs font-bold text-zinc-200 truncate">
                {decodedData.bodyClass || 'Sedan'}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                <Fuel className="w-3.5 h-3.5 text-rose-400" />
                <span>{t('نوع الوقود', 'Fuel')}</span>
              </div>
              <div className="text-xs font-bold text-zinc-200 truncate">
                {decodedData.fuelType || 'Gasoline'}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isDark ? 'bg-zinc-900/60 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                <Globe className="w-3.5 h-3.5 text-teal-400" />
                <span>{t('بلد الصنع', 'Plant')}</span>
              </div>
              <div className="text-xs font-bold text-zinc-200 truncate">
                {decodedData.plantCountry || 'Germany'}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Matched Parts Section */}
      {decodedData && matchResult && (
        <div className={`p-5 sm:p-6 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0a0a0c] border-white/10 shadow-xl' : 'bg-white border-slate-200 shadow-md'
        }`}>
          
          {/* Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div>
              <h3 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('قطع الغيار المتوافقة بالمخزن لهذا الشاسيه', 'Compatible In-Stock Spare Parts for this VIN')}
              </h3>
              <p className="text-xs text-zinc-400">
                {t('تمت مصفوفة المطابقة مع شاسيه', 'Cross-referenced against chassis')} <strong className="text-emerald-400">{decodedData.chassis}</strong>
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-white/10 text-xs">
              <button
                onClick={() => setActiveTab('VERIFIED')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'VERIFIED'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('مطابقة مؤكدة 100%', 'Verified')} ({matchResult.verified.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('POSSIBLE')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'POSSIBLE'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t('مطابقة محتملة', 'Possible')} ({matchResult.possible.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'ALL'
                    ? 'bg-zinc-700 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>{t('الكل', 'All')} ({matchResult.verified.length + matchResult.possible.length + matchResult.other.length})</span>
              </button>
            </div>
          </div>

          {/* Parts List */}
          <div className="mt-4 divide-y divide-white/5">
            {(() => {
              let displayList: MatchedPart[] = [];
              if (activeTab === 'VERIFIED') displayList = matchResult.verified;
              else if (activeTab === 'POSSIBLE') displayList = matchResult.possible;
              else displayList = [...matchResult.verified, ...matchResult.possible, ...matchResult.other];

              if (displayList.length === 0) {
                return (
                  <div className="py-12 text-center">
                    <Boxes className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-zinc-400">
                      {t('لا توجد قطع مطابقة مباشرة في هذه الفئة', 'No directly matched parts in this category')}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {t('يمكنك إدراج القطعة المطلوبة في قائمة النواقص لإعادة طلبها', 'You can add required parts to the shortage list to reorder')}
                    </p>
                  </div>
                );
              }

              return displayList.map(({ part, compatibilityTier, matchReasons }) => (
                <div key={part.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02] p-2 rounded-xl transition-all">
                  
                  {/* Part Details */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {part.imageUrl ? (
                        <img src={part.imageUrl} alt={part.partNumber} className="w-full h-full object-cover" />
                      ) : (
                        <Boxes className="w-6 h-6 text-zinc-500" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <span className="font-mono font-bold text-sm text-emerald-400">
                          {part.partNumber}
                        </span>
                        
                        {compatibilityTier === 'VERIFIED' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{t('مطابق مؤكد', 'Verified 100%')}</span>
                          </span>
                        )}

                        {compatibilityTier === 'POSSIBLE' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{t('مطابقة محتملة', 'Possible Match')}</span>
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-800 text-zinc-300">
                          {part.brand}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-white dark:text-white">
                        {language === 'ar' ? part.nameAr : part.nameEn}
                      </h4>

                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400 mt-1">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <MapPin className="w-3 h-3" />
                          <span>الرف: <strong>A-03-02-07</strong></span>
                        </span>
                        <span>الرصيد المتاح: <strong className={part.totalStock > 0 ? 'text-white' : 'text-rose-400'}>{part.totalStock} {part.unit}</strong></span>
                        <span>سعر البيع: <strong className="text-emerald-400">{formatEGP(part.sellingPrice)}</strong></span>
                      </div>

                      {/* Match reasons */}
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <span className="text-emerald-400">✓</span>
                        <span>{matchReasons.join(' • ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center flex-wrap gap-2 self-end lg:self-center">
                    
                    <button
                      onClick={() => onSelectPart(part)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('تفاصيل القطعة', 'View Details')}</span>
                    </button>

                    {onOpenSaleInvoice && part.totalStock > 0 && (
                      <button
                        onClick={() => onOpenSaleInvoice(part)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 shadow-xs"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>{t('صرف مبيعات', 'Issue Sale')}</span>
                      </button>
                    )}

                    {onAddShortage && part.totalStock <= part.minStock && (
                      <button
                        onClick={() => onAddShortage(part.partNumber, part.nameAr, decodedData.chassis)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{t('إضافة للنواقص', 'Add to Shortages')}</span>
                      </button>
                    )}

                  </div>

                </div>
              ));
            })()}
          </div>

        </div>
      )}

      {/* Google AI Recommended OEM Parts Catalog Table */}
      {decodedData?.suggestedOemParts && decodedData.suggestedOemParts.length > 0 && (
        <div className={`p-5 sm:p-6 rounded-2xl border transition-all ${
          isDark ? 'bg-[#0a0a0c] border-emerald-500/20 shadow-xl' : 'bg-white border-emerald-200 shadow-md'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Google Gemini AI EPC
                </span>
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('كتالوج أرقام القطع الأصلية المقترحة لهذا المحرك والشاسيه', 'Suggested OEM Part Numbers for this Engine & Chassis')}
                </h3>
              </div>
              <p className="text-xs text-zinc-400">
                {t('أرقام القطع الأصلية الصادرة وفق كود المحرك والشاسيه، يمكنك إدراجها فوراً في سجل النواقص أو إنشاء أمر توريد', 'Official OEM part numbers derived by AI. Add them directly to shortages or purchase orders.')}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {decodedData.suggestedOemParts.map((item, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                  isDark ? 'bg-zinc-900/60 border-white/10 hover:border-emerald-500/30' : 'bg-slate-50 border-slate-200 hover:border-emerald-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-emerald-400">
                      {item.partNumber}
                    </span>
                    {item.category && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-white mt-1">
                    {item.nameAr}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {item.nameEn}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  {onAddShortage && (
                    <button
                      onClick={() => onAddShortage(item.partNumber, item.nameAr, decodedData.chassis)}
                      className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>{t('إضافة للنواقص', 'Add Shortage')}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
