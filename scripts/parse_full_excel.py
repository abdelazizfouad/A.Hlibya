import json
import re
import os

# We will read chunks and populate catalog.json with complete records
catalog_data_file = os.path.join(os.path.dirname(__file__), '../src/data/catalog.json')

# Helper functions
def detect_category(group, name_ar, name_en):
    if group and group.strip():
        return group.strip()
    text = (name_ar + ' ' + name_en).lower()
    if any(k in text for k in ['طنابير', 'فرامل', 'تيل', 'كاليبر', 'brake', 'abs', 'سرفو']):
        return '42 BRAKES & HYDRAULICS'
    if any(k in text for k in ['مقص', 'مساعد', 'ميزان', 'جلب', 'شمعدان', 'بيض', 'suspension', 'بطاح', 'بطاحة']):
        return '32 SUSPENSION & SPRINGS'
    if any(k in text for k in ['فانوس', 'كنترول', 'حساس', 'دينامو', 'مارش', 'ضفيرة', 'سويتش', 'بوردة', 'شاشة', 'electrical', 'عداد', 'كاميرا', 'كونتاك', 'سام']):
        return '54 ELECTRICAL & SENSORS'
    if any(k in text for k in ['تكييف', 'سربنتين', 'كباس', 'ريداتير', 'ردياتير', 'كولر', 'climate', 'cooling', 'سخن', 'كمبروسر']):
        return '83 CLIMATE CONTROL'
    if any(k in text for k in ['اكصدام', 'رفرف', 'باب', 'كبوت', 'شنطة', 'شنطه', 'دفيوزر', 'هواية', 'شبك', 'body', 'زجاج', 'مصفح', 'فبر', 'شاسيه', 'مساحة', 'مساحات', 'كفه', 'مرايا']):
        return '88 BODY & BUMPERS'
    if any(k in text for k in ['موتور', 'سير', 'بكرة', 'بكر', 'بستن', 'بستم', 'كرنك', 'كام', 'كامة', 'طلمب', 'طلمبة', 'تربو', 'engine', 'بوجيه', 'كوعة', 'خرطوم', 'ماسورة', 'جوان']):
        return '01 ENGINE & TIMING'
    if any(k in text for k in ['فتيس', 'كرونه', 'كرونة', 'كوبلن', 'كوبلين', 'كردان', 'transmission', 'قربة فيتيس', 'عقل فتيس']):
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
    patterns = ['W205', 'W206', 'W213', 'W214', 'W222', 'W223', 'W204', 'W212', 'W211', 'W210', 'W203', 'W177', 'W118', 'W156', 'W166', 'W167', 'W246', 'W247', 'W253', 'W254', 'GLC', 'GLK', 'GLA', 'CLA', 'W221', 'W163', 'W140', 'W124', 'W126', 'W639', 'W447']
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
