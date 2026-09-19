import { PartMaster, WarehouseLocation } from '../types/erp';

/**
 * Normalizes Arabic text by removing diacritics and unifying letters (أ/إ/آ -> ا, ة -> ه, ى -> ي)
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    // Remove diacritics / tashkeel
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize Alef
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Taa Marbuta
    .replace(/ة/g, 'ه')
    // Normalize Yaa
    .replace(/ى/g, 'ي')
    // Normalize Waw with hamza & Yaa with hamza
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

/**
 * Normalizes part number by removing non-alphanumerics (dashes, spaces, dots, slashes)
 * and stripping standard Mercedes prefix ('A' or 'N') if followed by digits.
 * e.g. "A 223-330-23-03" -> "2233302303" & "a2233302303"
 */
export function normalizePartNumber(pNum: string): { clean: string; withoutPrefix: string } {
  if (!pNum) return { clean: '', withoutPrefix: '' };
  const clean = pNum.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Mercedes parts often start with 'a' (e.g. A2233302303) or 'n'
  const withoutPrefix = clean.replace(/^[an](?=\d)/, '');
  return { clean, withoutPrefix };
}

export type MatchType = 'exact' | 'part_number' | 'superseded' | 'alternative' | 'chassis' | 'name' | 'brand' | 'fuzzy';

export interface PartSearchResult {
  part: PartMaster;
  matches: boolean;
  score: number;
  matchType?: MatchType;
  matchedReason?: string;
  matchedValue?: string;
}

/**
 * Evaluates how well a part matches the query, even if the query is incomplete,
 * without prefixes, formatted differently, or matching an old superseded / alternative number.
 */
