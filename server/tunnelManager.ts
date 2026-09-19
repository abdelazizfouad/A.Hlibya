/**
 * AH.Libya ERP - Remote Access Tunnel Manager
 * 
 * Enables remote access to the local PC server from anywhere via a secure public URL.
 * Automatically generates and updates the user's note file (`رابط_الوصول_من_اي_مكان.txt` and `REMOTE_ACCESS_URL.txt`).
 */

import fs from 'fs';
import path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

const NOTE_FILE_AR = path.resolve(process.cwd(), 'رابط_الوصول_من_اي_مكان.txt');
const NOTE_FILE_EN = path.resolve(process.cwd(), 'REMOTE_ACCESS_URL.txt');
const CONFIG_FILE = path.resolve(process.cwd(), 'data', 'remote_config.json');

interface TunnelState {
  isActive: boolean;
  url: string | null;
  startedAt: string | null;
  error: string | null;
  noteFileArPath: string;
  noteFileEnPath: string;
  customUrl?: string | null;
}

let activeTunnel: ChildProcessWithoutNullStreams | null = null;
let currentState: TunnelState = {
  isActive: false,
  url: null,
  startedAt: null,
  error: null,
  noteFileArPath: NOTE_FILE_AR,
  noteFileEnPath: NOTE_FILE_EN,
  customUrl: null
};

// Load saved custom URL if exists
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.customUrl) currentState.customUrl = parsed.customUrl;
  }
} catch (e) {
  console.warn('Could not read remote_config.json:', e);
}

function generateNoteContent(url: string): string {
  const timestamp = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Tripoli' });
  return `===================================================================
منظومة أشرف وهشام ليبيا لقطع غيار مرسيدس-بنز (AH.Libya ERP)
ملف نوت: رابط الدخول عن بعد من أي مكان في العالم (Remote Access Note)
===================================================================

الرابط المباشر للمنظومة عبر الإنترنت:
>>> ${url} <<<

كيفية استخدام هذا الرابط:
1. انسخ الرابط أعلاه وافتحه في متصفح أي هاتف ذكي أو كمبيوتر آخر خارج المحل.
2. يمكنك إرسال هذا الرابط إلى الواتساب الخاص بك لفتحه على هاتفك في أي وقت.
3. يعمل هذا الرابط بشكل كامل وسريع طالما أن جهاز الكمبيوتر في المحل قيد التشغيل والبرنامج مفتوح.
4. كافة التعديلات وعمليات البيع والشراء التي تجريها من الخارج تُحفظ فوراً على كمبيوتر المحل.

تاريخ ووقت تحديث الرابط: ${timestamp}
الحالة: الخادم المحلي متصل ونشط على جهاز الكمبيوتر
===================================================================
`;
}

export function writeNoteFile(url: string): void {
  try {
    const content = generateNoteContent(url);
    fs.writeFileSync(NOTE_FILE_AR, content, 'utf-8');
    fs.writeFileSync(NOTE_FILE_EN, content, 'utf-8');
    console.log(`[Remote Access] Note file created successfully: ${NOTE_FILE_AR}`);
  } catch (err) {
    console.error('[Remote Access] Error writing note file:', err);
  }
}

function clearNoteFiles(): void {
  for (const notePath of [NOTE_FILE_AR, NOTE_FILE_EN]) {
    try {
      if (fs.existsSync(notePath)) fs.unlinkSync(notePath);
    } catch (err) {
      console.warn('[Remote Access] Could not clear note file:', err);
    }
  }
}

export function readNoteFile(): { content: string | null; path: string } {
  try {
    if (fs.existsSync(NOTE_FILE_AR)) {
      return { content: fs.readFileSync(NOTE_FILE_AR, 'utf-8'), path: NOTE_FILE_AR };
    }
    if (fs.existsSync(NOTE_FILE_EN)) {
      return { content: fs.readFileSync(NOTE_FILE_EN, 'utf-8'), path: NOTE_FILE_EN };
    }
  } catch (err) {
    console.warn('[Remote Access] Error reading note file:', err);
  }
  return { content: null, path: NOTE_FILE_AR };
}

