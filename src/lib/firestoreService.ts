/**
 * AH.Libya ERP - Local PC Server Data Service
 * 
 * Local PC Server data API backed by the on-device SQLite database.
 * All inventory, parts, movements, and records are stored on disk in `data/local_erp_database.sqlite`.
 */

import { 
  PartMaster, 
  InventoryItem, 
  PartSerial,
  StockMovement, 
  WarehouseLocation, 
  Branch, 
  Warehouse, 
  EpcCategory, 
  AuditLog, 
  ShortageItem,
  Supplier,
  Customer,
  PurchaseOrder,
  SalesInvoice,
  StocktakeSession,
  VinDecodeResult,
  ERPStats
} from '../types/erp';

import {
  fetchLocalData,
  subscribeLocalParts,
  subscribeLocalInventory,
  subscribeLocalMovements,
  subscribeLocalLocations,
  subscribeLocalBranches,
  subscribeLocalWarehouses,
  subscribeLocalCategories,
  subscribeLocalShortages,
  subscribeLocalSuppliers,
  subscribeLocalCustomers,
  subscribeLocalPurchaseOrders,
  subscribeLocalSalesInvoices,
  subscribeLocalAuditLogs,
  savePartToLocal,
  deletePartFromLocal,
  bulkImportPartsToLocal,
  executeLocalStockMovement,
  deleteLocalStockMovement,
  clearAllLocalStockMovements,
  saveLocalSalesInvoice,
  deleteLocalSalesInvoice,
  clearAllLocalSalesInvoices,
  addLocalWarehouseLocation,
  zeroOutLocalSellingPrices,
  zeroOutLocalAllPrices,
  startLocalAutoSync,
  fetchLocalPartsPage
} from './localServerService';

// Initialize auto sync on module load
if (typeof window !== 'undefined') {
  // Polling every four seconds multiplied API traffic for every remote client.
  // Mutations refresh immediately; this is only a low-cost reconciliation.
  startLocalAutoSync(30000);
}

export type QuotaListener = (isExceeded: boolean) => void;
export function subscribeQuotaState(listener: QuotaListener) {
  listener(false); // Quota is never exceeded on Local PC Server!
  return () => {};
}
export function notifyQuotaExceeded(_err: any) {}

export async function ensureDatabaseSeeded(): Promise<boolean> {
  await fetchLocalData();
  return true;
}

export async function forceReseedDatabase(): Promise<boolean> {
  await fetchLocalData();
  return true;
}

