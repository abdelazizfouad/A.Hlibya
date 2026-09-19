import { 
  PartMaster, 
  InventoryItem, 
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
  ERPStats
} from '../types/erp';

export interface LocalServerStatus {
  success: boolean;
  mode: string;
  isLocalServer: boolean;
  pcHostname: string;
  platform: string;
  localPort: number;
  localUrls: string[];
  primaryIp: string;
  databaseFile: string;
  databaseSizeBytes: number;
  databaseSizeFormatted: string;
  lastModified: string;
  counts: {
    parts: number;
    inventory: number;
    movements: number;
    locations: number;
    suppliers: number;
    customers: number;
    salesInvoices: number;
    purchaseOrders: number;
  };
}

// Local in-memory caches
let cachedParts: PartMaster[] = [];
let cachedInventory: InventoryItem[] = [];
let cachedMovements: StockMovement[] = [];
let cachedLocations: WarehouseLocation[] = [];
let cachedBranches: Branch[] = [];
let cachedWarehouses: Warehouse[] = [];
let cachedCategories: EpcCategory[] = [];
let cachedShortages: ShortageItem[] = [];
let cachedSuppliers: Supplier[] = [];
let cachedCustomers: Customer[] = [];
let cachedPurchaseOrders: PurchaseOrder[] = [];
let cachedSalesInvoices: SalesInvoice[] = [];
let cachedAuditLogs: AuditLog[] = [];

// Event listeners
type Callback<T> = (data: T) => void;
const partsListeners = new Set<Callback<PartMaster[]>>();
const inventoryListeners = new Set<Callback<InventoryItem[]>>();
const movementsListeners = new Set<Callback<StockMovement[]>>();
const locationsListeners = new Set<Callback<WarehouseLocation[]>>();
const branchesListeners = new Set<Callback<Branch[]>>();
const warehousesListeners = new Set<Callback<Warehouse[]>>();
const categoriesListeners = new Set<Callback<EpcCategory[]>>();
const shortagesListeners = new Set<Callback<ShortageItem[]>>();
const suppliersListeners = new Set<Callback<Supplier[]>>();
const customersListeners = new Set<Callback<Customer[]>>();
const purchaseOrdersListeners = new Set<Callback<PurchaseOrder[]>>();
const salesInvoicesListeners = new Set<Callback<SalesInvoice[]>>();
const auditLogsListeners = new Set<Callback<AuditLog[]>>();

export async function fetchLocalServerStatus(): Promise<LocalServerStatus | null> {
  try {
    const res = await fetch('/api/local/status');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[LocalServer] Status check error:', err);
    return null;
  }
}