export async function startTunnel(port: number = 3000, preferredSubdomain?: string): Promise<{ success: boolean; url: string | null; error?: string }> {
  if (activeTunnel) {
    return { success: true, url: currentState.url };
  }

  try {
    console.log(`[Remote Access] Launching secure public tunnel for port ${port}...`);
    clearNoteFiles();

    const cloudflaredPath = path.join(process.cwd(), 'cloudflared.exe');
    if (!fs.existsSync(cloudflaredPath)) {
      throw new Error('cloudflared.exe غير موجود. شغّل setup-pc.bat مرة أخرى.');
    }

    const tunnel = spawn(cloudflaredPath, [
      'tunnel',
      '--no-autoupdate',
      '--url',
      `http://127.0.0.1:${port}`
    ], {
      cwd: process.cwd(),
      windowsHide: true
    });

    activeTunnel = tunnel;
    const url = await new Promise<string>((resolve, reject) => {
      let output = '';
      const tunnelUrlPattern = /https:\/\/(?!api\.)[-a-z0-9]+\.trycloudflare\.com/i;
      const timeout = setTimeout(() => reject(new Error('انتهت مهلة إنشاء رابط Cloudflare.')), 45000);
      const readOutput = (chunk: Buffer) => {
        output += chunk.toString();
        const match = output.match(tunnelUrlPattern);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      };
      tunnel.stdout.on('data', readOutput);
      tunnel.stderr.on('data', readOutput);
      tunnel.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      tunnel.once('exit', (code) => {
        if (code && !output.match(tunnelUrlPattern)) {
          clearTimeout(timeout);
          reject(new Error(`Cloudflare tunnel توقف برمز ${code}.`));
        }
      });
    });

    // Quick Tunnel URLs can take a few seconds to propagate. Publish the URL
    // immediately and let Cloudflare finish establishing the edge connection.
    currentState.isActive = true;
    currentState.url = url;
    currentState.startedAt = new Date().toISOString();
    currentState.error = null;

    // Write the note file on the PC
    writeNoteFile(url);

    console.log(`\n===================================================================`);
    console.log(`[Remote Access] SUCCESS! Public URL generated:`);
    console.log(`>>> ${url} <<<`);
    console.log(`Note file saved to: ${NOTE_FILE_AR}`);
    console.log(`===================================================================\n`);

    tunnel.on('close', () => {
      console.log('[Remote Access] Tunnel closed.');
      activeTunnel = null;
      currentState.isActive = false;
      currentState.url = null;
      clearNoteFiles();
    });

    tunnel.on('error', (err: any) => {
      console.error('[Remote Access] Tunnel error:', err);
      currentState.error = err?.message || String(err);
      clearNoteFiles();
    });

    return { success: true, url };
  } catch (err: any) {
    console.error('[Remote Access] Failed to start tunnel:', err);
    currentState.isActive = false;
    currentState.error = err?.message || 'Failed to start tunnel';
    return { success: false, url: null, error: currentState.error };
  }
}

export async function stopTunnel(): Promise<boolean> {
  if (activeTunnel) {
    try {
      activeTunnel.kill();
      activeTunnel = null;
      currentState.isActive = false;
      currentState.url = null;
      clearNoteFiles();
      console.log('[Remote Access] Tunnel stopped successfully.');
      return true;
    } catch (e) {
      console.error('[Remote Access] Error closing tunnel:', e);
    }
  }
  return false;
}

export function saveCustomRemoteUrl(customUrl: string): { success: boolean; url: string } {
  try {
    const trimmed = customUrl.trim();
    currentState.customUrl = trimmed;
    currentState.url = trimmed;
    currentState.isActive = Boolean(trimmed);

    // Save config
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ customUrl: trimmed }, null, 2), 'utf-8');

    // Update note file
    writeNoteFile(trimmed);
    return { success: true, url: trimmed };
  } catch (err: any) {
    return { success: false, url: customUrl };
  }
}

export function getTunnelState(): TunnelState {
  return currentState;
}
