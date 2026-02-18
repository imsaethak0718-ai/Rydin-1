/**
 * ID Card Scanner — Robust OCR for SRM ID Cards
 * Handles bad quality photos, rotated images, watermarks, glare
 */

import { createWorker } from 'tesseract.js';

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
// IMAGE PREPROCESSING (Canvas-based)
// ─────────────────────────────────────────────

/**
 * Load a base64 image into an HTMLImageElement
 */
const loadImage = (base64: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64;
  });
};

/**
 * Rotate an image by the given degrees (0, 90, 180, 270)
 */
const rotateImage = (img: HTMLImageElement, degrees: number): string => {
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

  return canvas.toDataURL('image/jpeg', 0.9);
};

/**
 * Preprocess image for better OCR:
 * - Convert to grayscale
 * - Enhance contrast
 * - Apply sharpening
 * - Resize if too small
 */
const preprocessImage = (img: HTMLImageElement): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Scale up small images for better OCR (Tesseract works best at 300 DPI equivalent)
  let scale = 1;
  const minDim = Math.min(img.width, img.height);
  if (minDim < 800) {
    scale = 800 / minDim;
  }
  // Cap at 2x to avoid excessive processing
  scale = Math.min(scale, 2);

  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  // Draw scaled image
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Pass 1: Convert to grayscale and collect histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    // Weighted grayscale (matches human perception)
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    histogram[gray]++;
  }

  // Pass 2: Contrast stretching (histogram equalization light)
  // Find 5th and 95th percentile for robust stretching
  const totalPixels = canvas.width * canvas.height;
  let low = 0, high = 255;
  let cumSum = 0;
  for (let i = 0; i < 256; i++) {
    cumSum += histogram[i];
    if (cumSum < totalPixels * 0.05) low = i;
    if (cumSum < totalPixels * 0.95) high = i;
  }

  const range = Math.max(high - low, 1);
  const contrastFactor = 1.5; // Extra contrast boost

  for (let i = 0; i < data.length; i += 4) {
    // Stretch contrast
    let val = ((data[i] - low) / range) * 255;
    // Apply additional contrast boost around midpoint
    val = ((val / 255 - 0.5) * contrastFactor + 0.5) * 255;
    val = Math.max(0, Math.min(255, Math.round(val)));
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  // Pass 3: Simple sharpening using unsharp mask principle
  // Clone the blurred version
  const blurred = new Uint8ClampedArray(data.length);
  const w = canvas.width;
  const h = canvas.height;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      // 3x3 box blur
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += data[((y + dy) * w + (x + dx)) * 4];
        }
      }
      blurred[idx] = Math.round(sum / 9);
    }
  }

  // Sharpen: original + (original - blurred) * amount
  const sharpenAmount = 0.8;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const sharpened = data[idx] + (data[idx] - blurred[idx]) * sharpenAmount;
      const val = Math.max(0, Math.min(255, Math.round(sharpened)));
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
};

// ─────────────────────────────────────────────
// SRM-SPECIFIC NAME EXTRACTION
// ─────────────────────────────────────────────

/**
 * Clean OCR noise from extracted text
 */
