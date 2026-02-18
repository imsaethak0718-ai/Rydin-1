/**
 * ID Card Scanner V3 — Two-Pass Targeted OCR for SRM ID Cards
 * 
 * Strategy: 
 *   Pass 1: Quick OCR on full card to FIND the "Name" line and its bounding box
 *   Pass 2: Crop just the name text, upscale 3x, re-OCR with SINGLE_LINE mode
 * 
 * This is MUCH more accurate because:
 *   - Watermarks/noise are minimal in the small cropped region
 *   - Text is upscaled to very high resolution
 *   - Tesseract knows it's reading a single line, not a full page
 * 
 * Also faster: only 2 rotations (0°, 90°) × 2 passes = max 4 OCR calls
 */

import { createWorker, OEM, PSM } from 'tesseract.js';

export interface IDScanResult {
  isValid: boolean;
  error?: string;
  name?: string;
  idNumber?: string;
  collegeName?: string;
  imageBase64?: string;
  confidence?: number;
}

// ─────────────────────────────────────────────
// CANVAS UTILITIES
// ─────────────────────────────────────────────

const loadImage = (base64: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64;
  });

/** Rotate image by degrees */
const rotateCanvas = (img: HTMLImageElement, degrees: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  if (degrees === 90 || degrees === 270) {
    canvas.width = img.height;
    canvas.height = img.width;
  } else {
    canvas.width = img.width;
    canvas.height = img.height;
  }
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas;
};

/** Scale canvas so the smaller dimension is at least targetMin pixels */
const scaleUp = (source: HTMLCanvasElement, targetMin: number): HTMLCanvasElement => {
  const minDim = Math.min(source.width, source.height);
  if (minDim >= targetMin) return source;
  const scale = targetMin / minDim;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/** Crop a region from a canvas */
const cropCanvas = (
  source: HTMLCanvasElement,
  x: number, y: number, w: number, h: number
): HTMLCanvasElement => {
  // Clamp to canvas bounds
  const sx = Math.max(0, Math.round(x));
  const sy = Math.max(0, Math.round(y));
  const sw = Math.min(Math.round(w), source.width - sx);
  const sh = Math.min(Math.round(h), source.height - sy);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
};

/** Upscale a canvas by a fixed factor */
const upscaleCanvas = (source: HTMLCanvasElement, factor: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * factor);
  canvas.height = Math.round(source.height * factor);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

// ─────────────────────────────────────────────
// IMAGE PREPROCESSING
// ─────────────────────────────────────────────

/** Convert to grayscale */
const grayscale = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    d[i] = g; d[i + 1] = g; d[i + 2] = g;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
};

/**
 * Adaptive threshold — handles watermarks and uneven lighting
 * For each pixel, compares against the LOCAL mean in a block around it
 */
const adaptiveThreshold = (source: HTMLCanvasElement, blockSize: number = 25, C: number = 10): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const w = canvas.width, h = canvas.height;

  // Build integral image
  const integral = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += d[(y * w + x) * 4];
      integral[y * w + x] = rowSum + (y > 0 ? integral[(y - 1) * w + x] : 0);
    }
  }

  const half = Math.floor(blockSize / 2);
  const result = new Uint8ClampedArray(d.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half), y1 = Math.max(0, y - half);
      const x2 = Math.min(w - 1, x + half), y2 = Math.min(h - 1, y + half);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      let sum = integral[y2 * w + x2];
      if (x1 > 0) sum -= integral[y2 * w + (x1 - 1)];
      if (y1 > 0) sum -= integral[(y1 - 1) * w + x2];
      if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * w + (x1 - 1)];
      const mean = sum / area;
      const idx = (y * w + x) * 4;
      const val = d[idx] > (mean - C) ? 255 : 0;
      result[idx] = val; result[idx + 1] = val; result[idx + 2] = val; result[idx + 3] = 255;
    }
  }

  ctx.putImageData(new ImageData(result, w, h), 0, 0);
  return canvas;
};

/** Simple contrast enhancement */
const enhanceContrast = (source: HTMLCanvasElement, strength: number = 1.8): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    let val = ((d[i] / 255 - 0.5) * strength + 0.5) * 255;
    val = Math.max(0, Math.min(255, Math.round(val)));
    d[i] = val; d[i + 1] = val; d[i + 2] = val;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
};

/** Light preprocessing for Pass 1 (finding labels) — fast */
const preprocessForLabelDetection = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const scaled = scaleUp(canvas, 1200);
  const gray = grayscale(scaled);
  return enhanceContrast(gray, 1.5);
};

