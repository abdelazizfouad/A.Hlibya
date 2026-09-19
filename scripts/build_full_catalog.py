import json
import re

def process_csv():
    # Load or extract all user records
    with open('scripts/parts_raw_chunk1.csv', 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = [l.strip() for l in content.split('\n') if l.strip()]
    parts = []
    
    for idx, line in enumerate(lines):
        parts_cols = [c.strip() for c in line.split(',')]
        if len(parts_cols) < 7:
            continue
        
        p_num = parts_cols[0].replace('"', '').strip()
        name_ar = parts_cols[1].replace('"', '').strip()
        name_en = parts_cols[2].replace('"', '').strip()
        epc = parts_cols[3].replace('"', '').strip()
        brand = parts_cols[4].replace('"', '').strip() or 'Mercedes-Benz Genuine Parts'
        quality = parts_cols[5].replace('"', '').strip() or 'GENUINE_OEM'
        
        try:
            stock = int(parts_cols[6])
        except:
            stock = 0
            
        try:
            cost = float(parts_cols[7]) if len(parts_cols) > 7 and parts_cols[7] else 0
        except:
            cost = 0
            
        try:
            sell = float(parts_cols[8]) if len(parts_cols) > 8 and parts_cols[8] else 0
        except:
            sell = 0
            
        try:
            min_stk = int(parts_cols[9]) if len(parts_cols) > 9 and parts_cols[9] else 1
        except:
            min_stk = 1

        epc_grp = "42" if "BRAKE" in epc or "فرامل" in name_ar or "طنابير" in name_ar else ("32" if "SUSPENSION" in epc or "مقص" in name_ar or "مساعد" in name_ar else ("01" if "ENGINE" in epc or "موتور" in name_ar or "دينامو" in name_ar else "54"))
        
        clean_num = p_num.upper()
        pid = f"part_{re.sub(r'[^a-zA-Z0-9]', '_', clean_num).lower()}_{idx+1}"
        
        parts.append({
            "id": pid,
            "partNumber": clean_num,
            "originalPartNumber": clean_num,
            "supersededNumbers": [],
            "alternativeNumbers": [],
            "nameAr": name_ar,
            "nameEn": name_en or "Mercedes-Benz Part",
            "description": f"{name_ar} {name_en}",
            "categoryGroup": epc_grp,
            "subgroup": f"{epc_grp}0",
            "epcIllustration": "",
            "epcPosition": "",
            "compatibility": ["W204", "W205", "W212", "W213", "W222", "W223", "W176", "W177", "W117", "W118", "X253", "X254"],
            "side": "LEFT" if "شمال" in name_ar or " L" in name_ar or "left" in name_en.lower() else ("RIGHT" if "يمين" in name_ar or " R" in name_ar or "right" in name_en.lower() else "N/A"),
            "position": "FRONT" if "امامي" in name_ar or "أمامي" in name_ar or "front" in name_en.lower() else ("REAR" if "خلفي" in name_ar or "خلفى" in name_ar or "rear" in name_en.lower() else "N/A"),
            "condition": "NEW" if "جديد" in name_ar or "NEW" in quality else "USED",
            "quality": "GENUINE_OEM" if "GENUINE" in quality or "ORIGINAL" in quality or "Mercedes" in brand else "AFTERMARKET",
            "brand": brand,
            "unit": "PCS",
            "weightKg": 1.5,
            "costPrice": cost,
            "sellingPrice": sell,
            "wholesalePrice": sell * 0.85 if sell > 0 else 0,
            "minStock": min_stk,
            "maxStock": max(min_stk * 10, 50),
            "reorderLevel": max(min_stk, 2),
            "barcode": re.sub(r'[^a-zA-Z0-9]', '', clean_num),
            "qrCode": f"MB-{re.sub(r'[^a-zA-Z0-9]', '', clean_num)}",
            "totalStock": stock,
            "availableStock": stock
        })

    print(f"Generated {len(parts)} processed catalog records.")
    return parts

if __name__ == '__main__':
    process_csv()
