import csv
import json
import os
import re

# We will read from scripts/raw_catalog.csv and produce src/data/catalog.json
raw_file = os.path.join(os.path.dirname(__file__), 'raw_catalog.csv')
out_json = os.path.join(os.path.dirname(__file__), '../src/data/catalog.json')

def detect_category(group, name_ar, name_en):
    if group and group.strip():
        return group.strip()
    text = (name_ar + ' ' + name_en).lower()
    if any(k in text for k in ['طنابير', 'فرامل', 'تيل', 'كاليبر', 'brake']):
        return '42 BRAKES & HYDRAULICS'
    if any(k in text for k in ['مقص', 'مساعد', 'ميزان', 'جلب', 'شمعدان', 'بيض', 'suspension']):
        return '32 SUSPENSION & SPRINGS'
    if any(k in text for k in ['فانوس', 'كنترول', 'حساس', 'دينامو', 'مارش', 'ضفيرة', 'سويتش', 'بوردة', 'شاشة', 'electrical', 'عداد']):
        return '54 ELECTRICAL & SENSORS'
    if any(k in text for k in ['تكييف', 'سربنتين', 'كباس', 'ريداتير', 'ردياتير', 'كولر', 'climate', 'cooling', 'سخن']):
        return '83 CLIMATE CONTROL'
    if any(k in text for k in ['اكصدام', 'رفرف', 'باب', 'كبوت', 'شنطة', 'شنطه', 'دفيوزر', 'هواية', 'شبك', 'body', 'زجاج']):
        return '88 BODY & BUMPERS'
    if any(k in text for k in ['موتور', 'سير', 'بكرة', 'بكر', 'بستن', 'بستم', 'كرنك', 'كام', 'كامة', 'طلمب', 'طلمبة', 'تربو', 'engine', 'بوجيه']):
        return '01 ENGINE & TIMING'
    if any(k in text for k in ['فتيس', 'كرونه', 'كرونة', 'كوبلن', 'كوبلين', 'كردان', 'transmission']):
        return '27 AUTOMATIC TRANSMISSION'
    return '01 ENGINE & TIMING'

def detect_quality(q_str):
    upper = (q_str or '').upper().strip()
    if 'GENUINE' in upper or 'ORIGINAL' in upper or 'ORGINAL' in upper:
        return 'GENUINE_OEM'
    if 'AFTER' in upper or 'CHINA' in upper or 'CHINESE' in upper or 'TAIWAN' in upper:
        return 'AFTERMARKET'
    return 'GENUINE_OEM'

def detect_condition(q_str, name_ar):
    upper = ((q_str or '') + ' ' + (name_ar or '')).upper()
    if 'USED' in upper or 'مستعمل' in upper or 'استراد' in upper or 'استيراد' in upper:
        return 'USED_EXCELLENT'
    return 'NEW'

def detect_chassis(part_num, name_ar):
    combined = (part_num + ' ' + name_ar).upper()
    patterns = ['W205', 'W206', 'W213', 'W214', 'W222', 'W223', 'W204', 'W212', 'W211', 'W210', 'W203', 'W177', 'W118', 'W156', 'W166', 'W167', 'W246', 'W247', 'W253', 'W254', 'GLC', 'GLK', 'GLA', 'CLA', 'W221']
    found = []
    for pat in patterns:
        if pat in combined or pat.replace('W', '') in combined:
            found.append(pat if pat.startswith('W') else f"W{pat}")
    if not found:
        return [{'chassis': 'W206', 'model': 'C-Class Sedan', 'engine': 'M254', 'yearFrom': 2021, 'yearTo': 2026}]
    
    unique_chassis = list(dict.fromkeys(found))
    return [{'chassis': c, 'model': f'Mercedes-Benz {c}', 'engine': 'OEM Standard', 'yearFrom': 2016, 'yearTo': 2026} for c in unique_chassis]

BIN_RACKS = {
    '42 BRAKES & HYDRAULICS': ['A-01-01-01', 'A-01-01-02', 'A-01-02-01', 'A-01-02-02', 'A-01-03-01', 'A-01-03-02'],
    '32 SUSPENSION & SPRINGS': ['A-02-01-01', 'A-02-01-02', 'A-02-02-01', 'A-02-02-02', 'A-02-03-01', 'A-02-03-02'],
    '54 ELECTRICAL & SENSORS': ['B-01-01-01', 'B-01-01-02', 'B-01-02-01', 'B-01-02-02', 'B-01-03-01', 'B-01-03-02'],
    '83 CLIMATE CONTROL': ['B-02-01-01', 'B-02-01-02', 'B-02-02-01', 'B-02-02-02', 'B-02-03-01', 'B-02-03-02'],
    '88 BODY & BUMPERS': ['C-01-01-01', 'C-01-01-02', 'C-01-02-01', 'C-01-02-02', 'C-01-03-01', 'C-01-03-02'],
    '01 ENGINE & TIMING': ['D-01-01-01', 'D-01-01-02', 'D-01-02-01', 'D-01-02-02', 'D-01-03-01', 'D-01-03-02'],
    '27 AUTOMATIC TRANSMISSION': ['D-02-01-01', 'D-02-01-02', 'D-02-02-01', 'D-02-02-02', 'D-02-03-01', 'D-02-03-02'],
}