/** Heavy preprocessing for Pass 2 (reading name text) — accurate */
const preprocessForNameReading = (canvas: HTMLCanvasElement): HTMLCanvasElement[] => {
  // Return multiple variants — we'll OCR each and pick best
  const gray = grayscale(canvas);
  const variants: HTMLCanvasElement[] = [];

  // Variant 1: Adaptive threshold (handles watermarks best)
  variants.push(adaptiveThreshold(gray, 21, 8));

  // Variant 2: High contrast (handles faded text)
  variants.push(enhanceContrast(gray, 2.5));

  // Variant 3: Adaptive with larger block (handles large watermarks)
  variants.push(adaptiveThreshold(gray, 41, 15));

  return variants;
};

// ─────────────────────────────────────────────
// TWO-PASS OCR ENGINE
// ─────────────────────────────────────────────

/** Score how well OCR text matches SRM card structure */
const scoreSRMText = (text: string): number => {
  let score = 0;
  const t = text.toLowerCase();
  if (/name\s*[:;.]/i.test(text)) score += 50;
  if (t.includes('programme')) score += 20;
  if (t.includes('register')) score += 15;
  if (/b\.?\s*tech/i.test(text)) score += 15;
  if (/ra\d{5,}/i.test(text)) score += 20;
  if (t.includes('srm')) score += 10;
  if (t.includes('faculty')) score += 8;
  if (t.includes('engineering')) score += 8;
  if (t.includes('kattankulathur')) score += 8;
  if (t.includes('valid')) score += 5;
  return score;
};

interface TesseractLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

/**
 * Pass 1: Find the "Name" line on the card and return its bounding box
 */
const findNameLine = (lines: TesseractLine[]): {
  nameLineIdx: number;
  colonX: number;
  lineBbox: { x0: number; y0: number; x1: number; y1: number };
} | null => {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if this line contains "Name" (with OCR tolerance)
    if (/[Nn][ae]m[ec]?\s*[:;.]/i.test(line.text) || /^[Nn]ame/i.test(line.text)) {
      // Find the ":" position in this line
      let colonX = line.bbox.x0;
      for (const word of line.words) {
        if (word.text.includes(':') || word.text.includes(';')) {
          colonX = word.bbox.x1;
          break;
        }
      }
      // If no colon found, estimate it as ~30% into the line (after "Name" label)
      if (colonX === line.bbox.x0) {
        colonX = line.bbox.x0 + (line.bbox.x1 - line.bbox.x0) * 0.25;
      }

      return { nameLineIdx: i, colonX, lineBbox: line.bbox };
    }
  }
  return null;
};

/**
 * Determine the crop region for the name text
 * Includes the current line (after ":") and possibly next line for multi-line names
 */
const getNameCropRegion = (
  lines: TesseractLine[],
  nameLineIdx: number,
  colonX: number,
  lineBbox: { x0: number; y0: number; x1: number; y1: number },
  canvasWidth: number
): { x: number; y: number; w: number; h: number } => {
  const lineHeight = lineBbox.y1 - lineBbox.y0;
  const padding = Math.max(lineHeight * 0.3, 8);

  let cropY = lineBbox.y0 - padding;
  let cropH = lineHeight + padding * 2;

  // Check if next line is continuation of name (not "Programme" etc.)
  if (nameLineIdx + 1 < lines.length) {
    const nextLine = lines[nameLineIdx + 1];
    const isLabel = /programme|program|register|valid|b\.?tech|faculty/i.test(nextLine.text);
    if (!isLabel && nextLine.text.trim().length > 1) {
      // Extend crop to include next line (multi-line name like "KANTE REVANTH SAI\nVEERABHADRA")
      cropH = (nextLine.bbox.y1 - cropY) + padding;
    }
  }

  return {
    x: colonX + 2,
    y: Math.max(0, cropY),
    w: canvasWidth - colonX - 2,
    h: cropH,
  };
};

/**
 * Clean name text from OCR output
 */
