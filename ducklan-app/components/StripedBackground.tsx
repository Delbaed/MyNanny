import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet } from 'react-native';
import Svg, { Pattern, Rect } from 'react-native-svg';

export function StripedBackground({ colorA, colorB }: { colorA: string; colorB: string }) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <Svg style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {size.width > 0 && (
        <>
          <Pattern
            id="stripes"
            patternUnits="userSpaceOnUse"
            width={28}
            height={28}
            patternTransform="rotate(135)"
          >
            <Rect x={0} y={0} width={28} height={28} fill={colorA} />
            <Rect x={0} y={0} width={14} height={28} fill={colorB} />
          </Pattern>
          <Rect x={0} y={0} width={size.width} height={size.height} fill="url(#stripes)" />
        </>
      )}
    </Svg>
  );
}