export async function fetchLocalData() {
  try {
    const [bootstrapRes, partsRes, inventoryRes, movementsRes] = await Promise.all([
      fetch('/api/local/bootstrap'),
      fetch('/api/local/parts?page=1&limit=50'),
      fetch('/api/local/inventory?page=1&limit=50'),
      fetch('/api/local/movements?page=1&limit=50')
    ]);
    if (!bootstrapRes.ok || !partsRes.ok || !inventoryRes.ok || !movementsRes.ok) {
      throw new Error('Local server bootstrap request failed');
    }
    const bootstrap = await bootstrapRes.json();
    const partsPage = await partsRes.json();
    const inventoryPage = await inventoryRes.json();
    const movementsPage = await movementsRes.json();
    if (!bootstrap.success) return null;

    const d = {
      ...bootstrap,
      parts: partsPage.parts || [],
      inventory: inventoryPage.inventory || [],
      movements: movementsPage.movements || []
    };
    if (d.parts) {
      cachedParts = d.parts;
      partsListeners.forEach(cb => cb(cachedParts));
    }
    if (d.inventory) {
      cachedInventory = d.inventory;
      inventoryListeners.forEach(cb => cb(cachedInventory));
    }
    if (d.movements) {
      cachedMovements = d.movements;
      movementsListeners.forEach(cb => cb(cachedMovements));
    }
    if (d.locations) {
      cachedLocations = d.locations;
      locationsListeners.forEach(cb => cb(cachedLocations));
    }
    if (d.branches) {
      cachedBranches = d.branches;
      branchesListeners.forEach(cb => cb(cachedBranches));
    }
    if (d.warehouses) {
      cachedWarehouses = d.warehouses;
      warehousesListeners.forEach(cb => cb(cachedWarehouses));
    }
    if (d.categories) {
      cachedCategories = d.categories;
      categoriesListeners.forEach(cb => cb(cachedCategories));
    }
    if (d.shortages) {
      cachedShortages = d.shortages;
      shortagesListeners.forEach(cb => cb(cachedShortages));
    }
    if (d.suppliers) {
      cachedSuppliers = d.suppliers;
      suppliersListeners.forEach(cb => cb(cachedSuppliers));
    }
    if (d.customers) {
      cachedCustomers = d.customers;
      customersListeners.forEach(cb => cb(cachedCustomers));
    }
    if (d.purchaseOrders) {
      cachedPurchaseOrders = d.purchaseOrders;
      purchaseOrdersListeners.forEach(cb => cb(cachedPurchaseOrders));
    }
    if (d.salesInvoices) {
      cachedSalesInvoices = d.salesInvoices;
      salesInvoicesListeners.forEach(cb => cb(cachedSalesInvoices));
    }
    if (d.auditLogs) {
      cachedAuditLogs = d.auditLogs;
      auditLogsListeners.forEach(cb => cb(cachedAuditLogs));
    }

    return d;
  } catch (err) {
    console.warn('[LocalServer] fetchLocalData error:', err);
    return null;
  }
}

export interface LocalPartsPageResult {
  parts: PartMaster[];
  page: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
  performance?: { sqlMs: number };
}