const cleanNameText = (text: string): string => {
  return text
    // Remove SRM watermark artifacts
    .replace(/[OoC]?S\s*R\s*[MNW]/gi, '')
    .replace(/\bSRM\b/gi, '')
    .replace(/\bOSRM\b/gi, '')
    // Remove field labels that might bleed in
    .replace(/programme/gi, '')
    .replace(/register/gi, '')
    .replace(/b\.?\s*tech/gi, '')
    .replace(/\(?\s*cse\s*\)?/gi, '')
    // Remove numbers
    .replace(/[0-9]/g, '')
    // Remove stray punctuation
    .replace(/[:;.,()]/g, ' ')
    // Remove single characters (noise)
    .replace(/\b[a-zA-Z]\b/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Extract reg number from full OCR text
 */
const extractRegNo = (text: string): string | null => {
  const m = text.match(/(RA\d{8,})/i) || text.match(/([A-Z]{2}\d{10,})/);
  return m ? m[1] : null;
};

/**
 * Main two-pass OCR pipeline
 */
const twoPassOCR = async (
  img: HTMLImageElement
): Promise<{ name: string | null; regNo: string | null; fullText: string; confidence: number }> => {
  // Create worker once, reuse for all passes
  const worker = await createWorker('eng', OEM.LSTM_ONLY);
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: '1',
  });

  const rotations = [0, 90]; // Only realistic orientations
  let bestPass1 = { text: '', lines: [] as TesseractLine[], score: -1, rotation: 0, canvas: null as HTMLCanvasElement | null };

  // ── PASS 1: Find the best rotation and locate "Name" ──
  for (const deg of rotations) {
    console.log(`🔄 Pass 1 — trying rotation ${deg}°`);
    const base = deg === 0
      ? (() => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d')!.drawImage(img, 0, 0); return c; })()
      : rotateCanvas(img, deg);

    const preprocessed = preprocessForLabelDetection(base);
    const base64 = preprocessed.toDataURL('image/png');

    const { data } = await worker.recognize(base64);
    const score = scoreSRMText(data.text);
    console.log(`  Score: ${score} | Found "Name": ${/name\s*[:;.]/i.test(data.text)}`);

    if (score > bestPass1.score) {
      bestPass1 = {
        text: data.text,
        lines: data.lines as TesseractLine[],
        score,
        rotation: deg,
        canvas: preprocessed,
      };
    }

    // Good enough — stop trying rotations
    if (score >= 60) break;
  }

  console.log(`\n✅ Best rotation: ${bestPass1.rotation}° (score: ${bestPass1.score})`);
  console.log('📄 Full text:', bestPass1.text);

  const regNo = extractRegNo(bestPass1.text);
  const isSRM = bestPass1.score >= 15;

  // Find the "Name" line
  const nameLocation = findNameLine(bestPass1.lines);

  if (!nameLocation || !bestPass1.canvas) {
    // Fallback: try regex extraction from full text
    console.log('⚠️ Could not locate "Name" line, falling back to regex');
    const fallbackName = extractNameFromFullText(bestPass1.text);
    await worker.terminate();
    return { name: fallbackName, regNo, fullText: bestPass1.text, confidence: bestPass1.score / 100 };
  }

  console.log(`📍 "Name" found at line ${nameLocation.nameLineIdx}, colon at x=${nameLocation.colonX}`);

  // ── PASS 2: Crop and re-OCR the name region ──
  const cropRegion = getNameCropRegion(
    bestPass1.lines,
    nameLocation.nameLineIdx,
    nameLocation.colonX,
    nameLocation.lineBbox,
    bestPass1.canvas.width
  );

  console.log(`✂️ Cropping name region: x=${cropRegion.x}, y=${cropRegion.y}, w=${cropRegion.w}, h=${cropRegion.h}`);

  // Get the original (non-preprocessed) rotated canvas for cropping
  const originalRotated = bestPass1.rotation === 0
    ? (() => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d')!.drawImage(img, 0, 0); return c; })()
    : rotateCanvas(img, bestPass1.rotation);

  // Scale factor between preprocessed and original (we need to map bbox coordinates)
  const scaleX = originalRotated.width / bestPass1.canvas.width;
  const scaleY = originalRotated.height / bestPass1.canvas.height;

  // Crop from original image (unpreprocessed for best quality)
  const nameCrop = cropCanvas(
    originalRotated,
    cropRegion.x * scaleX,
    cropRegion.y * scaleY,
    cropRegion.w * scaleX,
    cropRegion.h * scaleY
  );

  // Upscale the tiny crop 3x for much better OCR
  const upscaled = upscaleCanvas(nameCrop, 3);

  // Try multiple preprocessing variants on the cropped name
  const nameVariants = preprocessForNameReading(upscaled);

  // Switch to SINGLE_LINE mode for the name
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // SINGLE_BLOCK handles 1-2 line names
  });

  let bestName = '';
  let bestNameConfidence = 0;

  for (let v = 0; v < nameVariants.length; v++) {
    const varBase64 = nameVariants[v].toDataURL('image/png');
    const { data: nameData } = await worker.recognize(varBase64);
    const rawName = nameData.text.trim();
    const cleaned = cleanNameText(rawName);
    const avgConfidence = nameData.words.length > 0
      ? nameData.words.reduce((sum: number, w: any) => sum + w.confidence, 0) / nameData.words.length
      : 0;

    console.log(`  📝 Name variant ${v}: "${rawName}" → cleaned: "${cleaned}" (confidence: ${avgConfidence.toFixed(0)})`);

    if (cleaned.length > bestName.length || (cleaned.length === bestName.length && avgConfidence > bestNameConfidence)) {
      bestName = cleaned;
      bestNameConfidence = avgConfidence;
    }
  }

  await worker.terminate();

  // If pass 2 failed, fall back to pass 1 text extraction
  if (!bestName || bestName.length < 2) {
    console.log('⚠️ Pass 2 failed, falling back to Pass 1 text');
    bestName = extractNameFromFullText(bestPass1.text) || '';
  }

  return {
    name: bestName || null,
    regNo,
    fullText: bestPass1.text,
    confidence: isSRM ? Math.min(bestNameConfidence / 100, 1.0) : 0.3,
  };
};

