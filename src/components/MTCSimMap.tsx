import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bus, Navigation, Timer, Wind, MapPin } from "lucide-react";

interface BusState {
    id: number;
    routeId: 'mtc';
    progress: number;
    direction: "forward" | "backward";
    speed: number;
    color: string;
    label: string;
}

const MTCSimMap = () => {
    // MTC ROUTE: Tambaram (Right) <-> Potheri (Left) - GST Road
    const [buses, setBuses] = useState<BusState[]>([
        { id: 1, routeId: 'mtc', progress: 10, direction: "forward", speed: 0.12, color: "bg-blue-600", label: "500A" }, // Tambaram to Potheri
        { id: 2, routeId: 'mtc', progress: 85, direction: "backward", speed: 0.15, color: "bg-sky-500", label: "114" }, // Potheri to Tambaram
    ]);

    // STRAIGHT PATH for GST ROAD (Relative to 800x400 viewBox)
    // Tambaram (Right/750,250) -> Potheri (Left/50,250)
    const pathGST = "M 750,250 L 50,250";

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

    // Helper to get XY on straight path
    const getPointOnPath = (progress: number) => {
        // Forward: 0 (Right/Tambaram) -> 100 (Left/Potheri)
        // x goes from 750 to 50
        const p = progress / 100;
        const x = 750 - (700 * p);
        const y = 250;
        return { x, y };
    };

    return (
        <div className="relative w-full aspect-[2/1] bg-[#eef2ff] rounded-[2rem] overflow-hidden border border-slate-200 shadow-2xl group cursor-crosshair mb-6">

            {/* 1. Base Map Layer */}
            <div className="absolute inset-0">
                {/* GST Road Background Strip */}
                <div className="absolute left-[5%] right-[5%] top-[62%] h-[20px] bg-slate-200 rounded-full" />
            </div>

            {/* 2. SVG Routes Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 400" preserveAspectRatio="none">
                {/* Main Road Line */}
                <path d={pathGST} fill="none" stroke="white" strokeWidth="20" strokeLinecap="round" />
                <path d={pathGST} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="10 5" />
            </svg>

            {/* 3. Landmarks */}

            {/* Tambaram (Start/Right) */}
            <div className="absolute right-[5%] top-[55%] flex flex-col items-center">
                <div className="w-16 h-12 bg-white border border-slate-300 rounded-lg shadow-md flex items-center justify-center relative overflow-hidden">
                    <div className="text-[12px] font-bold text-slate-700">TBM</div>
                </div>
                <div className="mt-1 bg-white px-2 py-0.5 rounded shadow text-[8px] font-black text-slate-700">TAMBARAM</div>
            </div>

            {/* Potheri (End/Left) */}
            <div className="absolute left-[5%] top-[55%] flex flex-col items-center">
                <div className="w-16 h-12 bg-white border border-slate-300 rounded-lg shadow-md flex items-center justify-center relative overflow-hidden">
                    <div className="text-[12px] font-bold text-slate-700">SRM</div>
                </div>
                <div className="mt-1 bg-white px-2 py-0.5 rounded shadow text-[8px] font-black text-slate-700">POTHERI</div>
            </div>

            {/* Vandalur (Midpoint) */}
            <div className="absolute left-[50%] top-[65%] -translate-x-1/2 flex flex-col items-center opacity-40">
                <div className="w-2 h-2 bg-slate-400 rounded-full" />
                <span className="text-[6px] text-slate-500 mt-1">Vandalur Zoo</span>
            </div>

            {/* 4. Live Buses */}
            {buses.map((bus) => {
                const { x, y } = getPointOnPath(bus.progress);

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
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-100 bg-black/80 text-white text-[8px] px-2 py-0.5 rounded whitespace-nowrap backdrop-blur-md">
                                {bus.label} • {bus.direction === 'forward' ? 'To SRM' : 'To TBM'}
                            </div>

                            <motion.div
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className={`w-12 h-7 ${bus.color} rounded shadow-lg border-2 border-white flex items-center justify-center relative`}
                            >
                                <Bus className="w-4 h-4 text-white/90" />
                                {/* Wheels */}
                                <div className="absolute -bottom-1 left-2 w-1.5 h-1.5 bg-slate-800 rounded-full" />
                                <div className="absolute -bottom-1 right-2 w-1.5 h-1.5 bg-slate-800 rounded-full" />
                            </motion.div>
                        </div>
                    </motion.div>
                );
            })}

            {/* HUD Overlay */}
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md p-3 rounded-xl border border-blue-200/50 shadow-xl max-w-[180px]">
                <div className="flex items-center gap-2 mb-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-slate-800">LIVE MTC FEED</span>
                </div>
                <p className="text-[8px] text-slate-500 leading-tight">
                    Monitoring <span className="font-bold text-slate-700">GST Road Corridor</span> for buses near SRM Campus.
                </p>
                <div className="mt-2 flex gap-1">
                    <span className="text-[8px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">500A</span>
                    <span className="text-[8px] px-1 py-0.5 bg-sky-100 text-sky-700 rounded font-bold">114</span>
                </div>
            </div>

        </div>
    );
};

export default MTCSimMap;
