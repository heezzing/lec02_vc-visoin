"use client";

import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";

export interface VideoPlayerHandle {
  getVideoElement: () => HTMLVideoElement | null;
}

interface VideoPlayerProps {
  videoUrl: string | null;
  onFrameCapture?: (dataUrl: string) => void;
  isAnalyzing?: boolean;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ videoUrl, onFrameCapture, isAnalyzing }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPaused, setIsPaused] = useState(true);

    useImperativeHandle(ref, () => ({
      getVideoElement: () => videoRef.current,
    }));

    const handleTimeUpdate = useCallback(() => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
    }, []);

    const handleLoadedMetadata = useCallback(() => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
      }
    }, []);

    const handlePlay = useCallback(() => {
      setIsPlaying(true);
      setIsPaused(false);
    }, []);

    const handlePause = useCallback(() => {
      setIsPlaying(false);
      setIsPaused(true);
    }, []);

    const togglePlay = useCallback(() => {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }, []);

    const handleSeek = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!videoRef.current) return;
        const time = parseFloat(e.target.value);
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      },
      []
    );

    const stepFrame = useCallback((direction: number) => {
      if (!videoRef.current) return;
      // Approximate frame step (~1/30th of a second)
      videoRef.current.currentTime += direction * (1 / 30);
    }, []);

    const captureCurrentFrame = useCallback(() => {
      if (!videoRef.current || !onFrameCapture) return;

      const video = videoRef.current;
      if (video.readyState < 2) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Capture at the video's original resolution — no downscaling.
      // The vision model's processor handles its own resizing internally.
      const width = video.videoWidth;
      const height = video.videoHeight;

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/png");
      onFrameCapture(dataUrl);
    }, [onFrameCapture]);

    const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    // Reset state when video URL changes
    useEffect(() => {
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setIsPaused(true);
    }, [videoUrl]);

    if (!videoUrl) {
      return (
        <div className="aspect-video bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] flex items-center justify-center">
          <div className="text-center text-[var(--text-secondary)]">
            <svg
              className="w-16 h-16 mx-auto mb-3 opacity-30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <p>YouTube URL을 입력하고 영상을 다운로드하세요</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Video element */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-[var(--border-color)]">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handlePlay}
            onPause={handlePause}
            playsInline
          />
        </div>

        {/* Controls */}
        <div className="bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] p-3 space-y-3">
          {/* Seek bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-secondary)] w-12 text-right font-mono">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 rounded-full appearance-none bg-[var(--border-color)] cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)]"
            />
            <span className="text-xs text-[var(--text-secondary)] w-12 font-mono">
              {formatTime(duration)}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {/* Frame step backward */}
            <button
              onClick={() => stepFrame(-1)}
              className="px-2 py-1.5 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)]
                hover:border-[var(--accent)] transition-colors"
              title="이전 프레임"
            >
              ◀◀
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="px-4 py-1.5 rounded text-sm font-medium bg-[var(--bg-secondary)] border border-[var(--border-color)]
                hover:border-[var(--accent)] transition-colors min-w-[80px]"
            >
              {isPlaying ? "일시정지" : "재생"}
            </button>

            {/* Frame step forward */}
            <button
              onClick={() => stepFrame(1)}
              className="px-2 py-1.5 rounded text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)]
                hover:border-[var(--accent)] transition-colors"
              title="다음 프레임"
            >
              ▶▶
            </button>

            <div className="flex-1" />

            {/* Capture & Analyze */}
            <button
              onClick={captureCurrentFrame}
              disabled={isAnalyzing || !isPaused}
              className="px-4 py-1.5 rounded text-sm font-medium bg-[var(--accent)] text-white
                hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 spinner"
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
                  분석중...
                </span>
              ) : (
                "프레임 분석"
              )}
            </button>
          </div>

          {!isPaused && (
            <p className="text-xs text-[var(--warning)]">
              * 프레임을 분석하려면 먼저 영상을 일시정지하세요
            </p>
          )}
        </div>
      </div>
    );
  }
);

export default VideoPlayer;
