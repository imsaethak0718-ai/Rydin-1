import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Phone, GraduationCap, Building, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

const departments = [
  "Computer Science", "Electronics", "Mechanical", "Civil",
  "Biotech", "Commerce", "Law", "Medicine", "Arts",
];

const ProfileSetup = () => {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const { updateProfile } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        name,
        department,
        year,
        phone,
        gender: gender as "male" | "female" | "other",
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
      } as any);
      navigate("/");
    } catch (error) {
      console.error("Profile update error:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 sm:px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-center mb-2">Complete your profile</h1>
        <p className="text-center text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8">
          Help others know who they're riding with
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
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

          {/* Emergency Contact Section */}
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
            Continue
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default ProfileSetup;
