import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, Users, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import RideLinkParser from '@/components/RideLinkParser';
import BottomNav from '@/components/BottomNav';
import type { ParsedRideLink } from '@/lib/rideLinkParser';

const CreateSplit = () => {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<'link' | 'details' | 'members' | 'share'>('link');
  const [parsedLink, setParsedLink] = useState<ParsedRideLink | null>(null);
  const [splitTitle, setSplitTitle] = useState('');
  const [numberOfPeople, setNumberOfPeople] = useState(2);
  const [isCreating, setIsCreating] = useState(false);
  const [createdSplitId, setCreatedSplitId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const handleParsedLink = (parsed: ParsedRideLink) => {
    setParsedLink(parsed);
    if (parsed.isValid) {
      // Auto-proceed to details
      setTimeout(() => setCurrentStep('details'), 300);
    }
  };

  const handleCreateSplit = async () => {
    if (!session?.user || !parsedLink?.price) {
      toast({
        title: 'Missing Information',
        description: 'Please provide all required details',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      // 1. Insert ride link
      const { data: rideLinkData, error: rideLinkError } = await supabase
        .from('ride_links')
        .insert({
          user_id: session.user.id,
          platform: parsedLink.platform,
          original_link: parsedLink.originalLink,
          pickup_location: parsedLink.pickupLocation,
          dropoff_location: parsedLink.dropoffLocation,
          ride_type: parsedLink.rideType,
          total_price: parsedLink.price,
          currency: parsedLink.currency,
          estimated_duration: parsedLink.estimatedDuration,
          estimated_distance: parsedLink.estimatedDistance,
          raw_metadata: parsedLink.rawData,
        })
        .select()
        .single();

      if (rideLinkError) throw rideLinkError;

      // 2. Create cost split
      const amountPerPerson = Math.round((parsedLink.price / numberOfPeople) * 100) / 100;

      const { data: splitData, error: splitError } = await supabase
        .from('cost_splits')
        .insert({
          created_by: session.user.id,
          ride_link_id: rideLinkData.id,
          title: splitTitle || `${parsedLink.platform.charAt(0).toUpperCase() + parsedLink.platform.slice(1)} Ride`,
          total_amount: parsedLink.price,
          split_count: numberOfPeople,
          amount_per_person: amountPerPerson,
          status: 'active',
        })
        .select()
        .single();

      if (splitError) throw splitError;

      // 3. Add creator as first member
      const { error: memberError } = await supabase
        .from('split_members')
        .insert({
          split_id: splitData.id,
          user_id: session.user.id,
          amount_owed: amountPerPerson,
          amount_paid: 0,
          payment_status: 'pending',
        });

      if (memberError) throw memberError;

      // Generate share link
      const shareUrl = `${window.location.origin}/split/${splitData.share_token}`;
      setCreatedSplitId(splitData.id);
      setShareLink(shareUrl);
      setCurrentStep('share');

      toast({
        title: 'Split Created!',
        description: 'Share the link with friends to join',
      });
    } catch (error) {
      console.error('Error creating split:', error);
      toast({
        title: 'Error Creating Split',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast({
        title: 'Copied!',
        description: 'Share link copied to clipboard',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {/* Step Indicator */}
          <div className="flex gap-1">
            {(['link', 'details', 'members', 'share'] as const).map((step, i) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  ['link', 'details', 'members', 'share'].indexOf(currentStep) >= i
                    ? 'bg-primary'
                    : 'bg-border'
                }`}
                style={{ width: '24px' }}
              />
            ))}
          </div>

          <div className="text-xs font-medium text-muted-foreground">
            {['link', 'details', 'members', 'share'].indexOf(currentStep) + 1}/4
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Step 1: Parse Link */}
        {currentStep === 'link' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div>
              <h1 className="text-2xl font-bold font-display">Share a Ride</h1>
              <p className="text-muted-foreground mt-1">
                Paste a link from Uber, Ola, or Rapido to split costs with friends
              </p>
            </div>

            <RideLinkParser onParsed={handleParsedLink} />
          </motion.div>
        )}

        {/* Step 2: Add Details */}
        {currentStep === 'details' && parsedLink && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <h1 className="text-2xl font-bold font-display">Ride Details</h1>
              <p className="text-muted-foreground mt-1">Add a title for this split</p>
            </div>

            {/* Ride Summary */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">From</span>
                <span className="font-medium">{parsedLink.pickupLocation}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">To</span>
                <span className="font-medium">{parsedLink.dropoffLocation}</span>
              </div>
              <div className="border-t pt-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Price</span>
                <span className="text-lg font-bold text-primary">
                  ₹{parsedLink.price?.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Title Input */}
            <div className="space-y-2">
              <Label>Trip Title (Optional)</Label>
              <Input
                placeholder="e.g., Airport run, Mall trip..."
                value={splitTitle}
                onChange={(e) => setSplitTitle(e.target.value)}
              />
            </div>

            <Button onClick={() => setCurrentStep('members')} className="w-full">
              Continue
            </Button>
          </motion.div>
        )}

        {/* Step 3: Add Members */}
        {currentStep === 'members' && parsedLink && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <h1 className="text-2xl font-bold font-display">Split Among</h1>
              <p className="text-muted-foreground mt-1">How many people are in this ride?</p>
            </div>

            {/* People Counter */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNumberOfPeople(Math.max(1, numberOfPeople - 1))}
                >
                  -
                </Button>
                <div className="text-center">
                  <div className="text-4xl font-bold font-display">{numberOfPeople}</div>
                  <p className="text-sm text-muted-foreground">
                    {numberOfPeople === 1 ? 'Person' : 'People'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNumberOfPeople(numberOfPeople + 1)}
                >
                  +
                </Button>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-primary/5 rounded p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Cost</span>
                  <span className="font-medium">₹{parsedLink.price?.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-lg">
                  <span className="font-semibold">Per Person</span>
                  <span className="font-bold text-primary">
                    ₹{(parsedLink.price! / numberOfPeople).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>💡 You'll be added as the first member. Friends can join via the share link.</p>
              </div>
            </div>

            <Button
              onClick={handleCreateSplit}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Split'
              )}
            </Button>
          </motion.div>
        )}

        {/* Step 4: Share Link */}
        {currentStep === 'share' && shareLink && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="text-center space-y-2">
              <div className="text-5xl">🎉</div>
              <h1 className="text-2xl font-bold font-display">Split Created!</h1>
              <p className="text-muted-foreground">Share this link with friends to join</p>
            </div>

            {/* Share Link Box */}
            <div className="border rounded-lg p-4 space-y-3 bg-secondary/50">
              <p className="text-sm font-medium">Share Link</p>
              <div className="flex gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="flex-1"
                />
                <Button
                  onClick={copyShareLink}
                  variant="outline"
                  size="sm"
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Share Methods */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-1"
                onClick={() => {
                  const text = `Check out this ride split: ${shareLink}`;
                  window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
                }}
              >
                <span>💬</span>
                <span className="text-xs">WhatsApp</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  toast({ title: 'Copied!' });
                }}
              >
                <span>📋</span>
                <span className="text-xs">Copy</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-1"
                onClick={() => navigate('/')}
              >
                <span>🏠</span>
                <span className="text-xs">Home</span>
              </Button>
            </div>

            <Button onClick={() => navigate('/')} className="w-full">
              Done
            </Button>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default CreateSplit;
