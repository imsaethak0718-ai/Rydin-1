import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Phone, GraduationCap, Building, ArrowRight, AlertCircle, Camera, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const departments = [
  "Computer Science", "Electronics", "Mechanical", "Civil",
  "Biotech", "Commerce", "Law", "Medicine", "Arts",
];

const ProfileSetup = () => {
  const [step, setStep] = useState<"profile" | "id-scan" | "complete">("profile");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ID Scanning state
  const [idName, setIdName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const { updateProfile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !department || !year || !phone || !gender) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    setStep("id-scan");
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to scan your ID",
        variant: "destructive",
      });
    }
  };

  const captureIDPhoto = async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    const imageData = canvas.toDataURL("image/jpeg");
    setPhotoUrl(imageData);
    stopCamera();
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const compressImage = async (base64Data: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Data;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWidth = 600;
        const maxHeight = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
        }

        // Compress to 70% quality (reduces size significantly)
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    });
  };

  const uploadIDPhoto = async (base64Data: string) => {
    if (!user?.id) return null;

    try {
      // Compress image first
      const compressedData = await compressImage(base64Data);

      // Convert base64 to blob
      const response = await fetch(compressedData);
      const blob = await response.blob();

      const fileName = `${user.id}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("id-verifications")
        .upload(fileName, blob, { cacheControl: "3600", upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("id-verifications")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const saveIDVerification = async (photoUrl: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.from("id_verifications").upsert({
        user_id: user.id,
        name: idName,
        id_number: idNumber,
        college_name: collegeName,
        photo_url: photoUrl,
        verified: false,
      }, { onConflict: 'user_id' });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Save ID verification error:", error);
      return false;
    }
  };

  const handleIDScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idName || !idNumber || !collegeName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all ID details",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      let uploadedPhotoUrl = photoUrl;

      // If we have a photo, upload it
      if (photoUrl && photoUrl.startsWith("data:")) {
        uploadedPhotoUrl = await uploadIDPhoto(photoUrl);
        if (!uploadedPhotoUrl) {
          throw new Error("Failed to upload photo");
        }
      }

      // Save ID verification
      const saved = await saveIDVerification(uploadedPhotoUrl || "");
      if (!saved) {
        throw new Error("Failed to save ID verification");
      }

      // Now update profile with all data
      await updateProfile({
        name,
        department,
        year,
        phone,
        gender: gender as "male" | "female" | "other",
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
      } as any);

      setStep("complete");
      setTimeout(() => navigate("/"), 1500);
    } catch (error: any) {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to complete setup",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 sm:px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Step 1: Profile Setup */}
        {step === "profile" && (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-center mb-1">Complete your profile</h1>
            <p className="text-center text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8">
              Help others know who they're riding with
            </p>
            <div className="flex gap-2 mb-6 justify-center">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <div className="w-3 h-3 rounded-full bg-muted"></div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-3 sm:space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 h-12 sm:h-11 bg-card text-base sm:text-sm"
                  required
                />
              </div>

              <Select value={department} onValueChange={setDepartment} required>
                <SelectTrigger className="h-12 sm:h-11 bg-card text-base sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Department" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={year} onValueChange={setYear} required>
                <SelectTrigger className="h-12 sm:h-11 bg-card text-base sm:text-sm">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Year" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"].map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female" | "other")} required>
                <SelectTrigger className="h-12 sm:h-11 bg-card text-base sm:text-sm">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10 h-12 sm:h-11 bg-card text-base sm:text-sm"
                  type="tel"
                  required
                />
              </div>

              <div className="pt-3 sm:pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-safety" />
                  <h3 className="text-sm sm:text-base font-semibold">Emergency Contact</h3>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                  In case something goes wrong, we'll reach this person
                </p>

                <div className="relative mb-3">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Emergency contact name"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="pl-10 h-12 sm:h-11 bg-card text-base sm:text-sm"
                    required
                  />
                </div>

                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Emergency contact phone"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="pl-10 h-12 sm:h-11 bg-card text-base sm:text-sm"
                    type="tel"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 sm:h-11 text-base sm:text-sm font-semibold gap-2 mt-4">
                Next Step
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </>
        )}

        {/* Step 2: ID Scanning */}
        {step === "id-scan" && (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-center mb-1">Verify your Identity</h1>
            <p className="text-center text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8">
              Scan or upload your college ID for verification
            </p>
            <div className="flex gap-2 mb-6 justify-center">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <div className="w-3 h-3 rounded-full bg-primary"></div>
            </div>

            {showCamera ? (
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={captureIDPhoto}
                    className="flex-1"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                  <Button
                    type="button"
                    onClick={stopCamera}
                    variant="outline"
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleIDScanSubmit} className="space-y-4">
                {photoUrl && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700">Photo captured</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={startCamera}
                    className="flex-1"
                    variant="outline"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                </div>

                <div className="border-t border-border pt-4 space-y-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Full name (from ID)"
                      value={idName}
                      onChange={(e) => setIdName(e.target.value)}
                      className="pl-10 h-12 sm:h-11 bg-card"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Input
                      placeholder="ID Number"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      className="h-12 sm:h-11 bg-card"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="College Name"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      className="pl-10 h-12 sm:h-11 bg-card"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 sm:h-11 font-semibold gap-2"
                  >
                    {isLoading ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Completing Setup...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <Check className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}

        {/* Step 3: Complete */}
        {step === "complete" && (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
              className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Check className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display mb-2">All Set!</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Your profile is complete. Redirecting to home...
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ProfileSetup;
