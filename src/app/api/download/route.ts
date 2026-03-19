import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "YouTube URL is required" },
        { status: 400 }
      );
    }

    if (
      !url.includes("youtube.com/") &&
      !url.includes("youtu.be/") &&
      !url.includes("youtube.com/shorts/")
    ) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    const videosDir = path.join(process.cwd(), "videos");
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    const filename = `video_${Date.now()}.mp4`;
    const filepath = path.join(videosDir, filename);

    // ── Step 1: Query available formats to find the best one ────────
    //
    // We run yt-dlp -j first to inspect what YouTube actually offers.
    // This lets us log the exact format chosen and adapt the strategy.
    // The mweb/android clients sometimes don't expose high-res H.264,
    // so we also try the default web client.

    // ── Step 2: Download with best-effort H.264 1080p ───────────────
    //
    // Format selection strategy — priority order:
    //
    //   1. bestvideo H.264 + bestaudio m4a  (separate, merged by ffmpeg)
    //      → "bv*[vcodec~=avc1][height<=1080]+ba[ext=m4a]"
    //      The regex ~=avc1 matches avc1, avc1.64001f, avc1.4d401e, etc.
    //      bv* means "best video that could also be a video-only OR
    //      video+audio stream" — this catches pre-muxed mp4 too.
    //
    //   2. bestvideo H.264 any resolution + bestaudio m4a
    //      → "bv*[vcodec~=avc1]+ba[ext=m4a]"
    //      For videos where H.264 is only available at 1080p+.
    //
    //   3. bestvideo any codec ≤1080p + bestaudio
    //      → "bv*[height<=1080]+ba"
    //      Allows VP9/AV1 — ffmpeg will re-encode to H.264 via --recode.
    //
    //   4. best single stream (pre-muxed)
    //      → "best[height<=1080]"
    //
    //   5. best anything
    //      → "best"
    //
    const formatString = [
      "bv*[vcodec~=avc1][height<=1080]+ba[ext=m4a]",
      "bv*[vcodec~=avc1]+ba[ext=m4a]",
      "bv*[height<=1080]+ba",
      "best[height<=1080]",
      "best",
    ].join("/");

    const downloadArgs = [
      "-f",
      formatString,

      // YouTube 403 workaround — try multiple player clients
      "--extractor-args",
      "youtube:player_client=default,mweb,android",

      "--user-agent",
      USER_AGENT,

      "--no-playlist",

      // Merge video+audio into mp4 container (only runs when streams are separate)
      "--merge-output-format",
      "mp4",

      // If the selected video codec is NOT H.264 (e.g. VP9 from fallback 3),
      // re-encode to H.264 so the browser can play it.  If it's already
      // H.264, this is a no-op (just remux, no quality loss).
      "--recode-video",
      "mp4",

      // Move moov atom to start for instant playback / seeking
      "--postprocessor-args",
      "ffmpeg:-movflags +faststart",

      // Print the selected format info to stdout as JSON (one line)
      "--print",
      "after_move:{\"format\":\"%(format)s\",\"resolution\":\"%(resolution)s\",\"vcodec\":\"%(vcodec)s\",\"acodec\":\"%(acodec)s\",\"filesize\":%(filesize_approx|0)s,\"height\":%(height|0)s,\"width\":%(width|0)s}",

      "-o",
      filepath,
      url,
    ];

    let formatInfo: {
      format?: string;
      resolution?: string;
      vcodec?: string;
      acodec?: string;
      height?: number;
      width?: number;
    } = {};

    try {
      const { stdout, stderr } = await execFileAsync("yt-dlp", downloadArgs, {
        timeout: 600_000, // 10 minutes for 1080p + potential re-encode
        maxBuffer: 10 * 1024 * 1024,
      });

      // Parse the --print output to get format details
      if (stdout) {
        for (const line of stdout.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("{") && trimmed.includes("format")) {
            try {
              formatInfo = JSON.parse(trimmed);
            } catch {
              // ignore parse errors
            }
            break;
          }
        }
      }

      console.log("yt-dlp format selected:", formatInfo);
      if (stderr) {
        console.log("yt-dlp stderr:", stderr.slice(0, 500));
      }
    } catch (dlError: unknown) {
      const err = dlError as {
        stderr?: string;
        stdout?: string;
        code?: number;
        message?: string;
      };
      const stderr = err.stderr || err.message || "Unknown yt-dlp error";
      console.error("yt-dlp stderr:", stderr);

      if (
        stderr.includes("command not found") ||
        stderr.includes("ENOENT")
      ) {
        return NextResponse.json(
          {
            error:
              "yt-dlp is not installed. Run: brew install yt-dlp (macOS) or pip install yt-dlp",
          },
          { status: 500 }
        );
      }

      const reason = stderr.length > 300 ? stderr.slice(0, 300) + "…" : stderr;
      return NextResponse.json(
        { error: `yt-dlp failed: ${reason}` },
        { status: 500 }
      );
    }

    if (!fs.existsSync(filepath)) {
      return NextResponse.json(
        { error: "Video download completed but file was not created" },
        { status: 500 }
      );
    }

    // Clean up old videos — keep only the latest 5
    try {
      const MAX_VIDEOS = 5;
      const files = fs.readdirSync(videosDir)
        .filter((f) => f.endsWith(".mp4"))
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(videosDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time); // newest first

      if (files.length > MAX_VIDEOS) {
        for (const old of files.slice(MAX_VIDEOS)) {
          fs.unlinkSync(path.join(videosDir, old.name));
          console.log(`[cleanup] deleted old video: ${old.name}`);
        }
      }
    } catch (cleanupErr) {
      // Non-fatal — log but don't fail the response
      console.warn("[cleanup] failed:", cleanupErr);
    }

    const stat = fs.statSync(filepath);

    return NextResponse.json({
      success: true,
      filename,
      size: stat.size,
      // Pass format details to the frontend for display
      format: formatInfo.format || "unknown",
      resolution: formatInfo.resolution || "unknown",
      vcodec: formatInfo.vcodec || "unknown",
      acodec: formatInfo.acodec || "unknown",
      width: formatInfo.width || 0,
      height: formatInfo.height || 0,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Download route error:", message);
    return NextResponse.json(
      { error: `Download failed: ${message}` },
      { status: 500 }
    );
  }
}
