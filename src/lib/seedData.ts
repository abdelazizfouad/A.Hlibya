import { 
  Branch, 
  Warehouse, 
  WarehouseLocation, 
  PartMaster, 
  EpcCategory, 
  InventoryItem, 
  StockMovement, 
  UserProfile,
  ShortageItem,
  Supplier,
  Customer,
  PurchaseOrder,
  SalesInvoice
} from '../types/erp';

export const INITIAL_DEMO_USERS: UserProfile[] = [
  {
    id: 'user_abdulaziz_admin',
    email: 'admin@ahlibya.store',
    displayName: 'عبد العزيز',
    role: 'SUPER_ADMIN',
    branchId: 'branch_elharefeyin',
    branchName: 'فرع الحرفيين',
    active: true,
    createdAt: '2026-01-01T08:00:00Z'
  }
];

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'branch_elharefeyin',
    name: 'فرع الحرفيين',
    code: 'AH-ELH',
    city: 'القاهرة / مجمع الحرفيين',
    country: 'مصر',
    address: 'المنطقة الصناعية — بلوك 14 — الحرفيين، القاهرة',
    phone: '+20 100 234 5678',
    isMain: true,
    active: true,
    createdAt: '2026-01-01T08:00:00Z'
  }
];

export const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh_elharefeyin_main',
    branchId: 'branch_elharefeyin',
    branchName: 'فرع الحرفيين',
    name: 'المستودع الرئيسي — الحرفيين',
    code: 'WH-ELH-01',
    description: 'المستودع المركزي لقطع غيار محركات وعفشة وهيكل سيارات مرسيدس-بنز',
    totalCapacityBins: 120,
    active: true,
    createdAt: '2026-01-01T08:00:00Z'
  }
];

export const INITIAL_LOCATIONS: WarehouseLocation[] = [
  {
    id: 'loc_a_03_02_07',
    warehouseId: 'wh_elharefeyin_main',
    warehouseName: 'المستودع الرئيسي — الحرفيين',
    branchId: 'branch_elharefeyin',
    zone: 'A',
    aisle: '03',
    shelf: '02',
    bin: '07',
    code: 'A-03-02-07',
    capacity: 20,
    currentUnits: 0,
    status: 'ACTIVE',
    notes: 'مقصات وعفشة مرسيدس S-Class W223 و W222',
    createdAt: '2026-01-01T08:00:00Z'
  },
  {
    id: 'loc_a_01_01_01',
    warehouseId: 'wh_elharefeyin_main',
    warehouseName: 'المستودع الرئيسي — الحرفيين',
    branchId: 'branch_elharefeyin',
    zone: 'A',
    aisle: '01',
    shelf: '01',
    bin: '01',
    code: 'A-01-01-01',
    capacity: 50,
    currentUnits: 0,
    status: 'ACTIVE',
    notes: 'فلاتر زيت وتكييف وبوجيهات المحركات',
    createdAt: '2026-01-01T08:00:00Z'
  },
  {
    id: 'loc_b_02_03_05',
    warehouseId: 'wh_elharefeyin_main',
    warehouseName: 'المستودع الرئيسي — الحرفيين',
    branchId: 'branch_elharefeyin',
    zone: 'B',
    aisle: '02',
    shelf: '03',
    bin: '05',
    code: 'B-02-03-05',
    capacity: 30,
    currentUnits: 0,
    status: 'ACTIVE',
    notes: 'طنابير وتيل فرامل أمامية وخلفية',
    createdAt: '2026-01-01T08:00:00Z'
  },
  {
    id: 'loc_c_01_04_02',
    warehouseId: 'wh_elharefeyin_main',
    warehouseName: 'المستودع الرئيسي — الحرفيين',
    branchId: 'branch_elharefeyin',
    zone: 'C',
    aisle: '01',
    shelf: '04',
    bin: '02',
    code: 'C-01-04-02',
    capacity: 15,
    currentUnits: 0,
    status: 'ACTIVE',
    notes: 'فوانيس الإضاءة الذكية Multibeam LED',
    createdAt: '2026-01-01T08:00:00Z'
  },
  {
    id: 'loc_d_01_02_03',
    warehouseId: 'wh_elharefeyin_main',
    warehouseName: 'المستودع الرئيسي — الحرفيين',
    branchId: 'branch_elharefeyin',
    zone: 'D',
    aisle: '01',
    shelf: '02',
    bin: '03',
    code: 'D-01-02-03',
    capacity: 25,
    currentUnits: 0,
    status: 'ACTIVE',
    notes: 'مساعدين هوائية AIRMATIC وطلمبات هيدروليك',
    createdAt: '2026-01-01T08:00:00Z'
  }
];

