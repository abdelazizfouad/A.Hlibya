import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Trash2, 
  Layers, 
  Building2, 
  Boxes, 
  RefreshCw,
  Search,
  Check,
  FileText
} from 'lucide-react';
import { 
  PartMaster, 
  PartQuality, 
  PartCondition, 
  WarehouseLocation, 
  Branch, 
  Warehouse, 
  EpcCategory 
} from '../../types/erp';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { bulkImportParts } from '../../lib/firestoreService';
import catalogData from '../../data/catalog.json';

interface ParsedImportRow {
  id: string;
  partNumber: string;
  originalPartNumber?: string;
  nameAr: string;
  nameEn: string;
  categoryGroup: string;
  subgroup?: string;
  brand: string;
  quality: PartQuality;
  condition: PartCondition;
  side: 'LEFT' | 'RIGHT' | 'BOTH' | 'N/A';
  position: 'FRONT' | 'REAR' | 'UPPER' | 'LOWER' | 'CENTER' | 'N/A';
  chassisCompatibility: string;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice: number;
  quantity: number;
  locationCode: string;
  minStock: number;
  maxStock: number;
  barcode: string;
  notes?: string;
  // Validation status
  status: 'READY' | 'WARNING' | 'ERROR';
  validationErrors: string[];
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: EpcCategory[];
  locations: WarehouseLocation[];
  warehouses: Warehouse[];
  branches: Branch[];
  onImportSuccess?: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  categories,
  locations,
  warehouses,
  branches,
  onImportSuccess
}) => {
  const { currentUser, activeBranch } = useAuth();
  const { isDark } = useTheme();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [importTab, setImportTab] = useState<'FILE' | 'PASTE' | 'CATALOG'>('FILE');
  const [pastedCsvText, setPastedCsvText] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  
  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'READY' | 'WARNING' | 'ERROR'>('ALL');

  // Load Preset Catalog with 1-click
  const handleLoadFullCatalog = () => {
    setIsLoadingFile(true);
    try {
      const items: ParsedImportRow[] = (catalogData as any[]).map((p, idx) => ({
        id: `cat_${idx}_${Date.now()}`,
        partNumber: p.partNumber,
        originalPartNumber: p.originalPartNumber || p.partNumber,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        categoryGroup: p.categoryGroup || '01 ENGINE & TIMING',
        brand: p.brand || 'Mercedes-Benz Genuine Parts',
        quality: p.quality || 'GENUINE_OEM',
        condition: p.condition || 'NEW',
        side: p.side || 'N/A',
        position: p.position || 'N/A',
        chassisCompatibility: Array.isArray(p.compatibility) ? p.compatibility.map((c: any) => c.chassis).join(', ') : 'W223',
        costPrice: Number(p.costPrice) || 0,
        sellingPrice: Number(p.sellingPrice) || 0,
        wholesalePrice: Number(p.wholesalePrice) || Number(p.sellingPrice) || 0,
        quantity: Number(p.totalStock) || 0,
        locationCode: p.locationCode || 'A-01-01-01',
        minStock: Number(p.minStock) || 1,
        maxStock: Number(p.maxStock) || 50,
        barcode: p.barcode || p.partNumber,
        notes: p.notes || 'من الكتالوج المعتمد',
        status: 'READY',
        validationErrors: []
      }));

      setSelectedFileName(`كتالوج أصناف مرسيدس المعتمد (${items.length} صنف)`);
      setParsedRows(items);
      setImportResult(null);
    } catch (e: any) {
      alert(`خطأ: ${e.message}`);
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Parse direct pasted CSV
  const handleParsePastedCsv = () => {
    if (!pastedCsvText.trim()) {
      alert('يرجى لصق نص CSV أو أسطر الإكسل في الصندوق أولاً.');
      return;
    }

    setIsLoadingFile(true);
    try {
      const workbook = XLSX.read(pastedCsvText, { type: 'string' });
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('لم يتم العثور على أسطر صالحة في النص الملصوق.');
      }

      const defaultShelf = locations[0]?.code || 'A-01-01-01';
      const validatedList: ParsedImportRow[] = rawRows.map((row, idx) => {
        const rowKeys = Object.keys(row);
        const getVal = (...keys: string[]) => {
          for (const k of keys) {
            const foundKey = rowKeys.find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase() || rk.includes(k));
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
              return String(row[foundKey]).trim();
            }
          }
          return '';
        };

        const parseNum = (val: string) => {
          if (!val) return 0;
          const cleaned = val.replace(/[^0-9.-]/g, '');
          const n = parseFloat(cleaned);
          return isNaN(n) ? 0 : n;
        };

        const rawPartNum = getVal('رقم القطعة', 'Part Number', 'partNumber', 'part_no', 'code', 'كود', 'رقم') || (rowKeys[0] ? String(row[rowKeys[0]]).trim() : '');
        const cleanPartNum = rawPartNum ? rawPartNum.replace(/\s+/g, ' ').trim() : `MB-PASTE-${idx + 1}`;
        const nameAr = getVal('الاسم بالعربي', 'Name Arabic', 'nameAr', 'arabic', 'الاسم', 'اسم الصنف', 'صنف') || (rowKeys[1] ? String(row[rowKeys[1]]).trim() : '') || `قطعة مرسيدس ${cleanPartNum}`;
        const nameEn = getVal('الاسم بالإنجليزي', 'Name English', 'nameEn', 'english', 'item_name') || (rowKeys[2] ? String(row[rowKeys[2]]).trim() : '') || nameAr;
        const categoryGroup = getVal('مجموعة EPC', 'EPC Group', 'categoryGroup', 'المجموعة', 'القسم') || (rowKeys[3] ? String(row[rowKeys[3]]).trim() : '') || '01 ENGINE & TIMING';
        const brand = getVal('الماركة', 'Brand', 'brand', 'الشركة') || (rowKeys[4] ? String(row[rowKeys[4]]).trim() : '') || 'Mercedes-Benz Genuine Parts';
        const qualityRaw = getVal('الجودة', 'Quality', 'quality', 'الدرجة') || (rowKeys[5] ? String(row[rowKeys[5]]).trim() : '');
        const quality: PartQuality = qualityRaw.toUpperCase().includes('AFTER') ? 'AFTERMARKET' : 'GENUINE_OEM';
        const quantity = Math.max(0, parseInt(getVal('المخزون الفعلي', 'Quantity', 'qty', 'الكمية', 'الرصيد') || (rowKeys[6] ? String(row[rowKeys[6]]).trim() : '0'), 10) || 0);
        const costPrice = parseNum(getVal('سعر التكلفة', 'Cost Price', 'costPrice', 'التكلفة') || (rowKeys[7] ? String(row[rowKeys[7]]).trim() : '0'));
        const sellingPrice = parseNum(getVal('سعر البيع', 'Selling Price', 'sellingPrice', 'البيع') || (rowKeys[8] ? String(row[rowKeys[8]]).trim() : '0'));
        const minStock = parseInt(getVal('الحد الأدنى', 'Min Stock', 'minStock') || (rowKeys[9] ? String(row[rowKeys[9]]).trim() : '1'), 10) || 1;

        return {
          id: `pasted_${idx}_${Date.now()}`,
          partNumber: cleanPartNum,
          originalPartNumber: cleanPartNum,
          nameAr,
          nameEn,
          categoryGroup,
          brand,
          quality,
          condition: 'NEW',
          side: nameAr.includes('شمال') || nameAr.includes(' L') ? 'LEFT' : nameAr.includes('يمين') || nameAr.includes(' R') ? 'RIGHT' : 'BOTH',
          position: nameAr.includes('امامي') || nameAr.includes('أمامي') ? 'FRONT' : nameAr.includes('خلفي') ? 'REAR' : 'N/A',
          chassisCompatibility: 'W206, W223, W213',
          costPrice,
          sellingPrice,
          wholesalePrice: sellingPrice > 0 ? Math.round(sellingPrice * 0.9) : 0,
          quantity,
          locationCode: defaultShelf,
          minStock,
          maxStock: 50,
          barcode: cleanPartNum.replace(/[^a-zA-Z0-9]/g, ''),
          notes: 'مستورد عبر لصق نص CSV',
          status: 'READY',
          validationErrors: []
        };
      });

      setSelectedFileName(`نص ملصوق (${validatedList.length} صنف)`);
      setParsedRows(validatedList);
      setImportResult(null);
    } catch (err: any) {
      alert(`خطأ في معالجة النص: ${err.message}`);
    } finally {
      setIsLoadingFile(false);
    }
  };

  if (!isOpen) return null;

  // Active warehouse (Default: El-Harefeyin Main Warehouse)
  const currentWarehouse = warehouses[0] || {
    id: 'wh_main_harefeyin',
    name: 'المستودع الرئيسي (فرع الحرفيين)',
    code: 'WH-MAIN',
    branchId: activeBranch.id,
    zones: ['ZONE-A', 'ZONE-B', 'ZONE-C'],
    totalLocations: 120,
    active: true
  };

  // 1. Download Sample Excel Template
  const handleDownloadTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const templateHeaders = [
      'رقم القطعة (Part Number)',
      'الاسم بالعربي (Name Arabic)',
      'الاسم بالإنجليزي (Name English)',
      'مجموعة EPC (EPC Group)',
      'الماركة المصنعة (Brand)',
      'درجة الجودة (GENUINE_OEM / ORIGINAL / AFTERMARKET)',
      'شاسيه السيارة المتوافق (Chassis Compatibility)',
      'سعر التكلفة بالجنيه EGP (Cost Price)',
      'سعر البيع بالجنيه EGP (Selling Price)',
      'سعر الجملة بالجنيه EGP (Wholesale Price)',
      'الكمية الافتتاحية (Quantity)',
      'كود رف التخزين بالمستودع (Shelf Code)',
      'الحد الأدنى للمخزون (Min Stock)',
      'الباركود (Barcode)',
      'ملاحظات الصنف (Notes)'
    ];

    const sampleData = [
      [
        'A2233302303',
        'مقص أمامي سفلي يسار مرسيدس S-Class W223 أصلي',
        'Mercedes-Benz Front Lower Control Arm Left W223',
        '32 SUSPENSION & SPRINGS',
        'Mercedes-Benz Genuine Parts',
        'GENUINE_OEM',
        'W223, V223',
        12500,
        18500,
        16000,
        6,
        'A-03-02-07',
        2,
        '4053421223303',
        'شحنة وكالة أصلية مختومة باللوجو — رف الحرفيين'
      ],
      [
        'A000989790211',
        'زيت محرك مرسيدس أصلي 5W-40 تخليقي 5 لتر 229.5',
        'Mercedes-Benz Genuine Engine Oil 5W-40 229.5 (5L)',
        '01 ENGINE & TIMING',
        'Mercedes-Benz Genuine Parts',
        'ORIGINAL',
        'W223, W222, W205, W213',
        2800,
        3900,
        3400,
        24,
        'A-01-01-01',
        5,
        '4009897902114',
        'زيوت وسوائل صيانة دورية مرسيدس بنز'
      ],
      [
        'A0084203820',
        'طقم تيل فرامل أمامي مرسيدس S-Class W223 أصلي',
        'Front Brake Pad Set Genuine Mercedes W223',
        '42 BRAKES & HYDRAULICS',
        'Brembo OEM',
        'GENUINE_OEM',
        'W223, W222',
        7500,
        11200,
        9800,
        12,
        'B-01-02-04',
        3,
        '4047437482910',
        'شامل حساسات الفرامل الأصلية'
      ],
      [
        'A2238200100',
        'فانوس أمامي ديجيتال لايت يسار مرسيدس W223',
        'Digital Light Headlamp Assembly Left W223',
        '82 BODY ELECTRICAL & LIGHTING',
        'Mercedes-Benz Genuine Parts',
        'GENUINE_OEM',
        'W223',
        68000,
        92000,
        82000,
        2,
        'C-01-04-02',
        1,
        '4058200100223',
        'تكنولوجيا Digital Light فائقة الدقة'
      ]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([templateHeaders, ...sampleData]);

    // Set columns width
    worksheet['!cols'] = [
      { wch: 18 }, // Part Number
      { wch: 38 }, // Name Ar
      { wch: 38 }, // Name En
      { wch: 25 }, // EPC Group
      { wch: 22 }, // Brand
      { wch: 20 }, // Quality
      { wch: 22 }, // Chassis
      { wch: 15 }, // Cost
      { wch: 15 }, // Selling
      { wch: 15 }, // Wholesale
      { wch: 10 }, // Qty
      { wch: 16 }, // Shelf
      { wch: 10 }, // Min
      { wch: 16 }, // Barcode
      { wch: 30 }  // Notes
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'قطع_غيار_AH_Libya');

    const fileName = `AH_Libya_Store_Parts_Template_${Date.now()}.${format}`;
    XLSX.writeFile(workbook, fileName, { bookType: format });
  };

  // 2. Parse uploaded file
  const processUploadedFile = async (file: File) => {
    setIsLoadingFile(true);
    setSelectedFileName(file.name);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات صالحة.');
      }

      // Transform and validate each row with ultra-flexible auto-fill
      const defaultShelf = locations[0]?.code || 'A-01-01-01';

      const validatedList: ParsedImportRow[] = rawRows.map((row, idx) => {
        // Smart column mapping (support various header namings, partial match, and index fallback)
        const rowKeys = Object.keys(row);
        const getVal = (...keys: string[]) => {
          for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
              return String(row[k]).trim();
            }
          }
          // Also check partial case-insensitive matches
          for (const k of keys) {
            const foundKey = rowKeys.find(rk => rk.toLowerCase().replace(/[\s_\-()]/g, '').includes(k.toLowerCase().replace(/[\s_\-()]/g, '')));
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
              return String(row[foundKey]).trim();
            }
          }
          return '';
        };

        // Fallback value from any column if specific key not found
        const allRowValues = rowKeys.map(k => String(row[k] || '').trim()).filter(Boolean);

        // 1. Part Number extraction
        let rawPartNum = getVal('رقم القطعة', 'Part Number', 'partNumber', 'PartNo', 'Part_Number', 'Part #', 'كود القطعة', 'SKU', 'الكود', 'كود', 'code', 'pn', 'item_code', 'item_no', 'رقم الصنف', 'رقم');
        if (!rawPartNum && allRowValues.length > 0) {
          // Check if first column looks like a part number or code
          rawPartNum = allRowValues[0];
        }
        let cleanPartNum = rawPartNum.replace(/[\s\-_]/g, '').toUpperCase();
        if (!cleanPartNum || cleanPartNum.length < 2) {
          cleanPartNum = `MB-AUTO-${String(idx + 1).padStart(4, '0')}`;
        }

        // 2. Names extraction
        let nameAr = getVal('الاسم بالعربي', 'Name Arabic', 'nameAr', 'Arabic Name', 'اسم القطعة', 'الوصف بالعربي', 'اسم الصنف', 'البيان', 'الصنف', 'الوصف', 'اسم', 'description_ar', 'arabic');
        let nameEn = getVal('الاسم بالإنجليزي', 'Name English', 'nameEn', 'English Name', 'Description', 'الاسم بالانجليزي', 'الوصف بالانجليزي', 'name', 'item_name', 'description_en', 'english');

        if (!nameAr && nameEn) {
          nameAr = nameEn;
        } else if (!nameAr && !nameEn) {
          // If 2nd column exists, use as name
          if (allRowValues.length > 1 && allRowValues[1] !== rawPartNum) {
            nameAr = allRowValues[1];
            nameEn = allRowValues[1];
          } else {
            nameAr = `قطعة غيار ${cleanPartNum}`;
            nameEn = `Mercedes Part ${cleanPartNum}`;
          }
        }
        if (!nameEn) {
          nameEn = nameAr;
        }

        // 3. Category & Brand
        const categoryGroup = getVal('مجموعة EPC', 'EPC Group', 'categoryGroup', 'Category', 'المجموعة', 'التصنيف', 'القسم', 'group', 'cat') || '01 ENGINE & TIMING';
        const brand = getVal('الماركة المصنعة', 'Brand', 'brand', 'الماركة', 'الشركة', 'الجهة المصنعة', 'make', 'manufacturer') || 'Mercedes-Benz Genuine Parts';
        
        // 4. Quality
        let qualityRaw = getVal('درجة الجودة', 'Quality', 'quality', 'الجودة', 'النوعية', 'grade').toUpperCase();
        let quality: PartQuality = 'GENUINE_OEM';
        if (qualityRaw.includes('AFTER') || qualityRaw.includes('تجاري') || qualityRaw.includes('تايوان') || qualityRaw.includes('صيني')) quality = 'AFTERMARKET';
        else if (qualityRaw.includes('PERF') || qualityRaw.includes('أداء') || qualityRaw.includes('تعديل')) quality = 'PERFORMANCE';
        else if (qualityRaw.includes('ORIGINAL') || qualityRaw.includes('أصلي') || qualityRaw.includes('وكالة')) quality = 'ORIGINAL';
        else quality = 'GENUINE_OEM';

        // 5. Chassis
        const chassis = getVal('شاسيه السيارة المتوافق', 'Chassis', 'chassisCompatibility', 'الشاسيه', 'الموديل', 'السيارة', 'model', 'chassis_no') || 'W223 / Universal';
        
        // 6. Prices (clean any currency symbols, commas or text)
        const parsePrice = (rawStr: string): number => {
          if (!rawStr) return 0;
          const cleaned = String(rawStr).replace(/[^0-9.]/g, '');
          const num = parseFloat(cleaned);
          return isNaN(num) ? 0 : Math.max(0, num);
        };

        const costPrice = parsePrice(getVal('سعر التكلفة بالجنيه EGP', 'Cost Price', 'costPrice', 'التكلفة', 'سعر الشراء', 'شراء', 'سعر التكلفة', 'تكلفة', 'cost', 'buy_price'));
        let sellingPrice = parsePrice(getVal('سعر البيع بالجنيه EGP', 'Selling Price', 'sellingPrice', 'سعر البيع', 'سعر القطاعي', 'بيع', 'سعر', 'قطاعي', 'price', 'sell_price'));
        let wholesalePrice = parsePrice(getVal('سعر الجملة بالجنيه EGP', 'Wholesale Price', 'wholesalePrice', 'سعر الجملة', 'جملة', 'wholesale'));

        // Fallbacks for prices
        if (sellingPrice === 0 && costPrice > 0) {
          sellingPrice = Math.round(costPrice * 1.35);
        } else if (sellingPrice === 0 && costPrice === 0) {
          sellingPrice = 100; // default baseline
        }
        if (wholesalePrice === 0) {
          wholesalePrice = Math.round(sellingPrice * 0.9);
        }

        // 7. Quantity & Shelf
        const quantity = parsePrice(getVal('الكمية الافتتاحية', 'Quantity', 'quantity', 'الكمية', 'الرصيد', 'المخزون', 'عدد', 'qty', 'count', 'stock', 'balance'));
        let locationCode = getVal('كود رف التخزين بالمستودع', 'Shelf Code', 'locationCode', 'الرف', 'الموقع', 'مكان التخزين', 'مكان', 'المخزن', 'Location', 'shelf', 'bin', 'loc') || defaultShelf;
        
        const minStock = parsePrice(getVal('الحد الأدنى للمخزون', 'Min Stock', 'minStock', 'الحد الادنى', 'الحد الأدنى', 'min_qty', 'min')) || 2;
        const barcode = getVal('الباركود', 'Barcode', 'barcode', 'EAN', 'باركود', 'upc') || cleanPartNum;
        const notes = getVal('ملاحظات الصنف', 'Notes', 'notes', 'ملاحظات', 'ملاحظة', 'comment') || 'مستورد عبر ملف إكسل';

        // Acceptance Policy: ALWAYS ACCEPT ALL ROWS! Never block or mark as ERROR.
        const validationErrors: string[] = [];
        let status: 'READY' | 'WARNING' | 'ERROR' = 'READY';

        if (!rawPartNum) {
          validationErrors.push('تم توليد كود تلقائي للصنف لعدم وجوده بالشيت');
          status = 'WARNING';
        }

        return {
          id: `parsed_${idx}_${Date.now()}`,
          partNumber: cleanPartNum,
          originalPartNumber: cleanPartNum,
          nameAr: nameAr,
          nameEn: nameEn,
          categoryGroup,
          brand,
          quality,
          condition: 'NEW',
          side: 'N/A',
          position: 'N/A',
          chassisCompatibility: chassis,
          costPrice,
          sellingPrice,
          wholesalePrice,
          quantity,
          locationCode,
          minStock,
          maxStock: 100,
          barcode,
          notes,
          status,
          validationErrors
        };
      });

      setParsedRows(validatedList);
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert(`خطأ في قراءة الملف: ${err.message}`);
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  // Delete row from preview
  const handleDeleteRow = (id: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  // Execute Bulk Save into Database
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) {
      alert('لا توجد صفوف للاستيراد. يرجى اختيار ملف أولاً.');
      return;
    }

    setIsSubmitting(true);
    setImportProgress(15);

    try {
      setImportProgress(40);
      const res = await bulkImportParts(
        parsedRows.map((r, idx) => ({
          partNumber: r.partNumber || `MB-AUTO-${idx + 1}`,
          originalPartNumber: r.originalPartNumber || r.partNumber || `MB-AUTO-${idx + 1}`,
          nameAr: r.nameAr || `قطعة غيار مرسيدس ${r.partNumber || idx + 1}`,
          nameEn: r.nameEn || `Mercedes Part ${r.partNumber || idx + 1}`,
          categoryGroup: r.categoryGroup || '01 ENGINE & TIMING',
          brand: r.brand || 'Mercedes-Benz Genuine Parts',
          quality: r.quality || 'GENUINE_OEM',
          condition: r.condition || 'NEW',
          side: r.side || 'N/A',
          position: r.position || 'N/A',
          chassisCompatibility: r.chassisCompatibility || 'W223 / Universal',
          costPrice: r.costPrice || 0,
          sellingPrice: r.sellingPrice > 0 ? r.sellingPrice : 100,
          wholesalePrice: r.wholesalePrice > 0 ? r.wholesalePrice : (r.sellingPrice || 100),
          quantity: r.quantity || 0,
          locationCode: r.locationCode || (locations[0]?.code || 'A-01-01-01'),
          minStock: r.minStock || 2,
          maxStock: r.maxStock || 100,
          barcode: r.barcode || r.partNumber || `MB-${idx + 1}`,
          notes: r.notes || 'مستورد عبر ملف إكسل'
        })),
        { id: currentUser.id, name: currentUser.displayName },
        activeBranch,
        currentWarehouse,
        locations
      );

      setImportProgress(100);
      setImportResult({ success: res.successCount, errors: res.errors });

      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err: any) {
      console.error('Import execution error:', err);
      alert(`فشل إتمام الاستيراد: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered rows for preview
  const filteredRows = parsedRows.filter(row => {
    if (filterStatus !== 'ALL' && row.status !== filterStatus) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      row.partNumber.toLowerCase().includes(q) ||
      row.nameAr.toLowerCase().includes(q) ||
      row.nameEn.toLowerCase().includes(q) ||
      row.locationCode.toLowerCase().includes(q) ||
      row.chassisCompatibility.toLowerCase().includes(q)
    );
  });

  const totalCount = parsedRows.length;
  const readyCount = parsedRows.filter(r => r.status === 'READY').length;
  const warningCount = parsedRows.filter(r => r.status === 'WARNING').length;
  const errorCount = parsedRows.filter(r => r.status === 'ERROR').length;
  const validForImportCount = readyCount + warningCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none" dir="rtl">
      <div 
        className={`w-full max-w-6xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[94vh] transition-colors ${
          isDark
            ? 'bg-[#0e0e13] border-white/10 text-zinc-200'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Top Header */}
        <div 
          className={`flex items-center justify-between px-4 sm:px-6 py-3.5 border-b shrink-0 ${
            isDark ? 'bg-[#09090c] border-white/10' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base">
                  استيراد قطع الغيار دفعة واحدة من ملف إكسل (Excel / CSV)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono font-bold">
                  EGP • فرع الحرفيين
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                معاينة فورية وفحص تلقائي لمطابقة الأرفف والأسعار والشاسيه قبل الحفظ بقاعدة البيانات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`p-1.5 rounded-full transition ${
                isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">

          {/* Import Modes Tabs */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
            <button
              type="button"
              onClick={() => setImportTab('FILE')}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
                importTab === 'FILE'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : isDark ? 'bg-zinc-900 text-zinc-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>رفع ملف Excel أو CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setImportTab('PASTE')}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
                importTab === 'PASTE'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : isDark ? 'bg-zinc-900 text-zinc-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>لصق أسطر CSV / إكسل مباشرة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setImportTab('CATALOG');
                handleLoadFullCatalog();
              }}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
                importTab === 'CATALOG'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                  : isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>⚡ إدراج الكتالوج المعتمد فوراً ({Array.isArray(catalogData) ? catalogData.length : 0} صنف)</span>
            </button>
          </div>
          
          {/* Tab 1: File Upload Mode */}
          {importTab === 'FILE' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* File Upload Zone */}
              <div className="lg:col-span-2">
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 sm:p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                    dragActive 
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : isDark 
                        ? 'border-white/10 hover:border-white/20 bg-[#121216]/60 hover:bg-[#15151a]' 
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/80'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                  
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Upload className="w-6 h-6 animate-bounce" />
                  </div>

                  <div>
                    <p className="font-bold text-xs sm:text-sm">
                      {selectedFileName ? `الملف المحدد: ${selectedFileName}` : 'اضغط هنا لاختيار ملف الإكسل أو اسحبه وأفلته هنا'}
                    </p>
                    <p className={`text-[11px] mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                      يدعم ملفات الإكسل الحديثة <strong className="font-mono">.XLSX</strong> و <strong className="font-mono">.XLS</strong> وملفات <strong className="font-mono">.CSV</strong>
                    </p>
                  </div>

                  {isLoadingFile && (
                    <div className="flex items-center gap-2 text-emerald-500 font-bold mt-1">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري تحليل وقراءة بيانات الشيت...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Template Download & Guide Box */}
              <div 
                className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  isDark ? 'bg-[#121216] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-xs mb-1.5 text-emerald-500">
                    <Download className="w-4 h-4" />
                    <span>نماذج استرشادية جاهزة للتحميل</span>
                  </div>
                  <p className={`text-[11px] leading-relaxed mb-3 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                    قم بتحميل ملف النموذج المعبأ بأكواد أرفف المستودع وأسعار الجنيه المصري (EGP) ومصفوفة شاسيهات مرسيدس.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('xlsx')}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                      isDark 
                        ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border-emerald-500/30' 
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>تحميل نموذج إكسل (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('csv')}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition ${
                      isDark 
                        ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10' 
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>تحميل نموذج CSV (.csv)</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* Tab 2: Direct Paste CSV Mode */}
          {importTab === 'PASTE' && (
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#121216] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  <span>الصق أسطر الـ CSV أو انسخ الخلايا مباشرة من برنامج Excel:</span>
                </label>
                <button
                  type="button"
                  onClick={handleParsePastedCsv}
                  disabled={!pastedCsvText.trim() || isLoadingFile}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>معاينة واستيراد الأسطر الملصوقة</span>
                </button>
              </div>
              <textarea
                value={pastedCsvText}
                onChange={(e) => setPastedCsvText(e.target.value)}
                placeholder="رقم القطعة,الاسم بالعربي,الاسم بالإنجليزي,مجموعة EPC,الماركة,الجودة,المخزون الفعلي,سعر التكلفة EGP,سعر البيع EGP,الحد الأدنى&#10;A0004212112,طنابير امامي,Brake Discs,42 BRAKES & HYDRAULICS,CHINESE,AFTERMARKET,2,0,0,1&#10;..."
                rows={6}
                className={`w-full font-mono text-xs p-3 rounded-xl border outline-none focus:border-emerald-500 ${
                  isDark ? 'bg-[#0a0a0d] border-white/10 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'
                }`}
                dir="ltr"
              />
            </div>
          )}

          {/* Tab 3: Instant Verified Catalog */}
          {importTab === 'CATALOG' && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-amber-300">
              <div className="flex items-center gap-3">
                <Boxes className="w-6 h-6 text-amber-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-amber-200">الكتالوج المعتمد تم تحميله للمعاينة ({parsedRows.length} صنف)</h4>
                  <p className="text-xs text-amber-300/80">يمكنك مراجعة الأصناف أدناه والضغط على زر "تأكيد الاستيراد والحفظ" لإضافتها فوراً لقاعدة البيانات والمستودع.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLoadFullCatalog}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition flex items-center gap-2 shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحميل القائمة</span>
              </button>
            </div>
          )}

          {/* Success Banner if already imported */}
          {importResult && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">
                  تم استيراد {importResult.success} قطعة غيار بنجاح وحفظها بالمستودع الرئيسي (فرع الحرفيين)!
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  تم تسجيل الأرصدة الافتتاحية في الأرفف المحددة، وإنشاء حركات المخزون، وتحديث كتالوج مرسيدس مباشرة.
                </p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 text-xs text-amber-400 space-y-1">
                    <p className="font-bold">ملاحظات التنبيه ({importResult.errors.length}):</p>
                    {importResult.errors.map((e, idx) => (
                      <p key={idx}>• {e}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Parsed Records Summary & Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              
              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                
                {/* Status Badges Filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setFilterStatus('ALL')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      filterStatus === 'ALL'
                        ? isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                        : isDark ? 'bg-zinc-900 text-zinc-400 hover:text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span>الكل</span>
                    <span className="font-mono text-[10px]">({totalCount})</span>
                  </button>

                  <button
                    onClick={() => setFilterStatus('READY')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      filterStatus === 'READY'
                        ? 'bg-emerald-600 text-white'
                        : isDark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>جاهزة للاستيراد</span>
                    <span className="font-mono text-[10px]">({readyCount})</span>
                  </button>

                  {warningCount > 0 && (
                    <button
                      onClick={() => setFilterStatus('WARNING')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                        filterStatus === 'WARNING'
                          ? 'bg-amber-600 text-white'
                          : isDark ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>تنبيهات خفيفة</span>
                      <span className="font-mono text-[10px]">({warningCount})</span>
                    </button>
                  )}

                  {errorCount > 0 && (
                    <button
                      onClick={() => setFilterStatus('ERROR')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                        filterStatus === 'ERROR'
                          ? 'bg-rose-600 text-white'
                          : isDark ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>أخطاء تمنع الحفظ</span>
                      <span className="font-mono text-[10px]">({errorCount})</span>
                    </button>
                  )}
                </div>

                {/* Quick Search inside preview */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث في الشيت المعروض..."
                    className={`w-full rounded-xl pl-3 pr-8 py-1.5 text-xs font-medium border ${
                      isDark ? 'bg-[#09090c] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50" />
                </div>

              </div>

              {/* Data Table */}
              <div 
                className={`rounded-2xl border overflow-hidden ${
                  isDark ? 'border-white/10 bg-[#0a0a0e]' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead 
                      className={`sticky top-0 z-10 ${
                        isDark ? 'bg-[#15151a] text-zinc-300 border-b border-white/10' : 'bg-slate-100 text-slate-700 border-b border-slate-200'
                      }`}
                    >
                      <tr>
                        <th className="py-2.5 px-3 font-bold">الحالة</th>
                        <th className="py-2.5 px-3 font-bold">رقم القطعة</th>
                        <th className="py-2.5 px-3 font-bold">اسم القطعة (عربي / إنجليزي)</th>
                        <th className="py-2.5 px-3 font-bold">الشاسيه</th>
                        <th className="py-2.5 px-3 font-bold">رف التخزين</th>
                        <th className="py-2.5 px-3 font-bold">الكمية</th>
                        <th className="py-2.5 px-3 font-bold">سعر البيع (EGP)</th>
                        <th className="py-2.5 px-3 font-bold">التكلفة (EGP)</th>
                        <th className="py-2.5 px-3 font-bold text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-inherit">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center opacity-60">
                            لا توجد أصناف مطابقة لفلتر البحث الحالي
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row) => (
                          <tr 
                            key={row.id}
                            className={`transition-colors ${
                              isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Status Badge */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {row.status === 'READY' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <Check className="w-3 h-3" />
                                  جاهز
                                </span>
                              )}
                              {row.status === 'WARNING' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                  <AlertTriangle className="w-3 h-3" />
                                  تحذير
                                </span>
                              )}
                              {row.status === 'ERROR' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20" title={row.validationErrors.join(', ')}>
                                  <AlertCircle className="w-3 h-3" />
                                  خطأ
                                </span>
                              )}
                            </td>

                            {/* Part Number */}
                            <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                              {row.partNumber}
                            </td>

                            {/* Names */}
                            <td className="py-2.5 px-3 min-w-[200px] max-w-[280px]">
                              <div className="font-bold truncate" title={row.nameAr}>{row.nameAr}</div>
                              <div className={`text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} title={row.nameEn}>
                                {row.nameEn}
                              </div>
                            </td>

                            {/* Chassis */}
                            <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-md border text-[10px] ${
                                isDark ? 'bg-zinc-900 border-white/10 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                              }`}>
                                {row.chassisCompatibility}
                              </span>
                            </td>

                            {/* Shelf Location */}
                            <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 text-indigo-500 dark:text-indigo-400">
                                <Boxes className="w-3.5 h-3.5 opacity-70" />
                                {row.locationCode}
                              </span>
                            </td>

                            {/* Quantity */}
                            <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                              {row.quantity} قطعة
                            </td>

                            {/* Selling Price */}
                            <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                              {row.sellingPrice.toLocaleString()} EGP
                            </td>

                            {/* Cost Price */}
                            <td className="py-2.5 px-3 font-mono whitespace-nowrap text-zinc-400">
                              {row.costPrice.toLocaleString()} EGP
                            </td>

                            {/* Action: Remove row */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.id)}
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                                title="حذف الصف من الاستيراد"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Bottom Footer Actions */}
        <div 
          className={`px-4 sm:px-6 py-3.5 border-t flex items-center justify-between gap-3 shrink-0 ${
            isDark ? 'bg-[#09090c] border-white/10' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              إجمالي الأصناف المقروءة: <strong className="text-emerald-500 font-mono text-sm">{totalCount}</strong> صنف
            </span>
            <span className="text-xs text-emerald-500 font-medium">
              (مقبولة بالكامل وجاهزة للاستيراد دون أي تخطي)
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-full font-bold transition border text-xs ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              إغلاق
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isSubmitting || totalCount === 0}
              className={`px-6 py-2 rounded-full font-bold transition shadow-md flex items-center gap-2 text-xs ${
                totalCount > 0 && !isSubmitting
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                  : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري الاستيراد ({importProgress}%)...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>اعتماد واستيراد ({totalCount}) صنف للسيستم 🚀</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
