'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SegmentedControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

/** Kis kapcsoló-csoport a shadcn Tabs triggereivel (tartalom-panel nélkül). */
export function SegmentedControl({ label, value, onChange, options }: SegmentedControlProps) {
  return (
    <div>
      <span className="uppercase-label mb-2 block">{label}</span>
      <Tabs value={value} onValueChange={onChange}>
        <TabsList aria-label={label}>
          {options.map(option => (
            <TabsTrigger key={option.value} value={option.value}>{option.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
