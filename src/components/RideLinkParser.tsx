import { useState } from 'react';
import { Copy, Check, AlertCircle, Loader, MapPin, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseRideLink, formatPrice, isValidParsedLink, type ParsedRideLink } from '@/lib/rideLinkParser';

interface RideLinkParserProps {
  onParsed: (parsed: ParsedRideLink) => void;
  loading?: boolean;
}

export const RideLinkParser = ({ onParsed, loading = false }: RideLinkParserProps) => {
  const [linkInput, setLinkInput] = useState('');
  const [parsedLink, setParsedLink] = useState<ParsedRideLink | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setLinkInput(text);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const handleParse = () => {
    if (!linkInput.trim()) return;

    setIsLoading(true);
    // Simulate small processing delay
    setTimeout(() => {
      const parsed = parseRideLink(linkInput);
      setParsedLink(parsed);
      setIsLoading(false);

      if (parsed.isValid) {
        onParsed(parsed);
      }
    }, 500);
  };

  const handleCopyLink = () => {
    if (linkInput) {
      navigator.clipboard.writeText(linkInput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getPlatformBadgeColor = (platform: string) => {
    switch (platform) {
      case 'uber':
        return 'bg-black text-white';
      case 'ola':
        return 'bg-yellow-500 text-black';
      case 'rapido':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="space-y-4">
      {/* Input Section */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Paste Ride Link</label>
        <p className="text-xs text-muted-foreground">
          Share link from Uber, Ola, or Rapido app
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="Paste Uber, Ola, or Rapido link here..."
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleParse()}
            className="flex-1"
            disabled={isLoading || loading}
          />
          <Button
            onClick={handlePaste}
            variant="outline"
            size="sm"
            disabled={isLoading || loading}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Parse Button */}
      <Button
        onClick={handleParse}
        disabled={!linkInput.trim() || isLoading || loading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader className="w-4 h-4 mr-2 animate-spin" />
            Parsing...
          </>
        ) : (
          'Parse Ride Details'
        )}
      </Button>

      {/* Parsed Result */}
      {parsedLink && (
        <div className="border rounded-lg p-4 space-y-3">
          {/* Header with Platform Badge */}
          <div className="flex items-center justify-between">
            <Badge className={getPlatformBadgeColor(parsedLink.platform)}>
              {parsedLink.platform.toUpperCase()}
            </Badge>
            {parsedLink.isValid ? (
              <Badge variant="outline" className="border-green-500 text-green-700">
                ✓ Valid
              </Badge>
            ) : (
              <Badge variant="outline" className="border-orange-500 text-orange-700">
                ⚠ Pending Details
              </Badge>
            )}
          </div>

          {/* Error Message */}
          {parsedLink.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parsedLink.error}</AlertDescription>
            </Alert>
          )}

          {/* Location Details */}
          <div className="space-y-2">
            <div className="flex gap-2 items-start">
              <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="text-sm font-medium truncate">{parsedLink.pickupLocation || 'Not available'}</p>
              </div>
            </div>

            <div className="h-6 flex items-center justify-center">
              <div className="w-0.5 h-4 bg-border" />
            </div>

            <div className="flex gap-2 items-start">
              <MapPin className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Dropoff</p>
                <p className="text-sm font-medium truncate">{parsedLink.dropoffLocation || 'Not available'}</p>
              </div>
            </div>
          </div>

          {/* Price Details */}
          {parsedLink.price !== undefined && (
            <div className="bg-primary/5 rounded p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Total Price</span>
              </div>
              <span className="text-lg font-bold text-primary">
                {formatPrice(parsedLink.price)}
              </span>
            </div>
          )}

          {/* Ride Type */}
          {parsedLink.rideType && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ride Type</span>
              <span className="font-medium">{parsedLink.rideType}</span>
            </div>
          )}

          {/* Duration & Distance */}
          {(parsedLink.estimatedDuration || parsedLink.estimatedDistance) && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {parsedLink.estimatedDuration && (
                <div className="bg-secondary/50 rounded p-2">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-medium">{parsedLink.estimatedDuration} min</p>
                </div>
              )}
              {parsedLink.estimatedDistance && (
                <div className="bg-secondary/50 rounded p-2">
                  <p className="text-xs text-muted-foreground">Distance</p>
                  <p className="font-medium">{parsedLink.estimatedDistance} km</p>
                </div>
              )}
            </div>
          )}

          {/* Extracted Time */}
          <p className="text-xs text-muted-foreground">
            Parsed at {new Date(parsedLink.extractedAt).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-950 rounded p-3 text-sm space-y-1">
        <p className="font-medium text-blue-900 dark:text-blue-100">
          💡 How to get a shareable link:
        </p>
        <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
          <li><strong>Uber</strong>: Open ride → Share → Copy link</li>
          <li><strong>Ola</strong>: Ride details → Share → Copy link</li>
          <li><strong>Rapido</strong>: Booking details → Share → Copy link</li>
        </ul>
      </div>
    </div>
  );
};

export default RideLinkParser;
