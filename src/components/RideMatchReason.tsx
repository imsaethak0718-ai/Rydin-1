import { motion } from "framer-motion";
import { Zap, MapPin, Plane, AlertCircle } from "lucide-react";

interface RideMatchReasonProps {
  reason: string;
  bucketName?: string;
  className?: string;
}

const RideMatchReason = ({ reason, bucketName, className = "" }: RideMatchReasonProps) => {
  const getIcon = () => {
    if (reason.toLowerCase().includes('flight') || reason.toLowerCase().includes('train')) {
      return <Plane className="w-3 h-3" />;
    }
    if (reason.toLowerCase().includes('airport') || reason.toLowerCase().includes('station')) {
      return <MapPin className="w-3 h-3" />;
    }
    return <Zap className="w-3 h-3" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 ${className}`}
    >
      {getIcon()}
      <span className="text-xs font-medium text-blue-700">
        Matched: {reason}
      </span>
    </motion.div>
  );
};

export default RideMatchReason;
