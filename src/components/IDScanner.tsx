import { useState } from 'react';
import { Camera, Upload, CheckCircle, AlertCircle, Loader, X, ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { motion } from 'framer-motion';
import {
  captureFromCamera,
  extractIDText,
  validateIDData,
  uploadIDImage,
  saveIDVerification,
  fuzzyNameMatch,
  type IDScanResult,
} from '@/lib/idScanner';

interface IDScannerProps {
  userId: string;
  userName: string;
  onSuccess: (data: IDScanResult) => void;
  onCancel: () => void;
}

export const IDScanner = ({ userId, userName, onSuccess, onCancel }: IDScannerProps) => {
  const [step, setStep] = useState<'intro' | 'capture' | 'processing' | 'result' | 'mismatch'>('intro');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<IDScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameMatchInfo, setNameMatchInfo] = useState<{ match: boolean; similarity: number } | null>(null);

  const handleCapture = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const imageBase64 = await captureFromCamera();
      setCapturedImage(imageBase64);
      setStep('processing');

      // Extract text from image via OCR
      const result = await extractIDText(imageBase64);
      setScanResult(result);

      if (result.isValid && result.name) {
        // Compare extracted name with profile name
        const matchResult = fuzzyNameMatch(userName, result.name);
        setNameMatchInfo(matchResult);

        if (matchResult.match) {
          setStep('result');
        } else {
          setStep('mismatch');
        }
      } else {
        setError(result.error || 'Could not extract ID information. Please try a clearer photo.');
        setStep('intro');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Camera access denied';
      setError(errorMsg);
      setStep('intro');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setError(null);

      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageBase64 = event.target?.result as string;
        setCapturedImage(imageBase64);
        setStep('processing');

        const result = await extractIDText(imageBase64);
        setScanResult(result);

        if (result.isValid && result.name) {
          const matchResult = fuzzyNameMatch(userName, result.name);
          setNameMatchInfo(matchResult);

          if (matchResult.match) {
            setStep('result');
          } else {
            setStep('mismatch');
          }
        } else {
          setError(result.error || 'Could not extract ID information. Please try a clearer photo.');
          setStep('intro');
        }
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      setStep('intro');
      setIsLoading(false);
    }
  };

  const handleConfirmVerification = async () => {
    if (!scanResult || !capturedImage) return;

    try {
      setIsLoading(true);

      // Upload image
      const imageUrl = await uploadIDImage(capturedImage, userId);
      if (!imageUrl) throw new Error('Failed to upload image');

      // Save verification
      const success = await saveIDVerification(userId, imageUrl, scanResult);
      if (success) {
        onSuccess(scanResult);
      } else {
        setError('Failed to save verification. Please try again.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Verification failed';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setScanResult(null);
    setError(null);
    setNameMatchInfo(null);
    setStep('intro');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-xl font-bold font-display">Verify Identity</h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Step 1: Intro */}
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  📋 Upload your <strong>SRM ID card</strong> photo. We'll automatically detect the orientation, enhance the image, and read your name. It will be matched with your profile name <strong>"{userName}"</strong> to verify you.
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
                  ✅ Works with rotated, blurry, or low-quality photos
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleCapture}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 h-12"
                >
                  {isLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  Take Photo
                </Button>

                <label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadImage}
                    disabled={isLoading}
                    className="hidden"
                  />
                  <Button
                    asChild
                    variant="outline"
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 cursor-pointer w-full h-12"
                  >
                    <span>
                      {isLoading ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Upload
                    </span>
                  </Button>
                </label>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                💡 Any orientation works — we auto-detect and rotate
              </p>

              <Button variant="outline" onClick={onCancel} className="w-full">
                Cancel
              </Button>
            </motion.div>
          )}

          {/* Step 2: Processing */}
          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <div className="relative">
                <Loader className="w-10 h-10 animate-spin text-primary" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Processing your ID card...</p>
                <p className="text-xs text-muted-foreground">Enhancing image → Detecting orientation → Reading text</p>
              </div>
            </motion.div>
          )}

          {/* Step 3: Match Success */}
          {step === 'result' && scanResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="text-center py-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                >
                  <ShieldCheck className="w-14 h-14 text-green-500 mx-auto mb-3" />
                </motion.div>
                <p className="font-bold text-lg">Name Matched! ✅</p>
                <p className="text-sm text-muted-foreground">Your identity has been verified</p>
              </div>

              {/* Extracted Data */}
              <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-4 space-y-2 text-sm border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Your Name</span>
                  <span className="font-medium">{userName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Name on ID</span>
                  <span className="font-medium">{scanResult.name || 'N/A'}</span>
                </div>
                {nameMatchInfo && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Match Score</span>
                    <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                      {Math.round(nameMatchInfo.similarity * 100)}%
                    </Badge>
                  </div>
                )}
                {scanResult.collegeName && scanResult.collegeName !== 'Unknown College' && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">College</span>
                    <span className="font-medium text-xs text-right max-w-[60%]">{scanResult.collegeName}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                🔒 Your ID data is encrypted and stored securely
              </p>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRetake} className="flex-1">
                  Retake
                </Button>
                <Button
                  onClick={handleConfirmVerification}
                  disabled={isLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm & Verify
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Name Mismatch */}
          {step === 'mismatch' && scanResult && (
            <motion.div
              key="mismatch"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="text-center py-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                >
                  <ShieldX className="w-14 h-14 text-red-500 mx-auto mb-3" />
                </motion.div>
                <p className="font-bold text-lg">Name Doesn't Match ❌</p>
                <p className="text-sm text-muted-foreground">The name on your ID doesn't match your profile</p>
              </div>

              {/* Mismatch Data */}
              <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 space-y-2 text-sm border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Your Profile Name</span>
                  <span className="font-medium">{userName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Name on ID</span>
                  <span className="font-medium text-red-600 dark:text-red-400">{scanResult.name || 'N/A'}</span>
                </div>
                {nameMatchInfo && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Match Score</span>
                    <Badge variant="outline" className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">
                      {Math.round(nameMatchInfo.similarity * 100)}%
                    </Badge>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  💡 <strong>Tips:</strong> 1) Make sure your profile name matches your ID card name. 2) Try a clearer photo with less glare. 3) Hold the card steady — any orientation is fine.
                  Go to <strong>Edit Profile</strong> to update your name if needed.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRetake} className="flex-1">
                  Try Again
                </Button>
                <Button variant="outline" onClick={onCancel} className="flex-1">
                  Update Profile
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default IDScanner;
