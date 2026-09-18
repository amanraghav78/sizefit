/**
 * Phase 4: the §8 screens, translated, with the housekeeping §10 and §5.3 ask
 * for — cache sweeps, a low-disk guard, and clean cancellation when the app
 * goes to the background mid-compression.
 *
 * Navigation is a plain state machine rather than a router — five screens with
 * one linear path do not need the dependency, and Home must stay one tap from
 * the picker.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { compress } from './src/core/compress';
import { buildSizedPdf } from './src/core/pdfBuilder';
import { compressPdf } from './src/core/pdfCompress';
import { detectFormat } from './src/core/sniff';
import { CompressError } from './src/core/errors';
import type { CompressRequest, CompressResult, ImageCodec, Rotation } from './src/core/types';
import { clearRecents, loadRecents, rememberTarget, type RecentTarget } from './src/data/recentStore';
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  type Settings,
} from './src/data/settingsStore';
import {
  defaultTarget,
  describeTarget,
  targetToRequest,
  type TargetSpec,
} from './src/data/sizeOptions';
import { createTranslate, resolveLanguage, type LanguagePreference } from './src/i18n';
import { createCodec } from './src/platform/createCodec';
import { clearTempFiles, freeDiskBytes, isLowOnDisk } from './src/platform/maintenance';
import { savePdf } from './src/platform/savePdf';
import { saveOutput } from './src/platform/saveOutput';
import { writeDocument } from './src/platform/writeDocument';
import { shareOutput } from './src/platform/shareOutput';
import { BatchScreen, type BatchItem, type PdfOutcome } from './src/screens/BatchScreen';
import { DocumentScreen, type DocumentOutcome } from './src/screens/DocumentScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PreviewScreen, type ManualPreview, type SourceInfo } from './src/screens/PreviewScreen';
import { ResultScreen } from './src/screens/ResultScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TargetScreen } from './src/screens/TargetScreen';
import { Toast } from './src/ui/components';
import { errorFeedback, successFeedback, tapFeedback } from './src/ui/haptics';
import { Screen } from './src/ui/Screen';
import { Shell } from './src/ui/Shell';
import { formatSize } from './src/ui/format';
import { darkTheme, lightTheme, spacing } from './src/ui/theme';

type Screen = 'home' | 'target' | 'preview' | 'batch' | 'document' | 'result' | 'settings';

const APP_VERSION = '0.1.0';
/** §10: sweep leftover working files on this cadence while the app is open. */
const CACHE_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export default function App() {
  return (
    <SafeAreaProvider>
      <SizeFit />
    </SafeAreaProvider>
  );
}

