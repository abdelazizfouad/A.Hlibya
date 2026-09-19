import fs from 'fs';
import path from 'path';

// Read raw CSV from input file
const csvPath = path.join(process.cwd(), 'scripts', 'parts_raw.csv');
const rawContent = fs.readFileSync(csvPath, 'utf8');

const lines = rawContent.split(/\r?\n/).filter(line => line.trim().length > 0);
const header = lines[0];
console.log('Total raw lines:', lines.length);

interface PartItem {
  id: string;
  partNumber: string;
  originalPartNumber?: string;
  supersededNumbers: string[];
  alternativeNumbers: string[];
  nameAr: string;
  nameEn: string;
  description: string;
  categoryGroup: string;
  subgroup: string;
  epcIllustration: string;
  epcPosition: string;
  compatibility: string[];
  side: 'LEFT' | 'RIGHT' | 'BOTH' | 'N/A';
  position: 'FRONT' | 'REAR' | 'N/A';
  condition: 'NEW' | 'USED' | 'RECONDITIONED';
  quality: 'GENUINE_OEM' | 'AFTERMARKET';
  brand: string;
  unit: string;
  weightKg: number;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice: number;
  minStock: number;
  maxStock: number;
  reorderLevel: number;
  barcode: string;
  qrCode: string;
  imageUrl?: string;
  notes?: string;
  totalStock: number;
  availableStock: number;
}

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
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

function extractEPCGroup(rawEpc: string): { group: string; subgroup: string } {
  if (!rawEpc) return { group: '01', subgroup: '015' };
  const match = rawEpc.match(/^(\d{2})/);
  if (match) {
    return { group: match[1], subgroup: match[1] + '0' };
  }
  return { group: '01', subgroup: '015' };
}

function sanitizeCondition(condition?: string): 'NEW' | 'USED' | 'RECONDITIONED' {
  if (!condition) return 'USED';
  const c = condition.toUpperCase().trim();
  if (c.includes('USED') || c.includes('مستعمل') || c.includes('استيراد') || c.includes('ORGINAL USED')) return 'USED';
  if (c.includes('RECONDITION') || c.includes('مجدد')) return 'RECONDITIONED';
  if (c.includes('NEW') || c.includes('جديد')) return 'NEW';
  return 'USED';
}

function sanitizeQuality(quality?: string, brand?: string): 'GENUINE_OEM' | 'AFTERMARKET' {
  const q = (quality || '').toUpperCase();
  const b = (brand || '').toUpperCase();
  if (q.includes('OEM') || q.includes('GENUINE') || q.includes('ORIGINAL') || b.includes('MERCEDES') || b.includes('GENUINE')) {
    return 'GENUINE_OEM';
  }
  return 'AFTERMARKET';
}

function determineSide(nameAr: string, nameEn: string): 'LEFT' | 'RIGHT' | 'BOTH' | 'N/A' {
  const full = (nameAr + ' ' + nameEn).toLowerCase();
  if (full.includes('يمين وشمال') || full.includes('طقم')) return 'BOTH';
  if (full.includes('شمال') || full.includes('left') || full.includes(' l ') || full.endsWith(' l')) return 'LEFT';
  if (full.includes('يمين') || full.includes('right') || full.includes(' r ') || full.endsWith(' r')) return 'RIGHT';
  return 'N/A';
}

function determinePosition(nameAr: string, nameEn: string): 'FRONT' | 'REAR' | 'N/A' {
  const full = (nameAr + ' ' + nameEn).toLowerCase();
  if (full.includes('امامي') || full.includes('أمامي') || full.includes('front')) return 'FRONT';
  if (full.includes('خلفي') || full.includes('خلفى') || full.includes('rear') || full.includes('rare')) return 'REAR';
  return 'N/A';
}

const seenPartNumbers = new Map<string, number>();
const parts: PartItem[] = [];

for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  if (!cols || cols.length < 2) continue;

  const rawPartNum = (cols[0] || '').replace(/[\uFEFF]/g, '').trim();
  if (!rawPartNum) continue;

  const nameAr = cols[1] || 'قطع غيار مرسيدس';
  const nameEn = cols[2] || 'Mercedes-Benz Spare Part';
  const epcRaw = cols[3] || '42 BRAKES & HYDRAULICS';
  const brand = cols[4] || 'Mercedes-Benz Genuine Parts';
  const qualityRaw = cols[5] || 'GENUINE_OEM';
  const stockQty = parseInt(cols[6], 10) || 0;
  const costPrice = parseFloat(cols[7]) || 0;
  const sellingPrice = parseFloat(cols[8]) || (costPrice > 0 ? costPrice * 1.3 : 0);
  const minStock = parseInt(cols[9], 10) || 1;

  // Handle part number duplicates with index suffixes
  const count = (seenPartNumbers.get(rawPartNum) || 0) + 1;
  seenPartNumbers.set(rawPartNum, count);

  const cleanPartNum = rawPartNum.replace(/\s+/g, ' ');
  const partId = `part_${cleanPartNum.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${count}`;
  const { group, subgroup } = extractEPCGroup(epcRaw);

  const item: PartItem = {
    id: partId,
    partNumber: cleanPartNum,
    originalPartNumber: cleanPartNum,
    supersededNumbers: [],
    alternativeNumbers: [],
    nameAr: nameAr.trim() || 'قطع غيار مرسيدس',
    nameEn: nameEn.trim() || 'Mercedes Part',
    description: `${nameAr} - ${nameEn}`,
    categoryGroup: group,
    subgroup: subgroup,
    epcIllustration: '',
    epcPosition: '',
    compatibility: ['W204', 'W205', 'W212', 'W213', 'W221', 'W222', 'W176', 'W177', 'W117', 'W118', 'X253', 'X254'],
    side: determineSide(nameAr, nameEn),
    position: determinePosition(nameAr, nameEn),
    condition: sanitizeCondition(qualityRaw || nameAr),
    quality: sanitizeQuality(qualityRaw, brand),
    brand: brand.trim() || 'Mercedes-Benz Genuine Parts',
    unit: 'PCS',
    weightKg: 1.5,
    costPrice: costPrice,
    sellingPrice: sellingPrice,
    wholesalePrice: sellingPrice > 0 ? Math.round(sellingPrice * 0.85) : 0,
    minStock: minStock,
    maxStock: Math.max(minStock * 10, 20),
    reorderLevel: Math.max(minStock, 2),
    barcode: `${cleanPartNum.replace(/[^a-zA-Z0-9]/g, '')}`,
    qrCode: `MB-${cleanPartNum.replace(/[^a-zA-Z0-9]/g, '')}`,
    totalStock: stockQty,
    availableStock: stockQty
  };

  parts.push(item);
}

console.log(`Parsed ${parts.length} distinct parts!`);
const outJsonPath = path.join(process.cwd(), 'src', 'data', 'catalog.json');
fs.writeFileSync(outJsonPath, JSON.stringify(parts, null, 2), 'utf8');
console.log('Saved to src/data/catalog.json');
