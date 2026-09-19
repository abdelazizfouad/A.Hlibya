import express from "express";
import compression from "compression";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { localDb } from "./server/localDatabase";
import { 
  startTunnel, 
  stopTunnel, 
  getTunnelState, 
  saveCustomRemoteUrl, 
  readNoteFile 
} from "./server/tunnelManager";

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// The authorized General Administrator profile
const AUTHORIZED_SUPER_ADMIN = {
  id: "user_abdulaziz_admin",
  email: "admin@ahlibya.store",
  displayName: "عبد العزيز",
  role: "SUPER_ADMIN",
  title: "المسؤول العام",
  branchId: "branch_elharefeyin",
  branchName: "فرع الحرفيين",
  active: true,
  createdAt: "2026-01-01T08:00:00Z"
};

// In-memory active session tokens store (Token -> Session Info)
interface UserSession {
  token: string;
  user: typeof AUTHORIZED_SUPER_ADMIN;
  createdAt: number;
  expiresAt: number;
}
const activeSessions = new Map<string, UserSession>();

// Helper to extract session token from request
function extractToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers["x-session-token"];
  if (typeof customHeader === "string" && customHeader.trim()) {
    return customHeader.trim();
  }
  if (req.body && typeof req.body.token === "string") {
    return req.body.token.trim();
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));
  app.use(compression());

  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const totalMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      if (req.path.startsWith("/api/")) {
        const responseBytes = Number(res.getHeader("content-length") || 0);
        const sqlMs = Number(res.locals.sqlMs || 0);
        const backendMs = Math.max(0, totalMs - sqlMs);
        console.log(`[PERF] ${req.method} ${req.originalUrl} sql=${sqlMs.toFixed(1)}ms backend=${backendMs.toFixed(1)}ms total=${totalMs.toFixed(1)}ms response=${responseBytes}B status=${res.statusCode}`);
      }
    });
    next();
  });

  // ==========================================
  // AUTHENTICATION BACKEND APIS
  // ==========================================

  // 1. Login Endpoint
  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, username, password } = req.body || {};
      const identifier = (email || username || "").toString().trim().toLowerCase();
      const rawPassword = (password || "").toString().trim();

      if (!identifier || !rawPassword) {
        return res.status(400).json({
          success: false,
          error: "يرجى إدخال البريد الإلكتروني وكلمة المرور."
        });
      }

      // Check against authorized Super Admin credentials:
      // Accepts 'admin@ahlibya.store' or 'admin' or 'ADMIN' and password '12345'
      const isEmailMatch = 
        identifier === "admin@ahlibya.store" || 
        identifier === "admin" || 
        identifier === "عبد العزيز" ||
        identifier === "abdulaziz";
      
      const isPasswordMatch = rawPassword === "12345";

      if (!isEmailMatch || !isPasswordMatch) {
        return res.status(401).json({
          success: false,
          error: "بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور."
        });
      }

      // Generate cryptographically secure random session token
      const sessionToken = `ahl_sec_${crypto.randomBytes(32).toString("hex")}`;
      const now = Date.now();
      const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 days valid session

      const sessionData: UserSession = {
        token: sessionToken,
        user: AUTHORIZED_SUPER_ADMIN,
        createdAt: now,
        expiresAt
      };

      activeSessions.set(sessionToken, sessionData);

      console.log(`[AUTH] Administrator login successful for ${AUTHORIZED_SUPER_ADMIN.displayName} (${AUTHORIZED_SUPER_ADMIN.email})`);

      return res.json({
        success: true,
        message: "تم تسجيل الدخول بنجاح. مرحباً بك في لوحة الإدارة.",
        token: sessionToken,
        user: AUTHORIZED_SUPER_ADMIN,
        expiresAt
      });
    } catch (err: any) {
      console.error("[AUTH] Login error:", err);
      return res.status(500).json({
        success: false,
        error: "حدث خطأ غير متوقع أثناء معالجة تسجيل الدخول."
      });
    }
  });

  // 2. Verify Session Endpoint
  app.all(["/api/auth/verify", "/api/auth/me"], (req, res) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          error: "غير مصادق عليه: رمز الجلسة غير موجود."
        });
      }

      const session = activeSessions.get(token);
      if (!session) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          error: "جلسة الدخول غير صالحة أو منتهية. يرجى تسجيل الدخول مجدداً."
        });
      }

      if (Date.now() > session.expiresAt) {
        activeSessions.delete(token);
        return res.status(401).json({
          success: false,
          authenticated: false,
          error: "انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول."
        });
      }

      return res.json({
        success: true,
        authenticated: true,
        user: session.user,
        expiresAt: session.expiresAt
      });
    } catch (err: any) {
      console.error("[AUTH] Verify error:", err);
      return res.status(500).json({
        success: false,
        authenticated: false,
        error: "فشل التحقق من جلسة المستخدم."
      });
    }
  });

  // 3. Logout Endpoint
  app.post("/api/auth/logout", (req, res) => {
    try {
      const token = extractToken(req);
      if (token) {
        activeSessions.delete(token);
        console.log("[AUTH] Session terminated and token revoked.");
      }
      return res.json({
        success: true,
        message: "تم تسجيل الخروج وإنهاء الجلسة بنجاح."
      });
    } catch (err: any) {
      console.error("[AUTH] Logout error:", err);
      return res.json({ success: true });
    }
  });

  // Health endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      service: "AH.Libya ERP Backend Engine",
      version: "2.4.0"
    });
  });

  // ==========================================
  // LOCAL PC DATABASE SERVER APIS (ON-PREMISE)
  // ==========================================

  // 1. Server Info & Status (Local Network IP, PC Name, Database Path)
  app.get("/api/local/status", (_req, res) => {
    try {
      const info = localDb.getServerInfo(PORT);
      res.json({ success: true, ...info });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Fetch Complete Local Dataset
  app.get("/api/local/data", (_req, res) => {
    try {
      const allData = localDb.getAllData();
      res.json({ success: true, data: allData });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/local/bootstrap", (_req, res) => {
    try {
      const startedAt = process.hrtime.bigint();
      const data = localDb.getBootstrapData();
      const sqlMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      res.locals.sqlMs = sqlMs;
      res.json({ success: true, ...data, performance: { sqlMs } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Parts APIs
  app.get("/api/local/parts", (req, res) => {
    try {
      // Search results must never be served from a browser or tunnel cache:
      // newly registered parts must be visible immediately.
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      const startedAt = process.hrtime.bigint();
      const result = localDb.getPartsPage({
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 50),
        query: String(req.query.q || ""),
        categoryGroup: String(req.query.categoryGroup || ""),
        quality: String(req.query.quality || ""),
        status: String(req.query.status || ""),
        sortBy: String(req.query.sortBy || "partNumber"),
        sortDirection: String(req.query.sortDirection || "asc")
      });
      const sqlMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      res.locals.sqlMs = sqlMs;
      res.json({ success: true, ...result, performance: { sqlMs } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/local/parts/:id", (req, res) => {
    try {
      const part = localDb.getPartByIdOrNumber(req.params.id);
      if (!part) return res.status(404).json({ success: false, error: "الصنف غير موجود." });
      res.json({ success: true, part, inventory: localDb.getInventoryForPart(part.id) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/local/parts", (req, res) => {
    try {
      const part = req.body;
      if (!part || (!part.partNumber && !part.nameAr)) {
        return res.status(400).json({ success: false, error: "بيانات الصنف غير صالحة." });
      }
      const updated = localDb.upsertPart(part);
      res.json({ success: true, part: updated, message: "تم حفظ الصنف في قاعدة بيانات الكمبيوتر بنجاح." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/local/parts/:id/printed-serial", (req, res) => {
    try {
      const success = localDb.recordPrintedSerial(req.params.id, String(req.body?.serialNumber || ""));
      res.status(success ? 200 : 404).json({ success });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/local/parts/:id", (req, res) => {
    try {
      const { id } = req.params;
      const success = localDb.deletePart(id);
      res.json({ success, message: success ? "تم حذف الصنف من الكمبيوتر بنجاح." : "الصنف غير موجود." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/local/parts/bulk-import", (req, res) => {
    try {
      const { items, branchId, warehouseId, locationCode } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, error: "قائمة الأصناف غير صالحة." });
      }
      const result = localDb.bulkImportParts(items, branchId, warehouseId, locationCode);
      res.json({
        success: true,
        successCount: result.successCount,
        errors: result.errors,
        message: `تم استيراد وحفظ (${result.successCount}) صنف في قاعدة بيانات الكمبيوتر بنجاح.`
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Inventory & Movements APIs
  app.get("/api/local/inventory", (req, res) => {
    try {
      const startedAt = process.hrtime.bigint();
      const result = localDb.getInventoryPage(Number(req.query.page || 1), Number(req.query.limit || 50));
      const sqlMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      res.locals.sqlMs = sqlMs;
      res.json({ success: true, ...result, performance: { sqlMs } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/local/movements", (req, res) => {
    try {
      const startedAt = process.hrtime.bigint();
      const result = localDb.getMovementsPage(Number(req.query.page || 1), Number(req.query.limit || 50));
      const sqlMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      res.locals.sqlMs = sqlMs;
      res.json({ success: true, ...result, performance: { sqlMs } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/local/inventory/movement", (req, res) => {
    try {
      const result = localDb.executeMovement(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/local/movements/:id", (req, res) => {
    try {
      const { id } = req.params;
      const success = localDb.deleteMovement(id);
      res.json({ success, message: "تم حذف سجل الحركة." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/local/movements/clear", (_req, res) => {
    try {
      localDb.clearAllMovements();
      res.json({ success: true, message: "تم مسح سجل الحركات بالكامل." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Locations APIs
  app.get("/api/local/locations", (_req, res) => {
    try {
      res.json({ success: true, locations: localDb.getLocations() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/local/locations", (req, res) => {
    try {
      const loc = localDb.addLocation(req.body);
      res.json({ success: true, location: loc, message: "تم إضافة الموقع التخزيني على الكمبيوتر." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Pricing Operations
  app.post("/api/local/prices/zero-selling", (_req, res) => {
    try {
      const count = localDb.zeroOutSellingPrices();
      res.json({ success: true, count, message: `تم تصفير سعر البيع لكافة الـ (${count}) صنف وجعلها 0 EGP.` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/local/prices/zero-all", (_req, res) => {
    try {
      const count = localDb.zeroOutAllPrices();
      res.json({ success: true, count, message: `تم تصفير جميع الأسعار (البيع والتكلفة والجملة) لكافة الـ (${count}) صنف.` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. Backup & Restore
  app.get("/api/local/backup/download", (_req, res) => {
    try {
      const data = localDb.getAllData();
      const filename = `ah-libya-backup-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.send(JSON.stringify(data, null, 2));
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/local/backup/restore", (req, res) => {
    try {
      const backupData = req.body;
      localDb.restoreDatabase(backupData);
      res.json({ success: true, message: "تم استعادة قاعدة البيانات بنجاح من النسخة الاحتياطية." });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 8. Shortages, Suppliers, Customers, Invoices, Purchase Orders
  app.get("/api/local/shortages", (_req, res) => res.json({ success: true, shortages: localDb.getShortages() }));
  app.post("/api/local/shortages", (req, res) => {
    if (Array.isArray(req.body)) {
      localDb.setShortages(req.body);
    } else {
      localDb.addShortage(req.body);
    }
    res.json({ success: true });
  });

  app.get("/api/local/suppliers", (_req, res) => res.json({ success: true, suppliers: localDb.getSuppliers() }));
  app.post("/api/local/suppliers", (req, res) => {
    localDb.setSuppliers(req.body);
    res.json({ success: true });
  });

  app.get("/api/local/customers", (_req, res) => res.json({ success: true, customers: localDb.getCustomers() }));
  app.post("/api/local/customers", (req, res) => {
    localDb.setCustomers(req.body);
    res.json({ success: true });
  });

  app.get("/api/local/orders", (_req, res) => {
    res.json({
      success: true,
      purchaseOrders: localDb.getPurchaseOrders(),
      salesInvoices: localDb.getSalesInvoices()
    });
  });

  app.post("/api/local/orders/purchase", (req, res) => {
    localDb.setPurchaseOrders(req.body);
    res.json({ success: true });
  });

  app.post("/api/local/orders/sales", (req, res) => {
    localDb.setSalesInvoices(req.body);
    res.json({ success: true });
  });

  // ==========================================
  // REMOTE ACCESS TUNNEL & PUBLIC URL NOTE APIS
  // ==========================================

  // 1. Get Tunnel & Note Status
  app.get("/api/local/tunnel/status", (_req, res) => {
    try {
      const state = getTunnelState();
      const note = readNoteFile();
      res.json({
        success: true,
        ...state,
        noteContent: note.content,
        notePath: note.path
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Start Remote Tunnel
  app.post("/api/local/tunnel/start", async (req, res) => {
    try {
      const { subdomain } = req.body || {};
      const result = await startTunnel(PORT, subdomain);
      const note = readNoteFile();
      res.json({
        ...result,
        noteContent: note.content,
        notePath: note.path
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Stop Remote Tunnel
  app.post("/api/local/tunnel/stop", async (_req, res) => {
    try {
      const stopped = await stopTunnel();
      res.json({ success: stopped });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Save Custom Remote URL
  app.post("/api/local/tunnel/custom-url", (req, res) => {
    try {
      const { customUrl } = req.body || {};
      const result = saveCustomRemoteUrl(customUrl || "");
      const note = readNoteFile();
      res.json({
        ...result,
        noteContent: note.content,
        notePath: note.path
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Download Note File (.txt)
  app.get("/api/local/tunnel/download-note", (_req, res) => {
    try {
      const note = readNoteFile();
      if (!note.content) {
        return res.status(404).send("ملف النوت غير موجود حتى الآن. يرجى تفعيل الرابط أولاً.");
      }
      res.setHeader("Content-Disposition", "attachment; filename=REMOTE_ACCESS_URL.txt");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(note.content);
    } catch (err: any) {
      res.status(500).send("خطأ أثناء تنزيل ملف النوت: " + err.message);
    }
  });

  // Backend System & Database Status
  app.get("/api/backend/status", (_req, res) => {
    const memory = process.memoryUsage();
    const serverInfo = localDb.getServerInfo(PORT);
    res.json({
      success: true,
      service: "AH.Libya Mercedes-Benz ERP Local PC Server",
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      database: {
        provider: "Local PC On-Premise Storage",
        databaseFile: serverInfo.databaseFile,
        databaseSize: serverInfo.databaseSizeFormatted,
        mode: "Offline Local Server on PC Hard Drive (No Cloud Dependency)"
      },
      counts: serverInfo.counts,
      localUrls: serverInfo.localUrls,
      aiEngine: {
        provider: "Google Gemini AI",
        model: "gemini-3.7-flash",
        configured: Boolean(process.env.GEMINI_API_KEY)
      },
      memory: {
        rssMb: Math.round(memory.rss / (1024 * 1024)),
        heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024))
      }
    });
  });

  // AI Parts Advisor & EPC Cross-Reference
  app.post("/api/ai/part-advisor", async (req, res) => {
    try {
      const { query: userQuery, chassis, partNumber } = req.body;
      if (!userQuery && !partNumber) {
        return res.status(400).json({ error: "يرجى تقديم استفسار أو رقم قطعة مرسيدس" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          success: true,
          source: "LOCAL_RULE_BASED",
          data: {
            advice: "محرك الذكاء الاصطناعي السحابي يعمل بالوضع المحلي. يمكنك البحث المباشر برقم القطعة أو فك الشاسيه.",
            recommendations: []
          }
        });
      }

      const ai = getAI();
      const prompt = `You are a master Mercedes-Benz Senior Parts Advisor and EPC Specialist for AH.Libya Auto Parts (أشرف و هشام ليبيا).
Answer this automotive inquiry with precision:
- User Question / Need: "${userQuery || ''}"
- Chassis / Model Target: "${chassis || 'All Mercedes Chassis'}"
- Specific Part Number (if provided): "${partNumber || ''}"

Return a strict JSON response with this schema:
{
  "summaryAr": "<Concise expert Arabic advice and diagnosis>",
  "primaryPartNumbers": [
    {
      "partNumber": "<e.g. A0004208000>",
      "nameAr": "<Arabic part title>",
      "nameEn": "<English part title>",
      "chassisCode": "<e.g. W223 / W213 / W205>",
      "position": "<FRONT / REAR / ENGINE / TRANSMISSION / SUSPENSION>",
      "estimatedLaborNote": "<Brief technical installation note>"
    }
  ],
  "supersessionsOrAlternatives": [
    {
      "code": "<Alternative or updated OEM number>",
      "brand": "<Mercedes-Benz / Lemforder / Bilstein / Bosch / Mahle>",
      "notes": "<Why this works or if superseded>"
    }
  ],
  "technicalTips": ["<Important technical caution or inspection tip 1>", "<Tip 2>"]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json({
        success: true,
        source: "GOOGLE_GEMINI_AI",
        data: parsed
      });
    } catch (err: any) {
      console.error("AI Part Advisor error:", err);
      res.status(500).json({ error: err?.message || "خطأ أثناء استشارة خبير قطع الغيار" });
    }
  });

  // Google Gemini Connected VIN Decoder
  app.post("/api/vin/decode", async (req, res) => {
    try {
      const { vin } = req.body;
      const cleanVin = (vin || "").trim().toUpperCase();

      if (!cleanVin || cleanVin.length !== 17) {
        return res.status(400).json({ error: "رقم الشاسيه (VIN) يجب أن يتكون من 17 رمزًا دقيقًا" });
      }

      // If GEMINI_API_KEY is present, query Google Gemini for precision Mercedes EPC decoding
      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = getAI();
          const prompt = `You are a world-class Mercedes-Benz Electronic Parts Catalog (EPC) and VIN decoding specialist for AH.Libya Store.
Decode the following 17-character VIN accurately: "${cleanVin}".

Return a strict JSON object with these exact fields:
{
  "vin": "${cleanVin}",
  "make": "Mercedes-Benz",
  "model": "<Exact Model Name, e.g. Mercedes-Benz S 500 4MATIC Sedan>",
  "modelYear": <Year as Integer, e.g. 2022>,
  "chassis": "<Exact Chassis code, e.g. W223, W222, W213, W205, W206, W167, W463, X253, C238, etc.>",
  "engineModel": "<Exact Engine Code, e.g. M256.930 3.0L Inline-6 Turbo EQ Boost, M274, OM654, M177, etc.>",
  "displacementL": "<e.g. 3.0L>",
  "cylinders": "<e.g. 6 Cylinders>",
  "fuelType": "<e.g. Gasoline Mild Hybrid / Diesel>",
  "bodyClass": "<e.g. Luxury Sedan, SUV, Coupe>",
  "driveType": "<e.g. 4MATIC AWD / RWD>",
  "plantCountry": "<e.g. Germany (Sindelfingen / Bremen / Rastatt)>",
  "series": "<e.g. S-Class / E-Class / C-Class / GLE>",
  "transmission": "<e.g. 9G-TRONIC Automatic>",
  "notes": "<Arabic summary of vehicle specifications and engineering notes>",
  "suggestedOemParts": [
    {
      "nameAr": "<Arabic part name, e.g. تيل فرامل أمامي>",
      "nameEn": "<English part name, e.g. Front Brake Pad Set>",
      "partNumber": "<Genuine Mercedes OEM part number, e.g. A0004208000>",
      "category": "<Category code, e.g. BRAKES, ENGINE, FILTERS, SUSPENSION>"
    }
  ]
}`;

          const response = await ai.models.generateContent({
            model: "gemini-3.7-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });

          const rawText = response.text || "";
          const decoded = JSON.parse(rawText);
          return res.json({
            success: true,
            source: "GOOGLE_GEMINI_AI",
            data: {
              ...decoded,
              decodedAt: new Date().toISOString(),
              isValid: true
            }
          });
        } catch (geminiError) {
          console.warn("Gemini VIN decode error, falling back:", geminiError);
        }
      }

      // Fallback: Query NHTSA vPIC API
      try {
        const nhtsaResp = await fetch(
          `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${cleanVin}?format=json`
        );
        if (nhtsaResp.ok) {
          const data = await nhtsaResp.json();
          const r = data?.Results?.[0];
          if (r && r.Make) {
            return res.json({
              success: true,
              source: "NHTSA_API",
              data: {
                vin: cleanVin,
                make: r.Make || "Mercedes-Benz",
                model: r.Model ? `Mercedes-Benz ${r.Model}` : "Mercedes-Benz Vehicle",
                modelYear: parseInt(r.ModelYear, 10) || 2022,
                chassis: r.Series || "W223",
                engineModel: r.EngineModel || "Mercedes Turbo Engine",
                displacementL: r.DisplacementL ? `${r.DisplacementL}L` : "3.0L",
                cylinders: r.EngineCylinders ? `${r.EngineCylinders} Cylinders` : "6 Cylinders",
                fuelType: r.FuelTypePrimary || "Gasoline",
                bodyClass: r.BodyClass || "Sedan",
                driveType: r.DriveType || "4MATIC AWD",
                plantCountry: r.PlantCountry || "Germany",
                series: r.Series || "Mercedes-Benz",
                decodedAt: new Date().toISOString(),
                isValid: true
              }
            });
          }
        }
      } catch (nhtsaError) {
        console.warn("NHTSA API error:", nhtsaError);
      }

      return res.status(500).json({ error: "فشل التحليل عبر خوادم Google و NHTSA" });
    } catch (err: any) {
      console.error("VIN decode error:", err);
      res.status(500).json({ error: err?.message || "خطأ أثناء فك الشاسيه" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`AH.Libya ERP Server running on http://0.0.0.0:${PORT}`);

    if (process.env.ENABLE_REMOTE_TUNNEL === "true" || process.argv.includes("--remote")) {
      console.log("[Remote Access] Auto-starting remote public tunnel...");
      try {
        const tunnelRes = await startTunnel(PORT);
        if (tunnelRes.success && tunnelRes.url) {
          console.log(`[Remote Access] Remote URL is ready: ${tunnelRes.url}`);
        }
      } catch (err) {
        console.warn("[Remote Access] Auto tunnel start warning:", err);
      }
    }
  });
}

startServer();