/**
 * Fallback: extract name from full OCR text using regex
 */
const extractNameFromFullText = (text: string): string | null => {
  const patterns = [
    /[Nn][ae]m[ec]?\s*[:;.]\s*(.+?)(?=\s*\n|\s*Programme|\s*Program|\s*Register|$)/i,
    /[Nn]ame\s*[:;.]\s*(.+)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const cleaned = cleanNameText(m[1]);
      if (cleaned.length >= 3) return cleaned.toUpperCase();
    }
  }
  return null;
};

// ─────────────────────────────────────────────
// FUZZY NAME MATCHING
// ─────────────────────────────────────────────

const levenshtein = (a: string, b: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[b.length][a.length];
};

const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Word-level fuzzy name matching
 * Handles: OCR typos, garbled surnames, initials, middle names
 */
export const fuzzyNameMatch = (
  profileName: string,
  idName: string
): { match: boolean; similarity: number } => {
  const a = normalize(profileName);
  const b = normalize(idName);

  if (!a || !b) return { match: false, similarity: 0 };
  if (a === b) return { match: true, similarity: 1.0 };

  const aWords = a.split(' ').filter(w => w.length >= 2);
  const bWords = b.split(' ').filter(w => w.length >= 2);

  // Full string similarity
  const fullSim = 1 - levenshtein(a, b) / Math.max(a.length, b.length);

  // Word-level matching
  let wordMatches = 0;
  const usedB = new Set<number>();
  for (const aw of aWords) {
    for (let j = 0; j < bWords.length; j++) {
      if (usedB.has(j)) continue;
      const bw = bWords[j];
      const wSim = 1 - levenshtein(aw, bw) / Math.max(aw.length, bw.length);
      // Also check prefix matching (OCR truncation: "PRITHISH" → "PRITHI")
      const prefixSim = (aw.startsWith(bw) || bw.startsWith(aw))
        ? Math.max(0.85, Math.min(aw.length, bw.length) / Math.max(aw.length, bw.length))
        : 0;
      if (Math.max(wSim, prefixSim) >= 0.6) {
        wordMatches++;
        usedB.add(j);
        break;
      }
    }
  }

  const totalWords = Math.max(aWords.length, bWords.length);
  const wordSim = totalWords > 0 ? wordMatches / totalWords : 0;

  // First-name matching (most important for verification)
  let firstNameSim = 0;
  if (aWords[0] && aWords[0].length >= 3) {
    for (const bw of bWords) {
      const sim = 1 - levenshtein(aWords[0], bw) / Math.max(aWords[0].length, bw.length);
      const prefix = (aWords[0].startsWith(bw) || bw.startsWith(aWords[0]))
        ? Math.max(0.85, Math.min(aWords[0].length, bw.length) / Math.max(aWords[0].length, bw.length))
        : 0;
      firstNameSim = Math.max(firstNameSim, sim, prefix);
    }
  }

  // Contains check
  const contains = aWords.some(w => w.length >= 3 && bWords.some(bw => bw.includes(w) || w.includes(bw)));

  const similarity = Math.max(
    fullSim,
    wordSim * 0.95,
    firstNameSim >= 0.7 ? Math.max(0.78, firstNameSim * 0.9) : 0,
    contains ? 0.85 : 0
  );

  const isMatch =
    similarity >= 0.60 ||
    (firstNameSim >= 0.65 && wordMatches >= 1) ||
    wordMatches >= 2 ||
    contains;

  return { match: isMatch, similarity: Math.min(similarity, 1.0) };
};

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────