export const INITIAL_EPC_CATEGORIES: EpcCategory[] = [
  {
    id: 'cat_32',
    groupCode: '32',
    nameEn: '32 SUSPENSION & SPRINGS',
    nameAr: '32 العفشة ونظام التعليق والمساعدين',
    iconName: 'Activity',
    subgroups: [
      { code: '32-050', nameEn: 'Control Arms & Ball Joints', nameAr: 'المقصات وأذرع التوجيه والجوزات' },
      { code: '32-100', nameEn: 'AIRMATIC Struts & Shock Absorbers', nameAr: 'المساعدين الهوائية ونظام الإيرماتيك' },
      { code: '32-150', nameEn: 'Stabilizer Bars & Bushings', nameAr: 'ميزان الاتزان وجلب العفشة' }
    ]
  },
  {
    id: 'cat_01',
    groupCode: '01',
    nameEn: '01 ENGINE & TIMING',
    nameAr: '01 المحرك ومكوناته وكاتينة التايمنج',
    iconName: 'Wrench',
    subgroups: [
      { code: '01-050', nameEn: 'Crankcase & Cylinder Head', nameAr: 'كتلة المحرك ورأس السلندر' },
      { code: '01-100', nameEn: 'Pistons & Crankshaft', nameAr: 'البساتم والكرنك' },
      { code: '01-150', nameEn: 'Camshafts & Timing Chain', nameAr: 'الكامات وجنزير التايمنج' }
    ]
  },
  {
    id: 'cat_42',
    groupCode: '42',
    nameEn: '42 BRAKES & HYDRAULICS',
    nameAr: '42 نظام الفرامل والهيدروليك',
    iconName: 'Shield',
    subgroups: [
      { code: '42-010', nameEn: 'Front Brake Calipers & Discs', nameAr: 'طنابير وكليبرات الفرامل الأمامية' },
      { code: '42-050', nameEn: 'Brake Pads & Wear Sensors', nameAr: 'تيل الفرامل وحساسات التآكل' }
    ]
  },
  {
    id: 'cat_82',
    groupCode: '82',
    nameEn: '82 BODY ELECTRICAL & LIGHTING',
    nameAr: '82 كهرباء الهيكل والإنارة والفوانيس',
    iconName: 'Zap',
    subgroups: [
      { code: '82-010', nameEn: 'Multibeam LED Headlights', nameAr: 'فوانيس ملتي بيم ليد الذكية' },
      { code: '82-070', nameEn: 'Front Bumpers & Diamond Grilles', nameAr: 'الاكصدامات وشبكات الدايموند' }
    ]
  }
];

import catalogData from '../data/catalog.json';

export const INITIAL_PARTS: PartMaster[] = ((catalogData as unknown as PartMaster[]) || []).map(p => ({
  ...p,
  costPrice: 0,
  sellingPrice: 0,
  wholesalePrice: 0
}));
export const INITIAL_INVENTORY: InventoryItem[] = INITIAL_PARTS.map((p, idx) => {
  const locCode = (p as any).locationCode || 'A-01-01-01';
  return {
    id: `inv_${p.id}`,
    partId: p.id,
    partNumber: p.partNumber,
    partNameEn: p.nameEn,
    partNameAr: p.nameAr,
    branchId: 'branch_harefeyin',
    branchName: 'فرع الحرفيين - القاهرة',
    warehouseId: 'wh_main_harefeyin',
    warehouseName: 'المستودع الرئيسي - الحرفيين',
    locationId: `loc_${locCode.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
    locationCode: locCode,
    quantity: p.totalStock || 0,
    reservedQuantity: 0,
    availableQuantity: p.availableStock || p.totalStock || 0,
    costPrice: 0,
    sellingPrice: 0,
    lastMovementDate: '2026-08-26T00:00:00.000Z',
    updatedAt: '2026-08-26T00:00:00.000Z'
  };
});
export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [];
export const INITIAL_SHORTAGES: ShortageItem[] = [];
export const INITIAL_SUPPLIERS: Supplier[] = [];
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];
export const INITIAL_SALES_INVOICES: SalesInvoice[] = [];