function SizeFit() {
  const theme = useColorScheme() === 'dark' ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const t = useMemo(() => createTranslate(resolveLanguage(settings.language)), [settings.language]);

  const [screen, setScreen] = useState<Screen>('home');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [recents, setRecents] = useState<RecentTarget[]>([]);
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [pendingTarget, setPendingTarget] = useState<TargetSpec>(defaultTarget);

  const [request, setRequest] = useState<CompressRequest | null>(null);
  const [targetLabel, setTargetLabel] = useState('');
  const [result, setResult] = useState<CompressResult | null>(null);
  const [manual, setManual] = useState<ManualPreview | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  // Batch (§12 Phase 5). A single file keeps the Preview path; two or more get
  // the list, because per-file status is the thing that matters there.
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [pdf, setPdf] = useState<PdfOutcome | null>(null);

  // A PDF source takes a separate path: it is never decoded as an image, so it
  // has no SourceInfo and no Preview.
  const [documentSource, setDocumentSource] = useState<{ uri: string; bytes: number } | null>(null);
  const [documentResult, setDocumentResult] = useState<DocumentOutcome | null>(null);

  // Rotation is a view on the source, not a separate edit: changing it re-runs
  // the search so the size guarantee still holds for the rotated image.
  const [rotation, setRotation] = useState<Rotation>(0);
  const [rotating, setRotating] = useState(false);

  // One codec per run: it owns the temp files and the decoded source, and must
  // stay alive while Preview lets the user re-encode.
  const codecRef = useRef<ImageCodec | null>(null);
  // §5.3: a compression in flight is abandoned if the app is backgrounded.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void loadRecents().then(setRecents);
    // §10: clear anything a previous run left behind.
    void clearTempFiles();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void clearTempFiles(), CACHE_SWEEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      // Cancel cleanly rather than letting work continue against a suspended
      // process; the temp files go with it.
      abortRef.current?.abort();
    });
    return () => subscription.remove();
  }, []);

  const releaseCodec = useCallback(async (keepUri?: string) => {
    const codec = codecRef.current;
    codecRef.current = null;
    if (codec) await codec.dispose(keepUri);
  }, []);

  const startWith = useCallback(
    async (uri: string, label: string, startingTarget?: TargetSpec) => {
      setError(null);
      await releaseCodec();

      // §5.3: warn before doing work that needs room to write.
      if (isLowOnDisk()) {
        const free = freeDiskBytes();
        setError(t('error.lowDisk', { free: free === null ? '—' : formatSize(free) }));
      }

      const codec = createCodec();
      codecRef.current = codec;
      try {
        // A PDF must be recognised before `probe`, which decodes as an image
        // and would throw on a document. The header is the only reliable tell:
        // a file picked as ".pdf" can be anything.
        const head = await codec.readBytes(uri);
        if (detectFormat(head.subarray(0, 64)) === 'pdf') {
          setSource(null);
          setDocumentResult(null);
          setDocumentSource({ uri, bytes: head.length });
          setSourceLabel(`${label} · ${formatSize(head.length)}`);
          setPendingTarget(startingTarget ?? defaultTarget);
          setScreen('target');
          return;
        }
        setDocumentSource(null);

        const probe = await codec.probe(uri);
        setSource({ uri, bytes: probe.bytes, width: probe.width, height: probe.height });
        setSourceLabel(`${label} · ${formatSize(probe.bytes)}`);
        setPendingTarget(startingTarget ?? defaultTarget);
        setScreen('target');
      } catch (cause) {
        await releaseCodec();
        setError(explain(cause, t));
      }
    },
    [releaseCodec, t],
  );

  /** Two or more files: probe each, then go to the target screen as a batch. */
  const startBatch = useCallback(
    async (files: Array<{ uri: string; name: string }>, startingTarget?: TargetSpec) => {
      setError(null);
      await releaseCodec();
      setPdf(null);

      const codec = createCodec();
      codecRef.current = codec;

      const items: BatchItem[] = [];
      for (const file of files) {
        try {
          const probe = await codec.probe(file.uri);
          items.push({
            sourceUri: file.uri,
            name: file.name,
            sourceBytes: probe.bytes,
            result: null,
            error: null,
          });
        } catch (cause) {
          // One unreadable file must not sink the whole selection.
          items.push({
            sourceUri: file.uri,
            name: file.name,
            sourceBytes: 0,
            result: null,
            error: explain(cause, t),
          });
        }
      }

      if (items.every((item) => item.error !== null)) {
        await releaseCodec();
        setError(t('error.corruptInput'));
        return;
      }

      setBatch(items);
      setSource(null);
      setSourceLabel(t('batch.title', { count: items.length }));
      setPendingTarget(startingTarget ?? defaultTarget);
      setScreen('target');
    },
    [releaseCodec, t],
  );

  const pickImage = useCallback(
    async (startingTarget?: TargetSpec) => {
      setBusy(true);
      try {
        const picked = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
          exif: false,
          allowsMultipleSelection: true,
        });
        if (picked.canceled || picked.assets.length === 0) return;

        if (picked.assets.length === 1) {
          const asset = picked.assets[0]!;
          await startWith(asset.uri, asset.fileName ?? 'Photo', startingTarget);
          return;
        }
        await startBatch(
          picked.assets.map((asset, index) => ({
            uri: asset.uri,
            name: asset.fileName ?? `Photo ${index + 1}`,
          })),
          startingTarget,
        );
      } catch (cause) {
        setError(explain(cause, t));
      } finally {
        setBusy(false);
      }
    },
    [startWith, startBatch, t],
  );

  const pickFile = useCallback(async () => {
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      await startWith(asset.uri, asset.name ?? 'File');
    } catch (cause) {
      setError(explain(cause, t));
    } finally {
      setBusy(false);
    }
  }, [startWith, t]);

  /**
   * The PDF path. It shares the Target screen with images but nothing after
   * it: there is no decoded source to preview and no quality slider, because
   * the document's size is the sum of many images rather than one dial.
   */
  const runDocumentCompression = useCallback(
    async (target: TargetSpec) => {
      const codec = codecRef.current;
      if (!codec || !documentSource) {
        setError(t('error.fileGone'));
        setScreen('home');
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setError(null);
      try {
        const maxBytes = Math.round(target.maxKB * 1024);
        const outcome = await compressPdf(
          {
            sourceUri: documentSource.uri,
            minBytes: target.minKB === null ? null : Math.round(target.minKB * 1024),
            maxBytes,
          },
          codec,
          { signal: controller.signal },
        );

        const uri = await writeDocument(outcome.bytes, 'pdf');
        setDocumentResult({
          uri,
          sourceBytes: documentSource.bytes,
          finalBytes: outcome.finalBytes,
          pageCount: outcome.pageCount,
          imagesRecompressed: outcome.imagesRecompressed,
          imagesSkipped: outcome.imagesSkipped,
          status: outcome.status,
        });
        if (outcome.finalBytes <= maxBytes) successFeedback();
        else errorFeedback();
        setTargetLabel(describeTarget(target, t));
        setPendingTarget(target);
        setScreen('document');
        setRecents(await rememberTarget(target));
      } catch (cause) {
        setError(explain(cause, t));
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [documentSource, t],
  );

  const saveDocument = useCallback(async () => {
    if (!documentResult) return;
    setSaving(true);
    try {
      const outcome = await savePdf(documentResult.uri);
      if (outcome.ok) {
        setSavedMessage(t('result.downloaded'));
        setScreen('result');
        return;
      }
      setError(
        outcome.reason === 'unavailable'
          ? t('error.shareUnavailable')
          : t('error.saveFailed', { detail: outcome.detail ?? '' }),
      );
    } finally {
      setSaving(false);
    }
  }, [documentResult, t]);

  const runCompression = useCallback(
    async (target: TargetSpec, turn: Rotation = 0) => {
      const codec = codecRef.current;
      if (!codec || !source) {
        setError(t('error.fileGone'));
        setScreen('home');
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setBusy(true);
      setError(null);
      setManual(null);
      try {
        const nextRequest = targetToRequest(target, source.uri);
        const compressed = await compress(nextRequest, codec, {
          signal: controller.signal,
          rotate: turn,
        });
        setRequest(nextRequest);
        setResult(compressed);
        if (compressed.status === 'exact') successFeedback();
        else errorFeedback();
        setTargetLabel(describeTarget(target, t));
        setPendingTarget(target);
        setScreen('preview');
        setRecents(await rememberTarget(target));
      } catch (cause) {
        setError(explain(cause, t));
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [source, t],
  );

  /**
   * Batch run (§12 Phase 5). Files are processed one at a time on purpose: the
   * codec keeps a decoded source warm, and running several in parallel would
   * hold several full-size bitmaps at once on a phone that may have 4GB.
   */
  const runBatch = useCallback(
    async (target: TargetSpec) => {
      const codec = codecRef.current;
      if (!codec) {
        setError(t('error.fileGone'));
        setScreen('home');
        return;
      }

      const usable = batch.filter((item) => item.error === null);
      const controller = new AbortController();
      abortRef.current = controller;

      setBusy(true);
      setError(null);
      setPdf(null);
      setTargetLabel(describeTarget(target, t));
      setScreen('batch');

      try {
        if (target.output === 'pdf') {
          setBatchProgress({ done: 0, total: usable.length });
          const built = await buildSizedPdf(
            {
              sourceUris: usable.map((item) => item.sourceUri),
              imageRequest: targetToRequest(target, ''),
              maxPdfBytes: Math.round(target.maxKB * 1024),
              options: { pageSize: target.pdfPageSize },
            },
            codec,
          );

          setBatch((current) =>
            current.map((item) => {
              const index = usable.findIndex((u) => u.sourceUri === item.sourceUri);
              return index === -1 ? item : { ...item, result: built.perImage[index] ?? null };
            }),
          );

          const uri = await writeDocument(built.bytes, 'pdf');
          setPdf({
            uri,
            bytes: built.bytes.length,
            pages: built.perImage.length,
            overLimit: built.status === 'best_effort_over',
          });
        } else {
          let done = 0;
          setBatchProgress({ done, total: usable.length });
          for (const item of usable) {
            try {
              const result = await compress(targetToRequest(target, item.sourceUri), codec, {
                signal: controller.signal,
              });
              setBatch((current) =>
                current.map((row) => (row.sourceUri === item.sourceUri ? { ...row, result } : row)),
              );
            } catch (cause) {
              const message = explain(cause, t);
              setBatch((current) =>
                current.map((row) =>
                  row.sourceUri === item.sourceUri ? { ...row, error: message } : row,
                ),
              );
            }
            done += 1;
            setBatchProgress({ done, total: usable.length });
          }
        }
        setRecents(await rememberTarget(target));
        setPendingTarget(target);
        successFeedback();
      } catch (cause) {
        setError(explain(cause, t));
      } finally {
        abortRef.current = null;
        setBatchProgress(null);
        setBusy(false);
      }
    },
    [batch, t],
  );

  /**
   * Manual override (§8.3). Re-encodes at one fixed quality through the same
   * codec — the search is not re-run, because the user is overriding it.
   */
  const previewQuality = useCallback(
    async (quality: number) => {
      const codec = codecRef.current;
      if (!codec || !request || !result || !source) return;
      setManualBusy(true);
      try {
        const rendered = await codec.render({
          sourceUri: source.uri,
          width: result.finalWidth,
          height: result.finalHeight,
          format: request.format,
          quality,
          flattenBackground: '#FFFFFF',
          rotate: rotation,
        });
        setManual({ uri: rendered.uri, bytes: rendered.bytes, quality });
      } catch (cause) {
        setError(explain(cause, t));
      } finally {
        setManualBusy(false);
      }
    },
    [request, result, rotation, source, t],
  );

  /** Rotate and re-run, so the size guarantee still holds after the turn. */
  const applyRotation = useCallback(
    async (next: Rotation) => {
      tapFeedback();
      setRotation(next);
      setManual(null);
      setRotating(true);
      try {
        await runCompression(pendingTarget, next);
      } finally {
        setRotating(false);
      }
    },
    [pendingTarget, runCompression],
  );

  /**
   * The largest ceiling worth offering for what is selected. A single file is
   * measured against itself; a batch against its biggest member, because each
   * file must clear the limit on its own — except for a PDF, where the limit
   * applies to the one finished document, so the total is what counts.
   */
  const sourceCeilingKB = useMemo(() => {
    if (batch.length > 0) {
      const sizes = batch.map((item) => item.sourceBytes);
      const bytes =
        pendingTarget.output === 'pdf'
          ? sizes.reduce((sum, value) => sum + value, 0)
          : Math.max(...sizes, 0);
      return Math.max(1, Math.floor(bytes / 1024));
    }
    if (documentSource) return Math.max(1, Math.floor(documentSource.bytes / 1024));
    return Math.max(1, Math.floor((source?.bytes ?? 1024) / 1024));
  }, [batch, pendingTarget.output, source, documentSource]);

  const outputUri = manual?.uri ?? result?.outputUri ?? null;

  const save = useCallback(async () => {
    if (!outputUri) return;
    setSaving(true);
    try {
      const saved = await saveOutput(outputUri);
      if (saved.ok) {
        setSavedMessage(t(Platform.OS === 'web' ? 'result.downloaded' : 'result.savedToGallery'));
        setScreen('result');
      } else if (saved.reason === 'permission_denied') {
        setError(t('error.permissionDenied'));
      } else {
        setError(t('error.saveFailed', { detail: saved.detail ?? '' }));
      }
    } finally {
      setSaving(false);
    }
  }, [outputUri, t]);

  const share = useCallback(async () => {
    if (!outputUri) return;
    const shared = await shareOutput(outputUri);
    if (shared.ok) return;
    setError(
      shared.reason === 'unavailable'
        ? t(Platform.OS === 'web' ? 'error.shareWeb' : 'error.shareUnavailable')
        : t('error.saveFailed', { detail: shared.detail ?? '' }),
    );
  }, [outputUri, t]);

  const saveAll = useCallback(async () => {
    const done = batch.filter((item) => item.result !== null);
    if (done.length === 0) return;

    setSaving(true);
    try {
      let saved = 0;
      for (const item of done) {
        const outcome = await saveOutput(item.result!.outputUri);
        if (outcome.ok) saved += 1;
        else if (outcome.reason === 'permission_denied') {
          setError(t('error.permissionDenied'));
          return;
        }
      }
      const failed = done.length - saved;
      setSavedMessage(
        failed === 0
          ? t(Platform.OS === 'web' ? 'batch.downloadedAll' : 'batch.savedAll', { count: saved })
          : t('batch.savedSome', { saved, failed }),
      );
      setScreen('result');
    } finally {
      setSaving(false);
    }
  }, [batch, t]);

  const handlePdf = useCallback(
    async (share: boolean) => {
      if (!pdf) return;
      setSaving(true);
      try {
        const outcome = share ? await shareOutput(pdf.uri) : await savePdf(pdf.uri);
        if (outcome.ok) {
          setSavedMessage(t('batch.pdfSaved'));
          setScreen('result');
        } else if (outcome.reason === 'unavailable') {
          setError(t(Platform.OS === 'web' ? 'error.shareWeb' : 'error.shareUnavailable'));
        } else {
          setError(t('error.saveFailed', { detail: outcome.detail ?? '' }));
        }
      } finally {
        setSaving(false);
      }
    },
    [pdf, t],
  );

  const reset = useCallback(async () => {
    abortRef.current?.abort();
    await releaseCodec();
    setRotation(0);
    setBatch([]);
    setPdf(null);
    setDocumentSource(null);
    setDocumentResult(null);
    setBatchProgress(null);
    setSource(null);
    setRequest(null);
    setResult(null);
    setManual(null);
    setSavedMessage('');
    setError(null);
    setScreen('home');
  }, [releaseCodec]);

  const changeLanguage = useCallback((language: LanguagePreference) => {
    tapFeedback();
    setSettings((current) => {
      const next = { ...current, language };
      void saveSettings(next);
      return next;
    });
  }, []);

  return (
    <KeyboardAvoidingView
      // The Target screen's numeric fields sit above a sticky footer; without
      // this the keyboard covers both on iOS.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: theme.backgroundDeep }]}
    >
      {/* The hero is a dark saturated block, so the status bar sits on it in
          light content on Home and normal content elsewhere. */}
      <StatusBar style={screen === 'home' ? 'light' : theme.mode === 'dark' ? 'light' : 'dark'} />

      <Shell theme={theme}>
      <View style={{ height: screen === 'home' ? 0 : insets.top }} />
      <Screen screenKey={screen}>
      {screen === 'home' ? (
        <HomeScreen
          theme={theme}
          t={t}
          recents={recents}
          busy={busy}
          onPickPhoto={() => void pickImage()}
          onPickFile={() => void pickFile()}
          onPickRecent={(recent) => void pickImage(recent.target)}
          onOpenSettings={() => {
            setNotice(null);
            setScreen('settings');
          }}
        />
      ) : null}

      {screen === 'settings' ? (
        <SettingsScreen
          theme={theme}
          t={t}
          settings={settings}
          version={APP_VERSION}
          onChangeLanguage={changeLanguage}
          onClearCache={() => {
            tapFeedback();
            void clearTempFiles().then(() => setNotice(t('settings.cacheCleared')));
          }}
          onClearRecents={() => {
            tapFeedback();
            void clearRecents().then(() => {
              setRecents([]);
              setNotice(t('settings.recentsCleared'));
            });
          }}
          onBack={() => setScreen('home')}
        />
      ) : null}

      {screen === 'target' && (source || documentSource || batch.length > 0) ? (
        <TargetScreen
          theme={theme}
          t={t}
          sourceLabel={sourceLabel}
          initialTarget={pendingTarget}
          fileCount={batch.length > 0 ? batch.length : 1}
          documentMode={documentSource !== null}
          sourceKB={sourceCeilingKB}
          onBack={() => void reset()}
          onConfirm={(target) => {
            if (batch.length > 0) return void runBatch(target);
            if (documentSource) return void runDocumentCompression(target);
            return void runCompression(target);
          }}
        />
      ) : null}

      {screen === 'batch' ? (
        <BatchScreen
          theme={theme}
          t={t}
          items={batch}
          maxBytes={Math.round(pendingTarget.maxKB * 1024)}
          targetLabel={targetLabel}
          busy={busy}
          progress={batchProgress}
          pdf={pdf}
          saving={saving}
          onBack={() => setScreen('target')}
          onSaveAll={() => void saveAll()}
          onSavePdf={() => void handlePdf(Platform.OS !== 'web')}
          onSharePdf={() => void handlePdf(true)}
          onRemove={(sourceUri) =>
            setBatch((current) => current.filter((item) => item.sourceUri !== sourceUri))
          }
        />
      ) : null}

      {screen === 'preview' && source && request && result ? (
        <PreviewScreen
          theme={theme}
          t={t}
          source={source}
          request={request}
          result={result}
          targetLabel={targetLabel}
          manual={manual}
          manualBusy={manualBusy}
          rotation={rotation}
          rotating={rotating}
          onRotate={(next) => void applyRotation(next)}
          onQualityCommit={(quality) => void previewQuality(quality)}
          onResetManual={() => setManual(null)}
          onBack={() => setScreen('target')}
          onSave={() => void save()}
          onShare={() => void share()}
          saving={saving}
          bottomInset={insets.bottom}
        />
      ) : null}

      {screen === 'document' && documentResult ? (
        <DocumentScreen
          theme={theme}
          t={t}
          outcome={documentResult}
          targetLabel={targetLabel}
          maxBytes={Math.round(pendingTarget.maxKB * 1024)}
          saving={saving}
          onBack={() => setScreen('target')}
          onSave={() => void saveDocument()}
          onChangeSize={() => setScreen('target')}
        />
      ) : null}

      {screen === 'result' ? (
        <ResultScreen
          theme={theme}
          t={t}
          savedMessage={savedMessage}
          savedPath={documentResult?.uri ?? pdf?.uri ?? outputUri}
          finalBytes={documentResult?.finalBytes ?? pdf?.bytes ?? manual?.bytes ?? result?.finalBytes ?? 0}
          targetLabel={targetLabel}
          onCompressAnother={() => void reset()}
          onDone={() => void reset()}
        />
      ) : null}

      </Screen>
      </Shell>

      {/* One surface for both failures and confirmations, floating over the
          screen rather than blocking it (§8: no modal dialogs in the happy
          path). */}
      {error || notice ? (
        <View style={[styles.toastHost, { bottom: spacing.xl + insets.bottom }]} pointerEvents="box-none">
          <Toast
            message={error ?? notice ?? ''}
            tone={error ? 'error' : 'info'}
            theme={theme}
            onDismiss={() => {
              setError(null);
              setNotice(null);
            }}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function explain(cause: unknown, t: (key: string, values?: Record<string, string>) => string): string {
  if (cause instanceof CompressError) {
    switch (cause.code) {
      case 'corrupt_input':
        return t('error.corruptInput');
      case 'invalid_request':
        return t('error.invalidRequest', { detail: cause.message });
      case 'cancelled':
        return t('error.cancelled');
      default:
        return cause.message;
    }
  }
  return String(cause);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toastHost: { position: 'absolute', left: spacing.xl, right: spacing.xl },
});
