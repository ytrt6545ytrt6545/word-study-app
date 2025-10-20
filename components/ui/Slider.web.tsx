import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native";

export type SliderProps = {
  value?: number;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const Slider = React.forwardRef<HTMLInputElement | null, SliderProps>(
  (
    {
      value,
      minimumValue = 0,
      maximumValue = 1,
      step = 0.01,
      minimumTrackTintColor,
      maximumTrackTintColor,
      onValueChange,
      onSlidingComplete,
      disabled,
      style,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [internalValue, setInternalValue] = useState<number>(
      value ?? minimumValue
    );

    useImperativeHandle(
      ref,
      () => inputRef.current as HTMLInputElement,
      []
    );

    useEffect(() => {
      if (typeof value === "number" && !Number.isNaN(value)) {
        setInternalValue(value);
      }
    }, [value]);

    const flattened = StyleSheet.flatten(style) as ViewStyle | undefined;
    const width = normalizeDimension(flattened?.width);
    const height = normalizeDimension(flattened?.height);

    const wrapperStyle: React.CSSProperties = {
      display: "flex",
      width,
      height,
      ...pickLayoutStyles(flattened),
    };

    const inputStyle: React.CSSProperties = {
      width: "100%",
      accentColor: minimumTrackTintColor,
      ...(maximumTrackTintColor ? { backgroundColor: maximumTrackTintColor } : {}),
    };

    const emitChange = (next: number) => {
      setInternalValue(next);
      onValueChange?.(next);
    };

    const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
      const next = parseFloat(event.target.value);
      if (!Number.isNaN(next)) {
        emitChange(next);
      }
    };

    const handleComplete = () => {
      onSlidingComplete?.(internalValue);
    };

    return (
      <div style={wrapperStyle}>
        <input
          ref={inputRef}
          type="range"
          min={minimumValue}
          max={maximumValue}
          step={step}
          value={internalValue}
          onChange={handleChange}
          onMouseUp={handleComplete}
          onTouchEnd={handleComplete}
          disabled={disabled}
          style={inputStyle}
        />
      </div>
    );
  }
);

Slider.displayName = "SliderWeb";

function pickLayoutStyles(style?: ViewStyle): React.CSSProperties {
  const result: React.CSSProperties = {};
  if (!style) {
    return result;
  }
  const record = style as Record<string, unknown>;
  const keys: (keyof React.CSSProperties)[] = [
    "margin",
    "marginTop",
    "marginBottom",
    "marginLeft",
    "marginRight",
    "marginInline",
    "marginBlock",
    "padding",
    "paddingTop",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "paddingInline",
    "paddingBlock",
    "display",
    "flex",
    "flexGrow",
    "flexShrink",
    "flexBasis",
    "alignSelf",
  ];
  for (const key of keys) {
    const value = record[key as string];
    if (value !== undefined) {
      (result as Record<string, unknown>)[key as string] = value;
    }
  }
  return result;
}

function normalizeDimension(
  value: ViewStyle["width"] | ViewStyle["height"] | null | undefined
): string | undefined {
  if (typeof value === "number") {
    return `${value}px`;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

export default Slider;
