/**
 * ID Card Scanner V5.0 — Robust OCR for low-quality laminated SRM ID photos
 *
 * V5.0 improvements:
 *   1. Orientation sweep now includes 180° and runs a two-stage best-rotation search.
 *   2. Added card-focus crops + binarization variant for noisy backgrounds/glare.
 *   3. Reworked Name extraction with token-based parser around "Name:" labels.
 *   4. Stronger fuzzy matching for missing middle names, split surnames, and OCR noise.
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

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const canvasFromImage = (img: HTMLImageElement): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
};

const rotateCanvas = (img: HTMLImageElement, deg: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  if (deg === 90 || deg === 270) { c.width = img.height; c.height = img.width; }
  else { c.width = img.width; c.height = img.height; }
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return c;
};

const scaleUp = (src: HTMLCanvasElement, targetMin: number): HTMLCanvasElement => {
  const minDim = Math.min(src.width, src.height);
  if (minDim >= targetMin) return src;
  const s = targetMin / minDim;
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
};

const cropCanvas = (
  source: HTMLCanvasElement,
  xRatio: number,
  yRatio: number,
  wRatio: number,
  hRatio: number
): HTMLCanvasElement => {
  const sx = Math.max(0, Math.floor(source.width * xRatio));
  const sy = Math.max(0, Math.floor(source.height * yRatio));
  const sw = Math.max(1, Math.floor(source.width * wRatio));
  const sh = Math.max(1, Math.floor(source.height * hRatio));
  const boundedW = Math.min(sw, source.width - sx);
  const boundedH = Math.min(sh, source.height - sy);

  const c = document.createElement('canvas');
  c.width = boundedW;
  c.height = boundedH;
  c.getContext('2d')!.drawImage(source, sx, sy, boundedW, boundedH, 0, 0, boundedW, boundedH);
  return c;
};

const buildCardFocusCrops = (source: HTMLCanvasElement): HTMLCanvasElement[] => {
  // Many user uploads contain hand/background around the card.
  // Keep a few deterministic crops to isolate ID text area.
  const crops = [
    source,
    cropCanvas(source, 0.06, 0.04, 0.88, 0.92), // card-centered crop
    cropCanvas(source, 0.14, 0.30, 0.72, 0.38), // name + reg no area
  ];

  // Deduplicate exact-size duplicates (happens on already tight crops)
  const unique: HTMLCanvasElement[] = [];
  const seen = new Set<string>();
  for (const c of crops) {
    const key = `${c.width}x${c.height}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  return unique;
};

/**
 * Sharpen image using unsharp mask technique.
 * Helps Tesseract read blurry/faded text on laminated cards.
 */
const sharpen = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = source.width; c.height = source.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const d = imgData.data;
  const w = c.width, h = c.height;

  // Copy original for reference
  const orig = new Uint8ClampedArray(d);

  // Apply 3x3 sharpening kernel: center=5, neighbors=-1
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const val =
          5 * orig[i + ch] -
          orig[((y - 1) * w + x) * 4 + ch] -
          orig[((y + 1) * w + x) * 4 + ch] -
          orig[(y * w + x - 1) * 4 + ch] -
          orig[(y * w + x + 1) * 4 + ch];
        d[i + ch] = Math.max(0, Math.min(255, val));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
};

// ─────────────────────────────────────────────
// IMAGE PREPROCESSING
// ─────────────────────────────────────────────

/**
 * Color-based text isolation — FALLBACK only
 * Keeps dark, non-colored pixels (black printed text)
 * Removes colored watermarks and light backgrounds
 */
const isolateText = (source: HTMLCanvasElement, brightMax: number, colorMax: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = source.width; c.height = source.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const brightness = (r + g + b) / 3;
    const colorRange = Math.max(r, g, b) - Math.min(r, g, b);

    if (brightness < brightMax && colorRange < colorMax) {
      d[i] = 0; d[i + 1] = 0; d[i + 2] = 0;
    } else if (brightness < (brightMax + 30) && colorRange < (colorMax - 20)) {
      d[i] = 50; d[i + 1] = 50; d[i + 2] = 50;
    } else {
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
};

/**
 * Simple sharpen + contrast boost — gentle enhancement without destroying text
 */
const enhanceContrast = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = source.width; c.height = source.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const d = imgData.data;

  // Convert to grayscale + histogram stretch
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    d[i] = g; d[i + 1] = g; d[i + 2] = g;
    hist[g]++;
  }
  const total = c.width * c.height;
  let low = 0, high = 255, cum = 0;
  for (let i = 0; i < 256; i++) {
    cum += hist[i];
    if (cum < total * 0.03) low = i;
    if (cum < total * 0.97) high = i;
  }
  const range = Math.max(high - low, 1);
  for (let i = 0; i < d.length; i += 4) {
    let val = Math.round(((d[i] - low) / range) * 255);
    val = Math.max(0, Math.min(255, val));
    d[i] = val; d[i + 1] = val; d[i + 2] = val;
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
};