/**
 * Process ID card image — two-pass targeted OCR
 */
export const extractIDText = async (imageBase64: string): Promise<IDScanResult> => {
  try {
    console.log('🔍 Starting V3 two-pass OCR...');
    const img = await loadImage(imageBase64);
    console.log(`📐 Image: ${img.width}×${img.height}`);

    const { name, regNo, fullText, confidence } = await twoPassOCR(img);

    const isSRM = scoreSRMText(fullText) >= 15;

    if (!name || name.length < 2) {
      return {
        isValid: false,
        error: 'Could not read the name from your ID. Please try with better lighting and ensure the full card is visible.',
        imageBase64,
        confidence: 0,
      };
    }

    return {
      isValid: true,
      name: name.toUpperCase(),
      idNumber: regNo || 'Unknown',
      collegeName: isSRM ? 'SRM Institute of Science and Technology' : 'Unknown College',
      imageBase64,
      confidence,
    };
  } catch (error) {
    console.error('OCR failed:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'OCR failed. Please try again.',
    };
  }
};

// ─────────────────────────────────────────────
// CAMERA, STORAGE, UTILITY (unchanged)
// ─────────────────────────────────────────────

export const initializeOpenCV = (): Promise<void> => Promise.resolve();

export const captureFromCamera = async (): Promise<string> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        video.srcObject = stream;
        video.play();
        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          setTimeout(() => {
            ctx?.drawImage(video, 0, 0);
            stream.getTracks().forEach(t => t.stop());
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          }, 500);
        };
      })
      .catch(e => reject(new Error(`Camera access failed: ${e.message}`)));
  });

export const validateIDData = (data: IDScanResult): boolean =>
  data.isValid && !!data.name && data.name.length >= 3;

const base64ToBlob = (base64: string): Blob => {
  const bstr = atob(base64.split(',')[1]);
  const u8 = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
  return new Blob([u8], { type: 'image/jpeg' });
};

export const uploadIDImage = async (imageBase64: string, userId: string): Promise<string | null> => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const blob = base64ToBlob(imageBase64);
    const { data, error } = await supabase.storage.from('user-verifications')
      .upload(`id-${userId}-${Date.now()}.jpg`, blob, { cacheControl: '3600', upsert: true });
    if (error) throw error;
    return supabase.storage.from('user-verifications').getPublicUrl(data.path).data.publicUrl;
  } catch (e) { console.error('Upload failed:', e); return null; }
};

export const saveIDVerification = async (userId: string, imageUrl: string, data: IDScanResult): Promise<boolean> => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { error } = await supabase.from('user_verifications').upsert({
      user_id: userId, name: data.name || 'Unknown', id_number: data.idNumber || 'Unknown',
      college_name: data.collegeName || 'Unknown', photo_url: imageUrl, verified: true,
    }, { onConflict: 'user_id' });
    if (error) throw error;
    try {
      const { error: pe } = await supabase.from('profiles').update({ identity_verified: true, phone_verified: true }).eq('id', userId);
      if (pe) await supabase.from('profiles').update({ phone_verified: true }).eq('id', userId);
    } catch { /* non-critical */ }
    return true;
  } catch (e) { console.error('Save failed:', e); return false; }
};

export const checkIDVerification = async (userId: string): Promise<boolean> => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data } = await supabase.from('user_verifications').select('user_id').eq('user_id', userId).eq('verified', true).maybeSingle();
    return !!data;
  } catch { return false; }
};

export const getVerificationBadge = (isVerified: boolean) => ({
  text: isVerified ? 'Verified Student' : 'Unverified',
  color: isVerified ? 'text-green-600' : 'text-gray-500',
  bg: isVerified ? 'bg-green-100' : 'bg-gray-100',
  icon: isVerified ? '✓' : '○',
});

export const formatIDNumber = (id: string): string =>
  id.length <= 4 ? id : `****${id.slice(-4)}`;