export async function fetchLocalPartsPage(options: {
  page?: number;
  limit?: number;
  query?: string;
  categoryGroup?: string;
  quality?: string;
  status?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  signal?: AbortSignal;
} = {}): Promise<LocalPartsPageResult> {
  const params = new URLSearchParams();
  params.set('page', String(options.page || 1));
  params.set('limit', String(options.limit || 50));
  if (options.query) params.set('q', options.query);
  if (options.categoryGroup && options.categoryGroup !== 'ALL') params.set('categoryGroup', options.categoryGroup);
  if (options.quality && options.quality !== 'ALL') params.set('quality', options.quality);
  if (options.status && options.status !== 'ALL') params.set('status', options.status);
  if (options.sortBy) params.set('sortBy', options.sortBy);
  if (options.sortDirection) params.set('sortDirection', options.sortDirection);
  const res = await fetch(`/api/local/parts?${params.toString()}`, {
    signal: options.signal,
    cache: 'no-store'
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'فشل تحميل صفحة الأصناف.');
  return data;
}

export async function searchLocalParts(query: string, limit = 30): Promise<PartMaster[]> {
  const result = await fetchLocalPartsPage({ query, limit, page: 1 });
  return result.parts;
}

// Subscriptions
export function subscribeLocalParts(cb: Callback<PartMaster[]>): () => void {
  partsListeners.add(cb);
  if (cachedParts.length > 0) cb(cachedParts);
  return () => partsListeners.delete(cb);
}

export function subscribeLocalInventory(cb: Callback<InventoryItem[]>): () => void {
  inventoryListeners.add(cb);
  if (cachedInventory.length > 0) cb(cachedInventory);
  return () => inventoryListeners.delete(cb);
}

export function subscribeLocalMovements(cb: Callback<StockMovement[]>): () => void {
  movementsListeners.add(cb);
  if (cachedMovements.length > 0) cb(cachedMovements);
  return () => movementsListeners.delete(cb);
}

export function subscribeLocalLocations(cb: Callback<WarehouseLocation[]>): () => void {
  locationsListeners.add(cb);
  if (cachedLocations.length > 0) cb(cachedLocations);
  return () => locationsListeners.delete(cb);
}

export function subscribeLocalBranches(cb: Callback<Branch[]>): () => void {
  branchesListeners.add(cb);
  if (cachedBranches.length > 0) cb(cachedBranches);
  return () => branchesListeners.delete(cb);
}

export function subscribeLocalWarehouses(cb: Callback<Warehouse[]>): () => void {
  warehousesListeners.add(cb);
  if (cachedWarehouses.length > 0) cb(cachedWarehouses);
  return () => warehousesListeners.delete(cb);
}

export function subscribeLocalCategories(cb: Callback<EpcCategory[]>): () => void {
  categoriesListeners.add(cb);
  if (cachedCategories.length > 0) cb(cachedCategories);
  return () => categoriesListeners.delete(cb);
}

export function subscribeLocalShortages(cb: Callback<ShortageItem[]>): () => void {
  shortagesListeners.add(cb);
  if (cachedShortages.length > 0) cb(cachedShortages);
  return () => shortagesListeners.delete(cb);
}

export function subscribeLocalSuppliers(cb: Callback<Supplier[]>): () => void {
  suppliersListeners.add(cb);
  if (cachedSuppliers.length > 0) cb(cachedSuppliers);
  return () => suppliersListeners.delete(cb);
}

export function subscribeLocalCustomers(cb: Callback<Customer[]>): () => void {
  customersListeners.add(cb);
  if (cachedCustomers.length > 0) cb(cachedCustomers);
  return () => customersListeners.delete(cb);
}

export function subscribeLocalPurchaseOrders(cb: Callback<PurchaseOrder[]>): () => void {
  purchaseOrdersListeners.add(cb);
  if (cachedPurchaseOrders.length > 0) cb(cachedPurchaseOrders);
  return () => purchaseOrdersListeners.delete(cb);
}

export function subscribeLocalSalesInvoices(cb: Callback<SalesInvoice[]>): () => void {
  salesInvoicesListeners.add(cb);
  if (cachedSalesInvoices.length > 0) cb(cachedSalesInvoices);
  return () => salesInvoicesListeners.delete(cb);
}

export function subscribeLocalAuditLogs(cb: Callback<AuditLog[]>): () => void {
  auditLogsListeners.add(cb);
  if (cachedAuditLogs.length > 0) cb(cachedAuditLogs);
  return () => auditLogsListeners.delete(cb);
}

// Write Operations
export async function savePartToLocal(part: Partial<PartMaster>): Promise<PartMaster> {
  const res = await fetch('/api/local/parts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(part)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'فشل حفظ الصنف في الخادم المحلي.');
  }
  // Refresh data
  await fetchLocalData();
  return data.part;
}

export async function deletePartFromLocal(partId: string): Promise<boolean> {
  const res = await fetch(`/api/local/parts/${encodeURIComponent(partId)}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل حذف الصنف.');
  await fetchLocalData();
  return true;
}

export async function bulkImportPartsToLocal(
  items: any[],
  branchId?: string,
  warehouseId?: string,
  locationCode?: string
): Promise<{ successCount: number; errors: string[] }> {
  const res = await fetch('/api/local/parts/bulk-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, branchId, warehouseId, locationCode })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'فشل استيراد الأصناف إلى الخادم المحلي.');
  }
  await fetchLocalData();
  return { successCount: data.successCount, errors: data.errors || [] };
}

export async function executeLocalStockMovement(movementData: {
  partId: string;
  partNumber: string;
  movementType: string;
  quantity: number;
  branchId?: string;
  warehouseId?: string;
  sourceLocation?: string;
  destinationLocation?: string;
  reference?: string;
  reason?: string;
  userName?: string;
  userId?: string;
}): Promise<{ success: boolean; movement: StockMovement; message: string }> {
  const res = await fetch('/api/local/inventory/movement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(movementData)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'فشل تنفيذ الحركة المخزنية.');
  }
  await fetchLocalData();
  return data;
}

export async function deleteLocalStockMovement(id: string): Promise<boolean> {
  const res = await fetch(`/api/local/movements/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل حذف الحركة.');
  await fetchLocalData();
  return true;
}

export async function clearAllLocalStockMovements(): Promise<boolean> {
  const res = await fetch('/api/local/movements/clear', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل مسح الحركات.');
  await fetchLocalData();
  return true;
}

export async function saveLocalSalesInvoice(invoice: SalesInvoice): Promise<boolean> {
  const current = [invoice, ...cachedSalesInvoices.filter(i => i.id !== invoice.id)];
  const res = await fetch('/api/local/orders/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(current)
  });
  if (res.ok) {
    cachedSalesInvoices = current;
    salesInvoicesListeners.forEach(cb => cb(cachedSalesInvoices));
  }
  return res.ok;
}

export async function deleteLocalSalesInvoice(id: string): Promise<boolean> {
  const current = cachedSalesInvoices.filter(i => i.id !== id);
  const res = await fetch('/api/local/orders/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(current)
  });
  if (res.ok) {
    cachedSalesInvoices = current;
    salesInvoicesListeners.forEach(cb => cb(cachedSalesInvoices));
  }
  return res.ok;
}

export async function clearAllLocalSalesInvoices(): Promise<boolean> {
  const res = await fetch('/api/local/orders/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([])
  });
  if (res.ok) {
    cachedSalesInvoices = [];
    salesInvoicesListeners.forEach(cb => cb(cachedSalesInvoices));
  }
  return res.ok;
}

