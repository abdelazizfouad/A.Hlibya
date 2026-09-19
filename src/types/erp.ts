export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'MANAGER' 
  | 'WAREHOUSE' 
  | 'SALES' 
  | 'PURCHASING' 
  | 'ACCOUNTING';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  branchId: string;
  branchName?: string;
  active: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  city: string;
  country: string;
  address: string;
  phone: string;
  isMain: boolean;
  active: boolean;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  branchId: string;
  branchName?: string;
  name: string;
  code: string;
  description: string;
  address?: string;
  city?: string;
  type?: 'MAIN_HUB' | 'BRANCH_WH' | 'TRANSIT';
  totalCapacityBins?: number;
  active: boolean;
  createdAt: string;
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  branchId: string;
  zone: string;       // e.g. "A", "B", "C", "D"
  aisle: string;      // e.g. "01", "02", "03"
  shelf: string;      // e.g. "01", "02"
  bin: string;        // e.g. "01", "02", "07"
  code: string;       // e.g. "A-03-02-07"
  capacity: number;   // max items capacity
  currentUnits?: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'FULL' | 'RESERVED';
  qrCode?: string;
  notes?: string;
  createdAt: string;
}

export interface VehicleCompatibility {
  chassis: string;    // e.g. "W213", "W205", "W222", "W167", "W206", "W223", "C238"
  model: string;      // e.g. "E200", "E300", "C180", "S500", "GLE 450"
  engine?: string;    // e.g. "M274", "OM654", "M256", "M176"
  yearFrom?: number;  // e.g. 2016
  yearTo?: number;    // e.g. 2023
  notes?: string;
}

export type PartCondition = 'NEW' | 'USED' | 'RECONDITIONED';
export type PartQuality = 'GENUINE_OEM' | 'ORIGINAL' | 'AFTERMARKET' | 'PERFORMANCE';
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'CRITICAL' | 'OUT_OF_STOCK' | 'OVERSTOCK';

export interface PartMaster {
  id: string;
  partNumber: string;               // e.g. "A2133230500" - Primary identifier
  originalPartNumber?: string;
  supersededNumbers: string[];      // Replaced by or replaces
  alternativeNumbers: string[];     // Cross-references / OEM alternatives
  nameEn: string;                   // e.g. "Front Left Lower Control Arm"
  nameAr: string;                   // e.g. "مقص أمامي سفلي يسار"
  description?: string;
  categoryGroup: string;            // e.g. "32 SUSPENSION", "42 BRAKES", "01 ENGINE"
  subgroup?: string;                // e.g. "Control Arms & Ball Joints"
  epcIllustration?: string;         // e.g. "32-050"
  epcPosition?: string;             // e.g. "10"
  compatibility: VehicleCompatibility[];
  side?: 'LEFT' | 'RIGHT' | 'BOTH' | 'N/A';
  position?: 'FRONT' | 'REAR' | 'UPPER' | 'LOWER' | 'CENTER' | 'N/A';
  condition: PartCondition;
  quality: PartQuality;
  brand: string;                    // e.g. "Mercedes-Benz Genuine", "Lemförder", "Brembo", "Bosch"
  unit: string;                     // "PCS", "SET", "PAIR", "LITER"
  weightKg?: number;
  costPrice: number;                // in EGP (جنيه مصري)
  sellingPrice: number;             // Retail selling price in EGP
  wholesalePrice?: number;          // Garage / Wholesale price in EGP
  minStock: number;                 // Threshold for Low stock warning
  maxStock: number;                 // Maximum stock limit
  reorderLevel: number;             // Auto-purchase alert point
  barcode?: string;
  qrCode?: string;
  defaultLocationId?: string;
  imageUrl?: string;
  notes?: string;
  totalStock: number;               // Aggregated across all locations
  availableStock: number;           // totalStock - reserved
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  partId: string;
  partNumber: string;
  partNameEn: string;
  partNameAr: string;
  branchId: string;
  branchName?: string;
  warehouseId: string;
  warehouseName?: string;
  locationId: string;
  locationCode: string;             // e.g. "A-03-02-07"
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  costPrice: number;
  sellingPrice: number;
  lastMovementDate: string;
  updatedAt: string;
}

export interface PartSerial {
  id: string;
  serialNumber: string;             // Unique Code 128 scannable serial e.g. "SN-A2233302303-0001"
  partId: string;
  partNumber: string;
  nameAr: string;
  nameEn: string;
  chassis?: string;
  brand?: string;
  locationCode?: string;
  branchId?: string;
  warehouseId?: string;
  costPrice?: number;
  sellingPrice?: number;
  status: 'IN_STOCK' | 'RESERVED' | 'SOLD' | 'RETURNED' | 'SCRAPPED';
  printCount: number;
  lastPrintedAt: string;
  createdAt: string;
  batchId?: string;
  notes?: string;
}

