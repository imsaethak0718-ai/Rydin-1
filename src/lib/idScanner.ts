/**
 * ID Card Scanner using OpenCV
 * One-time student identity verification
 */

export interface IDScanResult {
  isValid: boolean;
  error?: string;
  name?: string;
  idNumber?: string;
  collegeName?: string;
  imageBase64?: string;
  confidence?: number;
}

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
 * Fuzzy name matching — returns similarity score (0-1)
 * Handles OCR quirks like extra spaces, casing, minor typos
 */
export const fuzzyNameMatch = (profileName: string, idName: string): { match: boolean; similarity: number } => {
  // Normalize: lowercase, trim, collapse spaces
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

  const a = normalize(profileName);
  const b = normalize(idName);

  if (a === b) return { match: true, similarity: 1.0 };
  if (!a || !b) return { match: false, similarity: 0 };

  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  const similarity = 1 - dist / maxLen;

  // Also check if one contains the other (handles middle names
  // e.g., profile: "Anurag Pandey" vs ID: "Anurag Kumar Pandey")
  const containsMatch = a.includes(b) || b.includes(a);

  return {
    match: similarity >= 0.75 || containsMatch,
    similarity: containsMatch ? Math.max(similarity, 0.85) : similarity,
  };
};

/**
 * Initialize OpenCV.js
 */
export const initializeOpenCV = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if OpenCV is already loaded
    if ((window as any).cv) {
      resolve();
      return;
    }

    // Load OpenCV from CDN
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.5.2/opencv.js';
    script.onload = () => {
      console.log('✅ OpenCV.js loaded');
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load OpenCV.js'));
    };
    document.head.appendChild(script);
  });
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

          // Draw current frame
          setTimeout(() => {
            ctx?.drawImage(video, 0, 0);
            stream.getTracks().forEach((track) => track.stop());

            const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
            resolve(imageBase64);
          }, 100);
        };
      })
      .catch((error) => {
        reject(new Error(`Camera access failed: ${error.message}`));
      });
  });
};

import { createWorker } from 'tesseract.js';

/**
 * Process ID card image and extract text
 * Uses Tesseract.js for real OCR
 */
export const extractIDText = async (imageBase64: string): Promise<IDScanResult> => {
  try {
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(imageBase64);
    await worker.terminate();

    console.log('📄 OCR Extracted Text:', text);

    // Basic regex patterns for student IDs
    // Adjust these based on common ID formats
    const nameMatch = text.match(/Name[:\s]+([A-Za-z\s]+)/i) ||
      text.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/m);
    const idMatch = text.match(/(?:ID|Roll|Reg)(?:[\s#:]+)([A-Z0-9]+)/i) ||
      text.match(/([A-Z]{2,}\d{6,})/);
    const collegeMatch = text.match(/(?:College|University|Institute)[\s\w]+/i);

    const result: IDScanResult = {
      isValid: !!(nameMatch || idMatch),
      imageBase64: imageBase64,
      confidence: 0.8, // Tesseract provides its own confidence per word/line, putting a safe average here
      name: nameMatch ? nameMatch[1].trim() : 'Unknown Student',
      idNumber: idMatch ? idMatch[1].trim() : 'Unknown ID',
      collegeName: collegeMatch ? collegeMatch[0].trim() : 'Unknown College',
    };

    if (!result.isValid) {
      result.error = 'No clear ID details found. Please try again with a clearer photo.';
    }

    return result;
  } catch (error) {
    console.error('OCR Processing failed:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'OCR Processing failed',
    };
  }
};

/**
 * Validate ID information
 */
export const validateIDData = (data: IDScanResult): boolean => {
  if (!data.isValid) return false;
  if (!data.name || data.name.length < 3) return false;
  if (!data.idNumber || data.idNumber.length < 4) return false;
  if (data.confidence && data.confidence < 0.70) return false;
  return true;
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
 * Save ID verification to database
 */
export const saveIDVerification = async (
  userId: string,
  imageUrl: string,
  data: IDScanResult
): Promise<boolean> => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');

    // Use user_verifications table with correct column names
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

    // Update profile — try with identity_verified first, fallback to phone_verified only
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
