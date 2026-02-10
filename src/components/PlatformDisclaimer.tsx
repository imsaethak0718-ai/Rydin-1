import { AlertCircle, Info } from "lucide-react";

const PlatformDisclaimer = ({ variant = "footer" }: { variant?: "footer" | "modal" | "inline" }) => {
  const content = (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">
        ℹ️ About Rydin
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Rydin is a <strong>ride coordination platform</strong> that helps students
        share travel costs for common routes. We do not provide transportation
        services, operate vehicles, or employ drivers. Users are responsible for
        arranging their own rides with other members. Rydin is not liable for
        injuries, accidents, or disputes between members.
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Always verify member details, trust scores, and ride information before
        joining. Share your plans with someone you trust. Be safe.
      </p>
    </div>
  );

  if (variant === "footer") {
    return (
      <div className="border-t border-border mt-4 pt-3 px-4 pb-4">
        <details className="cursor-pointer group">
          <summary className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <span className="inline-flex items-center gap-1">
              <Info className="w-3 h-3" />
              About Rydin
            </span>
          </summary>
          <div className="mt-2 pt-2 border-t border-border">{content}</div>
        </details>
      </div>
    );
  }

  if (variant === "modal") {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="text-xs text-muted-foreground space-y-1 bg-background/50 p-2 rounded">
      {content}
    </div>
  );
};

export default PlatformDisclaimer;
