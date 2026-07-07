import { ColorValue, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export function HomeIcon({ color }: { color: ColorValue }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 9,
          borderRightWidth: 9,
          borderBottomWidth: 7,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      <View style={{ width: 18, height: 9, backgroundColor: color, marginTop: -1 }} />
    </View>
  );
}

export function MapIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={16} height={20} viewBox="0 0 16 20">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0C3.6 0 0 3.6 0 8c0 5.5 8 12 8 12s8-6.5 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"
        fill={color}
      />
    </Svg>
  );
}

export function AlertsIcon({ color }: { color: ColorValue }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 16,
          height: 14,
          backgroundColor: color,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
        }}
      />
      <View
        style={{
          width: 6,
          height: 4,
          backgroundColor: color,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          marginTop: -1,
        }}
      />
    </View>
  );
}
