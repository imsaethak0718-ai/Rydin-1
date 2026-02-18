import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User, Phone, GraduationCap, Building, ArrowRight,
  AlertCircle, Camera, Check, X, Upload, Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadProfilePhoto, saveAvatarUrl } from "@/lib/photoCapture";

const departments = [
  "Computer Science", "Electronics", "Mechanical", "Civil",
  "Biotech", "Commerce", "Law", "Medicine", "Arts",
];

const ProfileSetup = () => {
  const [step, setStep] = useState<"profile" | "photo" | "complete">("profile");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<string | File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { updateProfile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.profile_complete) {
      navigate("/", { replace: true });
    }
  }, [user?.profile_complete, navigate]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

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
    setStep("photo");
  };

  // ── Camera functions ───────────────────────────────────────────────────

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } }
      });
      setCameraStream(stream);
      setShowCamera(true);
      // Wait for ref to be available
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to take a photo",
        variant: "destructive",
      });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Capture square crop from center
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    const size = Math.min(vw, vh);
    canvas.width = size;
    canvas.height = size;

    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;
    ctx.drawImage(videoRef.current, sx, sy, size, size, 0, 0, size, size);

    const imageData = canvas.toDataURL("image/jpeg", 0.85);
    setPhotoPreview(imageData);
    setPhotoFile(imageData);
    stopCamera();
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target?.result as string);
      setPhotoFile(file);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
  };

  // ── Final submit ───────────────────────────────────────────────────────

  const handleCompleteSetup = async () => {
    setIsLoading(true);

    const profileData = {
      name,
      department,
      year,
      phone,
      gender: gender as "male" | "female" | "other",
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
      profile_complete: true,
    };

    // Start all tasks
    const setupTasks = async () => {
      try {
        await updateProfile(profileData as any);
        console.log("✅ Profile updated");

        // Upload photo if provided
        if (photoFile && user?.id) {
          const url = await uploadProfilePhoto(user.id, photoFile);
          if (url) {
            await saveAvatarUrl(user.id, url);
            console.log("✅ Profile photo uploaded");
          }
        }
      } catch (e) {
        console.warn("Setup tasks had issues:", e);
      }
    };

    setupTasks();

    // Force progression after 3.5 seconds
    setTimeout(() => {
      setStep("complete");
      setIsLoading(false);

      setTimeout(() => {
        navigate("/", { replace: true });
        setTimeout(() => {
          if (window.location.pathname === "/profile-setup") {
            window.location.href = "/";
          }
        }, 1000);
      }, 1500);
    }, 3500);
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
              {/* Name field with college ID hint */}
              <div className="space-y-1.5">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Full name (as per college ID)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-12 sm:h-11 bg-card text-base sm:text-sm"
                    required
                  />
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 pl-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Enter your name exactly as it appears on your college ID card
                </p>
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

        {/* Step 2: Profile Photo (optional) */}
        {step === "photo" && (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-center mb-1">Add your photo</h1>
            <p className="text-center text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8">
              This helps others recognize you — you can skip this for now
            </p>
            <div className="flex gap-2 mb-6 justify-center">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <div className="w-3 h-3 rounded-full bg-primary"></div>
            </div>

            {showCamera ? (
              <div className="space-y-4">
                <div className="relative bg-black rounded-2xl overflow-hidden aspect-square max-w-[280px] mx-auto">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Circular overlay guide */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[85%] h-[85%] rounded-full border-2 border-white/40 border-dashed" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="button" onClick={capturePhoto} className="flex-1 h-12">
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                  <Button type="button" onClick={stopCamera} variant="outline" className="flex-1 h-12">
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Photo preview / placeholder */}
                <div className="flex flex-col items-center">
                  {photoPreview ? (
                    <div className="relative">
                      <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-primary/20 shadow-lg">
                        <img
                          src={photoPreview}
                          alt="Profile preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="absolute -top-1 -right-1 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-36 h-36 rounded-full bg-muted border-4 border-dashed border-border flex flex-col items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      <p className="text-[10px] text-muted-foreground mt-1">No photo yet</p>
                    </div>
                  )}
                </div>

                {/* Upload options */}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={startCamera}
                    variant="outline"
                    className="flex-1 h-12"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Selfie
                  </Button>
                  <label className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                  </label>
                </div>

                {/* Action buttons */}
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={handleCompleteSetup}
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
                        {photoPreview ? "Complete Setup" : "Skip & Complete Setup"}
                        <Check className="w-4 h-4" />
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setStep("profile")}
                    className="w-full text-sm text-muted-foreground hover:text-foreground py-2"
                  >
                    ← Go Back
                  </button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  📷 You can always add or change your photo later from your profile
                </p>
              </div>
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
