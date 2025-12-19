import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageLoaderProps {
  className?: string;
  message?: string;
}

export function PageLoader({ className, message }: PageLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      {message && (
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

export function PageLoaderOverlay({ message }: { message?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      {message && (
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
