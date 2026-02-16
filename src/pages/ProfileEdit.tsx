import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Phone, GraduationCap, Building, ArrowLeft, Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const departments = [
    "Computer Science", "Electronics", "Mechanical", "Civil",
    "Biotech", "Commerce", "Law", "Medicine", "Arts",
];

const ProfileEdit = () => {
    const { user, updateProfile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [name, setName] = useState(user?.name || "");
    const [department, setDepartment] = useState(user?.department || "");
    const [year, setYear] = useState(user?.year || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [gender, setGender] = useState<"male" | "female" | "other" | "">(user?.gender || "");
    const [emergencyName, setEmergencyName] = useState(user?.emergency_contact_name || "");
    const [emergencyPhone, setEmergencyPhone] = useState(user?.emergency_contact_phone || "");
    const [upiId, setUpiId] = useState(user?.upi_id || "");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !department || !year || !phone || !gender) {
            toast({
                title: "Missing Information",
                description: "Please fill in all required fields",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        try {
            await updateProfile({
                name,
                department,
                year,
                phone,
                gender: gender as "male" | "female" | "other",
                emergency_contact_name: emergencyName,
                emergency_contact_phone: emergencyPhone,
                upi_id: upiId
            } as any);

            toast({
                title: "Profile Updated",
                description: "Your changes have been saved successfully.",
            });
            navigate("/profile");
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to update profile",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 bg-background/80 backdrop-blur-md z-40 border-b border-border">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-bold font-display">Edit Profile</h1>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                            <User className="w-4 h-4" /> Basic Information
                        </h2>

                        <div className="space-y-2">
                            <label className="text-xs font-medium px-1">Full Name</label>
                            <Input
                                placeholder="Your Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-12 bg-card border-border"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium px-1">Department</label>
                                <Select value={department} onValueChange={setDepartment}>
                                    <SelectTrigger className="h-12 bg-card">
                                        <SelectValue placeholder="Dept" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map((dept) => (
                                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium px-1">Year</label>
                                <Select value={year} onValueChange={setYear}>
                                    <SelectTrigger className="h-12 bg-card">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1st Year">1st Year</SelectItem>
                                        <SelectItem value="2nd Year">2nd Year</SelectItem>
                                        <SelectItem value="3rd Year">3rd Year</SelectItem>
                                        <SelectItem value="4th Year">4th Year</SelectItem>
                                        <SelectItem value="Postgrad">Postgraduate</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium px-1">Gender</label>
                            <div className="flex gap-2">
                                {["male", "female", "other"].map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => setGender(g as any)}
                                        className={`flex-1 h-12 rounded-xl text-sm font-medium transition-all border ${gender === g
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-card border-border text-muted-foreground hover:border-primary/50"
                                            }`}
                                    >
                                        {g.charAt(0).toUpperCase() + g.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border">
                        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                            <Phone className="w-4 h-4" /> Contact & Payments
                        </h2>

                        <div className="space-y-2">
                            <label className="text-xs font-medium px-1">Phone Number</label>
                            <Input
                                placeholder="Phone Number"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="h-12 bg-card"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium px-1">UPI ID (for receiving payments)</label>
                            <Input
                                placeholder="username@upi"
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                className="h-12 bg-card"
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border">
                        <h2 className="text-sm font-semibold text-safety flex items-center gap-2 text-red-500">
                            <Save className="w-4 h-4" /> Emergency Contact
                        </h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Input
                                    placeholder="Contact Name"
                                    value={emergencyName}
                                    onChange={(e) => setEmergencyName(e.target.value)}
                                    className="h-12 bg-card"
                                />
                            </div>
                            <div className="space-y-2">
                                <Input
                                    placeholder="Contact Phone"
                                    value={emergencyPhone}
                                    onChange={(e) => setEmergencyPhone(e.target.value)}
                                    className="h-12 bg-card"
                                />
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-14 rounded-2xl shadow-lg shadow-primary/20 text-lg font-bold mt-8"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 border-2 border-white border-t-transparent animate-spin rounded-full" />
                        ) : (
                            "Save Changes"
                        )}
                    </Button>
                </form>
            </main>
        </div>
    );
};

export default ProfileEdit;