if __name__ == '__main__':
    with open(raw_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        parts = []
        seen = {}
        idx = 0
        for row in reader:
            if not row or len(row) < 2:
                continue
            idx += 1
            raw_part_num = (row[0] or '').strip()
            name_ar = (row[1] or '').strip()
            name_en = (row[2] if len(row) > 2 else '').strip()
            epc_group = (row[3] if len(row) > 3 else '').strip()
            brand = (row[4] if len(row) > 4 else '').strip() or 'Mercedes-Benz Genuine Parts'
            quality_raw = (row[5] if len(row) > 5 else '').strip()
            try:
                stock_qty = int(row[6]) if len(row) > 6 and row[6].strip() else 0
            except:
                stock_qty = 0
            try:
                cost_price = float(row[7]) if len(row) > 7 and row[7].strip() else 0.0
            except:
                cost_price = 0.0
            try:
                selling_price = float(row[8]) if len(row) > 8 and row[8].strip() else 0.0
            except:
                selling_price = 0.0
            try:
                min_stock = int(row[9]) if len(row) > 9 and row[9].strip() else 1
            except:
                min_stock = 1

            if not raw_part_num and not name_ar:
                continue
            if not raw_part_num:
                raw_part_num = f"MB-ITEM-{idx}"
            if not name_ar:
                name_ar = f"قطعة مرسيدس {raw_part_num}"
            if not name_en:
                name_en = name_ar

            clean_part_num = re.sub(r'\s+', ' ', raw_part_num).strip()
            safe_id = 'part_' + re.sub(r'[^a-zA-Z0-9]', '_', clean_part_num).lower()
            if safe_id in seen:
                seen[safe_id] += 1
                unique_part_id = f"{safe_id}_{seen[safe_id]}"
            else:
                seen[safe_id] = 1
                unique_part_id = safe_id

            category = detect_category(epc_group, name_ar, name_en)
            quality = detect_quality(quality_raw)
            condition = detect_condition(quality_raw, name_ar)
            compat = detect_chassis(clean_part_num, name_ar)

            loc_list = BIN_RACKS.get(category, ['A-01-01-01', 'A-01-01-02'])
            assigned_loc = loc_list[idx % len(loc_list)]

            side = 'LEFT' if ('شمال' in name_ar or ' L' in name_ar) else 'RIGHT' if ('يمين' in name_ar or ' R' in name_ar) else 'BOTH'
            position = 'FRONT' if ('امامي' in name_ar or 'أمامي' in name_ar) else 'REAR' if 'خلفي' in name_ar else 'N/A'

            parts.append({
                'id': unique_part_id,
                'partNumber': clean_part_num,
                'originalPartNumber': clean_part_num,
                'supersededNumbers': [],
                'alternativeNumbers': [],
                'nameAr': name_ar,
                'nameEn': name_en,
                'description': f"صنف معتمد بكتالوج قطع غيار مرسيدس-بنز. الرف التخزيني المقترح: {assigned_loc}.",
                'categoryGroup': category,
                'subgroup': f"{category.split(' ')[0]}-010 General",
                'epcIllustration': 'EPC-MB-2026',
                'epcPosition': f"{(idx % 50) + 1}",
                'brand': brand,
                'quality': quality,
                'condition': condition,
                'side': side,
                'position': position,
                'unit': 'PCS',
                'costPrice': cost_price,
                'sellingPrice': selling_price,
                'wholesalePrice': round(selling_price * 0.9) if selling_price > 0 else 0,
                'minStock': min_stock,
                'maxStock': max(min_stock * 5, 20),
                'reorderLevel': min_stock + 1,
                'barcode': re.sub(r'[^a-zA-Z0-9]', '', clean_part_num),
                'qrCode': f"MB-GEN-{re.sub(r'[^a-zA-Z0-9]', '', clean_part_num)}",
                'notes': f"مستورد عبر الإكسل — الرف {assigned_loc}",
                'compatibility': compat,
                'totalStock': stock_qty,
                'availableStock': stock_qty,
                'locationCode': assigned_loc,
                'createdAt': '2026-08-26T00:00:00.000Z',
                'updatedAt': '2026-08-26T00:00:00.000Z'
            })

        print(f"Parsed {len(parts)} parts.")
        os.makedirs(os.path.dirname(out_json), exist_ok=True)
        with open(out_json, 'w', encoding='utf-8') as f_out:
            json.dump(parts, f_out, ensure_ascii=False, indent=2)
        print("Written to", out_json)
