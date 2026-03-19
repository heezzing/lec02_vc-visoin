"use client";

import { useState } from "react";

interface AnalysisPanelProps {
  capturedFrame: string | null;
  analysisResult: string | null;
  isAnalyzing: boolean;
  processingTime?: number;
  tokenCount?: number;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
  maxTokens: number;
  onMaxTokensChange: (tokens: number) => void;
}

export default function AnalysisPanel({
  capturedFrame,
  analysisResult,
  isAnalyzing,
  processingTime,
  tokenCount,
  prompt,
  onPromptChange,
  temperature,
  onTemperatureChange,
  maxTokens,
  onMaxTokensChange,
}: AnalysisPanelProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="space-y-4">
      {/* Prompt input */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-4">
        <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
          분석 프롬프트
        </label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={3}
          className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm
            text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none
            focus:outline-none focus:border-[var(--accent)] transition-colors"
          placeholder="이미지 분석 프롬프트를 입력하세요..."
        />

        {/* Settings toggle */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="mt-2 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          {showSettings ? "▼ 추론 설정 숨기기" : "▶ 추론 설정 보기"}
        </button>

        {showSettings && (
          <div className="mt-3 space-y-3 pt-3 border-t border-[var(--border-color)]">
            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[var(--text-secondary)]">
                  Temperature
                </label>
                <span className="text-xs font-mono text-[var(--text-primary)]">
                  {temperature.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={temperature}
                onChange={(e) =>
                  onTemperatureChange(parseFloat(e.target.value))
                }
                className="w-full h-1.5 rounded-full appearance-none bg-[var(--border-color)] cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)]"
              />
            </div>

            {/* Max tokens */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[var(--text-secondary)]">
                  Max Tokens
                </label>
                <span className="text-xs font-mono text-[var(--text-primary)]">
                  {maxTokens}
                </span>
              </div>
              <input
                type="range"
                min={64}
                max={1024}
                step={64}
                value={maxTokens}
                onChange={(e) =>
                  onMaxTokensChange(parseInt(e.target.value, 10))
                }
                className="w-full h-1.5 rounded-full appearance-none bg-[var(--border-color)] cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Captured frame preview */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-4">
        <h3 className="text-sm font-medium mb-3 text-[var(--text-secondary)]">
          캡처된 프레임
        </h3>
        {capturedFrame ? (
          <img
            src={capturedFrame}
            alt="Captured frame"
            className="w-full rounded-lg border border-[var(--border-color)]"
          />
        ) : (
          <div className="aspect-video bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] flex items-center justify-center">
            <p className="text-sm text-[var(--text-secondary)]">
              영상을 일시정지하고 &quot;프레임 분석&quot; 버튼을 클릭하세요
            </p>
          </div>
        )}
      </div>

      {/* Analysis result */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-4">
        <h3 className="text-sm font-medium mb-3 text-[var(--text-secondary)]">
          분석 결과
        </h3>

        {isAnalyzing ? (
          <div className="flex items-center gap-3 py-8 justify-center">
            <svg
              className="w-5 h-5 spinner text-[var(--accent)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeWidth={2}
                d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83"
              />
            </svg>
            <span className="text-sm text-[var(--text-secondary)]">
              AI 모델이 이미지를 분석하고 있습니다...
            </span>
          </div>
        ) : analysisResult ? (
          <div>
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-[var(--border-color)]">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {analysisResult}
              </p>
            </div>

            {/* Inference stats */}
            {(processingTime || tokenCount) && (
              <div className="flex gap-4 mt-3 text-xs text-[var(--text-secondary)]">
                {processingTime && (
                  <span>
                    처리 시간:{" "}
                    <span className="text-[var(--text-primary)] font-mono">
                      {(processingTime / 1000).toFixed(2)}s
                    </span>
                  </span>
                )}
                {tokenCount !== undefined && tokenCount > 0 && (
                  <span>
                    생성 토큰:{" "}
                    <span className="text-[var(--text-primary)] font-mono">
                      {tokenCount}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              프레임을 캡처하면 분석 결과가 여기에 표시됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
