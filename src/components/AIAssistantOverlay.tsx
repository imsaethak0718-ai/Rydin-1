import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, User, MessageCircle, MapPin, Navigation, Sparkles, TrendingDown, Clock, Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate } from "react-router-dom";

interface Message {
    id: string;
    type: "user" | "assistant";
    content: string;
    timestamp: Date;
    actions?: { label: string; action: string; icon?: any }[];
}

const AIAssistantOverlay = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            type: "assistant",
            content: "Vanakkam! I'm your Rydin Assistant. I can help you with travel routes in Chennai, cost savings, and managing your trips.\n\nType 'Chennai guide' to learn about the city!",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [userTrips, setUserTrips] = useState<any[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { user, isAuthenticated } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    // Fetch user trips when assistant is opened
    useEffect(() => {
        const fetchTrips = async () => {
            if (isAuthenticated && user?.id && isOpen) {
                // Fetch rides created by user
                const { data: hostedRides } = await supabase
                    .from("rides")
                    .select("*")
                    .eq("host_id", user.id)
                    .neq("status", "completed")
                    .neq("status", "cancelled");

                // Fetch rides joined by user
                const { data: joinedRides } = await supabase
                    .from("ride_members")
                    .select("ride_id, rides(*)")
                    .eq("user_id", user.id);

                const joined = (joinedRides || [])
                    .map((m: any) => m.rides)
                    .filter((r: any) => r && r.status !== 'completed' && r.status !== 'cancelled');

                const allTrips = [...(hostedRides || []), ...joined];
                // Deduplicate
                const uniqueTrips = Array.from(new Map(allTrips.map(item => [item.id, item])).values());
                setUserTrips(uniqueTrips);
            }
        };

        fetchTrips();
    }, [isAuthenticated, user?.id, isOpen]);

    const generateFallbackResponse = (userMessage: string): Message => {
        const lower = userMessage.toLowerCase();
        let response = "";
        let actions: Message["actions"] = [];

        // Chennai Guide
        if (lower.includes("chennai") || lower.includes("guide") || lower.includes("places")) {
            response = "Chennai is the Gateway to South India! Here are some key travel tips:\n\n🏖️ Marina Beach: World's 2nd longest beach.\n🏛️ Mylapore: Heritage & temples.\n🛍️ T. Nagar: Best for shopping.\n🥘 Must try: Masala Dosa & Filter Coffee at Saravana Bhavan.\n\nI can suggest the fastest route to any of these places if you want!";
            actions = [
                { label: "Fastest way to Marina", action: "marina_route", icon: Navigation },
                { label: "Best food spots", action: "food_spots", icon: Sparkles }
            ];
        }
        // Fastest Route
        else if (lower.includes("fastest") || lower.includes("route")) {
            response = "For the fastest travel in Chennai:\n\n✨ Local Train (MRTS): Best for avoiding traffic on Old Mahabalipuram Road (OMR).\n✨ Metro Rail: Fastest for Anna Salai & Central.\n✨ Cabs/Hopper: Best for door-to-door, but check OMR traffic peaks (9 AM & 6 PM).\n\nIf you have a trip planned today, I can check current delays for you.";
        }
        // Cheapest Route
        else if (lower.includes("cheap") || lower.includes("save") || lower.includes("cost")) {
            response = "Saving money on commutes is Rydin's specialty!\n\n💰 Bus (MTC): ₹5-₹30 (Cheapest, but slow).\n💰 Shared Auto: ₹20-₹50 for short hops.\n💰 Rydin Hopper (3 co-passengers): Up to 75% cheaper than solo cabs!\n\nA typical trip from SRM to the Airport costs ₹1200 solo, but only ₹300 with 4 people on Rydin.";
        }
        // Trips
        else if (lower.includes("my trips") || lower.includes("trips") || lower.includes("bookings") || lower.includes("my rides")) {
            if (!isAuthenticated) {
                response = "Please sign in to see your active trips.";
                actions = [{ label: "Sign In", action: "go_auth" }];
            } else if (userTrips.length === 0) {
                response = "You don't have any active trips scheduled. Want to create one or browse available rides?";
                actions = [
                    { label: "Create Ride", action: "go_create" },
                    { label: "Browse Rides", action: "go_home" }
                ];
            } else {
                const tripsCount = userTrips.length;
                response = `You have ${tripsCount} active trip${tripsCount > 1 ? 's' : ''} planned:\n\n` +
                    userTrips.map(r => `🚗 To ${r.destination} at ${r.time}`).join('\n') +
                    "\n\nWould you like me to check the weather or traffic for these destinations?";
            }
        }
        // Greetings
        else if (lower.includes("hi") || lower.includes("hello") || lower.includes("hey") || lower.includes("assistant")) {
            response = `Hello ${user?.name || "there"}! I'm your Chennai travel assistant. I can help with:\n\n📍 Route planning\n💹 Cost savings tips\n📜 Chennai heritage guide\n📅 Managing your trips\n\nWhat's on your mind?`;
        }
        // Help
        else if (lower.includes("help") || lower.includes("what can you do")) {
            response = "I'm your all-in-one assistant for navigating Chennai and managing your Rydin pools. Ask me things like:\n\n• 'Fastest way to Anna Nagar'\n• 'How to save money on rides?'\n• 'List my trips'\n• 'Places to visit in Chennai'";
        }
        // Default
        else {
            response = "I'm still learning about that! But I can definitely help you with Chennai routes, travel costs, or your Rydin trips. Try asking 'What's the cheapest way to the airport?'";
        }

        return {
            id: Date.now().toString(),
            type: "assistant",
            content: response,
            timestamp: new Date(),
            actions: actions.length > 0 ? actions : undefined
        };
    };

    const generateGroqResponse = async (userMessage: string): Promise<Message | null> => {
        const apiKey = import.meta.env.VITE_GROQ_API_KEY;
        if (!apiKey) return null;

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: "system",
                            content: "You are Rydin Assistant, a helpful and safety-conscious travel assistant for students at SRM University. You help with travel routes, cost savings, and finding co-passengers using 'Hopper'. Be concise, friendly, and use emojis."
                        },
                        { role: "user", content: userMessage }
                    ],
                    model: "llama-3.3-70b-versatile"
                })
            });

            if (!response.ok) return null;

            const data = await response.json();
            const content = data.choices[0]?.message?.content || null;

            if (!content) return null;

            return {
                id: Date.now().toString(),
                type: "assistant",
                content: content,
                timestamp: new Date()
            };
        } catch (error) {
            console.error("Groq API error:", error);
            return null;
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            type: "user",
            content: input,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        const currentInput = input;
        setInput("");
        setIsLoading(true);

        // Try Groq API first
        let response = await generateGroqResponse(currentInput);

        // If Groq fails or no key, fallback to local logic with delay
        if (!response) {
            // Natural delay logic for fallback
            const delay = Math.min(1500, Math.max(800, currentInput.length * 20));
            await new Promise((resolve) => setTimeout(resolve, delay));
            response = generateFallbackResponse(currentInput);
        }

        setMessages((prev) => [...prev, response!]);
        setIsLoading(false);
    };

    const handleAction = (action: string) => {
        if (action === "marina_route") {
            setInput("What is the fastest way to Marina Beach?");
            handleSendMessage();
        } else if (action === "food_spots") {
            setInput("Where should I eat in Chennai?");
            handleSendMessage();
        } else if (action === "go_auth") {
            navigate("/auth");
            setIsOpen(false);
        } else if (action === "go_create") {
            navigate("/create");
            setIsOpen(false);
        } else if (action === "go_home") {
            navigate("/");
            setIsOpen(false);
        }
    };

    return (
        <div className="fixed bottom-24 right-4 z-[100] sm:bottom-6 sm:right-6">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20, transformOrigin: "bottom right" }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        className="mb-4 w-[calc(100vw-2rem)] sm:w-96"
                    >
                        <Card className="shadow-2xl border-primary/20 bg-background/95 backdrop-blur-xl overflow-hidden flex flex-col h-[500px] sm:h-[600px]">
                            {/* Header */}
                            <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                                        <Bot className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm">Rydin Assistant</h3>
                                        <div className="text-[10px] opacity-80 flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Always online
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, x: msg.type === "user" ? 10 : -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        <div className={`max-w-[85%] flex gap-2 ${msg.type === "user" ? "flex-row-reverse" : "flex-row"}`}>
                                            {msg.type === "assistant" && (
                                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                                                    <Bot className="w-3.5 h-3.5 text-primary" />
                                                </div>
                                            )}
                                            <div>
                                                <div className={`p-3 rounded-2xl text-sm shadow-sm ${msg.type === "user"
                                                    ? "bg-primary text-primary-foreground rounded-tr-none"
                                                    : "bg-muted text-foreground rounded-tl-none border border-border/50"
                                                    }`}>
                                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                                </div>
                                                {msg.actions && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {msg.actions.map((act, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => handleAction(act.action)}
                                                                className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary transition-all flex items-center gap-1.5"
                                                            >
                                                                {act.icon && <act.icon className="w-3 h-3" />}
                                                                {act.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                <p className={`text-[9px] mt-1 text-muted-foreground ${msg.type === "user" ? "text-right" : "text-left"}`}>
                                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                                {isLoading && (
                                    <div className="flex gap-2">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Bot className="w-3.5 h-3.5 text-primary animate-bounce" />
                                        </div>
                                        <div className="bg-muted p-3 rounded-2xl rounded-tl-none border border-border/50 flex gap-1 items-center h-10">
                                            <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                                            <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                                            <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Quick Prompt Bar */}
                            {messages.length < 5 && (
                                <div className="px-4 py-2 border-t border-border/10 bg-muted/30 flex gap-2 overflow-x-auto no-scrollbar">
                                    {["Fastest Route", "Cheap Travel", "Chennai Guide", "My Trips"].map((prompt) => (
                                        <button
                                            key={prompt}
                                            onClick={() => { setInput(prompt); handleSendMessage(); }}
                                            className="whitespace-nowrap text-[10px] px-3 py-1 rounded-full bg-background border border-border hover:border-primary/30 transition-colors"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Input Area */}
                            <div className="p-4 border-t border-border/50 bg-background/50">
                                <form onSubmit={handleSendMessage} className="flex gap-2">
                                    <Input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Ask about your trip..."
                                        className="flex-1 h-11 bg-muted/30 border-none focus-visible:ring-primary/20 rounded-xl text-sm"
                                        disabled={isLoading}
                                    />
                                    <Button
                                        type="submit"
                                        size="icon"
                                        className="h-11 w-11 rounded-xl shadow-lg shrink-0"
                                        disabled={!input.trim() || isLoading}
                                    >
                                        <Send className="w-4 h-4" />
                                    </Button>
                                </form>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Trigger Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${isOpen ? "bg-destructive text-destructive-foreground rotate-90" : "bg-primary text-primary-foreground"
                    }`}
            >
                {isOpen ? <X className="w-6 h-6" /> : (
                    <div className="relative">
                        <Bot className="w-7 h-7" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-primary rounded-full" />
                    </div>
                )}
            </motion.button>
        </div>
    );
};

export default AIAssistantOverlay;
