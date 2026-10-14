'use client';

import { Button } from '@/components/ui/button';
import { Check, ClipboardCopy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const COPIED_FEEDBACK_MS = 2000;

interface CopyMarkdownButtonProps {
  /** A gomb felirata, pl. „Riport MD”. */
  label: string;
  /** A Markdown szövege; csak kattintáskor számolódik. */
  build: () => string;
  disabled?: boolean;
}

// Vágólapra másoló gomb a Markdown exportokhoz. A szöveg lustán épül fel (kattintáskor),
// a visszajelzés toast és rövid ideig látszó pipa. Fájlletöltés nincs.
export function CopyMarkdownButton({ label, build, disabled }: CopyMarkdownButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(build());
      toast.success(`${label}: a vágólapra másolva.`);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      toast.error(`${label}: a vágólapra másolás sikertelen.`);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={copy} disabled={disabled} title="Markdown másolása a vágólapra">
      {copied ? <Check className="h-4 w-4" strokeWidth={1.8} /> : <ClipboardCopy className="h-4 w-4" strokeWidth={1.8} />}
      {label}
    </Button>
  );
}
