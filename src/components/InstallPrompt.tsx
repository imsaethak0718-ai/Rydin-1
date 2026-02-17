
import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showInstruction, setShowInstruction] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent;
        const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
        const isDesktop = !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        setIsIOS(isIosDevice);

        // Check if already in standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (isStandalone) return;

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener("beforeinstallprompt", handler);

        // Always show strict PWA prompt for iOS or Desktop users to ensure visibility
        if (isIosDevice || isDesktop) {
            setIsVisible(true);
        }

        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstallClick = async () => {
        setShowInstruction(false);

        if (isIOS) {
            // iOS logic remains handled by showing instruction if needed, 
            // but here we just toggle the instruction text for simplicity in this consistent UI
            setShowInstruction(true);
            return;
        }

        if (!deferredPrompt) {
            // Fallback for Desktop/Windows if event didn't fire
            setShowInstruction(true);
            setTimeout(() => setShowInstruction(false), 5000); // Auto hide after 5s
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setIsVisible(false);
        }
        setDeferredPrompt(null);
    };

    if (!isVisible) return null;

    return (
        <div className="flex flex-col gap-2 bg-background border border-border rounded-xl p-4 mb-6 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-100 p-2 rounded-xl">
                        <Download className="w-5 h-5 text-amber-600" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Install Rydin App</span>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleInstallClick}
                        size="sm"
                        className="h-9 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white border-none shadow-sm rounded-lg transition-transform active:scale-95"
                    >
                        {isIOS ? "Install" : "Install"}
                    </Button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {showInstruction && (
                <div className="text-xs text-amber-600 font-medium bg-amber-50 p-2 rounded-lg animate-in fade-in slide-in-from-top-1">
                    {isIOS ? "Tap 'Share' ↓ then 'Add to Home Screen' ⊞" : "To install, click the ⊕ / Install icon in your browser's address bar ↗"}
                </div>
            )}
        </div>
    );
};
