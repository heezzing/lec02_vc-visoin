import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

// Common headers for all video responses
const VIDEO_HEADERS = {
  "Content-Type": "video/mp4",
  "Accept-Ranges": "bytes",
  // Required by COEP: require-corp — tells the browser this
  // same-origin resource explicitly opts into being loadable.
  "Cross-Origin-Resource-Policy": "same-origin",
  // Cache the video in the browser for the session
  "Cache-Control": "private, max-age=3600",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (filename.includes("..") || filename.includes("/")) {
    return new Response("Invalid filename", { status: 400 });
  }

  const filepath = path.join(process.cwd(), "videos", filename);

  if (!fs.existsSync(filepath)) {
    return new Response("Video not found", { status: 404 });
  }

  const stat = fs.statSync(filepath);
  const fileSize = stat.size;
  const range = request.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    // Serve up to 2MB chunks for smoother seeking
    const end = parts[1]
      ? parseInt(parts[1], 10)
      : Math.min(start + 2 * 1024 * 1024 - 1, fileSize - 1);

    const chunkSize = end - start + 1;
    const buffer = Buffer.alloc(chunkSize);
    const fd = fs.openSync(filepath, "r");
    fs.readSync(fd, buffer, 0, chunkSize, start);
    fs.closeSync(fd);

    return new Response(buffer, {
      status: 206,
      headers: {
        ...VIDEO_HEADERS,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": chunkSize.toString(),
      },
    });
  }

  const buffer = fs.readFileSync(filepath);
  return new Response(buffer, {
    headers: {
      ...VIDEO_HEADERS,
      "Content-Length": fileSize.toString(),
    },
  });
}
