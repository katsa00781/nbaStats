'use client';

import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface DataLoadErrorProps {
  message: string;
  onRetry: () => void;
}

// Adatbetöltési hiba egy nézetben: inline panel újrapróbálással + toast.
export function DataLoadError({ message, onRetry }: DataLoadErrorProps) {
  useEffect(() => {
    toast.error(message);
  }, [message]);

  return (
    <div role="alert" className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 px-4 py-3 text-sm">
      <AlertCircle className="h-4 w-4 shrink-0 text-negative" strokeWidth={1.8} />
      <span className="text-negative">{message}</span>
      <Button variant="ghost" size="sm" onClick={onRetry} className="ml-auto flex items-center gap-2">
        <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
        Újrapróbálás
      </Button>
    </div>
  );
}
