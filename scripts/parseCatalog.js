const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'raw_catalog.csv');
const rawCsv = fs.readFileSync(csvPath, 'utf8');

const lines = rawCsv.split(/\r?\n/).filter(line => line.trim().length > 0);
console.log('Total raw lines:', lines.length);

const header = lines[0];
console.log('Header:', header);

function parseCsvLine(text) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function detectQuality(qStr) {
  const upper = (qStr || '').toUpperCase().trim();
  if (upper.includes('GENUINE') || upper.includes('ORIGINAL') || upper.includes('ORGINAL')) {
    return 'GENUINE_OEM';
  }
  if (upper.includes('AFTER') || upper.includes('CHINA') || upper.includes('CHINESE') || upper.includes('TAIWAN')) {
    return 'AFTERMARKET';
  }
  return 'GENUINE_OEM';
}

function detectCondition(qStr, nameAr) {
  const upper = ((qStr || '') + ' ' + (nameAr || '')).toUpperCase();
  if (upper.includes('USED') || upper.includes('مستعمل') || upper.includes('استراد') || upper.includes('استيراد')) {
    return 'USED_EXCELLENT';
  }
  return 'NEW';
}

function detectCategory(group, nameAr, nameEn) {
  if (group && group.trim()) {
    return group.trim();
  }
  const text = (nameAr + ' ' + nameEn).toLowerCase();
  if (text.includes('طنابير') || text.includes('فرامل') || text.includes('تيل') || text.includes('كاليبر') || text.includes('brake')) {
    return '42 BRAKES & HYDRAULICS';
  }
  if (text.includes('مقص') || text.includes('مساعد') || text.includes('ميزان') || text.includes('جلب') || text.includes('شمعدان') || text.includes('بيض') || text.includes('suspension')) {
    return '32 SUSPENSION & SPRINGS';
  }
  if (text.includes('فانوس') || text.includes('كنترول') || text.includes('حساس') || text.includes('دينامو') || text.includes('مارش') || text.includes('ضفيرة') || text.includes('سويتش') || text.includes('بوردة') || text.includes('شاشة') || text.includes('electrical')) {
    return '54 ELECTRICAL & SENSORS';
  }
  if (text.includes('تكييف') || text.includes('سربنتين') || text.includes('كباس') || text.includes('ريداتير') || text.includes('ردياتير') || text.includes('كولر') || text.includes('climate') || text.includes('cooling')) {
    return '83 CLIMATE CONTROL';
  }
  if (text.includes('اكصدام') || text.includes('رفرف') || text.includes('باب') || text.includes('كبوت') || text.includes('شنطة') || text.includes('شنطه') || text.includes('دفيوزر') || text.includes('هواية') || text.includes('شبك') || text.includes('body')) {
    return '88 BODY & BUMPERS';
  }
  if (text.includes('موتور') || text.includes('سير') || text.includes('بكرة') || text.includes('بكر') || text.includes('بستن') || text.includes('بستم') || text.includes('كرنك') || text.includes('كام') || text.includes('كامة') || text.includes('طلمب') || text.includes('طلمبة') || text.includes('تربو') || text.includes('engine')) {
    return '01 ENGINE & TIMING';
  }
  if (text.includes('فتيس') || text.includes('كرونه') || text.includes('كرونة') || text.includes('كوبلن') || text.includes('كوبلين') || text.includes('كردان') || text.includes('transmission')) {
    return '27 AUTOMATIC TRANSMISSION';
  }
  return '01 ENGINE & TIMING';
}

