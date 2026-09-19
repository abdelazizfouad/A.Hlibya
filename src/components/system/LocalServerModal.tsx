import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Server, 
  HardDrive, 
  Wifi, 
  Download, 
  Upload, 
  CheckCircle2, 
  X, 
  Copy, 
  RefreshCw,
  FolderOpen,
  Globe,
  FileText,
  ExternalLink,
  Share2,
  Power,
  ShieldCheck,
  Check,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Link2
} from 'lucide-react';
import { 
  fetchLocalServerStatus, 
  LocalServerStatus, 
  downloadLocalDatabaseBackup, 
  restoreLocalDatabaseBackup,
  fetchRemoteTunnelStatus,
  RemoteTunnelStatus,
  startRemoteTunnel,
  stopRemoteTunnel,
  saveCustomRemoteTunnelUrl,
  downloadRemoteNoteFile
} from '../../lib/localServerService';
import { useLanguage } from '../../lib/languageContext';

interface LocalServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
}

export const LocalServerModal: React.FC<LocalServerModalProps> = ({ isOpen, onClose, isDark = false }) => {
  const { dir } = useLanguage();
  const [status, setStatus] = useState<LocalServerStatus | null>(null);
  const [tunnelStatus, setTunnelStatus] = useState<RemoteTunnelStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTunnelLoading, setIsTunnelLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showNotePreview, setShowNotePreview] = useState(true);
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [customUrlValue, setCustomUrlValue] = useState('');

  const loadAllStatus = async () => {
    setIsLoading(true);
    try {
      const [serverData, tunnelData] = await Promise.all([
        fetchLocalServerStatus(),
        fetchRemoteTunnelStatus()
      ]);
      if (serverData) setStatus(serverData);
      if (tunnelData) {
        setTunnelStatus(tunnelData);
        if (tunnelData.customUrl) setCustomUrlValue(tunnelData.customUrl);
      }
    } catch (err) {
      console.error('Error loading local server & tunnel status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllStatus();
    }
  }, [isOpen]);

  const handleCopy = (text: string, isNote: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isNote) {
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2500);
    } else {
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2500);
    }
  };

  const handleStartTunnel = async () => {
    setIsTunnelLoading(true);
    try {
      const result = await startRemoteTunnel();
      setTunnelStatus(result);
      setFeedbackMsg({ 
        text: 'تم إنشاء رابط الوصول الخارجي وملف النوت بنجاح! يمكنك الآن فتحه من أي مكان.', 
        type: 'success' 
      });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'فشل تشغيل نفق الوصول الخارجي.', type: 'error' });
    } finally {
      setIsTunnelLoading(false);
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  const handleStopTunnel = async () => {
    setIsTunnelLoading(true);
    try {
      await stopRemoteTunnel();
      await loadAllStatus();
      setFeedbackMsg({ text: 'تم إيقاف رابط الوصول الخارجي.', type: 'success' });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'فشل إيقاف النفق.', type: 'error' });
    } finally {
      setIsTunnelLoading(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleSaveCustomUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlValue.trim()) return;
    setIsTunnelLoading(true);
    try {
      const res = await saveCustomRemoteTunnelUrl(customUrlValue.trim());
      setTunnelStatus(res);
      setShowCustomUrlInput(false);
      setFeedbackMsg({ text: 'تم حفظ الرابط المخصص وتحديث ملف النوت بنجاح.', type: 'success' });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'فشل حفظ الرابط.', type: 'error' });
    } finally {
      setIsTunnelLoading(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleDownloadNote = async () => {
    try {
      await downloadRemoteNoteFile();
      setFeedbackMsg({ text: 'تم تنزيل ملف النوت (رابط_الوصول_من_اي_مكان.txt) إلى جهازك.', type: 'success' });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'فشل تنزيل ملف النوت.', type: 'error' });
    }
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleDownloadBackup = async () => {
    try {
      await downloadLocalDatabaseBackup();
      setFeedbackMsg({ text: 'تم تنزيل ملف النسخة الاحتياطية بنجاح إلى جهازك.', type: 'success' });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'فشل تنزيل النسخة الاحتياطية.', type: 'error' });
    }
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('هل أنت متأكد من رغبتك في استعادة قاعدة البيانات من هذا الملف؟ سيتم استبدال البيانات الحالية.')) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      await restoreLocalDatabaseBackup(file);
      setFeedbackMsg({ text: 'تم استعادة قاعدة البيانات بنجاح من النسخة الاحتياطية!', type: 'success' });
      await loadAllStatus();
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'فشل استعادة قاعدة البيانات.', type: 'error' });
    } finally {
      setIsRestoring(false);
      e.target.value = '';
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  const activeRemoteUrl = tunnelStatus?.url || null;
  const isOnline = Boolean(tunnelStatus?.isActive && activeRemoteUrl);

  const whatsappShareUrl = activeRemoteUrl 
    ? `https://wa.me/?text=${encodeURIComponent(`رابط الدخول لمنظومة أشرف وهشام ليبيا لقطع غيار مرسيدس-بنز:\n${activeRemoteUrl}\n(يعمل أثناء تشغيل سيرفر الكمبيوتر)`)}`
    : '#';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
        dir={dir}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className={`w-full max-w-2xl my-8 rounded-2xl shadow-2xl overflow-hidden border ${
            isDark 
              ? 'bg-[#121214] border-zinc-800 text-zinc-100' 
              : 'bg-white border-zinc-200 text-zinc-800'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-emerald-600/10 via-blue-600/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span>سيرفر الكمبيوتر والوصول عن بعد</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    خادم محلي PC
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  قاعدة البيانات على جهازك + رابط نوت للاستخدام من الهاتف وأي مكان في العالم
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback notification */}
          {feedbackMsg && (
            <div className={`mx-6 mt-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

            {/* REMOTE ACCESS & PUBLIC URL NOTE (PRIMARY HERO SECTION) */}
            <div className={`p-5 rounded-2xl border transition-all ${
              isOnline
                ? 'bg-gradient-to-b from-blue-500/10 via-emerald-500/5 to-transparent border-blue-500/30 dark:border-blue-500/20 shadow-md shadow-blue-500/5'
                : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${isOnline ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <span>الوصول عن بعد من أي مكان (Remote URL Note)</span>
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          متصل أونلاين
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                          غير نشط
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      يمكنك استخدام المنظومة من هاتفك خارج المحل طالما أن جهاز الكمبيوتر شغال والسيرفر مفتوح
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={loadAllStatus}
                    disabled={isLoading}
                    title="تحديث الرابط"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Active URL Card */}
              {isOnline && activeRemoteUrl ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-800/90 border border-blue-200 dark:border-blue-900/40 shadow-sm">
                    <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        رابط المنظومة المباشر للفتح من الهاتف أو اللابتوب:
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">HTTPS آمن ومشفّر</span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      <input 
                        type="text"
                        readOnly
                        value={activeRemoteUrl}
                        className="flex-1 px-3 py-2 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg select-all outline-none"
                      />
                      <button
                        onClick={() => handleCopy(activeRemoteUrl)}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                      >
                        {copiedUrl === activeRemoteUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedUrl === activeRemoteUrl ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                      </button>
                    </div>

                    <div className="flex items-center flex-wrap gap-2 mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-700/60">
                      <a
                        href={activeRemoteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>فتح الرابط في متصفح جديد</span>
                      </a>

                      <span className="text-zinc-300 dark:text-zinc-700">•</span>

                      <a
                        href={whatsappShareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline transition"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>إرسال الرابط إلى رقمي على واتساب</span>
                      </a>

                      <span className="text-zinc-300 dark:text-zinc-700">•</span>

                      <button
                        onClick={handleStopTunnel}
                        disabled={isTunnelLoading}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 transition cursor-pointer mr-auto"
                      >
                        <Power className="w-3 h-3" />
                        <span>إيقاف الرابط</span>
                      </button>
                    </div>
                  </div>

                  {/* Note File Display & Actions */}
                  <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                        <FileText className="w-4 h-4 text-amber-500" />
                        <span>ملف النوت التلقائي المحفوظ على جهازك</span>
                        <code className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-800 dark:text-amber-200 font-mono">
                          رابط_الوصول_من_اي_مكان.txt
                        </code>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleDownloadNote}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 text-[11px] font-semibold transition cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>تنزيل النوت</span>
                        </button>
                        <button
                          onClick={() => handleCopy(tunnelStatus?.noteContent || activeRemoteUrl, true)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-[11px] font-semibold transition cursor-pointer"
                        >
                          {copiedNote ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedNote ? 'تم نسخ النوت!' : 'نسخ نص النوت'}</span>
                        </button>
                        <button
                          onClick={() => setShowNotePreview(!showNotePreview)}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-600 transition"
                        >
                          {showNotePreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {showNotePreview && (
                      <div className="mt-2.5 p-3 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-amber-200/50 dark:border-amber-900/30 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap select-all">
                        {tunnelStatus?.noteContent || `رابط المنظومة:\n${activeRemoteUrl}`}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Tunnel Inactive State */
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-center">
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-3 leading-relaxed max-w-lg mx-auto">
                      اضغط على الزر أدناه لتوليد <strong>رابط خارجي مباشر ونوت تلقائي</strong> فورياً. سيتم حفظ ملف النوت باسم <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">رابط_الوصول_من_اي_مكان.txt</span> في مجلد البرنامج لنسخه أو إرساله لهاتفك.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={handleStartTunnel}
                        disabled={isTunnelLoading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer"
                      >
                        <Globe className={`w-4 h-4 ${isTunnelLoading ? 'animate-spin' : ''}`} />
                        <span>{isTunnelLoading ? 'جاري إنشاء الرابط والنوت...' : 'توليد رابط أونلاين ونوت تلقائي'}</span>
                      </button>

                      <button
                        onClick={() => setShowCustomUrlInput(!showCustomUrlInput)}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>إدخال رابط مخصص</span>
                      </button>
                    </div>

                    {showCustomUrlInput && (
                      <form onSubmit={handleSaveCustomUrl} className="mt-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-right">
                        <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
                          رابط خارجي خاص (مثل Cloudflare Tunnel أو Ngrok أو دومين):
                        </label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="url"
                            placeholder="https://my-store.trycloudflare.com"
                            value={customUrlValue}
                            onChange={(e) => setCustomUrlValue(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs font-mono rounded bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 outline-none"
                            required
                          />
                          <button
                            type="submit"
                            disabled={isTunnelLoading}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded transition cursor-pointer"
                          >
                            حفظ وتحديث النوت
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PC Database Status Card */}
            <div className={`p-4 rounded-xl border ${
              isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                  <HardDrive className="w-4 h-4 text-emerald-500" />
                  <span>معلومات قاعدة البيانات على الكمبيوتر</span>
                </div>
                <button
                  onClick={loadAllStatus}
                  disabled={isLoading}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-emerald-500 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>تحديث الأرقام</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60">
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {status?.counts?.parts ?? '...'}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">قطع الغيار المسجلة</div>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60">
                  <div className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                    {status?.counts?.inventory ?? '...'}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">سجلات المخزون</div>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60">
                  <div className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">
                    {status?.counts?.locations ?? '...'}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">مواقع الأرفف (Bins)</div>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60">
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                    {status?.databaseSizeFormatted ?? '0.40 MB'}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">حجم ملف القاعدة</div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 text-xs flex flex-col gap-1 text-zinc-500">
                <div className="flex items-center gap-1.5 font-mono text-[11px] truncate">
                  <FolderOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="text-zinc-400">ملف التخزين:</span>
                  <span className="text-zinc-700 dark:text-zinc-300 select-all font-semibold">
                    {status?.databaseFile || 'data/local_erp_database.sqlite'}
                  </span>
                </div>
              </div>
            </div>

            {/* Local Network Wi-Fi Sharing */}
            <div className={`p-4 rounded-xl border ${
              isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
            }`}>
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 mb-2">
                <Wifi className="w-4 h-4 text-emerald-500" />
                <span>ربط أجهزة المحل عبر الواي فاي الداخلي (Local Network)</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2.5 leading-relaxed">
                إذا كان الهاتف أو كمبيوتر المبيعات متصلاً بنفس شبكة الواي فاي في المحل، يمكنك فتحه فورياً عبر:
              </p>

              <div className="space-y-2">
                {(status?.localUrls || ['http://localhost:3000']).map((url, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono"
                  >
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{url}</span>
                    <button
                      onClick={() => handleCopy(url)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 transition cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedUrl === url ? 'تم النسخ!' : 'نسخ'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Backup & Restore Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleDownloadBackup}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل نسخة احتياطية كاملة (Backup)</span>
              </button>

              <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold shadow-md transition cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{isRestoring ? 'جاري الاستعادة...' : 'استعادة قاعدة بيانات من ملف'}</span>
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleFileRestore} 
                  disabled={isRestoring} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* Quick Automation Instructions */}
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>التشغيل السريع من سطح المكتب مع النوت:</strong>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  تم تجهيز ملفين تشغيل في مجلد البرنامج:
                  <br />
                  1. <code className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[11px] text-blue-600 dark:text-blue-400">start-remote-server.bat</code> : يشغل السيرفر ويولد رابط الوصول الخارجي ويفتح ملف النوت تلقائياً في المفكرة (Notepad).
                  <br />
                  2. <code className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">افتح_ملف_النوت_رابط_الوصول.bat</code> : يفتح ملف النوت فورياً متى أردت نسخ الرابط.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
