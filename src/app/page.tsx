'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatBytes, formatTime } from '@/lib/format';
import { copyTextToClipboard } from '@/lib/clipboard';
import {
  getProviderApiKey,
  getProviderLabel,
  needsLlmKey,
  streamFeedback,
  testLlmProviderConnection,
  transcribeAudio
} from '@/lib/providers';
import { findActiveSegmentId, seekPlayerToSegment } from '@/lib/playback';
import { getDefaultLlmModel, getLlmModelOptions, isKnownLlmModel } from '@/lib/model-options';
import { defaultSettings, loadSettings, saveSettings } from '@/lib/storage';
import type { AppSettings, FeedbackDraft, JobStatus, LlmProvider, MediaJob, TranscriptSegment } from '@/lib/types';

type AppPage = 'workspace' | 'settings';
type Lang = AppSettings['appearance']['language'];

const acceptedTypes = ['audio/', 'video/'];

const fontOptions = [
  { label: 'Inter / System', value: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Inter, ui-sans-serif, system-ui, sans-serif' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", "JetBrains Mono NL", "SFMono-Regular", Consolas, ui-monospace, monospace' },
  { label: 'JetBrains Sans', value: '"JetBrains Sans", Inter, ui-sans-serif, system-ui, sans-serif' },
  { label: 'HarmonyOS Sans', value: '"HarmonyOS Sans", "HarmonyOS Sans SC", "Microsoft YaHei", "PingFang SC", ui-sans-serif, system-ui, sans-serif' },
  { label: 'HarmonyOS Sans SC', value: '"HarmonyOS Sans SC", "HarmonyOS Sans", "Microsoft YaHei", "PingFang SC", ui-sans-serif, system-ui, sans-serif' },
  { label: 'HarmonyOS Sans Mono', value: '"HarmonyOS Sans Mono", "JetBrains Mono", "SFMono-Regular", Consolas, ui-monospace, monospace' },
  { label: 'Cascadia Code', value: '"Cascadia Code", "Cascadia Mono", Consolas, ui-monospace, monospace' },
  { label: 'Fira Code', value: '"Fira Code", "JetBrains Mono", Consolas, ui-monospace, monospace' },
  { label: 'Source Code Pro', value: '"Source Code Pro", "JetBrains Mono", Consolas, ui-monospace, monospace' },
  { label: 'Menlo', value: 'Menlo, Monaco, Consolas, ui-monospace, monospace' },
  { label: 'Microsoft YaHei', value: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif' },
  { label: 'PingFang SC', value: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif' },
  { label: 'Noto Sans SC', value: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", ui-sans-serif, system-ui, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'System Mono', value: '"SFMono-Regular", Consolas, ui-monospace, monospace' }
];

const themeColors = ['#6366f1', '#007aff', '#af52de', '#ff2d55', '#ff9500', '#34c759', '#30b0c7'];

const copy = {
  zh: {
    app: 'IELTS Speaking Copilot',
    ready: 'Ready',
    missing: 'Missing',
    configNeeded: 'Config Needed',
    workspace: '批改工作台',
    settings: '偏好设置',
    desktopMvp: 'Desktop MVP',
    workflow: 'Local review workflow',
    settingsSubtitle: 'Provider and appearance settings',
    mediaConsole: 'Media Console',
    mediaHelp: '拖入本地音视频，载入后可播放核对并发起 ASR。',
    chooseFile: '选择文件',
    startTranscription: '开始转录',
    transcribingButton: '转录中...',
    uploadTitle: '拖拽上传音频或视频文件',
    uploadDesc: '支持 MP3、M4A、WAV、MP4、MOV 等常见格式。当前 MVP 默认处理单个文件。',
    browseFile: '浏览本地文件',
    size: '大小',
    type: '类型',
    duration: '时长',
    status: '状态',
    reading: '读取中',
    retry: '重试',
    chooseAgain: '重新选择',
    transcription: 'AI Transcription',
    transcriptionHelp: '点击片段可跳转并播放对应时间。',
    pendingTranscription: 'Content pending transcription',
    critique: 'AI Critique',
    critiqueHelp: '生成后可直接编辑，复制以当前文本为准。',
    generateFeedback: '生成反馈',
    generatingButton: '生成中...',
    copy: '复制',
    copied: '已复制',
    feedbackPlaceholder: 'AI 反馈会显示在这里。你可以在生成后直接编辑最终版本。',
    appearance: 'Appearance',
    appearanceHelp: '调整工作台的字体、字号、主题色和界面语言。',
    font: '字体',
    fontSize: '字体大小',
    themeColor: '主题颜色',
    language: '界面语言',
    providerSettings: 'Provider Settings',
    providerHelp: '先选择 LLM 提供商，再填写对应 API Key。Mock 模式不需要 Key。',
    llmProvider: 'LLM 提供商',
    llmModel: 'LLM 模型',
    apiKey: 'API Key',
    apiKeyFor: (provider: string) => `${provider} API Key`,
    testConnection: '测试连接',
    testing: '测试中...',
    providerReady: 'Provider Ready',
    providerMissing: 'Provider Missing',
    maxFileMb: '最大文件 MB',
    maxDurationMinutes: '最大时长 分钟',
    tempLocalStorage: '临时保存在本地浏览器存储',
    testOk: (provider: string) => `${provider} 连接测试成功。`,
    testFail: (provider: string, reason: string) => `${provider} 连接测试失败：${reason}`,
    mockOk: 'Mock provider 不需要 API Key，连接测试通过。',
    needApiKey: (provider: string) => `请先填写 ${provider} API Key。`,
    copiedMessage: '已复制当前编辑区的最终反馈。',
    noFeedbackMessage: '没有可复制的反馈内容。',
    clipboardError: '复制失败。请检查系统剪贴板权限。',
    initialMessage: '导入本地音频或视频，开始 V0.1 批改流程。',
    unsupportedFile: '当前文件格式不支持。请导入音频或视频文件。',
    loadedMessage: '媒体已导入。可先播放核对，或开始转录。',
    importFirst: '请先导入一个媒体文件。',
    mediaStateError: '媒体文件状态异常，请重新拖拽导入。',
    feedbackFirst: '请先完成转录，再生成反馈。',
    feedbackDone: '反馈已生成。请编辑确认后复制。',
    transcriptionFailed: '转录失败。',
    feedbackFailed: '反馈生成失败。',
    mediaPlaybackFailed: '媒体无法播放。请确认文件未损坏，或重新选择常见音视频格式。',
    mediaOverLimit: '当前媒体超过限制。',
    fileTooLarge: (size: string, limit: number) => `当前文件大小为 ${size}，超过 V0.1 限制 ${limit} MB。请先选择更短的音视频文件。`,
    durationTooLong: (duration: string, limit: string) => `当前媒体时长为 ${duration}，超过 V0.1 限制 ${limit}。请先选择更短的音视频文件。`,
    providerWorking: (provider: string, task: string) => `${provider} 正在${task}。`,
    providerDone: (provider: string, count: number) => `${provider} 转录完成，共 ${count} 段。`,
    statuses: {
      idle: '等待导入',
      loaded: '媒体已载入',
      transcribing: '转录中',
      transcribed: '转录完成',
      generating: '反馈生成中',
      ready: '可复制',
      failed: '处理失败'
    } satisfies Record<JobStatus, string>
  },
  en: {
    app: 'IELTS Speaking Copilot',
    ready: 'Ready',
    missing: 'Missing',
    configNeeded: 'Config Needed',
    workspace: 'Workspace',
    settings: 'Settings',
    desktopMvp: 'Desktop MVP',
    workflow: 'Local review workflow',
    settingsSubtitle: 'Provider and appearance settings',
    mediaConsole: 'Media Console',
    mediaHelp: 'Drop local audio or video, then review playback before ASR.',
    chooseFile: 'Choose file',
    startTranscription: 'Start transcription',
    transcribingButton: 'Transcribing...',
    uploadTitle: 'Drop an audio or video file',
    uploadDesc: 'Supports MP3, M4A, WAV, MP4, MOV, and other common formats. The MVP handles one file at a time.',
    browseFile: 'Browse local file',
    size: 'Size',
    type: 'Type',
    duration: 'Duration',
    status: 'Status',
    reading: 'Reading',
    retry: 'Retry',
    chooseAgain: 'Choose again',
    transcription: 'AI Transcription',
    transcriptionHelp: 'Click a segment to seek and play that timestamp.',
    pendingTranscription: 'Content pending transcription',
    critique: 'AI Critique',
    critiqueHelp: 'Generated feedback is editable; copy uses the current text.',
    generateFeedback: 'Generate feedback',
    generatingButton: 'Generating...',
    copy: 'Copy',
    copied: 'Copied',
    feedbackPlaceholder: 'AI feedback appears here. You can edit the final version after generation.',
    appearance: 'Appearance',
    appearanceHelp: 'Adjust font, font size, theme color, and interface language.',
    font: 'Font',
    fontSize: 'Font size',
    themeColor: 'Theme color',
    language: 'Interface language',
    providerSettings: 'Provider Settings',
    providerHelp: 'Choose an LLM provider first, then enter that provider API key. Mock needs no key.',
    llmProvider: 'LLM Provider',
    llmModel: 'LLM Model',
    apiKey: 'API Key',
    apiKeyFor: (provider: string) => `${provider} API Key`,
    testConnection: 'Test connection',
    testing: 'Testing...',
    providerReady: 'Provider Ready',
    providerMissing: 'Provider Missing',
    maxFileMb: 'Max file MB',
    maxDurationMinutes: 'Max duration minutes',
    tempLocalStorage: 'Temporarily stored in local browser storage',
    testOk: (provider: string) => `${provider} connection test succeeded.`,
    testFail: (provider: string, reason: string) => `${provider} connection test failed: ${reason}`,
    mockOk: 'Mock provider needs no API key. Connection test passed.',
    needApiKey: (provider: string) => `Please enter the ${provider} API Key first.`,
    copiedMessage: 'Copied the current final feedback text.',
    noFeedbackMessage: 'There is no feedback content to copy.',
    clipboardError: 'Copy failed. Check system clipboard permissions.',
    initialMessage: 'Import local audio or video to start the V0.1 review workflow.',
    unsupportedFile: 'Unsupported file format. Please import an audio or video file.',
    loadedMessage: 'Media imported. Review playback or start transcription.',
    importFirst: 'Please import a media file first.',
    mediaStateError: 'Media file state is invalid. Please drag it in again.',
    feedbackFirst: 'Complete transcription before generating feedback.',
    feedbackDone: 'Feedback generated. Edit and confirm before copying.',
    transcriptionFailed: 'Transcription failed.',
    feedbackFailed: 'Feedback generation failed.',
    mediaPlaybackFailed: 'Media playback failed. Check that the file is not damaged, or choose a common audio/video format.',
    mediaOverLimit: 'The current media exceeds the limit.',
    fileTooLarge: (size: string, limit: number) => `Current file size is ${size}, exceeding the V0.1 limit of ${limit} MB. Please choose a shorter media file.`,
    durationTooLong: (duration: string, limit: string) => `Current media duration is ${duration}, exceeding the V0.1 limit of ${limit}. Please choose a shorter media file.`,
    providerWorking: (provider: string, task: string) => `${provider} is ${task}.`,
    providerDone: (provider: string, count: number) => `${provider} transcription complete, ${count} segments.`,
    statuses: {
      idle: 'Waiting for import',
      loaded: 'Media loaded',
      transcribing: 'Transcribing',
      transcribed: 'Transcribed',
      generating: 'Generating feedback',
      ready: 'Ready to copy',
      failed: 'Failed'
    } satisfies Record<JobStatus, string>
  }
};

type Copy = typeof copy.zh;

function createJob(file: File): MediaJob {
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    fileType: file.type || 'unknown',
    fileSize: file.size,
    duration: null,
    status: 'loaded',
    errorMessage: null
  };
}

function hasRequiredSettings(settings: AppSettings): boolean {
  const llmReady = settings.llmModel.trim() && (!needsLlmKey(settings) || getProviderApiKey(settings, settings.llmProvider));
  return Boolean(llmReady);
}

function isMediaLimitError(message: string | null): boolean {
  return Boolean(message?.includes('V0.1') || message?.includes('限制') || message?.includes('limit'));
}

function clampPositiveNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getFileKindLabel(kind: 'audio' | 'video' | null): string {
  return kind === 'audio' ? 'Audio' : kind === 'video' ? 'Video' : 'Media';
}

function getTextScale(size: AppSettings['appearance']['fontSize']): string {
  return {
    small: 'font-scale-small',
    medium: 'font-scale-medium',
    large: 'font-scale-large'
  }[size];
}

export default function Home() {
  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const runIdRef = useRef(0);
  const [currentPage, setCurrentPage] = useState<AppPage>('workspace');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<'audio' | 'video' | null>(null);
  const [job, setJob] = useState<MediaJob | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackDraft>({ content: '', source: 'ai' });
  const [message, setMessage] = useState(copy.zh.initialMessage);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const lang = settings.appearance.language;
  const t = copy[lang];
  const settingsReady = useMemo(() => hasRequiredSettings(settings), [settings]);
  const status = job?.status ?? 'idle';
  const isBusy = status === 'transcribing' || status === 'generating';

  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((loaded) => {
      if (cancelled) return;
      const normalized = isKnownLlmModel(loaded.llmProvider, loaded.llmModel)
        ? loaded
        : { ...loaded, llmModel: getDefaultLlmModel(loaded.llmProvider) };
      setSettings(normalized);
      if (normalized !== loaded) {
        void saveSettings(normalized);
      }
      setMessage(copy[normalized.appearance.language].initialMessage);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  function updateSettings(updater: (current: AppSettings) => AppSettings) {
    setSettings((current) => {
      const next = updater(current);
      void saveSettings(next);
      return next;
    });
  }

  function updateJob(partial: Partial<MediaJob>) {
    setJob((current) => (current ? { ...current, ...partial } : current));
  }

  function handleSettingsChange(field: 'llmModel', value: string) {
    updateSettings((current) => ({ ...current, [field]: value }));
  }

  function handleLlmProviderChange(provider: LlmProvider) {
    updateSettings((current) => ({ ...current, llmProvider: provider, llmModel: getDefaultLlmModel(provider) }));
  }

  function handleApiKeyChange(provider: keyof AppSettings['apiKeys'], value: string) {
    updateSettings((current) => ({ ...current, apiKeys: { ...current.apiKeys, [provider]: value } }));
  }

  function handleLimitChange(field: keyof AppSettings['limits'], value: string) {
    updateSettings((current) => ({
      ...current,
      limits: { ...current.limits, [field]: clampPositiveNumber(value, current.limits[field]) }
    }));
  }

  function handleAppearanceChange(nextAppearance: Partial<AppSettings['appearance']>) {
    updateSettings((current) => ({ ...current, appearance: { ...current.appearance, ...nextAppearance } }));
    if (nextAppearance.language) {
      setMessage(copy[nextAppearance.language].initialMessage);
    }
  }

  async function testProviderConnection() {
    const provider = settings.llmProvider;
    const providerLabel = getProviderLabel(provider);

    if (provider === 'mock') {
      window.alert(t.mockOk);
      return;
    }

    const apiKey = settings.apiKeys[provider].trim();
    if (!apiKey) {
      window.alert(t.needApiKey(providerLabel));
      return;
    }

    setIsTestingConnection(true);
    try {
      await testLlmProviderConnection(provider, apiKey, settings.llmModel);
      window.alert(t.testOk(providerLabel));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      window.alert(t.testFail(providerLabel, reason));
    } finally {
      setIsTestingConnection(false);
    }
  }

  function loadFile(file: File) {
    if (!acceptedTypes.some((type) => file.type.startsWith(type))) {
      setMessage(t.unsupportedFile);
      return;
    }

    const maxMediaFileSize = settings.limits.maxFileSizeMb * 1024 * 1024;
    if (file.size > maxMediaFileSize) {
      setMessage(t.fileTooLarge(formatBytes(file.size), settings.limits.maxFileSizeMb));
      return;
    }

    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setMediaFile(file);
    setFileUrl(nextUrl);
    setMediaKind(file.type.startsWith('video/') ? 'video' : 'audio');
    setJob(createJob(file));
    setSegments([]);
    setActiveSegmentId(null);
    setFeedback({ content: '', source: 'ai' });
    setCopied(false);
    runIdRef.current += 1;
    setMessage(t.loadedMessage);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (file) {
      loadFile(file);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.item(0);
    if (file) {
      loadFile(file);
    }
    event.target.value = '';
  }

  function handleMetadataLoaded() {
    const duration = playerRef.current?.duration;
    if (duration && Number.isFinite(duration)) {
      const maxMediaDuration = settings.limits.maxDurationMinutes * 60;
      if (duration > maxMediaDuration) {
        const errorMessage = t.durationTooLong(formatTime(duration), formatTime(maxMediaDuration));
        updateJob({ duration, status: 'failed', errorMessage });
        setMessage(errorMessage);
        return;
      }
      updateJob({ duration, errorMessage: null });
    }
  }

  function handleMediaError() {
    updateJob({ status: 'failed', errorMessage: t.mediaPlaybackFailed });
    setMessage(t.mediaPlaybackFailed);
  }

  async function startTranscription() {
    if (!job) {
      setMessage(t.importFirst);
      return;
    }
    if (job.status === 'failed' && isMediaLimitError(job.errorMessage)) {
      setMessage(job.errorMessage ?? t.mediaOverLimit);
      return;
    }
    if (!mediaFile) {
      setMessage(t.mediaStateError);
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    updateJob({ status: 'transcribing', errorMessage: null });
    setMessage(t.providerWorking(getProviderLabel(settings.asrProvider), lang === 'zh' ? '转录媒体' : 'transcribing media'));

    try {
      const nextSegments = await transcribeAudio(mediaFile, settings, job.duration);
      if (runId !== runIdRef.current) return;
      setSegments(nextSegments);
      updateJob({ status: 'transcribed' });
      setMessage(t.providerDone(getProviderLabel(settings.asrProvider), nextSegments.length));
    } catch (error) {
      if (runId !== runIdRef.current) return;
      const errorMessage = error instanceof Error ? error.message : t.transcriptionFailed;
      updateJob({ status: 'failed', errorMessage });
      setMessage(errorMessage);
    }
  }

  function seekTo(segment: TranscriptSegment) {
    const player = playerRef.current;
    if (!player) return;
    setActiveSegmentId(seekPlayerToSegment(player, segment));
  }

  function handleTimeUpdate() {
    const currentTime = playerRef.current?.currentTime ?? 0;
    setActiveSegmentId(findActiveSegmentId(segments, currentTime));
  }

  async function generateFeedback() {
    if (segments.length === 0) {
      setMessage(t.feedbackFirst);
      return;
    }

    const previousFeedback = feedback;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setFeedback({ content: '', source: 'ai' });
    setCopied(false);
    updateJob({ status: 'generating', errorMessage: null });
    setMessage(t.providerWorking(getProviderLabel(settings.llmProvider), lang === 'zh' ? '生成反馈' : 'generating feedback'));

    try {
      let content = '';
      for await (const chunk of streamFeedback(segments, settings)) {
        if (runId !== runIdRef.current) return;
        content += chunk;
        setFeedback({ content, source: 'ai' });
      }
      updateJob({ status: 'ready' });
      setMessage(t.feedbackDone);
    } catch (error) {
      if (runId !== runIdRef.current) return;
      const errorMessage = error instanceof Error ? error.message : t.feedbackFailed;
      if (previousFeedback.content) {
        setFeedback(previousFeedback);
      }
      updateJob({ status: 'failed', errorMessage });
      setMessage(errorMessage);
    }
  }

  async function copyFeedback() {
    if (!feedback.content.trim()) {
      setMessage(t.noFeedbackMessage);
      return;
    }
    try {
      await copyTextToClipboard(feedback.content);
      setCopied(true);
      setMessage(t.copiedMessage);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage(t.clipboardError);
    }
  }

  return (
    <main
      className={`relative h-screen overflow-hidden bg-[#1a1c2c] text-slate-100 ${getTextScale(settings.appearance.fontSize)}`}
      style={{ '--accent': settings.appearance.themeColor, fontFamily: settings.appearance.fontFamily } as React.CSSProperties}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,color-mix(in_srgb,var(--accent)_30%,transparent),transparent_32%),radial-gradient(circle_at_88%_88%,rgba(168,85,247,0.16),transparent_34%),linear-gradient(135deg,rgba(30,41,59,0.94),rgba(15,23,42,0.98))]" />
      <div className="relative z-10 flex h-full p-4 lg:p-6">
        <div className="glass flex min-h-0 w-full overflow-hidden rounded-[28px]">
          <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-black/20 p-6 lg:flex">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-lg font-black shadow-lg">IC</div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white">IELTS Copilot</h1>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${settingsReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">{settingsReady ? t.ready : t.configNeeded}</p>
                </div>
              </div>
            </div>
            <nav className="mt-10 space-y-2">
              <NavButton active={currentPage === 'workspace'} label={t.workspace} onClick={() => setCurrentPage('workspace')} />
              <NavButton active={currentPage === 'settings'} label={t.settings} onClick={() => setCurrentPage('settings')} />
            </nav>
            <div className="mt-auto border-t border-white/10 pt-4">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/30">
                <span>Version 0.1</span>
                <span>{t.desktopMvp}</span>
              </div>
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/10 px-4 lg:px-6">
              <div className="flex items-center gap-3">
                <div className="hidden gap-1.5 lg:flex">
                  <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                  <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90">{t.app}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">{currentPage === 'workspace' ? t.workflow : t.settingsSubtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-ghost" onClick={() => handleAppearanceChange({ language: lang === 'zh' ? 'en' : 'zh' })} type="button">
                  {lang === 'zh' ? 'EN' : '中文'}
                </button>
                <button className="btn-ghost lg:hidden" onClick={() => setCurrentPage(currentPage === 'workspace' ? 'settings' : 'workspace')} type="button">
                  {currentPage === 'workspace' ? t.settings : t.workspace}
                </button>
                {currentPage === 'workspace' ? (
                  <>
                    <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/45 sm:inline-flex">{getFileKindLabel(mediaKind)}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70">{t.statuses[status]}</span>
                  </>
                ) : (
                  <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${settingsReady ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                    {settingsReady ? t.providerReady : t.providerMissing}
                  </span>
                )}
              </div>
            </header>

            {currentPage === 'workspace' ? (
              <WorkspaceView
                activeSegmentId={activeSegmentId}
                copied={copied}
                copyFeedback={copyFeedback}
                feedback={feedback}
                fileInputRef={fileInputRef}
                fileUrl={fileUrl}
                generateFeedback={generateFeedback}
                handleDrop={handleDrop}
                handleFileSelect={handleFileSelect}
                handleMetadataLoaded={handleMetadataLoaded}
                handleMediaError={handleMediaError}
                handleTimeUpdate={handleTimeUpdate}
                isBusy={isBusy}
                isDragging={isDragging}
                job={job}
                mediaKind={mediaKind}
                message={message}
                playerRef={playerRef}
                seekTo={seekTo}
                segments={segments}
                setCopied={setCopied}
                setFeedback={setFeedback}
                setIsDragging={setIsDragging}
                settings={settings}
                startTranscription={startTranscription}
                status={status}
                t={t}
              />
            ) : (
              <SettingsView
                handleApiKeyChange={handleApiKeyChange}
                handleAppearanceChange={handleAppearanceChange}
                handleLimitChange={handleLimitChange}
                handleLlmProviderChange={handleLlmProviderChange}
                handleSettingsChange={handleSettingsChange}
                isTestingConnection={isTestingConnection}
                settings={settings}
                settingsReady={settingsReady}
                t={t}
                testProviderConnection={testProviderConnection}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

type WorkspaceProps = {
  activeSegmentId: string | null;
  copied: boolean;
  copyFeedback: () => void;
  feedback: FeedbackDraft;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  fileUrl: string | null;
  generateFeedback: () => void;
  handleDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleMetadataLoaded: () => void;
  handleMediaError: () => void;
  handleTimeUpdate: () => void;
  isBusy: boolean;
  isDragging: boolean;
  job: MediaJob | null;
  mediaKind: 'audio' | 'video' | null;
  message: string;
  playerRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
  seekTo: (segment: TranscriptSegment) => void;
  segments: TranscriptSegment[];
  setCopied: (copied: boolean) => void;
  setFeedback: (feedback: FeedbackDraft) => void;
  setIsDragging: (dragging: boolean) => void;
  settings: AppSettings;
  startTranscription: () => void;
  status: JobStatus;
  t: Copy;
};

function WorkspaceView(props: WorkspaceProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar lg:p-6">
      <div className="grid min-h-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(390px,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="glass-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--accent)]">{props.t.mediaConsole}</h2>
                <p className="mt-1 text-xs text-white/45">{props.t.mediaHelp}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => props.fileInputRef.current?.click()} type="button">{props.t.chooseFile}</button>
                <button className="btn-primary" onClick={props.startTranscription} disabled={!props.job || props.isBusy} type="button">
                  {props.status === 'transcribing' ? props.t.transcribingButton : props.t.startTranscription}
                </button>
              </div>
            </div>
            <input ref={props.fileInputRef} className="hidden" type="file" accept="audio/*,video/*,.mp3,.m4a,.wav,.mp4,.mov" onChange={props.handleFileSelect} />
            <div className="p-4">
              <div
                className={`media-drop flex min-h-[300px] flex-col items-center justify-center rounded-2xl border transition ${props.isDragging ? 'border-[var(--accent)] bg-white/10' : 'border-white/10 bg-black/30'}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  props.setIsDragging(true);
                }}
                onDragLeave={() => props.setIsDragging(false)}
                onDrop={props.handleDrop}
              >
                {!props.fileUrl ? (
                  <div className="flex max-w-md flex-col items-center px-6 text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl text-[var(--accent)]">↑</div>
                    <h3 className="text-base font-bold text-white">{props.t.uploadTitle}</h3>
                    <p className="mt-2 text-xs leading-6 text-white/40">{props.t.uploadDesc}</p>
                    <button className="mt-5 btn-primary" onClick={() => props.fileInputRef.current?.click()} type="button">{props.t.browseFile}</button>
                  </div>
                ) : props.mediaKind === 'video' ? (
                  <video ref={props.playerRef as React.RefObject<HTMLVideoElement>} src={props.fileUrl} controls onError={props.handleMediaError} onLoadedMetadata={props.handleMetadataLoaded} onTimeUpdate={props.handleTimeUpdate} />
                ) : (
                  <div className="flex w-full max-w-xl flex-col items-center gap-6 p-8">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/5 text-4xl text-white/35">♪</div>
                    <audio ref={props.playerRef as React.RefObject<HTMLAudioElement>} src={props.fileUrl ?? undefined} controls onError={props.handleMediaError} onLoadedMetadata={props.handleMetadataLoaded} onTimeUpdate={props.handleTimeUpdate} />
                  </div>
                )}
              </div>
              {props.job ? (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Metric label={props.t.size} value={formatBytes(props.job.fileSize)} />
                  <Metric label={props.t.type} value={props.job.fileType} />
                  <Metric label={props.t.duration} value={props.job.duration ? formatTime(props.job.duration) : props.t.reading} />
                  <Metric label={props.t.status} value={props.t.statuses[props.job.status]} />
                </div>
              ) : null}
              {props.job?.status === 'failed' && props.job.errorMessage ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  <span>{props.job.errorMessage}</span>
                  <button className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-100" onClick={isMediaLimitError(props.job.errorMessage) ? () => props.fileInputRef.current?.click() : props.startTranscription} type="button">
                    {isMediaLimitError(props.job.errorMessage) ? props.t.chooseAgain : props.t.retry}
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="glass-panel min-h-[320px] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--accent)]">{props.t.transcription}</h2>
                <p className="mt-1 text-xs text-white/45">{props.t.transcriptionHelp}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">{props.segments.length} segments</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-4 custom-scrollbar">
              {props.status === 'transcribing' ? (
                <LoadingPanel label="Transcribing media..." />
              ) : props.segments.length === 0 ? (
                <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">{props.t.pendingTranscription}</div>
              ) : (
                <div className="space-y-2">
                  {props.segments.map((segment) => (
                    <button key={segment.id} className={`group w-full rounded-xl border p-3 text-left transition ${props.activeSegmentId === segment.id ? 'border-[var(--accent)] bg-white/10' : 'border-transparent hover:border-white/10 hover:bg-white/5'}`} onClick={() => props.seekTo(segment)} type="button">
                      <span className="mr-3 font-mono text-[10px] font-bold text-white/45 group-hover:text-white/70">[{formatTime(segment.start)} - {formatTime(segment.end)}]</span>
                      <span className="text-sm leading-6 text-white/70 group-hover:text-white">{segment.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <section className="glass-panel flex min-h-[620px] flex-1 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--accent)]">{props.t.critique}</h2>
                <p className="mt-1 text-xs text-white/45">{props.t.critiqueHelp}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={props.generateFeedback} disabled={props.segments.length === 0 || props.isBusy} type="button">{props.status === 'generating' ? props.t.generatingButton : props.t.generateFeedback}</button>
                <button className="btn-primary" onClick={props.copyFeedback} type="button">{props.copied ? props.t.copied : props.t.copy}</button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1">
              {props.status === 'generating' && !props.feedback.content ? (
                <div className="absolute inset-0 z-10 bg-slate-950/35 backdrop-blur-sm"><LoadingPanel label="Generating critique..." fill /></div>
              ) : null}
              <textarea
                className="min-h-[500px] flex-1 resize-none border-0 bg-transparent p-5 text-sm leading-7 text-white/80 outline-none placeholder:text-white/25"
                value={props.feedback.content}
                onChange={(event) => {
                  props.setCopied(false);
                  props.setFeedback({ content: event.target.value, source: 'edited' });
                }}
                placeholder={props.t.feedbackPlaceholder}
              />
            </div>
            <footer className="flex min-h-10 items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/35">
              <span className="truncate normal-case tracking-normal text-white/45">{props.message}</span>
              <span className="shrink-0">Model: {props.settings.llmModel || 'unset'}</span>
            </footer>
          </section>
        </aside>
      </div>
    </div>
  );
}

type SettingsProps = {
  handleApiKeyChange: (provider: keyof AppSettings['apiKeys'], value: string) => void;
  handleAppearanceChange: (nextAppearance: Partial<AppSettings['appearance']>) => void;
  handleLimitChange: (field: keyof AppSettings['limits'], value: string) => void;
  handleLlmProviderChange: (provider: LlmProvider) => void;
  handleSettingsChange: (field: 'llmModel', value: string) => void;
  isTestingConnection: boolean;
  settings: AppSettings;
  settingsReady: boolean;
  t: Copy;
  testProviderConnection: () => void;
};

function SettingsView(props: SettingsProps) {
  const selectedProvider = props.settings.llmProvider;
  const selectedProviderLabel = getProviderLabel(selectedProvider);
  const selectedApiKey = selectedProvider === 'mock' ? '' : props.settings.apiKeys[selectedProvider];
  const modelOptions = getLlmModelOptions(selectedProvider, props.settings.llmModel);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar lg:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="glass-panel overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--accent)]">{props.t.appearance}</h2>
            <p className="mt-1 text-xs text-white/45">{props.t.appearanceHelp}</p>
          </div>
          <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
            <Field label={props.t.font}>
              <select className="glass-input" value={props.settings.appearance.fontFamily} onChange={(event) => props.handleAppearanceChange({ fontFamily: event.target.value })}>
                {fontOptions.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
              </select>
            </Field>
            <Field label={props.t.fontSize}>
              <div className="segmented-control">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button key={size} className={`choice-pill ${props.settings.appearance.fontSize === size ? 'choice-pill-active' : ''}`} onClick={() => props.handleAppearanceChange({ fontSize: size })} type="button">
                    {size}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={props.t.language}>
              <div className="segmented-control">
                {(['zh', 'en'] as const).map((language) => (
                  <button key={language} className={`choice-pill ${props.settings.appearance.language === language ? 'choice-pill-active' : ''}`} onClick={() => props.handleAppearanceChange({ language })} type="button">
                    {language === 'zh' ? '中文' : 'English'}
                  </button>
                ))}
              </div>
            </Field>
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/35">{props.t.themeColor}</p>
              <div className="flex flex-wrap gap-3">
                {themeColors.map((color) => (
                  <button key={color} className={`color-swatch ${props.settings.appearance.themeColor === color ? 'color-swatch-active' : ''}`} style={{ backgroundColor: color }} onClick={() => props.handleAppearanceChange({ themeColor: color })} type="button" aria-label={`${props.t.themeColor} ${color}`} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--accent)]">{props.t.providerSettings}</h2>
                <p className="mt-1 text-xs text-white/45">{props.t.providerHelp}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${props.settingsReady ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                {props.settingsReady ? props.t.ready : props.t.missing}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label={props.t.llmProvider}>
              <select className="glass-input" value={selectedProvider} onChange={(event) => props.handleLlmProviderChange(event.target.value as LlmProvider)}>
                <option value="mock">Mock</option>
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
                <option value="gemini">Gemini</option>
                <option value="nvidia">NVIDIA</option>
              </select>
            </Field>
            <Field label={props.t.llmModel}>
              <select className="glass-input" value={props.settings.llmModel} onChange={(event) => props.handleSettingsChange('llmModel', event.target.value)}>
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            {selectedProvider !== 'mock' ? (
              <Field label={props.t.apiKeyFor(selectedProviderLabel)} wide>
                <input className="glass-input" type="password" value={selectedApiKey} onChange={(event) => props.handleApiKeyChange(selectedProvider, event.target.value)} placeholder={props.t.tempLocalStorage} />
              </Field>
            ) : null}
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 p-4">
              <div>
                <p className="text-xs font-semibold text-white/80">{selectedProviderLabel}</p>
                <p className="mt-1 text-xs text-white/40">{selectedProvider === 'mock' ? props.t.mockOk : props.t.apiKeyFor(selectedProviderLabel)}</p>
              </div>
              <button className="btn-primary" onClick={props.testProviderConnection} disabled={props.isTestingConnection} type="button">
                {props.isTestingConnection ? props.t.testing : props.t.testConnection}
              </button>
            </div>
            <Field label={props.t.maxFileMb}>
              <input className="glass-input" type="number" min="1" step="1" value={props.settings.limits.maxFileSizeMb} onChange={(event) => props.handleLimitChange('maxFileSizeMb', event.target.value)} />
            </Field>
            <Field label={props.t.maxDurationMinutes}>
              <input className="glass-input" type="number" min="1" step="1" value={props.settings.limits.maxDurationMinutes} onChange={(event) => props.handleLimitChange('maxDurationMinutes', event.target.value)} />
            </Field>
          </div>
        </section>
      </div>
    </div>
  );
}

function NavButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`w-full rounded-xl px-4 py-3 text-left text-xs font-semibold transition ${active ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'text-white/45 hover:bg-white/5 hover:text-white/75'}`} onClick={onClick} type="button">
      <span className="flex items-center justify-between">{label}{active ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> : null}</span>
    </button>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`text-xs ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block font-bold uppercase tracking-widest text-white/35">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-white/75">{value}</p>
    </div>
  );
}

function LoadingPanel({ label, fill }: { label: string; fill?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${fill ? 'h-full' : 'min-h-[180px]'}`}>
      <div className="relative">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/10 border-t-[var(--accent)]" />
        <div className="absolute inset-0 flex items-center justify-center text-[var(--accent)]">*</div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">{label}</p>
    </div>
  );
}
