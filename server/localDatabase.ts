import fs from "fs";
import path from "path";
import os from "os";
import { DatabaseSync } from "node:sqlite";

export interface LocalDatabaseSchema {
  version: string;
  mode: string;
  createdAt: string;
  lastModified: string;
  parts: any[];
  inventory: any[];
  movements: any[];
  branches: any[];
  warehouses: any[];
  locations: any[];
  categories: any[];
  shortages: any[];
  suppliers: any[];
  customers: any[];
  purchaseOrders: any[];
  salesInvoices: any[];
  auditLogs: any[];
  users: any[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "local_erp_database.sqlite");
const LEGACY_DB_FILE = path.join(DATA_DIR, "local_erp_database.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

class LocalDatabaseManager {
  private data: LocalDatabaseSchema;
  private isLoaded: boolean = false;
  private sqlDb: DatabaseSync;
  private exactPartSearchCache = new Map<string, { expiresAt: number; parts: any[] }>();

  constructor() {
    this.data = this.getDefaultSchema();
    this.ensureDirectories();
    this.sqlDb = new DatabaseSync(DB_FILE);
    this.sqlDb.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `);
    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS erp_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    // Create these before loading so an existing database can safely be read
    // during the one-time migration from the legacy JSON state.
    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS inventory_index (id TEXT PRIMARY KEY, part_id TEXT NOT NULL, location_code TEXT NOT NULL, quantity REAL NOT NULL, available_quantity REAL NOT NULL, updated_at TEXT, item_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_inventory_part_location ON inventory_index(part_id, location_code);
      CREATE INDEX IF NOT EXISTS idx_inventory_updated ON inventory_index(updated_at DESC);
      CREATE TABLE IF NOT EXISTS movements_index (id TEXT PRIMARY KEY, part_id TEXT NOT NULL, part_number TEXT, movement_type TEXT, timestamp TEXT NOT NULL, source_location TEXT, destination_location TEXT, movement_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_movements_timestamp ON movements_index(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_movements_part_timestamp ON movements_index(part_id, timestamp DESC);
    `);
    this.loadDatabase();
    this.ensurePartsIndex();
    this.ensureOperationalIndexes();
  }

  private ensurePartsIndex() {
    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS parts_index (
        id TEXT PRIMARY KEY,
        part_number TEXT NOT NULL,
        part_number_key TEXT NOT NULL DEFAULT '',
        barcode TEXT,
        barcode_key TEXT,
        name_ar TEXT,
        name_en TEXT,
        category_group TEXT,
        quality TEXT,
        total_stock REAL NOT NULL DEFAULT 0,
        selling_price REAL NOT NULL DEFAULT 0,
        cost_price REAL NOT NULL DEFAULT 0,
        updated_at TEXT,
        part_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_parts_index_part_number ON parts_index(part_number);
      CREATE INDEX IF NOT EXISTS idx_parts_index_barcode ON parts_index(barcode);
      CREATE INDEX IF NOT EXISTS idx_parts_index_category ON parts_index(category_group);
      CREATE INDEX IF NOT EXISTS idx_parts_index_quality ON parts_index(quality);
      CREATE INDEX IF NOT EXISTS idx_parts_index_stock ON parts_index(total_stock);
      CREATE INDEX IF NOT EXISTS idx_parts_index_name_ar ON parts_index(name_ar);
      CREATE INDEX IF NOT EXISTS idx_parts_index_name_en ON parts_index(name_en);
    `);
    const columns = this.sqlDb.prepare("PRAGMA table_info(parts_index)").all() as Array<{ name: string }>;
    let rebuildSearchKeys = false;
    if (!columns.some(column => column.name === "min_stock")) {
      this.sqlDb.exec("ALTER TABLE parts_index ADD COLUMN min_stock REAL NOT NULL DEFAULT 1");
    }
    if (!columns.some(column => column.name === "part_number_key")) {
      this.sqlDb.exec("ALTER TABLE parts_index ADD COLUMN part_number_key TEXT NOT NULL DEFAULT ''");
      rebuildSearchKeys = true;
    }
    if (!columns.some(column => column.name === "barcode_key")) {
      this.sqlDb.exec("ALTER TABLE parts_index ADD COLUMN barcode_key TEXT");
      rebuildSearchKeys = true;
    }
    this.sqlDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_parts_index_part_number_key ON parts_index(part_number_key);
      CREATE INDEX IF NOT EXISTS idx_parts_index_barcode_key ON parts_index(barcode_key);
    `);

    const indexed = (this.sqlDb.prepare("SELECT COUNT(*) AS count FROM parts_index").get() as { count: number }).count;
    if (rebuildSearchKeys || indexed !== this.data.parts.length) {
      const insert = this.sqlDb.prepare(`
        INSERT INTO parts_index
          (id, part_number, part_number_key, barcode, barcode_key, name_ar, name_en, category_group, quality, total_stock, selling_price, cost_price, updated_at, part_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          part_number = excluded.part_number, part_number_key = excluded.part_number_key,
          barcode = excluded.barcode, barcode_key = excluded.barcode_key,
          name_ar = excluded.name_ar,
          name_en = excluded.name_en,
          category_group = excluded.category_group,
          quality = excluded.quality,
          total_stock = excluded.total_stock,
          selling_price = excluded.selling_price,
          cost_price = excluded.cost_price,
          updated_at = excluded.updated_at,
          part_json = excluded.part_json
      `);
      this.sqlDb.exec("BEGIN");
      try {
        for (const part of this.data.parts) this.writePartIndex(insert, part);
        this.sqlDb.exec("COMMIT");
      } catch (error) {
        this.sqlDb.exec("ROLLBACK");
        throw error;
      }
    }
  }

  // Inventory and movement history grow much faster than master data. Keeping
  // them as individual SQLite rows prevents every issue/receipt from rewriting
  // a multi-gigabyte JSON document.
  private ensureOperationalIndexes() {
    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS inventory_index (
        id TEXT PRIMARY KEY, part_id TEXT NOT NULL, location_code TEXT NOT NULL,
        quantity REAL NOT NULL, available_quantity REAL NOT NULL, updated_at TEXT, item_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_part_location ON inventory_index(part_id, location_code);
      CREATE INDEX IF NOT EXISTS idx_inventory_updated ON inventory_index(updated_at DESC);
      CREATE TABLE IF NOT EXISTS movements_index (
        id TEXT PRIMARY KEY, part_id TEXT NOT NULL, part_number TEXT, movement_type TEXT,
        timestamp TEXT NOT NULL, source_location TEXT, destination_location TEXT, movement_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_movements_timestamp ON movements_index(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_movements_part_timestamp ON movements_index(part_id, timestamp DESC);
    `);
    const invCount = Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM inventory_index").get() as any).count);
    const movCount = Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM movements_index").get() as any).count);
    // Existing indexed tables are authoritative. Only rebuild tables when
    // they are absent/empty and legacy records are actually available.
    if (invCount === 0 && movCount === 0 && (this.data.inventory.length > 0 || this.data.movements.length > 0)) {
      this.rebuildOperationalIndexes();
    }
  }

  private rebuildOperationalIndexes() {
    const writeInventory = this.sqlDb.prepare(`INSERT INTO inventory_index (id, part_id, location_code, quantity, available_quantity, updated_at, item_json) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const writeMovement = this.sqlDb.prepare(`INSERT INTO movements_index (id, part_id, part_number, movement_type, timestamp, source_location, destination_location, movement_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    this.sqlDb.exec("BEGIN");
    try {
      this.sqlDb.exec("DELETE FROM inventory_index; DELETE FROM movements_index;");
      for (const item of this.data.inventory) this.writeInventoryIndex(writeInventory, item);
      for (const movement of this.data.movements) this.writeMovementIndex(writeMovement, movement);
      this.sqlDb.exec("COMMIT");
    } catch (error) {
      this.sqlDb.exec("ROLLBACK");
      throw error;
    }
  }

  private writeInventoryIndex(statement: any, item: any) {
    statement.run(String(item.id), String(item.partId), String(item.locationCode || ""), Number(item.quantity || 0), Number(item.availableQuantity ?? item.quantity ?? 0), item.updatedAt || null, JSON.stringify(item));
  }

  private writeMovementIndex(statement: any, movement: any) {
    statement.run(String(movement.id), String(movement.partId), movement.partNumber || null, movement.movementType || null, movement.timestamp || new Date().toISOString(), movement.sourceLocation || null, movement.destinationLocation || null, JSON.stringify(movement));
  }

  private writePartIndex(statement: any, part: any) {
    const partNumber = String(part.partNumber || "").trim().toUpperCase();
    const barcode = part.barcode ? String(part.barcode).trim() : null;
    statement.run(
      String(part.id),
      partNumber,
      this.toSearchKey(partNumber),
      barcode,
      barcode ? this.toSearchKey(barcode) : null,
      part.nameAr || "",
      part.nameEn || "",
      part.categoryGroup || "",
      part.quality || "",
      Number(part.totalStock || 0),
      Number(part.sellingPrice || 0),
      Number(part.costPrice || 0),
      part.updatedAt || null,
      JSON.stringify(part)
    );
  }

  private toSearchKey(value: string): string {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  private getDefaultSchema(): LocalDatabaseSchema {
    return {
      version: "1.0.0",
      mode: "LOCAL_PC_SERVER",
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      parts: [],
      inventory: [],
      movements: [],
      branches: [
        {
          id: "branch_elharefeyin",
          name: "فرع الحرفيين (المركز الرئيسي)",
          code: "AH-ELH",
          city: "القاهرة / مجمع الحرفيين",
          country: "مصر",
          address: "المنطقة الصناعية — بلوك 14 — الحرفيين، القاهرة",
          phone: "+20 100 234 5678",
          isMain: true,
          active: true,
          createdAt: "2026-01-01T08:00:00Z"
        }
      ],
      warehouses: [
        {
          id: "wh_elharefeyin_main",
          branchId: "branch_elharefeyin",
          branchName: "فرع الحرفيين",
          name: "المستودع الرئيسي — الحرفيين",
          code: "WH-ELH-01",
          description: "المستودع المركزي لقطع غيار محركات وعفشة وهيكل سيارات مرسيدس-بنز",
          totalCapacityBins: 120,
          active: true,
          createdAt: "2026-01-01T08:00:00Z"
        }
      ],
      locations: [
        {
          id: "loc_a_01_01_01",
          warehouseId: "wh_elharefeyin_main",
          warehouseName: "المستودع الرئيسي — الحرفيين",
          branchId: "branch_elharefeyin",
          zone: "A",
          aisle: "01",
          shelf: "01",
          bin: "01",
          code: "A-01-01-01",
          capacity: 50,
          currentUnits: 0,
          status: "ACTIVE",
          notes: "فلاتر زيت وتكييف وبوجيهات المحركات",
          createdAt: "2026-01-01T08:00:00Z"
        },
        {
          id: "loc_b_02_03_05",
          warehouseId: "wh_elharefeyin_main",
          warehouseName: "المستودع الرئيسي — الحرفيين",
          branchId: "branch_elharefeyin",
          zone: "B",
          aisle: "02",
          shelf: "03",
          bin: "05",
          code: "B-02-03-05",
          capacity: 30,
          currentUnits: 0,
          status: "ACTIVE",
          notes: "طنابير وتيل فرامل أمامية وخلفية",
          createdAt: "2026-01-01T08:00:00Z"
        },
        {
          id: "loc_a_03_02_07",
          warehouseId: "wh_elharefeyin_main",
          warehouseName: "المستودع الرئيسي — الحرفيين",
          branchId: "branch_elharefeyin",
          zone: "A",
          aisle: "03",
          shelf: "02",
          bin: "07",
          code: "A-03-02-07",
          capacity: 20,
          currentUnits: 0,
          status: "ACTIVE",
          notes: "مساعدين وعفشة مرسيدس",
          createdAt: "2026-01-01T08:00:00Z"
        }
      ],
      categories: [],
      shortages: [],
      suppliers: [],
      customers: [],
      purchaseOrders: [],
      salesInvoices: [],
      auditLogs: [],
      users: [
        {
          id: "user_abdulaziz_admin",
          email: "admin@ahlibya.store",
          displayName: "عبد العزيز",
          role: "SUPER_ADMIN",
          branchId: "branch_elharefeyin",
          branchName: "فرع الحرفيين",
          active: true,
          createdAt: "2026-01-01T08:00:00Z"
        }
      ]
    };
  }

  private ensureDirectories() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }
    } catch (err) {
      console.error("[LocalDB] Error ensuring directories:", err);
    }
  }

  private loadDatabase() {
    try {
      const row = this.sqlDb.prepare("SELECT data_json FROM erp_state WHERE id = 1").get() as { data_json?: string } | undefined;
      if (row?.data_json) {
        const parsed = JSON.parse(row.data_json);
        this.data = {
          ...this.getDefaultSchema(),
          ...parsed
        };
        // High-volume operational records stay in indexed SQLite tables. Do
        // not hydrate every row into JavaScript during startup; pages are
        // read on demand by getInventoryPage/getMovementsPage.
        this.data.inventory = [];
        this.data.movements = [];
        this.isLoaded = true;
        const inventoryCount = Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM inventory_index").get() as { count: number }).count || 0);
        const movementCount = Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM movements_index").get() as { count: number }).count || 0);
        console.log(`[LocalDB] SQL database loaded from PC disk: ${this.data.parts.length} parts, ${inventoryCount} inventory rows, ${movementCount} movements.`);
      } else if (fs.existsSync(LEGACY_DB_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(LEGACY_DB_FILE, "utf8"));
        this.data = { ...this.getDefaultSchema(), ...parsed };
        this.saveDatabase();
        this.isLoaded = true;
        console.log(`[LocalDB] Migrated legacy JSON to SQL: ${this.data.parts.length} parts, ${this.data.inventory.length} inventory rows.`);
      } else {
        console.log("[LocalDB] No SQL database found on disk. Creating fresh local database...");
        this.saveDatabase();
        this.isLoaded = true;
      }
    } catch (err) {
      console.error("[LocalDB] Error reading database file:", err);
      this.data = this.getDefaultSchema();
      this.isLoaded = true;
    }
  }

  private saveDatabase(createBackup: boolean = false) {
    try {
      this.ensureDirectories();
      this.data.lastModified = new Date().toISOString();
      this.sqlDb.prepare(
        "INSERT INTO erp_state (id, data_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at"
      ).run(JSON.stringify({ ...this.data, inventory: [], movements: [] }), this.data.lastModified);

      if (createBackup) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(this.data, null, 2), "utf8");

        // Keep at most 10 recent backups
        const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("backup-") && f.endsWith(".json"));
        if (files.length > 10) {
          files.sort();
          for (let i = 0; i < files.length - 10; i++) {
            fs.unlinkSync(path.join(BACKUP_DIR, files[i]));
          }
        }
      }
    } catch (err) {
      console.error("[LocalDB] Error saving database file:", err);
    }
  }

  // Get full state
  public getAllData() {
    // Full snapshots are intentionally opt-in (backup/restore only). Normal
    // application reads use paged endpoints and never call this method.
    const inventory = (this.sqlDb.prepare("SELECT item_json FROM inventory_index ORDER BY updated_at DESC").all() as Array<{ item_json: string }>)
      .map(row => JSON.parse(row.item_json));
    const movements = (this.sqlDb.prepare("SELECT movement_json FROM movements_index ORDER BY timestamp DESC").all() as Array<{ movement_json: string }>)
      .map(row => JSON.parse(row.movement_json));
    return { ...this.data, inventory, movements };
  }

  // Parts
  public getParts(): any[] {
    return this.data.parts || [];
  }

  public getPartsPage(options: {
    page: number;
    limit: number;
    query?: string;
    categoryGroup?: string;
    quality?: string;
    status?: string;
    sortBy?: string;
    sortDirection?: string;
  }) {
    const page = Math.max(1, Math.floor(options.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(options.limit || 50)));
    const conditions: string[] = [];
    const parameters: any[] = [];
    const query = String(options.query || "").trim().toUpperCase();

    if (query) {
      // Part numbers and barcodes are by far the most common lookup.  An exact
      // match keeps this request on the B-tree index instead of scanning names.
      const queryKey = this.toSearchKey(query);
      if (/\d/.test(query) && /^[A-Z0-9 ._/-]+$/.test(query)) {
        // Users often scan/type A 223-330-23-03 while the source may store
        // A2233302303. Search normalized indexed keys, preserving the source
        // value in the response (including leading zeros and separators).
        const withoutMercedesPrefix = queryKey.replace(/^[AN](?=\d)/, "");
        // A scanner normally sends the complete part number. Keeping the
        // common path exact makes it a small indexed lookup rather than an OR
        // of multiple prefix scans and a large sort.
        if (withoutMercedesPrefix !== queryKey) {
          if (queryKey.length >= 6) {
            const exact = this.getExactPartSearch([queryKey, withoutMercedesPrefix]);
            if (exact) return this.buildPartsPageResult(exact, page, limit);
          }
          // If the user has entered only part of a number, search the
          // normalized indexed value instead of requiring an exact match.
          conditions.push("(part_number_key LIKE ? OR barcode_key LIKE ?)");
          parameters.push(`%${withoutMercedesPrefix}%`, `%${withoutMercedesPrefix}%`);
        } else {
          if (queryKey.length >= 6) {
            const exact = this.getExactPartSearch([queryKey]);
            if (exact) return this.buildPartsPageResult(exact, page, limit);
          }
          // Numeric fragments such as "213" should match every stored part
          // number containing that fragment.
          conditions.push("(part_number_key LIKE ? OR barcode_key LIKE ?)");
          parameters.push(`%${queryKey}%`, `%${queryKey}%`);
        }

      } else {
        conditions.push("(part_number LIKE ? OR barcode LIKE ? OR UPPER(name_ar) LIKE ? OR UPPER(name_en) LIKE ?)");
        const pattern = `%${query}%`;
        parameters.push(pattern, pattern, pattern, pattern);
      }
    }
    if (options.categoryGroup && options.categoryGroup !== "ALL") {
      conditions.push("category_group = ?");
      parameters.push(options.categoryGroup);
    }
    if (options.quality && options.quality !== "ALL") {
      conditions.push("quality = ?");
      parameters.push(options.quality);
    }
    if (options.status === "IN_STOCK") conditions.push("total_stock > 0");
    if (options.status === "OUT_OF_STOCK") conditions.push("total_stock <= 0");
    if (options.status === "LOW_STOCK") conditions.push("total_stock > 0 AND total_stock <= json_extract(part_json, '$.minStock')");

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const sortColumns: Record<string, string> = {
      partNumber: "part_number",
      nameAr: "name_ar",
      nameEn: "name_en",
      totalStock: "total_stock",
      sellingPrice: "selling_price",
      updatedAt: "updated_at"
    };
    const sortColumn = sortColumns[options.sortBy || "partNumber"] || "part_number";
    const direction = options.sortDirection === "desc" ? "DESC" : "ASC";
    const countRow = this.sqlDb.prepare(`SELECT COUNT(*) AS count FROM parts_index ${where}`).get(...parameters) as { count: number };
    const rows = this.sqlDb.prepare(
      `SELECT part_json FROM parts_index ${where} ORDER BY ${sortColumn} ${direction}, id ASC LIMIT ? OFFSET ?`
    ).all(...parameters, limit, (page - 1) * limit) as Array<{ part_json: string }>;

    return {
      parts: rows.map(row => JSON.parse(row.part_json)),
      page,
      limit,
      totalCount: Number(countRow.count || 0),
      hasMore: page * limit < Number(countRow.count || 0)
    };
  }

  private getExactPartSearch(keys: string[]): any[] | null {
    const cacheKey = keys.join("|");
    const cached = this.exactPartSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.parts;

    const placeholders = keys.map(() => "?").join(", ");
    const rows = this.sqlDb.prepare(
      `SELECT part_json FROM parts_index
       WHERE part_number_key IN (${placeholders}) OR barcode_key IN (${placeholders})
       LIMIT 100`
    ).all(...keys, ...keys) as Array<{ item_json?: string; part_json: string }>;
    if (rows.length === 0) return null;
    const parts = rows.map(row => JSON.parse(row.part_json));
    this.exactPartSearchCache.set(cacheKey, { expiresAt: Date.now() + 5_000, parts });
    return parts;
  }

  private buildPartsPageResult(parts: any[], page: number, limit: number) {
    const start = (page - 1) * limit;
    const pageParts = parts.slice(start, start + limit);
    return {
      parts: pageParts,
      page,
      limit,
      totalCount: parts.length,
      hasMore: start + limit < parts.length
    };
  }

  public getPartByIdOrNumber(value: string): any | null {
    const raw = String(value || "").trim();
    const clean = raw.toUpperCase();
    const row = this.sqlDb.prepare(
      "SELECT part_json FROM parts_index WHERE id = ? OR part_number = ? OR UPPER(barcode) = ? OR EXISTS (SELECT 1 FROM json_each(part_json, '$.serials') WHERE value = ? OR UPPER(value) = ?) LIMIT 1"
    ).get(raw, clean, clean, raw, clean) as { part_json?: string } | undefined;
    return row?.part_json ? JSON.parse(row.part_json) : null;
  }

  public getInventoryForPart(partId: string): any[] {
    return this.getInventoryRowsForPart(partId);
  }

  public upsertPart(part: any): any {
    const parts = this.data.parts || [];
    const index = parts.findIndex(p => p.id === part.id || p.partNumber?.toUpperCase() === part.partNumber?.toUpperCase());
    const now = new Date().toISOString();
    const updated = {
      ...part,
      updatedAt: now
    };

    if (index >= 0) {
      parts[index] = { ...parts[index], ...updated };
    } else {
      parts.push(updated);
    }
    this.data.parts = parts;
    this.ensurePartIndexed(updated);
    this.saveDatabase();
    return updated;
  }

  private ensurePartIndexed(part: any) {
    this.exactPartSearchCache.clear();
    const statement = this.sqlDb.prepare(`
      INSERT INTO parts_index
        (id, part_number, part_number_key, barcode, barcode_key, name_ar, name_en, category_group, quality, total_stock, selling_price, cost_price, updated_at, part_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        part_number = excluded.part_number, part_number_key = excluded.part_number_key,
        barcode = excluded.barcode, barcode_key = excluded.barcode_key, name_ar = excluded.name_ar,
        name_en = excluded.name_en, category_group = excluded.category_group, quality = excluded.quality,
        total_stock = excluded.total_stock, selling_price = excluded.selling_price, cost_price = excluded.cost_price,
        updated_at = excluded.updated_at, part_json = excluded.part_json
    `);
    this.writePartIndex(statement, part);
  }

  public recordPrintedSerial(partId: string, serialNumber: string): boolean {
    const part = this.data.parts.find(item => item.id === partId);
    if (!part) return false;
    const serials = Array.isArray(part.serials) ? part.serials : [];
    if (serialNumber && !serials.includes(serialNumber)) serials.push(serialNumber);
    part.serials = serials;
    part.lastPrintedAt = new Date().toISOString();
    this.ensurePartIndexed(part);
    this.saveDatabase();
    return true;
  }

  public deletePart(id: string): boolean {
    const initialLen = this.data.parts.length;
    this.data.parts = this.data.parts.filter(p => p.id !== id);
    if (this.data.parts.length !== initialLen) {
      this.exactPartSearchCache.clear();
      this.sqlDb.prepare("DELETE FROM parts_index WHERE id = ?").run(id);
      this.sqlDb.prepare("DELETE FROM inventory_index WHERE part_id = ?").run(id);
      this.saveDatabase();
      return true;
    }
    return false;
  }

  public bulkImportParts(importedItems: any[], defaultBranchId?: string, defaultWarehouseId?: string, defaultLocCode?: string): { successCount: number; errors: string[] } {
    let successCount = 0;
    const errors: string[] = [];
    const branchId = defaultBranchId || "branch_elharefeyin";
    const warehouseId = defaultWarehouseId || "wh_elharefeyin_main";
    const locCode = defaultLocCode || "A-01-01-01";
    const now = new Date().toISOString();

    for (const item of importedItems) {
      try {
        if (!item.partNumber) continue;
        const cleanNum = String(item.partNumber).trim().toUpperCase();
        const partId = item.id || `part_${cleanNum.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_${Date.now().toString(36)}`;
        
        const qty = Number(item.totalStock ?? item.quantity ?? 0);
        const cost = Number(item.costPrice ?? 0);
        const sell = Number(item.sellingPrice ?? 0);

        const partRecord = {
          id: partId,
          partNumber: cleanNum,
          originalPartNumber: item.originalPartNumber?.trim().toUpperCase() || cleanNum,
          supersededNumbers: Array.isArray(item.supersededNumbers) ? item.supersededNumbers : [],
          alternativeNumbers: Array.isArray(item.alternativeNumbers) ? item.alternativeNumbers : [],
          nameAr: item.nameAr || "قطع غيار مرسيدس-بنز",
          nameEn: item.nameEn || "Mercedes-Benz Genuine Spare Part",
          description: item.description || `${item.nameAr || ''} - ${item.nameEn || ''}`.trim(),
          categoryGroup: item.categoryGroup || "42",
          subgroup: item.subgroup || "420",
          epcIllustration: item.epcIllustration || "",
          epcPosition: item.epcPosition || "",
          compatibility: Array.isArray(item.compatibility) ? item.compatibility : ["W204", "W205", "W212", "W213", "W222", "W223"],
          side: item.side || "N/A",
          position: item.position || "N/A",
          condition: item.condition || "NEW",
          quality: item.quality || "GENUINE_OEM",
          brand: item.brand || "Mercedes-Benz Genuine Parts",
          unit: item.unit || "PCS",
          weightKg: Number(item.weightKg) || 1,
          costPrice: cost,
          sellingPrice: sell,
          wholesalePrice: Number(item.wholesalePrice) || (sell > 0 ? Math.round(sell * 0.85) : 0),
          minStock: Number(item.minStock) || 1,
          maxStock: Number(item.maxStock) || 50,
          reorderLevel: Number(item.reorderLevel) || 2,
          barcode: item.barcode ? String(item.barcode) : cleanNum.replace(/[^a-zA-Z0-9]/g, ""),
          qrCode: item.qrCode || `MB-${cleanNum.replace(/[^a-zA-Z0-9]/g, "")}`,
          imageUrl: item.imageUrl || null,
          notes: item.notes || "",
          totalStock: qty,
          availableStock: qty,
          updatedAt: now
        };

        const existingPartIdx = this.data.parts.findIndex(p => p.id === partId || p.partNumber?.toUpperCase() === cleanNum);
        if (existingPartIdx >= 0) {
          this.data.parts[existingPartIdx] = { ...this.data.parts[existingPartIdx], ...partRecord };
        } else {
          this.data.parts.push(partRecord);
        }

        if (qty > 0) {
          const invId = `inv_${partId}`;
          const invRecord = {
            id: invId,
            partId: partId,
            partNumber: cleanNum,
            branchId: branchId,
            warehouseId: warehouseId,
            locationId: "loc_a_01_01_01",
            locationCode: item.locationCode || locCode,
            quantity: qty,
            reservedQuantity: 0,
            availableQuantity: qty,
            costPrice: cost,
            sellingPrice: sell,
            lastMovementDate: now,
            updatedAt: now
          };

          const existingInvIdx = this.data.inventory.findIndex(i => i.partId === partId || i.id === invId);
          if (existingInvIdx >= 0) {
            this.data.inventory[existingInvIdx] = { ...this.data.inventory[existingInvIdx], ...invRecord };
          } else {
            this.data.inventory.push(invRecord);
          }

          // Stock movement log
          this.data.movements.unshift({
            id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            partId: partId,
            partNumber: cleanNum,
            partName: partRecord.nameAr,
            movementType: "INWARD_PURCHASE",
            quantity: qty,
            previousQuantity: 0,
            newQuantity: qty,
            branchId: branchId,
            warehouseId: warehouseId,
            sourceLocation: "استيراد إكسل محلي (PC Server)",
            destinationLocation: item.locationCode || locCode,
            reference: `LOCAL_IMPORT_${new Date().toLocaleDateString("en-GB").replace(/\//g, "")}`,
            reason: "استيراد مخزون أولي عبر ملف إكسل محلياً",
            userId: "user_abdulaziz_admin",
            userName: "عبد العزيز",
            timestamp: now
          });
        }

        successCount++;
      } catch (e: any) {
        errors.push(`خطأ في السطر ${item.partNumber || 'مجهول'}: ${e.message}`);
      }
    }

    this.sqlDb.exec("BEGIN");
    try {
      this.sqlDb.exec("DELETE FROM parts_index");
      const statement = this.sqlDb.prepare(`INSERT INTO parts_index (id, part_number, part_number_key, barcode, barcode_key, name_ar, name_en, category_group, quality, total_stock, selling_price, cost_price, updated_at, part_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const part of this.data.parts) this.writePartIndex(statement, part);
      this.sqlDb.exec("COMMIT");
    } catch (error) {
      this.sqlDb.exec("ROLLBACK");
      throw error;
    }
    this.rebuildOperationalIndexes();
    this.saveDatabase(true);
    return { successCount, errors };
  }

  // Inventory & Movements
  public getInventory(): any[] {
    return this.data.inventory || [];
  }

  public getInventoryPage(page: number = 1, limit: number = 50) {
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 50)));
    const safePage = Math.max(1, Math.floor(page || 1));
    const start = (safePage - 1) * safeLimit;
    const totalCount = Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM inventory_index").get() as any).count || 0);
    const rows = this.sqlDb.prepare("SELECT item_json FROM inventory_index ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?").all(safeLimit, start) as Array<{ item_json: string }>;
    return {
      inventory: rows.map(row => JSON.parse(row.item_json)),
      page: safePage,
      limit: safeLimit,
      totalCount,
      hasMore: start + safeLimit < totalCount
    };
  }

  public getMovements(): any[] {
    return this.data.movements || [];
  }

  public getMovementsPage(page: number = 1, limit: number = 50) {
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 50)));
    const safePage = Math.max(1, Math.floor(page || 1));
    const start = (safePage - 1) * safeLimit;
    const totalCount = Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM movements_index").get() as any).count || 0);
    const rows = this.sqlDb.prepare("SELECT movement_json FROM movements_index ORDER BY timestamp DESC, id ASC LIMIT ? OFFSET ?").all(safeLimit, start) as Array<{ movement_json: string }>;
    return {
      movements: rows.map(row => JSON.parse(row.movement_json)),
      page: safePage,
      limit: safeLimit,
      totalCount,
      hasMore: start + safeLimit < totalCount
    };
  }

  public getBootstrapData() {
    const partsCount = Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM parts_index").get() as { count: number }).count || 0);
    const inventoryCount = Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM inventory_index").get() as { count: number }).count || 0);
    const movementsCount = Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM movements_index").get() as { count: number }).count || 0);
    return {
      locations: this.data.locations || [],
      branches: this.data.branches || [],
      warehouses: this.data.warehouses || [],
      categories: this.data.categories || [],
      counts: {
        parts: partsCount,
        inventory: inventoryCount,
        movements: movementsCount
      }
    };
  }

  public executeMovement(movementData: any): { success: boolean; movement: any; message: string } {
    const {
      partId,
      partNumber,
      movementType,
      quantity,
      branchId,
      warehouseId,
      sourceLocation,
      destinationLocation,
      reference,
      reason,
      userName,
      userId
    } = movementData;

    const qty = Number(quantity);
    if (!partId || isNaN(qty) || qty <= 0) {
      throw new Error("بيانات الحركة غير مكتملة أو الكمية غير صالحة.");
    }

    const now = new Date().toISOString();
    // The UI uses friendly movement names while the API historically used a
    // second vocabulary. Normalize at the boundary so a sale can never fall
    // through to the default (incoming) branch.
    const normalizedType: Record<string, string> = {
      PURCHASE: "INWARD_PURCHASE",
      CUSTOMER_RETURN: "RETURN_CUSTOMER",
      SALE: "OUTWARD_SALE",
      DAMAGED: "DISPOSAL",
      SUPPLIER_RETURN: "RETURN_SUPPLIER",
      TRANSFER: "TRANSFER_LOCATION",
      ADJUSTMENT: "ADJUSTMENT_IN"
    };
    const effectiveType = normalizedType[String(movementType || "").toUpperCase()] || String(movementType || "").toUpperCase();
    
    // Find part master first
    let partItem = this.data.parts.find(p => p.id === partId || p.partNumber?.toUpperCase() === String(partNumber || "").toUpperCase());
    if (!partItem) throw new Error("الصنف غير موجود في كتالوج قطع الغيار.");

    // Only load balances for the affected part. Loading the entire inventory
    // here would make a single movement scale with the total database size.
    this.data.inventory = this.getInventoryRowsForPart(partId);
    let sourceCode = String(sourceLocation || "").trim();
    if (sourceCode.toUpperCase() === "AUTO" || sourceCode === "تلقائي") {
      sourceCode = "";
    }
    const destinationCode = String(destinationLocation || "").trim();

    // If no inventory rows exist in inventory_index, but partItem exists with stock:
    if (this.data.inventory.length === 0) {
      const defaultShelf = sourceCode || "A-01-01-01";
      const initialStock = Math.max(0, Number(partItem.totalStock || 0));
      const autoRow = {
        id: `inv_${partId}`,
        partId: partId,
        partNumber: partItem.partNumber,
        branchId: branchId || "branch_elharefeyin",
        warehouseId: warehouseId || "wh_elharefeyin_main",
        locationId: "loc_a_01_01_01",
        locationCode: defaultShelf,
        quantity: initialStock,
        reservedQuantity: 0,
        availableQuantity: initialStock,
        costPrice: partItem.costPrice || 0,
        sellingPrice: partItem.sellingPrice || 0,
        lastMovementDate: now,
        updatedAt: now
      };
      this.data.inventory.push(autoRow);
    }

    const isOutgoing = ["OUTWARD_SALE", "RETURN_SUPPLIER", "ADJUSTMENT_OUT", "DISPOSAL"].includes(effectiveType);

    // Look for exact inventory row by location code
    let inventoryItem = this.data.inventory.find(i => i.partId === partId && (!sourceCode || i.locationCode === sourceCode));

    // For outgoing transactions (sales, disposal): auto-resolve to positive stock shelf without blocking
    if (isOutgoing) {
      if (!inventoryItem || Number(inventoryItem.quantity || 0) < qty) {
        // 1. Try to find a shelf with sufficient stock
        const shelfWithEnough = this.data.inventory.find(i => i.partId === partId && Number(i.quantity || 0) >= qty);
        if (shelfWithEnough) {
          inventoryItem = shelfWithEnough;
          sourceCode = String(inventoryItem.locationCode || "");
        } else {
          // 2. Try to find any shelf with positive stock
          const shelfWithPositive = this.data.inventory.find(i => i.partId === partId && Number(i.quantity || 0) > 0);
          if (shelfWithPositive) {
            inventoryItem = shelfWithPositive;
            sourceCode = String(inventoryItem.locationCode || "");
          } else if (this.data.inventory.length > 0) {
            inventoryItem = this.data.inventory[0];
            sourceCode = String(inventoryItem.locationCode || "");
          }
        }
      }
    } else {
      // Incoming move (e.g. PURCHASE)
      if (!inventoryItem && this.data.inventory.length > 0) {
        inventoryItem = this.data.inventory[0];
      }
    }

    if (!sourceCode && inventoryItem) {
      sourceCode = String(inventoryItem.locationCode || "A-01-01-01");
    }

    const prevQty = inventoryItem ? Number(inventoryItem.quantity || 0) : 0;
    let newQty = prevQty;

    switch (effectiveType) {
      case "INWARD_PURCHASE":
      case "RETURN_CUSTOMER":
      case "ADJUSTMENT_IN":
        newQty = prevQty + qty;
        break;
      case "OUTWARD_SALE":
      case "RETURN_SUPPLIER":
      case "ADJUSTMENT_OUT":
      case "DISPOSAL": {
        const currentTotalPartStock = Number(partItem.totalStock || 0);
        if (prevQty < qty && currentTotalPartStock < qty) {
          throw new Error(`الرصيد الكلي للصنف في المخزن (${currentTotalPartStock}) غير كافٍ لصرف كمية (${qty}).`);
        }
        if (prevQty < qty && currentTotalPartStock >= qty && inventoryItem) {
          inventoryItem.quantity = currentTotalPartStock;
          newQty = currentTotalPartStock - qty;
        } else {
          newQty = Math.max(0, prevQty - qty);
        }
        break;
      }
      case "TRANSFER_BRANCH":
      case "TRANSFER_LOCATION":
        if (!destinationCode || destinationCode === sourceCode) {
          throw new Error("يجب تحديد رف وجهة مختلف لإتمام التحويل.");
        }
        if (prevQty < qty) throw new Error(`رصيد الرف المصدر (${prevQty}) غير كافٍ لتحويل (${qty}).`);
        newQty = prevQty - qty;
        break;
      default:
        throw new Error("نوع الحركة غير مدعوم.");
    }

    // Update or create inventory row
    if (inventoryItem) {
      inventoryItem.quantity = newQty;
      inventoryItem.availableQuantity = Math.max(0, newQty - Number(inventoryItem.reservedQuantity || 0));
      inventoryItem.lastMovementDate = now;
      inventoryItem.updatedAt = now;
    } else {
      inventoryItem = {
        id: `inv_${partId}`,
        partId: partId,
        partNumber: partNumber || (partItem ? partItem.partNumber : "UNKNOWN"),
        branchId: branchId || "branch_elharefeyin",
        warehouseId: warehouseId || "wh_elharefeyin_main",
        locationId: "loc_a_01_01_01",
        locationCode: sourceCode || destinationLocation || "A-01-01-01",
        quantity: newQty,
        reservedQuantity: 0,
        availableQuantity: newQty,
        costPrice: partItem ? partItem.costPrice : 0,
        sellingPrice: partItem ? partItem.sellingPrice : 0,
        lastMovementDate: now,
        updatedAt: now
      };
      this.data.inventory.push(inventoryItem);
    }

    if (effectiveType === "TRANSFER_LOCATION" || effectiveType === "TRANSFER_BRANCH") {
      let targetItem = this.data.inventory.find(i => i.partId === partId && i.locationCode === destinationCode);
      if (targetItem) {
        targetItem.quantity = Number(targetItem.quantity || 0) + qty;
        targetItem.availableQuantity = Number(targetItem.quantity || 0) - Number(targetItem.reservedQuantity || 0);
        targetItem.updatedAt = now;
        targetItem.lastMovementDate = now;
      } else {
        targetItem = {
          ...inventoryItem,
          id: `inv_${partId}_${destinationCode.replace(/[^a-zA-Z0-9]/g, "_")}`,
          locationCode: destinationCode,
          quantity: qty,
          availableQuantity: qty,
          reservedQuantity: 0,
          updatedAt: now,
          lastMovementDate: now
        };
        this.data.inventory.push(targetItem);
      }
    }

    // Update part totalStock
    if (partItem) {
      // The master balance is the sum of all shelf balances, not merely the
      // shelf used in this movement.
      partItem.totalStock = this.data.inventory
        .filter(i => i.partId === partId)
        .reduce((sum, i) => sum + Number(i.quantity || 0), 0);
      partItem.availableStock = this.data.inventory
        .filter(i => i.partId === partId)
        .reduce((sum, i) => sum + Number(i.availableQuantity ?? i.quantity ?? 0), 0);
      partItem.updatedAt = now;
      this.ensurePartIndexed(partItem);
    }

    // Create movement record
    const movementRecord = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      partId,
      partNumber: partNumber || (partItem ? partItem.partNumber : ""),
      partName: partItem ? partItem.nameAr : "قطعة غيار",
      movementType: effectiveType,
      // The history must communicate the actual stock effect. The database
      // stores the absolute quantity for arithmetic, while the audit record
      // stores a negative value for sales, damage and other outgoing moves.
      quantity: isOutgoing ? -qty : qty,
      previousQuantity: prevQty,
      newQuantity: effectiveType.startsWith("TRANSFER") ? prevQty - qty : newQty,
      branchId: branchId || "branch_elharefeyin",
      warehouseId: warehouseId || "wh_elharefeyin_main",
      sourceLocation: sourceCode || "الرف الافتراضي",
      destinationLocation: destinationCode || "",
      reference: reference || `SALE-MOV-${Date.now().toString(36).toUpperCase()}`,
      reason: reason || (isOutgoing ? "صرف مبيعات معتمد" : "حركة مخزنية مسجلة على الخادم المحلي"),
      userId: userId || "user_abdulaziz_admin",
      userName: userName || "عبد العزيز",
      timestamp: now
    };

    this.data.movements.unshift(movementRecord);
    const inventoryUpsert = this.sqlDb.prepare(`
      INSERT INTO inventory_index (id, part_id, location_code, quantity, available_quantity, updated_at, item_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET part_id=excluded.part_id, location_code=excluded.location_code,
        quantity=excluded.quantity, available_quantity=excluded.available_quantity, updated_at=excluded.updated_at, item_json=excluded.item_json
    `);
    for (const item of this.data.inventory.filter(i => i.partId === partId)) this.writeInventoryIndex(inventoryUpsert, item);
    const movementInsert = this.sqlDb.prepare(`INSERT INTO movements_index (id, part_id, part_number, movement_type, timestamp, source_location, destination_location, movement_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    this.writeMovementIndex(movementInsert, movementRecord);
    this.saveDatabase();

    return {
      success: true,
      movement: movementRecord,
      message: `تم تسجيل الحركة وصرف الصنف بنجاح وتحديث الرصيد في الخادم المحلي إلى (${newQty}).`
    };
  }

  public deleteMovement(id: string): boolean {
    const existing = this.sqlDb.prepare("SELECT 1 AS found FROM movements_index WHERE id = ? LIMIT 1").get(id) as { found?: number } | undefined;
    if (existing?.found) {
      this.sqlDb.prepare("DELETE FROM movements_index WHERE id = ?").run(id);
      this.saveDatabase();
      return true;
    }
    return false;
  }

  public clearAllMovements(): boolean {
    this.sqlDb.exec("DELETE FROM movements_index");
    this.saveDatabase();
    return true;
  }

  private getInventoryRowsForPart(partId: string): any[] {
    const rows = this.sqlDb.prepare(
      "SELECT item_json FROM inventory_index WHERE part_id = ? ORDER BY location_code ASC"
    ).all(partId) as Array<{ item_json: string }>;
    return rows.map(row => JSON.parse(row.item_json));
  }

  // Locations
  public getLocations(): any[] {
    return this.data.locations || [];
  }

  public addLocation(location: any): any {
    const now = new Date().toISOString();
    const newLoc = {
      ...location,
      id: location.id || `loc_${Date.now()}`,
      createdAt: now
    };
    this.data.locations.push(newLoc);
    this.saveDatabase();
    return newLoc;
  }

  // Pricing utilities
  public zeroOutSellingPrices(): number {
    let count = 0;
    const now = new Date().toISOString();
    for (const part of this.data.parts) {
      part.sellingPrice = 0;
      part.updatedAt = now;
      count++;
    }
    for (const inv of this.data.inventory) {
      inv.sellingPrice = 0;
      inv.updatedAt = now;
    }
    this.rebuildOperationalIndexes();
    this.sqlDb.exec("BEGIN");
    try {
      const statement = this.sqlDb.prepare("UPDATE parts_index SET selling_price = ?, updated_at = ?, part_json = ? WHERE id = ?");
      for (const part of this.data.parts) statement.run(0, now, JSON.stringify(part), part.id);
      this.sqlDb.exec("COMMIT");
    } catch (error) { this.sqlDb.exec("ROLLBACK"); throw error; }
    this.saveDatabase(true);
    return count;
  }

  public zeroOutAllPrices(): number {
    let count = 0;
    const now = new Date().toISOString();
    for (const part of this.data.parts) {
      part.costPrice = 0;
      part.sellingPrice = 0;
      part.wholesalePrice = 0;
      part.updatedAt = now;
      count++;
    }
    for (const inv of this.data.inventory) {
      inv.costPrice = 0;
      inv.sellingPrice = 0;
      inv.updatedAt = now;
    }
    this.rebuildOperationalIndexes();
    this.sqlDb.exec("BEGIN");
    try {
      const statement = this.sqlDb.prepare("UPDATE parts_index SET selling_price = ?, cost_price = ?, updated_at = ?, part_json = ? WHERE id = ?");
      for (const part of this.data.parts) statement.run(0, 0, now, JSON.stringify(part), part.id);
      this.sqlDb.exec("COMMIT");
    } catch (error) { this.sqlDb.exec("ROLLBACK"); throw error; }
    this.saveDatabase(true);
    return count;
  }

  // Shortages, Partners, Orders
  public getShortages() { return this.data.shortages || []; }
  public setShortages(items: any[]) { this.data.shortages = items; this.saveDatabase(); }
  public addShortage(item: any) { 
    this.data.shortages.unshift({ ...item, id: item.id || `sht_${Date.now()}` }); 
    this.saveDatabase(); 
  }

  public getSuppliers() { return this.data.suppliers || []; }
  public setSuppliers(items: any[]) { this.data.suppliers = items; this.saveDatabase(); }

  public getCustomers() { return this.data.customers || []; }
  public setCustomers(items: any[]) { this.data.customers = items; this.saveDatabase(); }

  public getPurchaseOrders() { return this.data.purchaseOrders || []; }
  public setPurchaseOrders(items: any[]) { this.data.purchaseOrders = items; this.saveDatabase(); }

  public getSalesInvoices() { return this.data.salesInvoices || []; }
  public setSalesInvoices(items: any[]) { this.data.salesInvoices = items; this.saveDatabase(); }

  // Database Backup / Restore
  public restoreDatabase(jsonContent: any): boolean {
    if (!jsonContent || typeof jsonContent !== "object") {
      throw new Error("ملف النسخة الاحتياطية غير صالح.");
    }
    this.data = {
      ...this.getDefaultSchema(),
      ...jsonContent,
      lastModified: new Date().toISOString()
    };
    this.saveDatabase(true);
    return true;
  }

  // Server & Network info
  public getServerInfo(port: number = 3000) {
    const interfaces = os.networkInterfaces();
    const localIps: string[] = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          localIps.push(iface.address);
        }
      }
    }

    const fileSize = fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0;

    return {
      mode: "LOCAL_PC_SERVER",
      isLocalServer: true,
      pcHostname: os.hostname(),
      platform: os.platform(),
      localPort: port,
      localUrls: [
        `http://localhost:${port}`,
        ...localIps.map(ip => `http://${ip}:${port}`)
      ],
      primaryIp: localIps[0] || "localhost",
      databaseFile: DB_FILE,
      databaseSizeBytes: fileSize,
      databaseSizeFormatted: `${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
      lastModified: this.data.lastModified,
      counts: {
        parts: Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM parts_index").get() as { count: number }).count || 0),
        inventory: Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM inventory_index").get() as { count: number }).count || 0),
        movements: Number((this.sqlDb.prepare("SELECT COUNT(*) AS count FROM movements_index").get() as { count: number }).count || 0),
        locations: this.data.locations.length,
        suppliers: this.data.suppliers.length,
        customers: this.data.customers.length,
        salesInvoices: this.data.salesInvoices.length,
        purchaseOrders: this.data.purchaseOrders.length
      }
    };
  }
}

export const localDb = new LocalDatabaseManager();
