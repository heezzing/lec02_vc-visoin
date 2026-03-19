/**
 * Model Manager — singleton loading, caching, and WebGPU detection
 *
 * Model: onnx-community/Qwen3.5-0.8B-ONNX
 *   - 0.8B-param vision-language model (Qwen 3.5 family)
 *   - vision_encoder + embed_tokens + decoder_model_merged
 *   - q4f16 quantization: ~646 MB total browser download
 *   - Cached by Transformers.js in browser Cache API after first load
 *   - Loaded once, reused for all subsequent inferences (singleton)
 *
 * Requires @huggingface/transformers >= 4.0.0-next.8
 *   (v3.8.1 did not have Qwen3_5ForConditionalGeneration)
 *
 * Loading path:
 *   1. q4f16 / WebGPU  (primary — small download, GPU accelerated)
 *   2. q4f16 / WASM    (fallback if WebGPU fails)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _processor: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _model: any = null;

let _isLoaded = false;
let _isLoading = false;
let _activeDevice: "webgpu" | "wasm" | null = null;

export const MODEL_ID = "onnx-community/Qwen3.5-0.8B-ONNX";
export const DTYPE = "q4f16";

function log(detail: string) {
  console.log(`[modelManager] ${detail}`);
}

export type ProgressCallback = (progress: {
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}) => void;

export interface ModelLoadResult {
  activeDevice: "webgpu" | "wasm";
  browserSupport: boolean;
  adapterAvailable: boolean;
  fallbackReason: string | null;
}

// ─── WebGPU Probe ───────────────────────────────────────────────────

export async function probeWebGPU(): Promise<{
  browserSupport: boolean;
  adapterAvailable: boolean;
  adapterInfo: string | null;
  error: string | null;
}> {
  if (typeof window === "undefined" || !navigator.gpu) {
    return {
      browserSupport: false,
      adapterAvailable: false,
      adapterInfo: null,
      error: "navigator.gpu is undefined",
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        browserSupport: true,
        adapterAvailable: false,
        adapterInfo: null,
        error: "requestAdapter() returned null",
      };
    }

    const info = adapter.info;
    const desc = [info.vendor, info.architecture, info.description]
      .filter(Boolean)
      .join(" / ");

    return {
      browserSupport: true,
      adapterAvailable: true,
      adapterInfo: desc || "unknown adapter",
      error: null,
    };
  } catch (e) {
    return {
      browserSupport: true,
      adapterAvailable: false,
      adapterInfo: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─── Model Loading ──────────────────────────────────────────────────

export async function loadModel(
  onProgress?: ProgressCallback
): Promise<ModelLoadResult> {
  // Singleton — return cached result if already loaded
  if (_isLoaded && _activeDevice) {
    log("model already loaded, reusing");
    return {
      activeDevice: _activeDevice,
      browserSupport: true,
      adapterAvailable: true,
      fallbackReason: null,
    };
  }

  // Wait for in-progress load
  if (_isLoading) {
    log("load in progress, waiting");
    while (_isLoading) {
      await new Promise((r) => setTimeout(r, 200));
    }
    return {
      activeDevice: _activeDevice!,
      browserSupport: true,
      adapterAvailable: true,
      fallbackReason: null,
    };
  }

  _isLoading = true;
  log(`loading model=${MODEL_ID}, dtype=${DTYPE}`);

  try {
    const transformers = await import("@huggingface/transformers");

    // Probe GPU
    log("probing WebGPU");
    const gpu = await probeWebGPU();
    log(
      `browserSupport=${gpu.browserSupport}, adapter=${gpu.adapterAvailable}, info=${gpu.adapterInfo}`
    );

    if (onProgress) {
      onProgress({
        status: "initiate",
        name: "system",
        file: gpu.adapterAvailable
          ? `WebGPU adapter: ${gpu.adapterInfo}`
          : `WebGPU unavailable: ${gpu.error ?? "unknown"}`,
      });
    }

    // Load processor
    log("loading processor");
    if (onProgress) {
      onProgress({ status: "loading", name: "processor" });
    }
    _processor = await transformers.AutoProcessor.from_pretrained(MODEL_ID, {
      progress_callback: onProgress,
    });
    log("processor loaded");

    // Load model
    let fallbackReason: string | null = null;
    let device: "webgpu" | "wasm";

    if (gpu.adapterAvailable) {
      log(`attempting ${DTYPE}/WebGPU`);
      if (onProgress) {
        onProgress({
          status: "loading",
          name: `model (WebGPU · ${DTYPE})`,
        });
      }

      try {
        _model =
          await transformers.AutoModelForImageTextToText.from_pretrained(
            MODEL_ID,
            {
              dtype: DTYPE,
              device: "webgpu",
              progress_callback: onProgress,
            }
          );
        device = "webgpu";
        log("model loaded on WebGPU");
      } catch (webgpuError) {
        const reason =
          webgpuError instanceof Error
            ? webgpuError.message
            : String(webgpuError);
        log(`WebGPU FAILED: ${reason}`);
        fallbackReason = reason;

        if (onProgress) {
          onProgress({
            status: "initiate",
            name: "system",
            file: `WebGPU failed. Falling back to WASM...`,
          });
          onProgress({
            status: "loading",
            name: `model (WASM · ${DTYPE})`,
          });
        }

        _model =
          await transformers.AutoModelForImageTextToText.from_pretrained(
            MODEL_ID,
            {
              dtype: DTYPE,
              device: "wasm",
              progress_callback: onProgress,
            }
          );
        device = "wasm";
        log("model loaded on WASM (fallback)");
      }
    } else {
      log(`no WebGPU, loading ${DTYPE}/WASM`);
      if (onProgress) {
        onProgress({
          status: "loading",
          name: `model (WASM · ${DTYPE})`,
        });
      }

      _model =
        await transformers.AutoModelForImageTextToText.from_pretrained(
          MODEL_ID,
          {
            dtype: DTYPE,
            device: "wasm",
            progress_callback: onProgress,
          }
        );
      device = "wasm";
      fallbackReason = gpu.browserSupport
        ? `WebGPU adapter unavailable: ${gpu.error ?? "null"}`
        : "Browser does not support WebGPU";
      log("model loaded on WASM");
    }

    _activeDevice = device;
    _isLoaded = true;
    log(`READY — device=${device}, dtype=${DTYPE}`);

    if (onProgress) {
      onProgress({ status: "ready", name: "model" });
    }

    return {
      activeDevice: device,
      browserSupport: gpu.browserSupport,
      adapterAvailable: gpu.adapterAvailable,
      fallbackReason,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    if (
      msg.includes("Array buffer allocation") ||
      msg.includes("out of memory")
    ) {
      log(`MEMORY ERROR: ${msg}`);
      throw new Error(
        `브라우저 메모리 부족: 모델 파일이 너무 큽니다. 다른 탭을 닫고 다시 시도하세요.`
      );
    }

    log(`FATAL: ${msg}`);
    throw error;
  } finally {
    _isLoading = false;
  }
}

// ─── Accessors ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProcessor(): any {
  return _processor;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModel(): any {
  return _model;
}

export function isModelLoaded(): boolean {
  return _isLoaded;
}

export function getActiveDevice(): "webgpu" | "wasm" | null {
  return _activeDevice;
}

export async function disposeModel(): Promise<void> {
  if (_model && typeof _model.dispose === "function") {
    await _model.dispose();
  }
  _model = null;
  _processor = null;
  _isLoaded = false;
  _activeDevice = null;
}
