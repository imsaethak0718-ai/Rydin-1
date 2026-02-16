import { useState, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { MapPin, Bus, Navigation, Info } from "lucide-react";

const ShuttleSimMap = () => {
    const [busPosition, setBusPosition] = useState({ x: 10, y: 50 });
    const [direction, setDirection] = useState("towards-potheri");
    const [isMoving, setIsMoving] = useState(true);

    // Path points (normalized 0-100)
    // Points: Campus Main (10, 50) -> Gate 1 (40, 50) -> Potheri Station (90, 50)
    const points = [
        { x: 10, y: 50, label: "SRM Campus" },
        { x: 50, y: 50, label: "Gate 1" },
        { x: 90, y: 50, label: "Potheri Stn" }
    ];

    useEffect(() => {
        if (!isMoving) return;

        const interval = setInterval(() => {
            setBusPosition(prev => {
                const step = 0.5;
                if (direction === "towards-potheri") {
                    if (prev.x >= 90) {
                        setDirection("towards-campus");
                        return { ...prev, x: 90 };
                    }
                    return { ...prev, x: prev.x + step };
                } else {
                    if (prev.x <= 10) {
                        setDirection("towards-potheri");
                        return { ...prev, x: 10 };
                    }
                    return { ...prev, x: prev.x - step };
                }
            });
        }, 100);

        return () => clearInterval(interval);
    }, [isMoving, direction]);

    return (
        <div className="relative w-full aspect-[2/1] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            {/* Map Grid/Texture */}
            <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle, #4f46e5 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

            {/* Route Path Line */}
            <svg className="absolute inset-0 w-full h-full">
                <motion.path
                    d="M 10 50 L 90 50"
                    fill="none"
                    stroke="rgba(79, 70, 229, 0.2)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    style={{ vectorEffect: 'non-scaling-stroke' }}
                    viewBox="0 0 100 100"
                />
                <motion.path
                    d="M 10 50 L 90 50"
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="1 10"
                    style={{ vectorEffect: 'non-scaling-stroke' }}
                />
            </svg>

            {/* Labels & Markers */}
            {points.map((pt, i) => (
                <div
                    key={pt.label}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                    style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                >
                    <div className={`w-3 h-3 rounded-full border-2 border-slate-900 shadow-lg ${i === 0 ? 'bg-indigo-500' : i === 2 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tighter bg-slate-900/80 px-1 rounded whitespace-nowrap">
                        {pt.label}
                    </span>
                </div>
            ))}

            {/* Animated Bus */}
            <motion.div
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                animate={{
                    left: `${busPosition.x}%`,
                    top: `${busPosition.y}%`,
                    rotateY: direction === "towards-potheri" ? 0 : 180
                }}
                transition={{ type: "tween", ease: "linear", duration: 0.1 }}
            >
                <div className="relative group">
                    <div className="absolute -inset-2 bg-indigo-500/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
                    <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg border border-indigo-400/30">
                        <Bus className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>

                    {/* Bus Info Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-slate-800 text-white text-[8px] px-2 py-1 rounded shadow-xl border border-slate-700 whitespace-nowrap">
                            Shuttle #02 · Live
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Map Overlay Info */}
            <div className="absolute top-3 left-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded-full border border-slate-700/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-slate-200">LIVE TRACKING</span>
                </div>
            </div>

            <div className="absolute bottom-3 right-3">
                <div className="bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-1">
                        <Navigation className="w-2.5 h-2.5 text-indigo-400" />
                        <span className="text-[8px] font-medium text-slate-300">
                            {direction === "towards-potheri" ? "To Potheri" : "To Campus"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Map Decorative Controls */}
            <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors" onClick={() => setIsMoving(!isMoving)}>
                    <Info className="w-3 h-3" />
                </div>
            </div>
        </div>
    );
};

export default ShuttleSimMap;
