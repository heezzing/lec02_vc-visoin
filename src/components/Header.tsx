"use client";

import type { GpuStatus } from "@/app/page";

interface HeaderProps {
  modelStatus: "idle" | "loading" | "ready" | "error";
  gpuStatus: GpuStatus;
  modelLoadTime?: number;
}

export default function Header({
  modelStatus,
  gpuStatus,
  modelLoadTime,
}: HeaderProps) {
  const modelStatusConfig = {
    idle: { label: "모델 미로드", color: "bg-gray-400" },
    loading: { label: "모델 로딩중...", color: "bg-amber-500 pulse-dot" },
    ready: { label: "모델 준비완료", color: "bg-[var(--success)]" },
    error: { label: "모델 오류", color: "bg-[var(--error)]" },
  };

  const ms = modelStatusConfig[modelStatus];

  let gpuLabel: string;
  let gpuColor: string;

  if (gpuStatus.runtimeBackend !== null) {
    if (gpuStatus.runtimeBackend === "webgpu") {
      gpuLabel = "WebGPU 실행중";
      gpuColor = "bg-[var(--success)]";
    } else if (gpuStatus.adapterAvailable) {
      gpuLabel = "WASM 폴백";
      gpuColor = "bg-amber-500";
    } else {
      gpuLabel = "WASM 실행중";
      gpuColor = "bg-amber-500";
    }
  } else if (gpuStatus.browserSupport === null) {
    gpuLabel = "GPU 확인중...";
    gpuColor = "bg-amber-500 pulse-dot";
  } else if (!gpuStatus.browserSupport) {
    gpuLabel = "WebGPU 미지원";
    gpuColor = "bg-[var(--error)]";
  } else if (!gpuStatus.adapterAvailable) {
    gpuLabel = "어댑터 없음";
    gpuColor = "bg-[var(--error)]";
  } else {
    gpuLabel = "WebGPU 준비됨";
    gpuColor = "bg-[var(--accent)]";
  }

  return (
    <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            On-Device Video Frame Analysis
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Qwen 3.5 Vision · WebGPU + Transformers.js
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* COI */}
          <div className="flex items-center gap-2 text-sm" title="Cross-Origin Isolation">
            <span
              className={`w-2 h-2 rounded-full ${
                gpuStatus.crossOriginIsolated === null
                  ? "bg-amber-500 pulse-dot"
                  : gpuStatus.crossOriginIsolated
                    ? "bg-[var(--success)]"
                    : "bg-[var(--error)]"
              }`}
            />
            <span className="text-[var(--text-secondary)]">
              {gpuStatus.crossOriginIsolated === null
                ? "COI..."
                : gpuStatus.crossOriginIsolated
                  ? "COI"
                  : "COI ✗"}
            </span>
          </div>

          {/* GPU backend */}
          <div className="flex items-center gap-2 text-sm" title={gpuStatus.adapterInfo ?? undefined}>
            <span className={`w-2 h-2 rounded-full ${gpuColor}`} />
            <span className="text-[var(--text-secondary)]">{gpuLabel}</span>
          </div>

          {/* Model status */}
          <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-white border border-[var(--border-color)] shadow-sm">
            <span className={`w-2 h-2 rounded-full ${ms.color}`} />
            <span className="text-[var(--text-secondary)]">{ms.label}</span>
            {modelLoadTime && modelStatus === "ready" && (
              <span className="text-xs text-[var(--text-secondary)]">
                ({(modelLoadTime / 1000).toFixed(1)}s)
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