const cleanOCRText = (text: string): string => {
  return text
    // Remove common watermark text
    .replace(/\bSRM\b/gi, '')
    .replace(/\bOSRM\b/gi, '')
    .replace(/\bCSRM\b/gi, '')
    // Remove stray single characters (OCR noise)
    .replace(/(?:^|\s)[^a-zA-Z\s](?:\s|$)/g, ' ')
    // Remove numbers mixed into name
    .replace(/[0-9]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Extract name from OCR text using multiple strategies
 * Designed specifically for SRM ID card format:
 *   Name : FIRSTNAME LASTNAME
 *   Programme : B.Tech.(CSE)
 */
const extractNameFromText = (text: string): string | null => {
  console.log('📄 Raw OCR text:', text);

  // Strategy 1: Look for "Name" followed by ":"  and capture until next label
  // This handles: "Name : VISHAL SINGH", "Name: PRANAV PRATAP SINGH", "Name :PRITHISH MISRA"
  const namePatterns = [
    /[Nn]ame\s*[:;]\s*(.+?)(?:\n|Programme|Program|Register|Valid|$)/i,
    /[Nn]ame\s*[:;]\s*(.+)/i,
    /[Nn]am[ec]\s*[:;]\s*(.+?)(?:\n|$)/i,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const cleaned = cleanOCRText(match[1]);
      // Must have at least 2 chars and contain a letter
      if (cleaned.length >= 2 && /[a-zA-Z]/.test(cleaned)) {
        console.log('✅ Name extracted (pattern match):', cleaned);
        return cleaned;
      }
    }
  }

  // Strategy 2: Look for lines with mostly uppercase words (SRM uses ALL CAPS for names)
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  for (const line of lines) {
    // Skip lines that are clearly not names
    if (/programme|register|valid|faculty|engineering|technology|campus|kattankulathur|chengalpattu|student|website|email|phone/i.test(line)) continue;
    if (/RA\d{5,}/i.test(line)) continue; // Registration number
    if (/\d{3,}/.test(line)) continue; // Lines with many numbers

    // Check if line has 2+ uppercase words that look like a name
    const words = line.replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/);
    const upperWords = words.filter(w => w.length >= 2 && w === w.toUpperCase() && /^[A-Z]+$/.test(w));

    if (upperWords.length >= 2 && upperWords.join(' ').length >= 5) {
      const nameCandidate = cleanOCRText(upperWords.join(' '));
      if (nameCandidate.length >= 3) {
        console.log('✅ Name extracted (uppercase detection):', nameCandidate);
        return nameCandidate;
      }
    }
  }

  // Strategy 3: Find the line right after a line containing "Name"
  for (let i = 0; i < lines.length; i++) {
    if (/name/i.test(lines[i]) && !lines[i].includes(':')) {
      // The name might be on the next line
      if (i + 1 < lines.length) {
        const cleaned = cleanOCRText(lines[i + 1]);
        if (cleaned.length >= 3 && /[A-Za-z]/.test(cleaned)) {
          console.log('✅ Name extracted (next-line):', cleaned);
          return cleaned;
        }
      }
    }
  }

  console.log('❌ No name found in OCR text');
  return null;
};

/**
 * Extract registration number from OCR text
 */
const extractRegNoFromText = (text: string): string | null => {
  // SRM registration format: RA followed by digits (e.g., RA2511003010756)
  const regPatterns = [
    /(?:Register|Reg)\s*(?:No)?\.?\s*[:;]\s*(RA\d{6,})/i,
    /(RA\d{10,})/i,
    /([A-Z]{2}\d{10,})/i,
  ];

  for (const pattern of regPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
};

/**
 * Check if text looks like it came from an SRM ID card
 */
const isSRMCard = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  return (
    lowerText.includes('srm') ||
    lowerText.includes('faculty') ||
    lowerText.includes('engineering') ||
    lowerText.includes('kattankulathur') ||
    lowerText.includes('programme') ||
    /ra\d{6,}/i.test(text)
  );
};

// ─────────────────────────────────────────────
// AUTO-ROTATION OCR
// ─────────────────────────────────────────────

/**
 * Score how well OCR text matches an expected SRM ID card
 */
const scoreOCRResult = (text: string): number => {
  let score = 0;
  const lower = text.toLowerCase();

  if (/name\s*[:;]/i.test(text)) score += 50;     // Found "Name :"
  if (lower.includes('programme')) score += 20;
  if (lower.includes('register')) score += 20;
  if (lower.includes('srm')) score += 10;
  if (lower.includes('faculty')) score += 10;
  if (lower.includes('engineering')) score += 10;
  if (lower.includes('b.tech') || lower.includes('btech')) score += 15;
  if (/ra\d{6,}/i.test(text)) score += 25;        // Registration number
  if (lower.includes('kattankulathur')) score += 10;
  if (lower.includes('valid')) score += 5;

  return score;
};

/**
 * Try OCR at multiple rotations and pick the best result
 */