export type MovementType = 
  | 'INITIAL_STOCK' 
  | 'PURCHASE' 
  | 'SALE' 
  | 'TRANSFER' 
  | 'ADJUSTMENT' 
  | 'DAMAGED' 
  | 'LOST' 
  | 'FOUND' 
  | 'CUSTOMER_RETURN' 
  | 'SUPPLIER_RETURN';

export interface StockMovement {
  id: string;
  partId: string;
  partNumber: string;
  partName: string;
  movementType: MovementType;
  quantity: number;                 // Positive or negative delta
  previousQuantity: number;
  newQuantity: number;
  branchId: string;
  branchName?: string;
  warehouseId: string;
  warehouseName?: string;
  sourceLocation?: string;          // e.g. "A-03-02-07"
  destinationLocation?: string;     // e.g. "B-01-04-02"
  reference?: string;               // PO#, Invoice#, Transfer Doc#
  reason: string;
  userId: string;
  userName: string;
  userRole?: string;
  timestamp: string;
}

export interface EpcCategory {
  id: string;
  groupCode: string;                // e.g. "01", "27", "32", "42", "46", "54", "82", "88"
  nameEn: string;
  nameAr: string;
  iconName: string;
  subgroups: {
    code: string;
    nameEn: string;
    nameAr: string;
  }[];
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;                   // e.g. "CREATE_PART", "TRANSFER_STOCK", "UPDATE_LOCATION"
  entity: string;                   // e.g. "Part", "Inventory", "Warehouse"
  entityId: string;
  details: string;
  timestamp: string;
}

export interface VinDecodeResult {
  id?: string;
  vin: string;
  make: string;
  model: string;
  modelYear: number;
  chassis: string;
  engineModel?: string;
  displacementL?: string;
  cylinders?: string;
  fuelType?: string;
  bodyClass?: string;
  driveType?: string;
  plantCountry?: string;
  series?: string;
  trim?: string;
  transmission?: string;
  decodedAt: string;
  isValid: boolean;
  notes?: string;
  rawAttributes?: Record<string, string>;
  suggestedOemParts?: {
    nameAr: string;
    nameEn: string;
    partNumber: string;
    category?: string;
  }[];
}

export interface ShortageItem {
  id: string;
  partNumber: string;
  nameAr: string;
  nameEn: string;
  chassis?: string;
  requestedQty: number;
  requestCount: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  customerName?: string;
  customerPhone?: string;
  status: 'PENDING' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  country: string;
  city: string;
  address?: string;
  taxNumber?: string;
  rating?: number;
  notes?: string;
  totalOrdersCount?: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  workshopName?: string;
  type: 'WORKSHOP' | 'INDIVIDUAL' | 'FLEET' | 'DEALER';
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  totalOrdersCount?: number;
  createdAt: string;
}

export interface PurchaseOrderItem {
  partId: string;
  partNumber: string;
  nameAr: string;
  quantity: number;
  costPrice: number;
  totalCost: number;
  locationCode: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  warehouseId: string;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  items: PurchaseOrderItem[];
  totalAmount: number;
  currency: 'EGP';
  createdDate: string;
  receivedDate?: string;
  notes?: string;
  userId: string;
  userName: string;
}

export interface SalesInvoiceItem {
  partId: string;
  partNumber: string;
  nameAr: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  locationCode: string;
}

export interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  branchId: string;
  warehouseId: string;
  status: 'COMPLETED' | 'PENDING' | 'REFUNDED';
  items: SalesInvoiceItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT';
  currency: 'EGP';
  createdDate: string;
  notes?: string;
  userId: string;
  userName: string;
}

export interface StocktakeItem {
  locationCode: string;
  partId: string;
  partNumber: string;
  partName: string;
  systemQty: number;
  countedQty: number;
  variance: number;
  costPrice?: number;
  unitCost?: number;
  varianceValue?: number;
}

export interface StocktakeSession {
  id: string;
  title?: string;
  warehouseId?: string;
  zone: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  items: StocktakeItem[];
  totalVarianceUnits?: number;
  totalVarianceValue?: number;
  conductedBy: string;
  conductedAt: string;
  approvedAt?: string;
}

export interface ERPStats {
  totalParts: number;
  totalStockUnits: number;
  totalInventoryValuation: number;
  totalCostValuationEGP?: number;
  totalRetailValuationEGP?: number;
  lowStockCount: number;
  criticalStockCount: number;
  outOfStockCount: number;
  todayMovementsCount: number;
  totalLocations: number;
  occupiedLocations: number;
  totalBranches: number;
  shortagesCount?: number;
  totalSalesValue?: number;
  totalPurchasesValue?: number;
  categoryCounts?: Record<string, { count: number; units: number; val: number }>;
  updatedAt?: string;
}