export async function addLocalWarehouseLocation(location: Partial<WarehouseLocation>): Promise<WarehouseLocation> {
  const res = await fetch('/api/local/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(location)
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'فشل إضافة الموقع التخزيني.');
  await fetchLocalData();
  return data.location;
}

export async function zeroOutLocalSellingPrices(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/local/prices/zero-selling', { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'فشل تصفير سعر البيع.');
  await fetchLocalData();
  return data;
}

export async function zeroOutLocalAllPrices(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/local/prices/zero-all', { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'فشل تصفير الأسعار.');
  await fetchLocalData();
  return data;
}

export async function downloadLocalDatabaseBackup(): Promise<void> {
  const res = await fetch('/api/local/backup/download');
  if (!res.ok) throw new Error('فشل تنزيل النسخة الاحتياطية.');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ah-libya-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function restoreLocalDatabaseBackup(file: File): Promise<boolean> {
  const text = await file.text();
  const json = JSON.parse(text);
  const res = await fetch('/api/local/backup/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(json)
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'فشل استعادة النسخة الاحتياطية.');
  await fetchLocalData();
  return true;
}

// ----------------------------------------------------
// Remote Tunnel & Access Note Services
// ----------------------------------------------------

export interface RemoteTunnelStatus {
  success: boolean;
  isActive: boolean;
  url: string | null;
  startedAt: string | null;
  error: string | null;
  noteFileArPath: string;
  noteFileEnPath: string;
  noteContent: string | null;
  notePath: string;
  customUrl?: string | null;
}

export async function fetchRemoteTunnelStatus(): Promise<RemoteTunnelStatus | null> {
  try {
    const res = await fetch('/api/local/tunnel/status');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[LocalServer] Error fetching tunnel status:', err);
    return null;
  }
}

export async function startRemoteTunnel(subdomain?: string): Promise<RemoteTunnelStatus> {
  const res = await fetch('/api/local/tunnel/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'فشل تشغيل نفق الوصول الخارجي');
  }
  return data;
}

export async function stopRemoteTunnel(): Promise<boolean> {
  const res = await fetch('/api/local/tunnel/stop', { method: 'POST' });
  const data = await res.json();
  return Boolean(data.success);
}

export async function saveCustomRemoteTunnelUrl(customUrl: string): Promise<RemoteTunnelStatus> {
  const res = await fetch('/api/local/tunnel/custom-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customUrl })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'فشل حفظ الرابط المخصص');
  }
  return data;
}

export async function downloadRemoteNoteFile(): Promise<void> {
  const res = await fetch('/api/local/tunnel/download-note');
  if (!res.ok) throw new Error('فشل تنزيل ملف النوت. يرجى تفعيل الرابط أولاً.');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `رابط_الوصول_من_اي_مكان.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Auto sync loop (lightweight polling every 4 seconds)
let syncInterval: any = null;
export function startLocalAutoSync(intervalMs = 4000) {
  if (syncInterval) return;
  fetchLocalData();
  syncInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      fetchLocalData();
    }
  }, intervalMs);
}