const tryAllRotations = async (
  img: HTMLImageElement,
  worker: Awaited<ReturnType<typeof createWorker>>
): Promise<{ text: string; rotation: number; score: number }> => {
  const rotations = [0, 90, 270, 180]; // Most common orientations first
  let bestResult = { text: '', rotation: 0, score: -1 };

  for (const deg of rotations) {
    const rotatedBase64 = deg === 0
      ? preprocessImage(img)
      : (() => {
        const rotatedImg = document.createElement('img') as HTMLImageElement;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        if (deg === 90 || deg === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((deg * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        // Now preprocess the rotated image
        const tempImg = new Image();
        return canvas.toDataURL('image/jpeg', 0.9);
      })();

    // For non-zero rotations, we need to preprocess the rotated version
    let processedBase64 = rotatedBase64;
    if (deg !== 0) {
      const rotImg = await loadImage(rotatedBase64);
      processedBase64 = preprocessImage(rotImg);
    }

    const { data: { text } } = await worker.recognize(processedBase64);
    const score = scoreOCRResult(text);

    console.log(`🔄 Rotation ${deg}°: score=${score}`);

    if (score > bestResult.score) {
      bestResult = { text, rotation: deg, score };
    }

    // If we found a very strong match, stop early
    if (score >= 80) {
      console.log(`✅ Strong match at ${deg}°, stopping early`);
      break;
    }
  }

  return bestResult;
};

// ─────────────────────────────────────────────
// FUZZY NAME MATCHING (Improved)
// ─────────────────────────────────────────────

/**
 * Compute Levenshtein distance between two strings
 */
const levenshtein = (a: string, b: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
};

/**
 * Normalize a name for comparison
 */
const normalizeName = (s: string): string =>
  s.toLowerCase()
    .replace(/[^a-z\s]/g, '') // Keep only letters and spaces
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Improved fuzzy name matching for OCR results
 * Uses multiple strategies:
 * 1. Full string Levenshtein similarity
 * 2. Word-level matching (handles garbled surnames)
 * 3. First-name priority (if first name matches strongly, accept)
 * 4. Contains check (handles middle names)
 */
export const fuzzyNameMatch = (
  profileName: string,
  idName: string
): { match: boolean; similarity: number } => {
  const a = normalizeName(profileName);
  const b = normalizeName(idName);

  if (!a || !b) return { match: false, similarity: 0 };
  if (a === b) return { match: true, similarity: 1.0 };

  // 1. Full string Levenshtein similarity
  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  const fullSimilarity = 1 - dist / maxLen;

  // 2. Word-level matching
  const aWords = a.split(' ').filter(w => w.length >= 2);
  const bWords = b.split(' ').filter(w => w.length >= 2);

  let matchedWords = 0;
  let totalWords = Math.max(aWords.length, bWords.length);

  for (const aw of aWords) {
    for (const bw of bWords) {
      const wordDist = levenshtein(aw, bw);
      const wordSim = 1 - wordDist / Math.max(aw.length, bw.length);
      if (wordSim >= 0.7) { // 70% per-word match threshold
        matchedWords++;
        break;
      }
    }
  }

  const wordSimilarity = totalWords > 0 ? matchedWords / totalWords : 0;

  // 3. First-name priority: if profile has a first name that matches any ID word
  const profileFirst = aWords[0] || '';
  let firstNameMatch = false;
  if (profileFirst.length >= 3) {
    for (const bw of bWords) {
      const fDist = levenshtein(profileFirst, bw);
      const fSim = 1 - fDist / Math.max(profileFirst.length, bw.length);
      if (fSim >= 0.75) {
        firstNameMatch = true;
        break;
      }
    }
  }

  // 4. Contains check (handles middle names/initials)
  const containsMatch = a.includes(b) || b.includes(a) ||
    aWords.some(w => b.includes(w) && w.length >= 3) ||
    bWords.some(w => a.includes(w) && w.length >= 3);

  // Calculate final similarity — weighted combination
  let similarity = Math.max(
    fullSimilarity,
    wordSimilarity * 0.95,  // Word matching is almost as good as full match
    firstNameMatch ? 0.80 : 0,
    containsMatch ? 0.85 : 0
  );

  // Determine match
  const isMatch =
    similarity >= 0.65 ||           // 65% overall (lowered from 75% for OCR tolerance)
    (firstNameMatch && wordSimilarity >= 0.4) || // First name matches + at least some words
    (matchedWords >= 2) ||          // At least 2 words match individually
    containsMatch;                  // One contains the other

  return {
    match: isMatch,
    similarity: Math.min(similarity, 1.0),
  };
};

// ─────────────────────────────────────────────
// MAIN OCR PIPELINE
// ─────────────────────────────────────────────

/**
 * Process ID card image and extract text
 * Robust pipeline: preprocess → auto-rotate → OCR → SRM-specific extraction
 */
export const extractIDText = async (imageBase64: string): Promise<IDScanResult> => {
  try {
    console.log('🔍 Starting robust OCR pipeline...');

    // Load the image
    const img = await loadImage(imageBase64);
    console.log(`📐 Image size: ${img.width}x${img.height}`);

    // Create Tesseract worker
    const worker = await createWorker('eng');

    // Try all rotations with preprocessing to find the best orientation
    const { text: bestText, rotation, score } = await tryAllRotations(img, worker);

    await worker.terminate();

    console.log(`📄 Best OCR result at ${rotation}° (score: ${score}):`);
    console.log(bestText);

    // If score is very low, the image is probably not a valid ID
    if (score < 10) {
      return {
        isValid: false,
        error: 'Could not detect an ID card. Please make sure the entire card is visible and try again.',
        imageBase64,
      };
    }

    // Extract name using SRM-specific patterns
    const name = extractNameFromText(bestText);
    const regNo = extractRegNoFromText(bestText);
    const isSRM = isSRMCard(bestText);

    const result: IDScanResult = {
      isValid: !!name,
      imageBase64,
      confidence: Math.min(score / 100, 1.0),
      name: name || 'Unknown Student',
      idNumber: regNo || 'Unknown ID',
      collegeName: isSRM ? 'SRM Institute of Science and Technology' : 'Unknown College',
    };

    if (!result.isValid || !name) {
      result.error = 'Could not read the name on your ID. Please try with a clearer photo — hold the card upright and avoid glare.';
    }

    return result;
  } catch (error) {
    console.error('OCR Processing failed:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'OCR Processing failed. Please try again.',
    };
  }
};

// ─────────────────────────────────────────────
// CAMERA, UPLOAD, STORAGE (unchanged)
// ─────────────────────────────────────────────

/**
 * Initialize OpenCV.js (kept for compatibility but not required for new pipeline)
 */
export const initializeOpenCV = (): Promise<void> => {
  return new Promise((resolve) => resolve());
};

/**
 * Capture image from camera
 */
export const captureFromCamera = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        video.srcObject = stream;
        video.play();

        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          setTimeout(() => {
            ctx?.drawImage(video, 0, 0);
            stream.getTracks().forEach((track) => track.stop());
            const imageBase64 = canvas.toDataURL('image/jpeg', 0.9);
            resolve(imageBase64);
          }, 300); // Slightly longer delay for camera to stabilize
        };
      })
      .catch((error) => {
        reject(new Error(`Camera access failed: ${error.message}`));
      });
  });
};