/**
 * Otsu binarization: robust fallback for faded text on laminated backgrounds.
 */
const binarizeOtsu = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const d = imgData.data;

  const hist = new Array(256).fill(0);
  const gray = new Uint8Array(c.width * c.height);

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const g = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    gray[p] = g;
    hist[g]++;
  }

  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const val = gray[p] > threshold ? 255 : 0;
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
  }

  ctx.putImageData(imgData, 0, 0);
  return c;
};

// ─────────────────────────────────────────────
// SRM CARD TEXT ANALYSIS
// ─────────────────────────────────────────────

const scoreSRM = (text: string): number => {
  let s = 0;
  if (/name\s*[:;.]/i.test(text)) s += 50;
  if (/\bname\b/i.test(text)) s += 20;
  if (/programme/i.test(text)) s += 20;
  if (/register/i.test(text)) s += 15;
  if (/b\.?\s*tech/i.test(text)) s += 15;
  if (/ra\d{5,}/i.test(text)) s += 20;
  if (/srm/i.test(text)) s += 10;
  if (/faculty/i.test(text)) s += 8;
  if (/engineering/i.test(text)) s += 8;
  if (/kattankulathur/i.test(text)) s += 8;
  if (/valid/i.test(text)) s += 5;
  return s;
};

const extractRegNo = (text: string): string | null => {
  const m = text.match(/(RA\d{8,})/i) || text.match(/([A-Z]{2}\d{10,})/);
  return m ? m[1] : null;
};

// Words on SRM cards that are NOT student names
const NON_NAME = new Set([
  'SRM', 'OSRM', 'CSRM', 'OSFIM', 'GSRM', 'DSRM',
  'FACULTY', 'ENGINEERING', 'TECHNOLOGY', 'INSTITUTE', 'SCIENCE',
  'PROGRAMME', 'REGISTER', 'VALID', 'FROM', 'CAMPUS', 'STUDENT',
  'KATTANKULATHUR', 'CHENGALPATTU', 'CHENGALP', 'TAMIL', 'NADU',
  'EMAIL', 'WEBSITE', 'PHONE', 'DEEMED', 'UNIVERSITY', 'UGC', 'ACT',
  'TECH', 'BTECH', 'NAME', 'THE', 'AND', 'FOR', 'WITH',
  'CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'ENGG', 'SOFTWARE', 'IT', 'AIML',
  'JUN', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]);

const isNameWord = (w: string): boolean => {
  if (w.length === 0) return false;
  if (NON_NAME.has(w.toUpperCase())) return false;
  if (/^\d+$/.test(w)) return false;
  if (/RA\d{4,}/i.test(w)) return false;
  return true;
};

/**
 * Extract ALL possible name candidates from OCR text
 */
