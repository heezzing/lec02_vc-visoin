"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Header from "@/components/Header";
import VideoPlayer, { VideoPlayerHandle } from "@/components/VideoPlayer";
import AnalysisPanel from "@/components/AnalysisPanel";
import ModelLoader from "@/components/ModelLoader";

const DEFAULT_PROMPT = `You are an AI vision assistant.

The image is a single frame from a video.

Look carefully at the image and identify the most important visual elements such as people, objects, and actions.

Then describe what is happening in the scene.

Rules:
- Describe only what is clearly visible in the image.
- Do not invent details or create stories.
- Do not guess intentions or events that cannot be seen.
- If something is uncertain, say it is unclear.

Write the answer in natural Korean.

Output:
Describe the scene briefly in 1–2 sentences.`;

export interface GpuStatus {
  browserSupport: boolean | null;
  adapterAvailable: boolean | null;
  adapterInfo: string | null;
  crossOriginIsolated: boolean | null;
  runtimeBackend: "webgpu" | "wasm" | null;
  fallbackReason: string | null;
}

export default function Home() {
  // Video state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Model state
  const [modelStatus, setModelStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelLoadTime, setModelLoadTime] = useState<number | undefined>();
  const [loadingProgress, setLoadingProgress] = useState<{
    file?: string;
    progress?: number;
    status?: string;
  } | null>(null);

  // GPU status
  const [gpuStatus, setGpuStatus] = useState<GpuStatus>({
    browserSupport: null,
    adapterAvailable: null,
    adapterInfo: null,
    crossOriginIsolated: null,
    runtimeBackend: null,
    fallbackReason: null,
  });

  // Analysis state
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processingTime, setProcessingTime] = useState<number | undefined>();
  const [tokenCount, setTokenCount] = useState<number | undefined>();

  // Inference settings
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(80);

  // Console logs
  const [logs, setLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString("ko-KR");
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // ── Probe on mount: COI + WebGPU ──
  useEffect(() => {
    async function probe() {
      if (typeof window === "undefined") return;

      // Cross-Origin Isolation
      const origin = window.location.hostname;
      const isTrustworthy =
        window.location.protocol === "https:" || origin === "localhost";

      if (!isTrustworthy) {
        addLog(
          `✗ 현재 주소(${origin})는 신뢰할 수 없는 origin입니다`
        );
        addLog(
          `  → http://localhost:${window.location.port} 로 접속해주세요`
        );
        setGpuStatus((prev) => ({
          ...prev,
          crossOriginIsolated: false,
        }));
      } else {
        const coiStatus = self.crossOriginIsolated;
        setGpuStatus((prev) => ({
          ...prev,
          crossOriginIsolated: coiStatus,
        }));
        if (coiStatus) {
          addLog("✓ Cross-Origin Isolated: SharedArrayBuffer 사용 가능");
        } else {
          addLog("⚠ Cross-Origin Isolated 아님: SharedArrayBuffer 제한됨");
        }
      }

      // WebGPU
      const { probeWebGPU } = await import("@/lib/modelManager");
      const result = await probeWebGPU();

      setGpuStatus((prev) => ({
        ...prev,
        browserSupport: result.browserSupport,
        adapterAvailable: result.adapterAvailable,
        adapterInfo: result.adapterInfo,
      }));

      if (!result.browserSupport) {
        addLog("⚠ WebGPU를 지원하지 않는 브라우저입니다");
      } else if (!result.adapterAvailable) {
        addLog(`⚠ WebGPU 어댑터 없음: ${result.error}`);
      } else {
        addLog(`✓ WebGPU 어댑터 확인됨: ${result.adapterInfo}`);
      }
    }

    probe();
  }, [addLog]);

  // ── Download video ──
  const handleDownload = useCallback(async () => {
    if (!youtubeUrl.trim()) return;

    setIsDownloading(true);
    setDownloadError(null);
    setVideoUrl(null);
    setCapturedFrame(null);
    setAnalysisResult(null);
    addLog(`영상 다운로드 시작: ${youtubeUrl}`);

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Download failed");

      setVideoUrl(`/api/video/${data.filename}`);
      addLog(`✓ 영상 다운로드 완료 (${(data.size / 1024 / 1024).toFixed(1)}MB)`);
      if (data.resolution && data.resolution !== "unknown") {
        addLog(
          `  해상도: ${data.width}×${data.height} · 코덱: ${data.vcodec}/${data.acodec}`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      setDownloadError(message);
      addLog(`✗ 다운로드 실패: ${message}`);
    } finally {
      setIsDownloading(false);
    }
  }, [youtubeUrl, addLog]);

  // ── Load model ──
  const handleLoadModel = useCallback(async () => {
    setModelStatus("loading");
    setModelError(null);
    addLog("── Qwen 3.5 Vision (0.8B) 모델 로딩 시작 ──");
    const startTime = performance.now();

    try {
      const { loadModel } = await import("@/lib/modelManager");

      const result = await loadModel((progress) => {
        setLoadingProgress({
          file: progress.file || progress.name,
          progress: progress.progress,
          status: progress.status,
        });

        if (progress.status === "progress" && progress.file) {
          if (progress.progress && progress.progress % 25 < 1) {
            addLog(
              `  파일: ${progress.file} (${Math.round(progress.progress || 0)}%)`
            );
          }
        }
      });

      const loadTime = performance.now() - startTime;
      setModelLoadTime(loadTime);
      setLoadingProgress(null);

      setGpuStatus((prev) => ({
        ...prev,
        browserSupport: result.browserSupport,
        adapterAvailable: result.adapterAvailable,
        runtimeBackend: result.activeDevice,
        fallbackReason: result.fallbackReason,
      }));

      setModelStatus("ready");

      if (result.activeDevice === "webgpu") {
        addLog(
          `✓ 모델 로딩 완료 → WebGPU (${(loadTime / 1000).toFixed(1)}s)`
        );
      } else {
        addLog(
          `✓ 모델 로딩 완료 → WASM (${(loadTime / 1000).toFixed(1)}s)`
        );
        if (result.fallbackReason) {
          addLog(`  폴백 사유: ${result.fallbackReason}`);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Model loading failed";
      setModelStatus("error");
      setModelError(message);
      addLog(`✗ 모델 로딩 실패: ${message}`);
    }
  }, [addLog]);

  // ── Frame capture → analysis ──
  const handleFrameCapture = useCallback(
    async (dataUrl: string) => {
      setCapturedFrame(dataUrl);

      const img = new Image();
      img.onload = () => {
        addLog(
          `프레임 캡처 완료: ${img.naturalWidth}×${img.naturalHeight}px`
        );
      };
      img.src = dataUrl;

      if (modelStatus !== "ready") {
        addLog("⚠ 모델이 로드되지 않았습니다. 먼저 모델을 로드해주세요.");
        return;
      }

      setIsAnalyzing(true);
      setAnalysisResult(null);
      addLog(
        `프레임 분석 시작... (${gpuStatus.runtimeBackend === "webgpu" ? "WebGPU" : "WASM"})`
      );

      try {
        const { analyzeFrame } = await import("@/lib/inference");
        const result = await analyzeFrame(dataUrl, prompt, {
          maxTokens,
          temperature,
        });

        setAnalysisResult(result.text);
        setProcessingTime(result.processingTime);
        setTokenCount(result.tokenCount);
        addLog(
          `✓ 분석 완료 (${(result.processingTime / 1000).toFixed(2)}s, ${result.tokenCount} tokens)`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Analysis failed";
        setAnalysisResult(`오류: ${message}`);
        addLog(`✗ 분석 실패: ${message}`);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [modelStatus, prompt, maxTokens, temperature, addLog, gpuStatus.runtimeBackend]
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        modelStatus={modelStatus}
        gpuStatus={gpuStatus}
        modelLoadTime={modelLoadTime}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* COI warning */}
        {gpuStatus.crossOriginIsolated === false && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <span className="text-[var(--error)] text-lg">⚠</span>
            <div>
              <p className="text-sm font-medium text-[var(--error)]">
                Cross-Origin Isolation 비활성
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                http://localhost:{typeof window !== "undefined" ? window.location.port : "3000"} 으로 접속해주세요.
              </p>
            </div>
          </div>
        )}

        {/* WebGPU warning */}
        {gpuStatus.browserSupport === false && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <span className="text-amber-600 text-lg">⚠</span>
            <div>
              <p className="text-sm font-medium text-amber-700">
                WebGPU 미지원 브라우저
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                최신 Chrome 또는 Edge 브라우저를 사용해주세요.
              </p>
            </div>
          </div>
        )}

        {/* WASM fallback warning */}
        {gpuStatus.runtimeBackend === "wasm" &&
          gpuStatus.adapterAvailable === true &&
          gpuStatus.fallbackReason && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <span className="text-amber-600 text-lg">⚠</span>
              <div>
                <p className="text-sm font-medium text-amber-700">
                  WASM 폴백 모드로 실행중
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono break-all">
                  {gpuStatus.fallbackReason}
                </p>
              </div>
            </div>
          )}

        {/* Model loader */}
        <ModelLoader
          onLoadModel={handleLoadModel}
          modelStatus={modelStatus}
          loadingProgress={loadingProgress}
          error={modelError}
          gpuStatus={gpuStatus}
        />

        {/* YouTube URL input */}
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDownload()}
              placeholder="YouTube URL을 입력하세요 (예: https://www.youtube.com/watch?v=...)"
              className="flex-1 bg-white border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-sm
                text-[var(--text-primary)] placeholder-[var(--text-secondary)]
                focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-colors"
            />
            <button
              onClick={handleDownload}
              disabled={isDownloading || !youtubeUrl.trim()}
              className="px-6 py-2.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-white
                hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-2 min-w-[140px] justify-center shadow-sm"
            >
              {isDownloading ? (
                <>
                  <svg className="w-4 h-4 spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeWidth={2} d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" />
                  </svg>
                  다운로드중...
                </>
              ) : (
                "영상 다운로드"
              )}
            </button>
          </div>
          {downloadError && (
            <p className="mt-2 text-sm text-[var(--error)]">
              {downloadError}
            </p>
          )}
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <VideoPlayer
              ref={videoPlayerRef}
              videoUrl={videoUrl}
              onFrameCapture={handleFrameCapture}
              isAnalyzing={isAnalyzing}
            />

            {/* Console */}
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-4">
              <h3 className="text-sm font-medium mb-2 text-[var(--text-primary)]">
                콘솔
              </h3>
              <div
                ref={logContainerRef}
                className="h-40 overflow-y-auto bg-white rounded-lg border border-[var(--border-color)] p-3 font-mono text-xs space-y-1"
              >
                {logs.length === 0 ? (
                  <p className="text-[var(--text-secondary)]">
                    로그가 여기에 표시됩니다...
                  </p>
                ) : (
                  logs.map((log, i) => (
                    <div
                      key={i}
                      className={
                        log.includes("──")
                          ? "text-[var(--accent)] font-semibold"
                          : log.includes("✗")
                            ? "text-[var(--error)]"
                            : log.includes("⚠")
                              ? "text-amber-600"
                              : "text-[var(--text-secondary)]"
                      }
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <AnalysisPanel
            capturedFrame={capturedFrame}
            analysisResult={analysisResult}
            isAnalyzing={isAnalyzing}
            processingTime={processingTime}
            tokenCount={tokenCount}
            prompt={prompt}
            onPromptChange={setPrompt}
            temperature={temperature}
            onTemperatureChange={setTemperature}
            maxTokens={maxTokens}
            onMaxTokensChange={setMaxTokens}
          />
        </div>
      </main>

      <footer className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] py-3 text-center text-xs text-[var(--text-secondary)]">
        On-Device Video Frame Analysis · Qwen 3.5 Vision · Transformers.js +{" "}
        {gpuStatus.runtimeBackend === "wasm" ? "WASM" : "WebGPU"} ·
        모든 AI 추론은 브라우저에서 실행됩니다
      </footer>
    </div>
  );
}
