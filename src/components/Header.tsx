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
    idle: { label: "모델 미로드", color: "bg-gray-500" },
    loading: { label: "모델 로딩중...", color: "bg-yellow-500 pulse-dot" },
    ready: { label: "모델 준비완료", color: "bg-green-500" },
    error: { label: "모델 오류", color: "bg-red-500" },
  };

  const ms = modelStatusConfig[modelStatus];

  let gpuLabel: string;
  let gpuColor: string;

  if (gpuStatus.runtimeBackend !== null) {
    if (gpuStatus.runtimeBackend === "webgpu") {
      gpuLabel = "WebGPU 실행중";
      gpuColor = "bg-green-500";
    } else if (gpuStatus.adapterAvailable) {
      gpuLabel = "WASM 폴백";
      gpuColor = "bg-orange-500";
    } else {
      gpuLabel = "WASM 실행중";
      gpuColor = "bg-yellow-500";
    }
  } else if (gpuStatus.browserSupport === null) {
    gpuLabel = "GPU 확인중...";
    gpuColor = "bg-yellow-500 pulse-dot";
  } else if (!gpuStatus.browserSupport) {
    gpuLabel = "WebGPU 미지원";
    gpuColor = "bg-red-500";
  } else if (!gpuStatus.adapterAvailable) {
    gpuLabel = "어댑터 없음";
    gpuColor = "bg-red-500";
  } else {
    gpuLabel = "WebGPU 준비됨";
    gpuColor = "bg-blue-500";
  }

  return (
    <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div>
          <h1 className="text-xl font-bold text-white">
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
                  ? "bg-yellow-500 pulse-dot"
                  : gpuStatus.crossOriginIsolated
                    ? "bg-green-500"
                    : "bg-red-500"
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
          <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
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
