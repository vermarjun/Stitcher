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

type Preset = '24h' | '7d' | '30d' | '90d' | '6m' | '1y';

const PRESETS: { label: string; value: Preset }[] = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last 6 months', value: '6m' },
  { label: 'Last 12 months', value: '1y' },
];

const PRESET_DAYS: Record<Preset, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '6m': 182,
  '1y': 365,
};

function presetToRange(preset: Preset): DateRange {
  const to = new Date();
  return { from: subDays(to, PRESET_DAYS[preset] ?? 30), to };
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