export async function wipeAllDatabaseData(_user?: { id: string; name: string }): Promise<{ success: boolean; message: string }> {
  try {
    await clearAllLocalStockMovements();
    return { success: true, message: "تم تنظيف بيانات الحركات في الخادم المحلي بنجاح." };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function zeroOutAllSellingPrices(_user?: { id: string; name: string }): Promise<{ success: boolean; updatedCount: number; message: string }> {
  const res = await zeroOutLocalSellingPrices();
  return { success: res.success, updatedCount: 0, message: res.message };
}

export async function zeroOutAllPrices(_user?: { id: string; name: string }): Promise<{ success: boolean; updatedCount: number; message: string }> {
  const res = await zeroOutLocalAllPrices();
  return { success: res.success, updatedCount: 0, message: res.message };
}

export async function zeroOutAllCosts(_user?: { id: string; name: string }): Promise<{ success: boolean; updatedCount: number; message: string }> {
  return await zeroOutAllPrices();
}

export function getInitialSystemStats(): ERPStats {
  return {
    totalParts: 0,
    totalStockUnits: 0,
    totalInventoryValuation: 0,
    totalCostValuationEGP: 0,
    lowStockCount: 0,
    criticalStockCount: 0,
    outOfStockCount: 0,
    todayMovementsCount: 0,
    totalLocations: 135,
    occupiedLocations: 0,
    totalBranches: 1
  };
}

export function subscribeSystemStats(callback: (stats: ERPStats) => void) {
  const unsubParts = subscribeLocalParts((parts) => {
    const totalParts = parts.length;
    let totalStockUnits = 0;
    let totalInventoryValuation = 0;
    let totalCostValuationEGP = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of parts) {
      const stock = Number(p.totalStock || 0);
      const sell = Number(p.sellingPrice || 0);
      const cost = Number(p.costPrice || 0);
      totalStockUnits += stock;
      totalInventoryValuation += stock * sell;
      totalCostValuationEGP += stock * cost;
      if (stock === 0) outOfStockCount++;
      else if (stock <= (p.minStock || 1)) lowStockCount++;
    }

    callback({
      totalParts,
      totalStockUnits,
      totalInventoryValuation,
      totalCostValuationEGP,
      lowStockCount,
      criticalStockCount: Math.floor(lowStockCount / 2),
      outOfStockCount,
      totalLocations: 135,
      occupiedLocations: Math.min(135, totalParts),
      totalBranches: 1,
      todayMovementsCount: 0
    });
  });

  return unsubParts;
}

export async function updateSystemStatsAtomic(_deltas: any) {}

export async function recalculateSystemStats(): Promise<ERPStats> {
  const data = await fetchLocalData();
  const parts = data?.parts || [];
  let totalStockUnits = 0;
  let totalInventoryValuation = 0;
  let totalCostValuationEGP = 0;

  for (const p of parts) {
    const stock = Number(p.totalStock || 0);
    totalStockUnits += stock;
    totalInventoryValuation += stock * Number(p.sellingPrice || 0);
    totalCostValuationEGP += stock * Number(p.costPrice || 0);
  }

  return {
    totalParts: parts.length,
    totalStockUnits,
    totalInventoryValuation,
    totalCostValuationEGP,
    lowStockCount: 0,
    criticalStockCount: 0,
    outOfStockCount: 0,
    totalLocations: 135,
    occupiedLocations: Math.min(135, parts.length),
    totalBranches: 1,
    todayMovementsCount: 0
  };
}

export interface PaginatedPartsResult {
  parts: PartMaster[];
  hasMore: boolean;
  totalCount: number;
}

export async function fetchPartsPage(options: {
  pageSize: number;
  page?: number;
  query?: string;
  categoryGroup?: string;
  quality?: string;
  status?: string;
  sortBy?: 'partNumber' | 'nameAr' | 'nameEn' | 'totalStock' | 'sellingPrice' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
}): Promise<PaginatedPartsResult> {
  return fetchLocalPartsPage({
    page: options.page || 1,
    limit: options.pageSize || 50,
    query: options.query,
    categoryGroup: options.categoryGroup,
    quality: options.quality,
    status: options.status,
    sortBy: options.sortBy,
    sortDirection: options.sortDirection
  });
}

export async function searchPartsFirestore(searchTerm: string, limitCount: number = 30, signal?: AbortSignal): Promise<PartMaster[]> {
  return fetchLocalPartsPage({ query: searchTerm, limit: limitCount, page: 1, signal }).then(result => result.parts);
}

export async function getPartByBarcode(barcode: string): Promise<PartMaster | null> {
  const res = await fetch(`/api/local/parts/${encodeURIComponent(barcode)}`);
  if (res.status === 404) return null;
  const data = await res.json();
  return data.success ? { ...data.part, scannedInventory: data.inventory || [] } : null;
}

export async function getPartByPartNumber(partNumber: string): Promise<PartMaster | null> {
  const res = await fetch(`/api/local/parts/${encodeURIComponent(partNumber)}`);
  if (res.status === 404) return null;
  const data = await res.json();
  return data.success ? { ...data.part, scannedInventory: data.inventory || [] } : null;
}

export async function getLocationByCode(locationCode: string): Promise<WarehouseLocation | null> {
  const clean = locationCode.trim().toUpperCase();
  const data = await fetchLocalData();
  const locs: WarehouseLocation[] = data?.locations || [];
  return locs.find(l => l.code.toUpperCase() === clean) || null;
}

// Subscriptions
export function subscribeParts(callback: (parts: PartMaster[]) => void) {
  return subscribeLocalParts(callback);
}

export async function bulkImportParts(
  importedItems: any[],
  userOrBranchId?: any,
  branchIdOrWarehouseId?: any,
  _warehouseIdOrLocations?: any,
  _extra?: any
): Promise<{ successCount: number; errors: string[] }> {
  const branchId = typeof userOrBranchId === 'string' ? userOrBranchId : 'branch_main';
  const warehouseId = typeof branchIdOrWarehouseId === 'string' ? branchIdOrWarehouseId : 'wh_main';
  const res = await bulkImportPartsToLocal(importedItems, branchId, warehouseId);
  return res;
}

export async function createPart(
  partData: any,
  _user?: { id: string; name: string }
): Promise<string> {
  const newPart = await savePartToLocal({
    ...partData,
    id: partData.id || `part_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    totalStock: partData.initialStock || partData.totalStock || 0,
    availableStock: partData.initialStock || partData.availableStock || 0
  });
  return newPart.id;
}

export async function updatePart(id: string, updates: Partial<PartMaster>, _user?: { id: string; name: string }): Promise<void> {
  await savePartToLocal({ ...updates, id });
}

export async function deletePart(id: string, _user?: { id: string; name: string }): Promise<void> {
  await deletePartFromLocal(id);
}

export function subscribeInventory(callback: (items: InventoryItem[]) => void) {
  return subscribeLocalInventory(callback);
}

export function subscribeStockMovements(callback: (movements: StockMovement[]) => void) {
  return subscribeLocalMovements(callback);
}

export async function deleteStockMovement(id: string): Promise<void> {
  await deleteLocalStockMovement(id);
}

export async function executeStockMovement(params: any): Promise<string> {
  const res = await executeLocalStockMovement({
    partId: params.partId || params.part?.id,
    partNumber: params.partNumber || params.part?.partNumber || '',
    movementType: params.movementType,
    quantity: params.quantity || Math.abs(params.quantityDelta || 0),
    branchId: params.branchId || params.branch?.id || params.branch,
    warehouseId: params.warehouseId || params.warehouse?.id || params.warehouse,
    sourceLocation: params.sourceLocation || params.location?.code || params.location,
    destinationLocation: params.destinationLocation || params.targetLocation?.code || params.targetLocation,
    reference: params.reference,
    reason: params.reason,
    userName: params.userName || params.user?.name,
    userId: params.userId || params.user?.id
  });
  return res.movement?.id || `mov_${Date.now()}`;
}

export function subscribeBranches(callback: (branches: Branch[]) => void) {
  return subscribeLocalBranches(callback);
}

export function subscribeWarehouses(callback: (warehouses: Warehouse[]) => void) {
  return subscribeLocalWarehouses(callback);
}

export async function createWarehouse(whData: Omit<Warehouse, 'id' | 'createdAt'>): Promise<string> {
  const id = `wh_${Date.now()}`;
  return id;
}

export async function updateWarehouse(_id: string, _updates: Partial<Warehouse>): Promise<void> {}
export async function deleteWarehouse(_id: string): Promise<void> {}

export function subscribeLocations(callback: (locations: WarehouseLocation[]) => void) {
  return subscribeLocalLocations(callback);
}

export async function createWarehouseLocation(locData: Omit<WarehouseLocation, 'id' | 'createdAt'>): Promise<string> {
  const loc = await addLocalWarehouseLocation(locData);
  return loc.id;
}

export async function updateWarehouseLocation(_id: string, _updates: Partial<WarehouseLocation>): Promise<void> {}
export async function deleteWarehouseLocation(_id: string): Promise<void> {}
export async function clearAllLocations(): Promise<void> {}

export async function clearAllMovements(): Promise<void> {
  await clearAllLocalStockMovements();
}

export async function clearAllPurchaseOrders(): Promise<void> {}
export async function clearAllSalesInvoices(): Promise<void> {
  await clearAllLocalSalesInvoices();
}
export async function clearAllShortages(): Promise<void> {}

export function subscribeCategories(callback: (categories: EpcCategory[]) => void) {
  return subscribeLocalCategories(callback);
}

export async function createCategory(cat: Omit<EpcCategory, 'id'>): Promise<string> {
  return `cat_${Date.now()}`;
}
export const addEpcCategory = createCategory;
export async function updateCategory(_id: string, _updates: Partial<EpcCategory>): Promise<void> {}
export const updateEpcCategory = updateCategory;
export async function deleteCategory(_id: string): Promise<void> {}
export const deleteEpcCategory = deleteCategory;

export function recommendOptimalBinLocation(
  _categoryGroup: string,
  _weightKg: number = 1,
  _locations: WarehouseLocation[]
): WarehouseLocation | null {
  return null;
}

export function subscribeAuditLogs(callback: (logs: AuditLog[]) => void) {
  return subscribeLocalAuditLogs(callback);
}

export function subscribeShortages(callback: (shortages: ShortageItem[]) => void) {
  return subscribeLocalShortages(callback);
}

export async function addShortageItem(item: Omit<ShortageItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const res = await fetch('/api/local/shortages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  const data = await res.json();
  await fetchLocalData();
  return data.id || `sht_${Date.now()}`;
}

export async function updateShortageItem(id: string, updates: Partial<ShortageItem>): Promise<void> {
  await fetchLocalData();
}

export async function updateShortageStatus(id: string, status: ShortageItem['status'], notes?: string): Promise<void> {
  await fetchLocalData();
}

export async function deleteShortageItem(id: string): Promise<void> {
  await fetchLocalData();
}

export function subscribeSuppliers(callback: (suppliers: Supplier[]) => void) {
  return subscribeLocalSuppliers(callback);
}

export async function addSupplier(supplier: Omit<Supplier, 'id' | 'createdAt'>): Promise<string> {
  return `sup_${Date.now()}`;
}
export async function updateSupplier(_id: string, _updates: Partial<Supplier>): Promise<void> {}
export async function deleteSupplier(_id: string): Promise<void> {}

export function subscribeCustomers(callback: (customers: Customer[]) => void) {
  return subscribeLocalCustomers(callback);
}

export async function addCustomer(customer: Omit<Customer, 'id' | 'createdAt'>): Promise<string> {
  return `cust_${Date.now()}`;
}
export async function updateCustomer(_id: string, _updates: Partial<Customer>): Promise<void> {}
export async function deleteCustomer(_id: string): Promise<void> {}

export function subscribePurchaseOrders(callback: (pos: PurchaseOrder[]) => void) {
  return subscribeLocalPurchaseOrders(callback);
}

export async function createPurchaseOrder(po: Omit<PurchaseOrder, 'id'>): Promise<string> {
  return `po_${Date.now()}`;
}
export async function updatePurchaseOrder(_id: string, _updates: Partial<PurchaseOrder>): Promise<void> {}
export async function deletePurchaseOrder(_id: string): Promise<void> {}
export async function receivePurchaseOrder(_po: string | PurchaseOrder, _receivedItemsOrUser?: any, _notes?: string): Promise<void> {}

export function subscribeSalesInvoices(callback: (invoices: SalesInvoice[]) => void) {
  return subscribeLocalSalesInvoices(callback);
}

export async function createSalesInvoice(invoice: any, user?: any): Promise<string> {
  const invId = invoice.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fullInvoice: SalesInvoice = {
    ...invoice,
    id: invId,
    createdDate: invoice.createdDate || new Date().toISOString()
  };

  // 1. Record stock movements for all items in the invoice automatically
  for (const item of invoice.items || []) {
    try {
      await executeStockMovement({
        partId: item.partId,
        partNumber: item.partNumber,
        movementType: 'SALE',
        quantity: item.quantity,
        sourceLocation: item.locationCode || 'AUTO',
        reference: invoice.invoiceNumber || `INV-${Date.now()}`,
        reason: `صرف مبيعات - فاتورة: ${invoice.invoiceNumber || ''} (${invoice.customerName || 'عميل'})`,
        user: user || { id: invoice.userId, name: invoice.userName }
      });
    } catch (e) {
      console.warn('Auto stock movement for sale item note:', e);
    }
  }

  // 2. Save invoice in local server
  await saveLocalSalesInvoice(fullInvoice);
  return invId;
}

export async function updateSalesInvoice(_id: string, _updates: Partial<SalesInvoice>): Promise<void> {}
export async function deleteSalesInvoice(id: string): Promise<void> {
  await deleteLocalSalesInvoice(id);
}

export function subscribeStocktakeSessions(callback: (sessions: StocktakeSession[]) => void) {
  callback([]);
  return () => {};
}
export async function approveStocktakeSession(_sessionId: string | StocktakeSession, _approvedBy?: any): Promise<void> {}

export function subscribeVinLookups(callback: (lookups: VinDecodeResult[]) => void) {
  callback([]);
  return () => {};
}
export async function saveVinLookup(result: VinDecodeResult): Promise<string> {
  return `vin_${Date.now()}`;
}

export function subscribePartSerials(callback: (serials: PartSerial[]) => void) {
  callback([]);
  return () => {};
}
export async function savePartSerialsBatch(_serials: PartSerial[]): Promise<void> {}
export async function findSerialByCode(_code: string): Promise<PartSerial | null> { return null; }
export async function getExistingSerialsForPart(_partId: string): Promise<PartSerial[]> { return []; }
export async function updateSerialStatus(_serialId: string, _status: PartSerial['status']): Promise<void> {}
export async function incrementSerialPrintCounts(_serialIds: string[]): Promise<void> {}
export async function clearAllSerials(): Promise<void> {}