function detectChassis(partNum, nameAr) {
  const combined = (partNum + ' ' + nameAr).toUpperCase();
  const chassisFound = [];
  const patterns = ['W205', 'W206', 'W213', 'W214', 'W222', 'W223', 'W204', 'W212', 'W211', 'W210', 'W203', 'W177', 'W118', 'W156', 'W166', 'W167', 'W246', 'W247', 'W253', 'W254', 'GLC', 'GLK', 'GLA', 'CLA', 'W221'];
  
  for (const pat of patterns) {
    if (combined.includes(pat) || combined.includes(pat.replace('W', ''))) {
      chassisFound.push(pat.startsWith('W') ? pat : `W${pat}`);
    }
  }
  if (chassisFound.length === 0) {
    return [{ chassis: 'W206', model: 'C-Class Sedan', engine: 'M254', yearFrom: 2021, yearTo: 2026 }];
  }
  return Array.from(new Set(chassisFound)).map(c => ({
    chassis: c,
    model: `Mercedes-Benz ${c}`,
    engine: 'OEM Standard',
    yearFrom: 2016,
    yearTo: 2026
  }));
}

// Location generator based on category
const BIN_RACKS = {
  '42 BRAKES & HYDRAULICS': ['A-01-01-01', 'A-01-01-02', 'A-01-02-01', 'A-01-02-02', 'A-01-03-01', 'A-01-03-02'],
  '32 SUSPENSION & SPRINGS': ['A-02-01-01', 'A-02-01-02', 'A-02-02-01', 'A-02-02-02', 'A-02-03-01', 'A-02-03-02'],
  '54 ELECTRICAL & SENSORS': ['B-01-01-01', 'B-01-01-02', 'B-01-02-01', 'B-01-02-02', 'B-01-03-01', 'B-01-03-02'],
  '83 CLIMATE CONTROL': ['B-02-01-01', 'B-02-01-02', 'B-02-02-01', 'B-02-02-02', 'B-02-03-01', 'B-02-03-02'],
  '88 BODY & BUMPERS': ['C-01-01-01', 'C-01-01-02', 'C-01-02-01', 'C-01-02-02', 'C-01-03-01', 'C-01-03-02'],
  '01 ENGINE & TIMING': ['D-01-01-01', 'D-01-01-02', 'D-01-02-01', 'D-01-02-02', 'D-01-03-01', 'D-01-03-02'],
  '27 AUTOMATIC TRANSMISSION': ['D-02-01-01', 'D-02-01-02', 'D-02-02-01', 'D-02-02-02', 'D-02-03-01', 'D-02-03-02'],
};

