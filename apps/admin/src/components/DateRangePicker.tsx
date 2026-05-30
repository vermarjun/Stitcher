import { useState } from 'react';
import { subDays } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DateRange } from '@/lib/types';

type Preset = '24h' | '7d' | '30d';

const PRESETS: { label: string; value: Preset }[] = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
];

function presetToRange(preset: Preset): DateRange {
  const to = new Date();
  switch (preset) {
    case '24h':
      return { from: subDays(to, 1), to };
    case '7d':
      return { from: subDays(to, 7), to };
    case '30d':
    default:
      return { from: subDays(to, 30), to };
  }
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  defaultPreset?: Preset;
}

export function DateRangePicker({
  value: _value,
  onChange,
  defaultPreset = '30d',
}: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<Preset>(defaultPreset);

  const handlePreset = (preset: Preset) => {
    setActivePreset(preset);
    onChange(presetToRange(preset));
  };

  const label = PRESETS.find((p) => p.value === activePreset)?.label ?? 'Custom';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.value}
            onClick={() => handlePreset(preset.value)}
            className={activePreset === preset.value ? 'font-medium' : ''}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          Custom range (coming soon)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Re-export the helper for page agents
export { presetToRange };
