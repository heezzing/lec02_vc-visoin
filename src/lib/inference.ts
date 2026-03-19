/**
 * Frame analysis using Qwen 3.5 Vision 0.8B (on-device, WebGPU)
 *
 * Pipeline:
 *   1. Load captured frame as RawImage
 *   2. Resize to max 960px (reduces vision patches for speed)
 *   3. Build chat message with Korean structured prompt
 *   4. Apply chat template → tokenize + vision-encode
 *   5. Generate text with model.generate()
 *   6. Decode generated tokens → Korean scene description
 *
 * The model and processor are managed by modelManager.ts (singleton).
 * This module only handles the inference logic.
 */

import { getModel, getProcessor, isModelLoaded } from "./modelManager";

const MAX_IMAGE_DIM = 960;

function log(detail: string) {
  console.log(`[inference] ${detail}`);
}

export interface InferenceResult {
  text: string;
  processingTime: number;
  tokenCount: number;
}

export interface InferenceOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Analyze a captured video frame and return a Korean scene description.
 *
 * @param imageDataUrl - PNG data URL from Canvas capture (full resolution)
 * @param prompt - User-editable analysis prompt
 * @param options - Generation parameters (maxTokens, temperature)
 */
export async function analyzeFrame(
  imageDataUrl: string,
  prompt: string,
  options: InferenceOptions = {}
): Promise<InferenceResult> {
  const model = getModel();
  const processor = getProcessor();

  if (!isModelLoaded() || !model || !processor) {
    throw new Error("모델이 로드되지 않았습니다. 먼저 모델을 로드해주세요.");
  }

  log("starting frame analysis");
  const startTime = performance.now();
  const transformers = await import("@huggingface/transformers");

  // ── 1. Load image ──
  let image = await transformers.RawImage.fromURL(imageDataUrl);
  log(`image loaded: ${image.width}×${image.height}`);

  // ── 2. Resize for inference speed ──
  // Qwen3.5's vision encoder creates more patches for larger images.
  // 960px cap keeps inference fast while preserving visual detail.
  // Full resolution is preserved in the UI for display.
  const maxDim = Math.max(image.width, image.height);
  if (maxDim > MAX_IMAGE_DIM) {
    const scale = MAX_IMAGE_DIM / maxDim;
    const newW = Math.round(image.width * scale);
    const newH = Math.round(image.height * scale);
    image = await image.resize(newW, newH);
    log(`resized to ${newW}×${newH} for model input`);
  }

  // ── 3. Build chat message ──
  // Qwen 3.5 has native Korean support — the structured Korean prompt
  // in DEFAULT_PROMPT is sufficient without an English prefix.
  const messages = [
    {
      role: "user" as const,
      content: [
        { type: "image" as const },
        { type: "text" as const, text: prompt },
      ],
    },
  ];

  // ── 4. Process inputs ──
  log("applying chat template + processing inputs");
  const text = processor.apply_chat_template(messages, {
    add_generation_prompt: true,
  });
  const inputs = await processor(text, [image]);

  // ── 5. Generate ──
  // Low temperature (0.2) + top_p (0.9) produces stable, factual
  // descriptions without hallucination or creative storytelling.
  // max_new_tokens capped at 200 to keep output concise.
  const maxTokens = options.maxTokens || 80;
  const temperature = options.temperature ?? 0.2;

  const generateArgs: Record<string, unknown> = {
    ...inputs,
    max_new_tokens: maxTokens,
    repetition_penalty: 1.1,
  };

  if (temperature > 0) {
    generateArgs.do_sample = true;
    generateArgs.temperature = temperature;
    generateArgs.top_p = 0.9;
  } else {
    generateArgs.do_sample = false;
  }

  log(`generating (max_tokens=${maxTokens}, temp=${temperature}, top_p=0.9)`);
  const outputTokens = await model.generate(generateArgs);

  // ── 6. Decode ──
  const inputLength = inputs.input_ids.dims[1];
  const generatedTokens = outputTokens.slice(null, [inputLength, null]);

  const decoded = processor.batch_decode(generatedTokens, {
    skip_special_tokens: true,
  });

  const endTime = performance.now();
  const tokenCount = generatedTokens.dims?.[1] || 0;
  log(`done — ${tokenCount} tokens in ${Math.round(endTime - startTime)}ms`);

  return {
    text: decoded[0]?.trim() || "분석 결과를 생성하지 못했습니다.",
    processingTime: Math.round(endTime - startTime),
    tokenCount,
  };
}
