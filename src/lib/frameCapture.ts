/**
 * Capture a frame from an HTMLVideoElement using the Canvas API.
 *
 * Frames are captured at the video's original resolution — no downscaling.
 * The vision model's processor handles its own internal resizing.
 */

/**
 * Capture the current frame and return it as a PNG data URL.
 */
export function captureFrame(video: HTMLVideoElement): string | null {
  if (!video || video.readyState < 2) {
    return null;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

  return canvas.toDataURL("image/png");
}

/**
 * Capture frame and return as Blob.
 */
export function captureFrameAsBlob(
  video: HTMLVideoElement
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!video || video.readyState < 2) {
      resolve(null);
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(null);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
