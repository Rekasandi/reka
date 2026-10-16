import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerEyeDropper,
  ColorPickerHueSlider,
  ColorPickerInput,
  ColorPickerSwatch,
  ColorPickerTrigger,
} from '@reka/ui';

export function ColorPickerField({
  label,
  value,
  disabled = false,
  onValueChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  return (
    <ColorPicker value={value} onValueChange={onValueChange} defaultFormat="hex" disabled={disabled}>
      <ColorPickerTrigger aria-label={label} title={label} variant="outline" size="icon" className="size-9 p-1">
        <ColorPickerSwatch className="size-full rounded-sm" />
      </ColorPickerTrigger>
      <ColorPickerContent align="end" className="w-[min(340px,calc(100vw-2rem))]">
        <ColorPickerArea aria-label={`${label} color area`} />
        <ColorPickerEyeDropper aria-label={`Pick ${label} from screen`} />
        <ColorPickerHueSlider aria-label={`${label} hue`} />
        <ColorPickerInput aria-label={`${label} hex value`} withoutAlpha />
      </ColorPickerContent>
    </ColorPicker>
  );
}