/**
 * Validate ID information
 */
export const validateIDData = (data: IDScanResult): boolean => {
  if (!data.isValid) return false;
  if (!data.name || data.name.length < 3) return false;
  return true;
};

/**
 * Convert base64 to Blob
 */
const base64ToBlob = (base64: string): Blob => {
  const bstr = atob(base64.split(',')[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }

  return new Blob([u8arr], { type: 'image/jpeg' });
};

/**
 * Upload ID image to Supabase Storage
 */
export const uploadIDImage = async (
  imageBase64: string,
  userId: string
): Promise<string | null> => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');

    const blob = base64ToBlob(imageBase64);
    const fileName = `id-${userId}-${Date.now()}.jpg`;

    const { data, error } = await supabase.storage
      .from('user-verifications')
      .upload(fileName, blob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('user-verifications')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Upload failed:', error);
    return null;
  }
};

/**
 * Save ID verification to database
 */
export const saveIDVerification = async (
  userId: string,
  imageUrl: string,
  data: IDScanResult
): Promise<boolean> => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');

    const { error } = await supabase
      .from('user_verifications')
      .upsert({
        user_id: userId,
        name: data.name || 'Unknown',
        id_number: data.idNumber || 'Unknown',
        college_name: data.collegeName || 'Unknown',
        photo_url: imageUrl,
        verified: true,
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('ID verification upsert error:', error);
      throw error;
    }

    // Update profile verification status
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ identity_verified: true, phone_verified: true })
        .eq('id', userId);

      if (profileError) {
        console.warn('Profile update with identity_verified failed, trying fallback:', profileError.message);
        await supabase
          .from('profiles')
          .update({ phone_verified: true })
          .eq('id', userId);
      }
    } catch (profileErr) {
      console.warn('Profile badge update failed (non-critical):', profileErr);
    }

    return true;
  } catch (error) {
    console.error('Save verification failed:', error);
    return false;
  }
};

/**
 * Check if user is already verified
 */
export const checkIDVerification = async (userId: string): Promise<boolean> => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');

    const { data, error } = await supabase
      .from('user_verifications')
      .select('user_id')
      .eq('user_id', userId)
      .eq('verified', true)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Check verification failed:', error);
    return false;
  }
};

/**
 * Get verification badge display
 */
export const getVerificationBadge = (isVerified: boolean) => {
  if (!isVerified) {
    return {
      text: 'Unverified',
      color: 'text-gray-500',
      bg: 'bg-gray-100',
      icon: '○',
    };
  }

  return {
    text: 'Verified Student',
    color: 'text-green-600',
    bg: 'bg-green-100',
    icon: '✓',
  };
};

/**
 * Format ID number (mask for privacy)
 */
export const formatIDNumber = (idNumber: string): string => {
  if (idNumber.length <= 4) return idNumber;
  return `****${idNumber.slice(-4)}`;
};
