import { useState } from 'react';
import { Camera, Upload, CheckCircle, AlertCircle, Loader, X } from 'lucide-react';
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
  type IDScanResult,
} from '@/lib/idScanner';

interface IDScannerProps {
  userId: string;
  onSuccess: (data: IDScanResult) => void;
  onCancel: () => void;
}

export const IDScanner = ({ userId, onSuccess, onCancel }: IDScannerProps) => {
  const [step, setStep] = useState<'intro' | 'capture' | 'processing' | 'result'>('intro');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<IDScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const imageBase64 = await captureFromCamera();
      setCapturedImage(imageBase64);
      setStep('processing');

      // Extract text from image
      const result = await extractIDText(imageBase64);
      setScanResult(result);

      if (result.isValid) {
        setStep('result');
      } else {
        setError(result.error || 'Could not extract ID information');
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

        if (result.isValid) {
          setStep('result');
        } else {
          setError(result.error || 'Could not extract ID information');
          setStep('intro');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      setStep('intro');
    } finally {
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
        setError('Failed to save verification');
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
    setStep('intro');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-background rounded-lg shadow-lg max-w-md w-full space-y-4"
      >
        {/* Close Button */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-xl font-bold font-display">Verify Identity</h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Step 1: Intro */}
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Scan your college ID card once. This verifies you're a student.
              </p>

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
                  className="flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
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
                    className="flex items-center justify-center gap-2 cursor-pointer w-full"
                  >
                    <span>
                      <Upload className="w-4 h-4" />
                      Upload
                    </span>
                  </Button>
                </label>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                💡 Make sure ID is clear, readable, and face-up
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
              <Loader className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Extracting information...</p>
            </motion.div>
          )}

          {/* Step 3: Result */}
          {step === 'result' && scanResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-semibold">ID Verified</p>
              </div>

              {/* Extracted Data */}
              <div className="bg-muted/50 rounded p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{scanResult.name || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ID Number</span>
                  <span className="font-medium">{scanResult.idNumber || 'N/A'}</span>
                </div>
                {scanResult.collegeName && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">College</span>
                    <span className="font-medium text-xs">{scanResult.collegeName}</span>
                  </div>
                )}
                {scanResult.confidence && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Confidence</span>
                    <Badge variant="outline">{Math.round(scanResult.confidence * 100)}%</Badge>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                ✓ This information is encrypted and saved securely
              </p>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRetake} className="flex-1">
                  Retake
                </Button>
                <Button
                  onClick={handleConfirmVerification}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm
                    </>
                  )}
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