const fixCommonOCRNoise = (s: string): string =>
  s
    .replace(/0/g, 'O')
    .replace(/1(?=[A-Z])/g, 'I')
    .replace(/\$/g, 'S')
    .replace(/\|/g, 'I')
    .replace(/\{/g, '(')
    .replace(/5(?=[A-Z])/g, 'S')
    .replace(/8(?=[A-Z])/g, 'B')
    .replace(/[@#*~`]/g, ' ')
    .replace(/\s+/g, ' ');

const NAME_STOP_WORDS = new Set([
  'PROGRAMME', 'PROGRAM', 'REGISTER', 'VALID', 'FROM', 'TO', 'COLLEGE',
  'FACULTY', 'ENGINEERING', 'TECHNOLOGY', 'CAMPUS', 'KATTANKULATHUR',
  'CHENGALPATTU', 'PHONE', 'EMAIL', 'WEBSITE', 'DEPARTMENT',
]);

const normalizeNameCandidate = (raw: string): string => {
  const corrected = fixCommonOCRNoise(raw.toUpperCase());
  const cleaned = corrected.replace(/[^A-Z.\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleaned
    .split(' ')
    .map(w => w.replace(/\.+$/g, ''))
    .filter(w => w.length > 0 && isNameWord(w) && !NAME_STOP_WORDS.has(w));

  // Most names are 1-4 words on these cards; trim noisy tails.
  const finalWords = words.slice(0, 4);
  return finalWords.join(' ').trim();
};

const extractCandidates = (text: string): string[] => {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (raw: string) => {
    const cleaned = normalizeNameCandidate(raw);
    if (cleaned.length < 3) return;
    const dedupeKey = cleaned.replace(/\s/g, '');
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      candidates.push(cleaned);
    }
  };

  const normalizedText = fixCommonOCRNoise(text.replace(/\r/g, '\n'));

  // Strategy 1: Text between "Name" and next structural label.
  const between = normalizedText.match(
    /(?:^|\n)\s*(?:NAME|NANE|NAIME|NARNE)\s*[:;.]\s*([\s\S]*?)(?=\bPROGRAMME\b|\bPROGRAM\b|\bREGISTER\b|\bVALID\b|\n{2,}|$)/i
  );
  if (between?.[1]) addCandidate(between[1].replace(/\n/g, ' '));

  // Strategy 2: line-level parse around Name label.
  for (const line of normalizedText.split('\n')) {
    if (!/(?:^|\s)(?:NAME|NANE|NAIME|NARNE)\s*[:;.]/i.test(line)) continue;
    const rhs = line.replace(/^.*?(?:NAME|NANE|NAIME|NARNE)\s*[:;.]\s*/i, '');
    addCandidate(rhs);
  }

  // Strategy 3: token scan after Name label to handle wrapped names.
  const tokens = normalizedText
    .replace(/[:;,.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i].toUpperCase().replace(/[^A-Z]/g, '');
    if (!['NAME', 'NANE', 'NAIME', 'NARNE'].includes(tk)) continue;

    const captured: string[] = [];
    for (let j = i + 1; j < tokens.length && captured.length < 4; j++) {
      const w = tokens[j].toUpperCase().replace(/[^A-Z]/g, '');
      if (!w) continue;
      if (NAME_STOP_WORDS.has(w) || /^(RA[A-Z0-9]{4,}|BTECH|TECH|CSE|ECE|EEE|IT|AIML)$/.test(w)) break;
      if (isNameWord(w)) captured.push(w);
    }
    if (captured.length > 0) addCandidate(captured.join(' '));
  }

  // Strategy 4: uppercase dominant sequences on lines that look like name rows.
  for (const line of normalizedText.split('\n')) {
    if (/programme|register|valid|faculty|engineering|technology|campus|kattankulathur|email|website|044-/i.test(line)) continue;
    if ((line.match(/\d/g) || []).length > 4) continue;
    const likelyName = line.match(/[A-Z]{2,}(?:\s+[A-Z]{2,}){0,3}/g) || [];
    for (const seq of likelyName) addCandidate(seq);
  }

  // Strategy 5: merge split surname fragments ("MANGALWED HEKAR" -> "MANGALWEDHEKAR").
  const merged: string[] = [];
  for (const c of [...candidates]) {
    const parts = c.split(' ');
    if (parts.length < 2) continue;
    for (let i = 0; i < parts.length - 1; i++) {
      const m = [...parts];
      if (parts[i].length >= 4 && parts[i + 1].length >= 3) {
        m.splice(i, 2, parts[i] + parts[i + 1]);
        merged.push(m.join(' '));
      }
    }
  }
  for (const m of merged) addCandidate(m);

  return candidates;
};

// ─────────────────────────────────────────────
// FUZZY NAME MATCHING (FIXED — no more false positives)
// ─────────────────────────────────────────────

const levenshtein = (a: string, b: string): number => {
  const m: number[][] = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  return m[b.length][a.length];
};

const norm = (s: string) =>
  fixCommonOCRNoise(s.toUpperCase())
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const jaroWinkler = (s1: string, s2: string): number => {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (!len1 || !len2) return 0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;

  let t = 0;
  for (let i = 0, k = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }

  const transpositions = t / 2;
  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3;

  let prefix = 0;
  const prefixLimit = Math.min(4, len1, len2);
  while (prefix < prefixLimit && s1[prefix] === s2[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
};

export const fuzzyNameMatch = (
  profileName: string,
  idName: string
): { match: boolean; similarity: number } => {
  const a = norm(profileName);
  const b = norm(idName);
  if (!a || !b) return { match: false, similarity: 0 };
  if (a === b) return { match: true, similarity: 1.0 };

  const aWords = a.split(' ').filter(w => w.length >= 2 && !NAME_STOP_WORDS.has(w.toUpperCase()));
  const bWords = b.split(' ').filter(w => w.length >= 2 && !NAME_STOP_WORDS.has(w.toUpperCase()));

  if (aWords.length === 0 || bWords.length === 0) return { match: false, similarity: 0 };

  // Word-merge: OCR often splits long surnames into two tokens.
  const bMerged: string[] = [...bWords];
  const aMerged: string[] = [...aWords];
  for (let j = 0; j < bWords.length - 1; j++) {
    const merged = bWords[j] + bWords[j + 1];
    if (merged.length >= 6) bMerged.push(merged);
    if (j < bWords.length - 2) {
      const merged3 = bWords[j] + bWords[j + 1] + bWords[j + 2];
      if (merged3.length >= 8) bMerged.push(merged3);
    }
  }
  for (let j = 0; j < aWords.length - 1; j++) {
    const merged = aWords[j] + aWords[j + 1];
    if (merged.length >= 6) aMerged.push(merged);
  }

  // Full-string and order-invariant similarities.
  const fullSim = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const sortedA = [...aWords].sort().join(' ');
  const sortedB = [...bWords].sort().join(' ');
  const tokenOrderInvariantSim =
    sortedA && sortedB
      ? 1 - levenshtein(sortedA, sortedB) / Math.max(sortedA.length, sortedB.length)
      : 0;

  const wordSimilarity = (w1: string, w2: string): number => {
    const wSim = 1 - levenshtein(w1, w2) / Math.max(w1.length, w2.length);
    const jw = jaroWinkler(w1, w2);
    return Math.max(wSim, jw);
  };

  let wordMatches = 0;
  let matchedSimSum = 0;
  const usedB = new Set<number>();
  for (const aw of aMerged) {
    let bestSim = 0;
    let bestJ = -1;
    const threshold = aw.length >= 8 ? 0.46 : 0.58;

    for (let j = 0; j < bMerged.length; j++) {
      if (usedB.has(j)) continue;
      const sim = wordSimilarity(aw, bMerged[j]);
      if (sim > bestSim) { bestSim = sim; bestJ = j; }
    }
    if (bestSim >= threshold && bestJ >= 0) {
      wordMatches++;
      matchedSimSum += bestSim;
      usedB.add(bestJ);
    }
  }

  const totalWords = Math.max(aMerged.length, 1);
  const coverage = wordMatches / totalWords;
  const avgWordSim = matchedSimSum / Math.max(wordMatches, 1);
  const wordSim = coverage * avgWordSim;

  // First and last word anchors are strong signals for real identity match.
  let firstSim = 0;
  let lastSim = 0;
  if (aWords[0]?.length >= 2) {
    for (const bw of bMerged) {
      if (bw.length < 2) continue;
      firstSim = Math.max(firstSim, wordSimilarity(aWords[0], bw));
    }
  }
  if (aWords[aWords.length - 1]?.length >= 2) {
    for (const bw of bMerged) {
      if (bw.length < 2) continue;
      lastSim = Math.max(lastSim, wordSimilarity(aWords[aWords.length - 1], bw));
    }
  }

  // Containment check with length-ratio guard to avoid short-word false positives.
  const contains = aWords.some(aw =>
    aw.length >= 4 && bMerged.some(bw => {
      if (bw.length < 4) return false;
      const shorter = Math.min(aw.length, bw.length);
      const longer = Math.max(aw.length, bw.length);
      if (shorter / longer < 0.6) return false;
      return aw.includes(bw) || bw.includes(aw);
    })
  );

  // Penalize obvious garbage strings from OCR.
  const garbagePenalty = /^(?:[a-z]\s*){1,3}$/i.test(b) ? 0.2 : 0;

  const anchorScore = firstSim * 0.55 + lastSim * 0.45;
  const similarity = Math.max(
    fullSim * 0.85 + wordSim * 0.35,
    tokenOrderInvariantSim * 0.8 + wordSim * 0.4,
    anchorScore * 0.9,
    contains ? 0.84 : 0
  );
  const finalSimilarity = Math.max(0, Math.min(1, similarity - garbagePenalty));

  // Match decision: allow missing middle name but require strong anchors/coverage.
  const isMatch =
    finalSimilarity >= 0.67 ||
    (firstSim >= 0.86 && (lastSim >= 0.62 || coverage >= 0.5)) ||
    (firstSim >= 0.78 && lastSim >= 0.70) ||
    (contains && wordMatches >= 2);

  return { match: isMatch, similarity: finalSimilarity };
};

// ─────────────────────────────────────────────
// CANDIDATE SELECTION
// ─────────────────────────────────────────────

const pickBest = (candidates: string[], profileName?: string): { name: string; similarity: number } => {
  if (candidates.length === 0) return { name: '', similarity: 0 };
  if (!profileName) return { name: candidates[0], similarity: 0.5 };

  let best = { name: candidates[0], similarity: 0 };
  for (const c of candidates) {
    const r = fuzzyNameMatch(profileName, c);
    const words = c.split(' ').filter(Boolean);
    const qualityBoost =
      words.length <= 4 && words.every(w => w.length >= 2) && !/\b(PROGRAMME|REGISTER|VALID)\b/.test(c)
        ? 0.03
        : 0;
    const score = Math.min(1, r.similarity + qualityBoost);
    console.log(`  📊 "${c}" → ${(score * 100).toFixed(0)}% ${r.match ? '✓' : '✗'}`);
    if (score > best.similarity) {
      best = { name: c, similarity: score };
    }
  }

  // If no good match, return first candidate (from "Name:" pattern)
  if (best.similarity < 0.25) best.name = candidates[0];
  return best;
};

const getBestSimilarityQuick = (
  candidates: string[],
  profileName?: string
): { similarity: number; name: string } => {
  if (!profileName || candidates.length === 0) return { similarity: 0, name: '' };

  let bestSimilarity = 0;
  let bestName = '';
  for (const c of candidates) {
    const r = fuzzyNameMatch(profileName, c);
    const words = c.split(' ').filter(Boolean);
    const qualityBoost =
      words.length <= 4 && words.every(w => w.length >= 2) && !/\b(PROGRAMME|REGISTER|VALID)\b/.test(c)
        ? 0.03
        : 0;
    const score = Math.min(1, r.similarity + qualityBoost);
    if (score > bestSimilarity) {
      bestSimilarity = score;
      bestName = c;
    }
  }
  return { similarity: bestSimilarity, name: bestName };
};

// ─────────────────────────────────────────────
// MAIN OCR PIPELINE
// ─────────────────────────────────────────────

export const extractIDText = async (
  imageBase64: string,
  profileName?: string
): Promise<IDScanResult> => {
  try {
    console.log('🔍 Starting V5.0 OCR pipeline (robust low-quality ID support)...');
    const img = await loadImage(imageBase64);
    console.log(`📐 Image: ${img.width}×${img.height}`);

    const worker = await createWorker('eng', OEM.LSTM_ONLY);
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:().-/ ',
    });

    let allCandidates: string[] = [];
    let bestText = '';
    let bestScore = -1;
    let bestRotation = 0;
    let regNoDetected: string | null = null;
    let bestSimilaritySnapshot = 0;

    const runOCR = async (canvas: HTMLCanvasElement) => {
      const { data } = await worker.recognize(canvas.toDataURL('image/png'));
      return {
        text: data.text || '',
        score: scoreSRM(data.text || ''),
      };
    };

    const dedupeCandidates = () =>
      [...new Set(allCandidates)].filter((c) => c.length >= 3 && !/^\s*[A-Z]\s*$/.test(c));

    const shouldEarlyStop = (quickSimilarity: number, currentScore: number, hasRegNo: boolean) => {
      if (profileName) {
        return quickSimilarity >= 0.9 && (currentScore >= 35 || hasRegNo);
      }
      return currentScore >= 85 && hasRegNo;
    };

    // Stage 1: quick orientation sweep (includes 180°)
    const orientationResults: Array<{
      deg: number;
      score: number;
      text: string;
      candidates: string[];
      canvas: HTMLCanvasElement;
      quickSimilarity: number;
      rank: number;
    }> = [];

    for (const deg of [0, 90, 180, 270]) {
      const base = deg === 0 ? canvasFromImage(img) : rotateCanvas(img, deg);
      const scaled = scaleUp(base, 1050);

      const raw = await runOCR(scaled);
      regNoDetected = regNoDetected || extractRegNo(raw.text);
      let bestDegText = raw.text;
      let bestDegScore = raw.score;
      const degCandidates = [...extractCandidates(raw.text)];

      // Only run secondary pass if quick pass looks weak.
      if (bestDegScore < 58) {
        const enhanced = enhanceContrast(scaled);
        const enh = await runOCR(enhanced);
        regNoDetected = regNoDetected || extractRegNo(enh.text);
        degCandidates.push(...extractCandidates(enh.text));
        if (enh.score > bestDegScore) {
          bestDegScore = enh.score;
          bestDegText = enh.text;
        }
      }

      const quickSimilarity = getBestSimilarityQuick([...new Set(degCandidates)], profileName).similarity;
      const rank = bestDegScore + quickSimilarity * 30;
      orientationResults.push({
        deg,
        score: bestDegScore,
        text: bestDegText,
        candidates: [...new Set(degCandidates)],
        canvas: scaled,
        quickSimilarity,
        rank,
      });
      console.log(`🔄 Rotation ${deg}° quick-score=${bestDegScore}, sim=${quickSimilarity.toFixed(2)}`);
    }

    orientationResults.sort((a, b) => b.rank - a.rank);
    const bestOrientation = orientationResults[0];
    const secondOrientation = orientationResults[1];
    const strongPrimary =
      !!bestOrientation &&
      (bestOrientation.score >= 78 ||
        (bestOrientation.quickSimilarity >= 0.88 && bestOrientation.score >= 30));
    const secondIsClose =
      !!bestOrientation &&
      !!secondOrientation &&
      bestOrientation.rank - secondOrientation.rank < 12;
    const topOrientationCount = strongPrimary ? 1 : secondIsClose ? 2 : 1;
    const topOrientations = orientationResults.slice(0, topOrientationCount);
    if (topOrientations.length > 0) {
      bestRotation = topOrientations[0].deg;
      bestScore = topOrientations[0].score;
      bestText = topOrientations[0].text;
    }

    for (const o of topOrientations) {
      allCandidates.push(...o.candidates);
    }

    bestSimilaritySnapshot = getBestSimilarityQuick(dedupeCandidates(), profileName).similarity;

    // Stage 2: deep pass on best rotations with focused crops and preprocessing variants
    let earlyStop = shouldEarlyStop(bestSimilaritySnapshot, bestScore, !!regNoDetected);
    for (const o of topOrientations) {
      if (earlyStop) break;
      console.log(`\n🧠 Deep scan for rotation ${o.deg}°`);
      const focusCrops = buildCardFocusCrops(o.canvas);

      for (let idx = 0; idx < focusCrops.length; idx++) {
        if (earlyStop) break;
        const crop = focusCrops[idx];
        const enhanced = enhanceContrast(crop);
        const variants: Array<{ label: string; canvas: HTMLCanvasElement }> = idx === 0
          ? [
              { label: 'raw-full', canvas: crop },
              { label: 'enh-full', canvas: enhanced },
            ]
          : [
              { label: `enh-${idx}`, canvas: enhanced },
              { label: `bin-${idx}`, canvas: binarizeOtsu(enhanced) },
            ];

        // Heavy fallbacks only when still weak.
        const needsHeavyFallback =
          idx === 0 &&
          bestScore < 55 &&
          bestSimilaritySnapshot < 0.82;
        if (needsHeavyFallback) {
          variants.push({ label: 'sharp-full', canvas: sharpen(crop) });
          variants.push({ label: 'iso-full', canvas: isolateText(crop, 175, 80) });
        }

        for (const variant of variants) {
          const r = await runOCR(variant.canvas);
          regNoDetected = regNoDetected || extractRegNo(r.text);
          allCandidates.push(...extractCandidates(r.text));
          if (r.score > bestScore) {
            bestScore = r.score;
            bestText = r.text;
            bestRotation = o.deg;
          }

          bestSimilaritySnapshot = Math.max(
            bestSimilaritySnapshot,
            getBestSimilarityQuick(dedupeCandidates(), profileName).similarity
          );
          earlyStop = shouldEarlyStop(bestSimilaritySnapshot, bestScore, !!regNoDetected);
          console.log(`  ${variant.label}: score=${r.score}`);
          if (earlyStop) break;
        }
      }
    }

    // Bonus pass on best orientation using layout-aware segmentation.
    const needsBonusPass =
      bestScore >= 10 &&
      !earlyStop &&
      (bestScore < 60 || (profileName ? bestSimilaritySnapshot < 0.82 : !regNoDetected));
    if (needsBonusPass) {
      const base = bestRotation === 0 ? canvasFromImage(img) : rotateCanvas(img, bestRotation);
      const scaled = scaleUp(base, 1450);
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      const auto = await runOCR(scaled);
      regNoDetected = regNoDetected || extractRegNo(auto.text);
      allCandidates.push(...extractCandidates(auto.text));
      if (auto.score > bestScore) {
        bestScore = auto.score;
        bestText = auto.text;
      }

      bestSimilaritySnapshot = Math.max(
        bestSimilaritySnapshot,
        getBestSimilarityQuick(dedupeCandidates(), profileName).similarity
      );

      // Sparse mode only if AUTO still weak.
      if (bestScore < 55 || (profileName && bestSimilaritySnapshot < 0.8)) {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        const sparse = await runOCR(scaled);
        regNoDetected = regNoDetected || extractRegNo(sparse.text);
        allCandidates.push(...extractCandidates(sparse.text));
        if (sparse.score > bestScore) {
          bestScore = sparse.score;
          bestText = sparse.text;
        }
      }

      // Restore default for next calls in same session.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    }

    await worker.terminate();

    console.log(`\n📄 Best text (score: ${bestScore}):`);
    console.log(bestText.substring(0, 300));

    // Deduplicate and remove obvious garbage candidates
    allCandidates = dedupeCandidates();
    console.log('\n🏷️ All candidates:', allCandidates);

    const regNo = regNoDetected || extractRegNo(bestText);
    const isSRM = bestScore >= 15;

    // Pick best candidate
    let finalName = '';
    if (profileName && allCandidates.length > 0) {
      console.log(`\n🎯 Matching against profile: "${profileName}"`);
      const best = pickBest(allCandidates, profileName);
      finalName = best.name;
      console.log(`  ✅ Winner: "${finalName}" (${(best.similarity * 100).toFixed(0)}%)`);
    } else if (allCandidates.length > 0) {
      finalName = allCandidates[0];
    }

    if (!finalName || finalName.length < 2) {
      return {
        isValid: false,
        error: 'Could not read the name from your ID. Try better lighting, avoid glare, and make sure the full card is visible.',
        imageBase64,
      };
    }

    return {
      isValid: true,
      name: finalName.toUpperCase(),
      idNumber: regNo || 'Unknown',
      collegeName: isSRM ? 'SRM Institute of Science and Technology' : 'Unknown College',
      imageBase64,
      confidence: Math.min(bestScore / 100, 1.0),
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
// CAMERA, STORAGE, UTILITY
// ─────────────────────────────────────────────

export const initializeOpenCV = (): Promise<void> => Promise.resolve();

export const captureFromCamera = async (): Promise<string> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then(stream => {
        video.srcObject = stream; video.play();
        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          setTimeout(() => {
            ctx?.drawImage(video, 0, 0);
            stream.getTracks().forEach(t => t.stop());
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          }, 500);
        };
      })
      .catch(e => reject(new Error(`Camera: ${e.message}`)));
  });

export const validateIDData = (d: IDScanResult) => d.isValid && !!d.name && d.name.length >= 3;

const base64ToBlob = (b64: string) => {
  const s = atob(b64.split(',')[1]);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return new Blob([u], { type: 'image/jpeg' });
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

export const getVerificationBadge = (v: boolean) => ({
  text: v ? 'Verified Student' : 'Unverified',
  color: v ? 'text-green-600' : 'text-gray-500',
  bg: v ? 'bg-green-100' : 'bg-gray-100',
  icon: v ? '✓' : '○',
});

export const formatIDNumber = (id: string) => id.length <= 4 ? id : `****${id.slice(-4)}`;
