"use client";

import type { GpuStatus } from "@/app/page";

interface ModelLoaderProps {
  onLoadModel: () => void;
  modelStatus: "idle" | "loading" | "ready" | "error";
  loadingProgress: { file?: string; progress?: number; status?: string } | null;
  error?: string | null;
  gpuStatus: GpuStatus;
}

export default function ModelLoader({
  onLoadModel,
  modelStatus,
  loadingProgress,
  error,
  gpuStatus,
}: ModelLoaderProps) {
  if (modelStatus === "ready") {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-[var(--text-primary)]">
            Qwen 3.5 Vision (0.8B)
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              gpuStatus.runtimeBackend === "webgpu"
                ? "bg-green-500/15 text-green-400"
                : "bg-yellow-500/15 text-yellow-400"
            }`}
          >
            {gpuStatus.runtimeBackend === "webgpu" ? "WebGPU" : "WASM"}
          </span>
        </div>
        <span className="text-xs text-[var(--text-secondary)]">
          추론 준비 완료
        </span>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">AI 모델</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Qwen 3.5 Vision 0.8B (ONNX · q4f16 · WebGPU)
          </p>
        </div>

        {modelStatus === "idle" && (
          <button
            onClick={onLoadModel}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-white
              hover:bg-[var(--accent-hover)] transition-colors"
          >
            모델 로드
          </button>
        )}
      </div>

      {modelStatus === "loading" && loadingProgress && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>
              {loadingProgress.file || loadingProgress.status || "로딩중..."}
            </span>
            {loadingProgress.progress !== undefined && (
              <span>{Math.round(loadingProgress.progress)}%</span>
            )}
          </div>
          <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            {loadingProgress.progress !== undefined ? (
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress.progress}%` }}
              />
            ) : (
              <div className="h-full w-1/4 bg-[var(--accent)] rounded-full progress-indeterminate" />
            )}
          </div>
        </div>
      )}

      {modelStatus === "error" && error && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={onLoadModel}
            className="mt-2 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