export function matchPartFlexible(query: string, part: PartMaster): PartSearchResult {
  if (!query || !query.trim()) {
    return { part, matches: true, score: 0 };
  }

  const rawQuery = query.trim().toLowerCase();
  const normQueryArabic = normalizeArabic(rawQuery);
  const { clean: cleanQuery, withoutPrefix: queryNoPrefix } = normalizePartNumber(rawQuery);

  const { clean: cleanPartNum, withoutPrefix: partNumNoPrefix } = normalizePartNumber(part.partNumber || '');
  const { clean: cleanOrigNum, withoutPrefix: origNumNoPrefix } = normalizePartNumber(part.originalPartNumber || '');

  // 1. EXACT PART NUMBER MATCH
  if (
    cleanPartNum === cleanQuery ||
    partNumNoPrefix === queryNoPrefix ||
    (part.partNumber && part.partNumber.toLowerCase() === rawQuery)
  ) {
    return {
      part,
      matches: true,
      score: 100,
      matchType: 'exact',
      matchedReason: 'تطابق تام مع رقم القطعة',
      matchedValue: part.partNumber
    };
  }

  // 2. PARTIAL PART NUMBER MATCH (Contains or starts with)
  if (
    (cleanPartNum && cleanPartNum.includes(cleanQuery)) ||
    (partNumNoPrefix && queryNoPrefix && partNumNoPrefix.includes(queryNoPrefix)) ||
    (cleanOrigNum && cleanOrigNum.includes(cleanQuery))
  ) {
    return {
      part,
      matches: true,
      score: 85,
      matchType: 'part_number',
      matchedReason: 'تطابق برقم القطعة (رقم جزئي أو صيغة مرنة)',
      matchedValue: part.partNumber
    };
  }

  // 3. SUPERSEDED / OLD REPLACED NUMBERS (بدائل مستبدلة)
  if (part.supersededNumbers && part.supersededNumbers.length > 0) {
    for (const sup of part.supersededNumbers) {
      const { clean: cleanSup, withoutPrefix: supNoPrefix } = normalizePartNumber(sup);
      if (
        cleanSup === cleanQuery ||
        supNoPrefix === queryNoPrefix ||
        (cleanSup && cleanSup.includes(cleanQuery)) ||
        (supNoPrefix && queryNoPrefix && supNoPrefix.includes(queryNoPrefix)) ||
        sup.toLowerCase().includes(rawQuery)
      ) {
        return {
          part,
          matches: true,
          score: 80,
          matchType: 'superseded',
          matchedReason: `رقم قديم مستبدل تم تحديثه: (${sup})`,
          matchedValue: sup
        };
      }
    }
  }

  // 4. ALTERNATIVE NUMBERS / OEM INTERCHANGE (أرقام بديلة)
  if (part.alternativeNumbers && part.alternativeNumbers.length > 0) {
    for (const alt of part.alternativeNumbers) {
      const { clean: cleanAlt, withoutPrefix: altNoPrefix } = normalizePartNumber(alt);
      if (
        cleanAlt === cleanQuery ||
        altNoPrefix === queryNoPrefix ||
        (cleanAlt && cleanAlt.includes(cleanQuery)) ||
        (altNoPrefix && queryNoPrefix && altNoPrefix.includes(queryNoPrefix)) ||
        alt.toLowerCase().includes(rawQuery)
      ) {
        return {
          part,
          matches: true,
          score: 75,
          matchType: 'alternative',
          matchedReason: `رقم بديل متوافق / مكافئ: (${alt})`,
          matchedValue: alt
        };
      }
    }
  }

  // 5. CHASSIS / VEHICLE MODEL MATCH (e.g. W223, 223, W213, W205, S500, E200, C180)
  if (part.compatibility && part.compatibility.length > 0) {
    for (const comp of part.compatibility) {
      const chassisRaw = (comp.chassis || '').toLowerCase();
      const chassisClean = chassisRaw.replace(/[^a-z0-9]/g, '');
      const chassisNoW = chassisClean.replace(/^w/, '');
      const modelRaw = (comp.model || '').toLowerCase();
      const engineRaw = (comp.engine || '').toLowerCase();

      if (
        chassisRaw.includes(rawQuery) ||
        chassisClean.includes(cleanQuery) ||
        (chassisNoW && queryNoPrefix && chassisNoW === queryNoPrefix) ||
        modelRaw.includes(rawQuery) ||
        engineRaw.includes(rawQuery)
      ) {
        return {
          part,
          matches: true,
          score: 65,
          matchType: 'chassis',
          matchedReason: `متوافق مع شاسيه: ${comp.chassis} (${comp.model})`,
          matchedValue: `${comp.chassis} ${comp.model}`
        };
      }
    }
  }

  // 6. ARABIC NAME FLEXIBLE / NORMALIZED MATCH
  const normPartAr = normalizeArabic(part.nameAr || '');
  if (normPartAr && (normPartAr.includes(normQueryArabic) || normQueryArabic.includes(normPartAr))) {
    return {
      part,
      matches: true,
      score: 60,
      matchType: 'name',
      matchedReason: 'تطابق في الاسم العربي',
      matchedValue: part.nameAr
    };
  }

  // 7. ENGLISH NAME MATCH
  const normPartEn = (part.nameEn || '').toLowerCase();
  if (normPartEn && normPartEn.includes(rawQuery)) {
    return {
      part,
      matches: true,
      score: 55,
      matchType: 'name',
      matchedReason: 'تطابق في الاسم بالإنجليزي',
      matchedValue: part.nameEn
    };
  }

  // 8. CATEGORY GROUP OR BRAND MATCH
  const normGroup = normalizeArabic(part.categoryGroup || '');
  const normBrand = (part.brand || '').toLowerCase();
  if (normGroup.includes(normQueryArabic) || normBrand.includes(rawQuery)) {
    return {
      part,
      matches: true,
      score: 45,
      matchType: 'brand',
      matchedReason: `المجموعة: ${part.categoryGroup} • الماركة: ${part.brand}`,
      matchedValue: part.brand
    };
  }

  // 9. BARCODE MATCH
  if (part.barcode && part.barcode.includes(rawQuery)) {
    return {
      part,
      matches: true,
      score: 70,
      matchType: 'part_number',
      matchedReason: `تطابق باركود: ${part.barcode}`,
      matchedValue: part.barcode
    };
  }

  return { part, matches: false, score: 0 };
}

/**
 * Filter and sort a list of parts flexibly with intelligent relevance ranking
 */
export function searchPartsFlexible(parts: PartMaster[], query: string): PartSearchResult[] {
  if (!query || !query.trim()) {
    return parts.map((part) => ({
      part,
      matches: true,
      score: 10
    }));
  }

  const results: PartSearchResult[] = [];

  for (let i = 0; i < parts.length; i++) {
    const res = matchPartFlexible(query, parts[i]);
    if (res.matches) {
      results.push(res);
    }
  }

  // Sort by highest score first, then part number
  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.part.partNumber || '').localeCompare(b.part.partNumber || '');
  });
}
