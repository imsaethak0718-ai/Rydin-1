import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bus, Navigation, Timer, Wind, MapPin } from "lucide-react";

interface BusState {
    id: number;
    routeId: 'medical';
    progress: number;
    direction: "forward" | "backward";
    speed: number;
    color: string;
}

const ShuttleSimMap = () => {
    // ONLY ONE ROUTE: Arch Gate <-> Medical Hostel
    const [buses, setBuses] = useState<BusState[]>([
        { id: 1, routeId: 'medical', progress: 10, direction: "forward", speed: 0.18, color: "bg-indigo-600" }, // Going to Medical
        { id: 2, routeId: 'medical', progress: 85, direction: "backward", speed: 0.18, color: "bg-emerald-500" }, // Returning to Arch
    ]);

    // REAL GEOGRAPHY PATH (Relative to 800x400 viewBox)
    // Arch Gate (Right/700,200) -> Center Roundabout (400,250) -> Medical Hostel (Left/100,250)
    const pathMedical = "M 700,200 L 600,200 C 500,200 450,250 400,250 L 100,250";

    useEffect(() => {
        const interval = setInterval(() => {
            setBuses(prev => prev.map(bus => {
                let nextProgress = bus.progress;
                let nextDirection = bus.direction;

                if (bus.direction === "forward") {
                    nextProgress += bus.speed;
                    if (nextProgress >= 100) { nextProgress = 100; nextDirection = "backward"; }
                } else {
                    nextProgress -= bus.speed;
                    if (nextProgress <= 0) { nextProgress = 0; nextDirection = "forward"; }
                }

                return { ...bus, progress: nextProgress, direction: nextDirection };
            }));
        }, 30);
        return () => clearInterval(interval);
    }, []);

    // Helper to get XY on specific paths
    const getPointOnPath = (pathD: string, progress: number) => {
        const p = progress / 100;
        let x = 0, y = 0;

        // Arch (700,200) -> Center (400,250) -> Medical (100,250)
        // Split into 3 segments for approximation
        if (p < 0.2) { // Arch to Road
            x = 700 - (100 * (p / 0.2));
            y = 200;
        } else if (p < 0.4) { // Curve to Center
            const p2 = (p - 0.2) / 0.2;
            x = 600 - (200 * p2);
            y = 200 + (50 * p2); // Linear approx for curve for now
        } else { // Center to Medical
            const p3 = (p - 0.4) / 0.6;
            x = 400 - (300 * p3);
            y = 250;
        }
        return { x, y };
    };

    return (
        <div className="relative w-full aspect-[2/1] bg-[#f0f4f8] rounded-[2rem] overflow-hidden border border-slate-200 shadow-2xl group cursor-crosshair">

            {/* 1. Base Map Layer */}
            <div className="absolute inset-0">
                {/* GST Road */}
                <div className="absolute right-[5%] top-0 bottom-0 w-[40px] bg-slate-300 border-l-2 border-r-2 border-slate-400 flex flex-col justify-between py-2 items-center">
                    <div className="h-full w-0 border-r-2 border-dashed border-white/50" />
                </div>
                {/* Greenery */}
                <div className="absolute left-[20%] top-[40%] w-[200px] h-[100px] bg-emerald-500/5 rounded-full blur-2xl" />
            </div>

            {/* 2. SVG Routes Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 400" preserveAspectRatio="none">
                <path d={pathMedical} fill="none" stroke="white" strokeWidth="22" strokeLinecap="round" />
                <path d={pathMedical} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
            </svg>

            {/* 3. Landmarks */}

            {/* Arch Gate (Start) */}
            <div className="absolute right-[12%] top-[45%] flex flex-col items-center">
                <div className="w-16 h-10 border-t-4 border-l-2 border-r-2 border-amber-600 rounded-t-xl bg-white/80 backdrop-blur-sm shadow-sm flex items-end justify-center pb-1">
                    <span className="text-[6px] font-bold text-amber-800 uppercase">Start</span>
                </div>
                <div className="mt-1 bg-white px-2 py-0.5 rounded shadow text-[8px] font-black text-slate-700">ARCH GATE</div>
            </div>

            {/* Medical Hostel (End) */}
            <div className="absolute left-[10%] top-[60%] flex flex-col items-center">
                <div className="w-16 h-12 bg-white border border-blue-200 rounded-lg shadow-md flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-blue-50/50" />
                    <div className="text-[12px]">🏥</div>
                </div>
                <div className="mt-1 bg-white px-2 py-0.5 rounded shadow text-[8px] font-black text-slate-700">MEDICAL HOSTEL</div>
            </div>

            {/* UB (Midpoint) */}
            <div className="absolute left-[50%] top-[65%] -translate-x-1/2 flex flex-col items-center opacity-50">
                <div className="w-8 h-8 bg-slate-100 rounded border border-slate-200" />
                <span className="text-[6px] text-slate-400 mt-1">UB</span>
            </div>

            {/* 4. Live Buses */}
            {buses.map((bus) => {
                const { x, y } = getPointOnPath(pathMedical, bus.progress);

                return (
                    <motion.div
                        key={bus.id}
                        className="absolute z-20 pointer-events-none"
                        style={{
                            left: `${(x / 800) * 100}%`,
                            top: `${(y / 400) * 100}%`,
                            translateX: "-50%",
                            translateY: "-50%"
                        }}
                    >
                        <div className="relative group/bus">
                            {/* Route Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover/bus:opacity-100 transition-opacity bg-black text-slate-50 text-[8px] px-2 py-0.5 rounded whitespace-nowrap">
                                {bus.direction === 'forward' ? 'To Medical' : 'To Arch'}
                            </div>

                            <motion.div
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className={`w-10 h-6 ${bus.color} rounded shadow-lg border-2 border-white flex items-center justify-center relative`}
                            >
                                <div className="w-8 h-3 bg-white/90 rounded-[1px]" />
                                {/* Wheels */}
                                <div className="absolute -bottom-1 left-1 w-1.5 h-1.5 bg-slate-800 rounded-full" />
                                <div className="absolute -bottom-1 right-1 w-1.5 h-1.5 bg-slate-800 rounded-full" />
                            </motion.div>
                        </div>
                    </motion.div>
                );
            })}

            {/* HUD Overlay */}
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md p-3 rounded-xl border border-slate-200/50 shadow-xl max-w-[150px]">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-800">FREE SHUTTLE</span>
                </div>
                <p className="text-[8px] text-slate-500 leading-tight">
                    Running specifically between <span className="font-bold text-slate-700">Arch Gate</span> and <span className="font-bold text-slate-700">Medical Hostel</span> every 15 mins.
                </p>
            </div>

        </div>
    );
};

export default ShuttleSimMap;