const parts = [];
const seenPartNumbers = new Map();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line || !line.trim()) continue;
  const cols = parseCsvLine(line);
  if (cols.length < 2) continue;

  let rawPartNum = (cols[0] || '').trim();
  let nameAr = (cols[1] || '').trim();
  let nameEn = (cols[2] || '').trim();
  let epcGroup = (cols[3] || '').trim();
  let brand = (cols[4] || '').trim() || 'Mercedes-Benz Genuine Parts';
  let qualityRaw = (cols[5] || '').trim();
  let stockQty = parseInt(cols[6], 10);
  if (isNaN(stockQty) || stockQty < 0) stockQty = 0;
  let costPrice = parseFloat(cols[7]) || 0;
  let sellingPrice = parseFloat(cols[8]) || 0;
  let minStock = parseInt(cols[9], 10) || 1;

  if (!rawPartNum && !nameAr) continue;
  if (!rawPartNum) {
    rawPartNum = `MB-PART-${i}`;
  }
  if (!nameAr) {
    nameAr = `قطعة مرسيدس ${rawPartNum}`;
  }
  if (!nameEn) {
    nameEn = nameAr;
  }

  const category = detectCategory(epcGroup, nameAr, nameEn);
  const quality = detectQuality(qualityRaw);
  const condition = detectCondition(qualityRaw, nameAr);
  const compatibility = detectChassis(rawPartNum, nameAr);

  // De-duplicate clean part number
  const cleanPartNum = rawPartNum.replace(/\s+/g, ' ').trim();
  let uniquePartId = `part_${cleanPartNum.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
  
  if (seenPartNumbers.has(uniquePartId)) {
    const count = seenPartNumbers.get(uniquePartId) + 1;
    seenPartNumbers.set(uniquePartId, count);
    uniquePartId = `${uniquePartId}_${count}`;
  } else {
    seenPartNumbers.set(uniquePartId, 1);
  }

  const locList = BIN_RACKS[category] || ['A-01-01-01', 'A-01-01-02', 'A-02-01-01'];
  const assignedLoc = locList[i % locList.length];

  parts.push({
    id: uniquePartId,
    partNumber: cleanPartNum,
    originalPartNumber: cleanPartNum,
    supersededNumbers: [],
    alternativeNumbers: [],
    nameAr,
    nameEn,
    description: `صنف معتمد بكتالوج قطع غيار مرسيدس-بنز. الموقع التخزيني المقترح: ${assignedLoc}.`,
    categoryGroup: category,
    subgroup: `${category.split(' ')[0]}-010 General`,
    epcIllustration: 'EPC-MB-2026',
    epcPosition: `${(i % 50) + 1}`,
    brand,
    quality,
    condition,
    side: nameAr.includes('شمال') || nameAr.includes(' L') ? 'LEFT' : nameAr.includes('يمين') || nameAr.includes(' R') ? 'RIGHT' : 'BOTH',
    position: nameAr.includes('امامي') || nameAr.includes('أمامي') ? 'FRONT' : nameAr.includes('خلفي') ? 'REAR' : 'N/A',
    unit: 'PCS',
    costPrice,
    sellingPrice,
    wholesalePrice: sellingPrice > 0 ? Math.round(sellingPrice * 0.9) : 0,
    minStock,
    maxStock: Math.max(minStock * 5, 20),
    reorderLevel: minStock + 1,
    barcode: cleanPartNum.replace(/[^a-zA-Z0-9]/g, ''),
    qrCode: `MB-GEN-${cleanPartNum.replace(/[^a-zA-Z0-9]/g, '')}`,
    notes: `مخزن بفرع الحرفيين بالرف ${assignedLoc}`,
    compatibility,
    totalStock: stockQty,
    availableStock: stockQty,
    assignedBinLocation: assignedLoc,
    createdAt: '2026-08-26T00:00:00.000Z',
    updatedAt: '2026-08-26T00:00:00.000Z'
  });
}

console.log('Successfully processed items count:', parts.length);

const outContent = `import { PartMaster, InventoryItem } from '../types/erp';

/**
 * Complete imported Mercedes-Benz parts catalog (${parts.length} items)
 * Sourced directly from Libya/Egypt AH Store catalog.
 */
export const IMPORTED_CATALOG_PARTS: PartMaster[] = ${JSON.stringify(parts, null, 2)};

export const IMPORTED_CATALOG_INVENTORY: InventoryItem[] = IMPORTED_CATALOG_PARTS.map((p, idx) => ({
  id: 'inv_' + p.id,
  partId: p.id,
  partNumber: p.partNumber,
  partNameEn: p.nameEn,
  partNameAr: p.nameAr,
  branchId: 'branch_harefeyin',
  branchName: 'فرع الحرفيين - القاهرة',
  warehouseId: 'wh_main_harefeyin',
  warehouseName: 'المستودع الرئيسي - الحرفيين',
  locationId: 'loc_' + (p as any).assignedBinLocation.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
  locationCode: (p as any).assignedBinLocation || 'A-01-01-01',
  quantity: p.totalStock,
  reservedQuantity: 0,
  availableQuantity: p.availableStock,
  costPrice: p.costPrice,
  sellingPrice: p.sellingPrice,
  lastMovementDate: '2026-08-26T00:00:00.000Z',
  updatedAt: '2026-08-26T00:00:00.000Z'
}));
`;

fs.writeFileSync(path.join(__dirname, '../src/data/importedCatalogData.ts'), outContent);
console.log('Saved catalog data to src/data/importedCatalogData.ts');
