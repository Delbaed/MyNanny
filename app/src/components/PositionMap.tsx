import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';
import { ANCHORS } from '../config/constants';
import { SafeZone } from '../types/robot';

interface Props {
  x: number | null;
  y: number | null;
  located: boolean;
  safeZone: SafeZone;
  insideSafeZone: boolean;
}

const PADDING_METERS = 1.5;

export function PositionMap({ x, y, located, safeZone, insideSafeZone }: Props) {
  const minX = Math.min(...ANCHORS.map((a) => a.x), safeZone.x - safeZone.radiusMeters) - PADDING_METERS;
  const maxX = Math.max(...ANCHORS.map((a) => a.x), safeZone.x + safeZone.radiusMeters) + PADDING_METERS;
  const minY = Math.min(...ANCHORS.map((a) => a.y), safeZone.y - safeZone.radiusMeters) - PADDING_METERS;
  const maxY = Math.max(...ANCHORS.map((a) => a.y), safeZone.y + safeZone.radiusMeters) + PADDING_METERS;
  const width = maxX - minX;
  const height = maxY - minY;

  const toSvgX = (mx: number) => mx - minX;
  const toSvgY = (my: number) => height - (my - minY); // flip so +y reads as "up"

  const markerColor = !located ? colors.textMuted : insideSafeZone ? colors.online : colors.danger;

  const gridLines = [];
  for (let gx = Math.ceil(minX); gx <= Math.floor(maxX); gx++) {
    gridLines.push(
      <Line key={`gx${gx}`} x1={toSvgX(gx)} y1={0} x2={toSvgX(gx)} y2={height} stroke={colors.border} strokeWidth={0.02} />
    );
  }
  for (let gy = Math.ceil(minY); gy <= Math.floor(maxY); gy++) {
    gridLines.push(
      <Line key={`gy${gy}`} x1={0} y1={toSvgY(gy)} x2={width} y2={toSvgY(gy)} stroke={colors.border} strokeWidth={0.02} />
    );
  }

  return (
    <View style={styles.container}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {gridLines}

        <Circle
          cx={toSvgX(safeZone.x)}
          cy={toSvgY(safeZone.y)}
          r={safeZone.radiusMeters}
          fill={`${colors.primary}22`}
          stroke={colors.primary}
          strokeWidth={0.05}
          strokeDasharray="0.2,0.15"
        />

        {ANCHORS.map((a) => (
          <React.Fragment key={a.id}>
            <Circle cx={toSvgX(a.x)} cy={toSvgY(a.y)} r={0.12} fill={colors.textMuted} />
            <SvgText x={toSvgX(a.x) + 0.2} y={toSvgY(a.y) + 0.05} fontSize={0.35} fill={colors.textMuted}>
              {a.id}
            </SvgText>
          </React.Fragment>
        ))}

        {located && x !== null && y !== null && (
          <>
            <Circle cx={toSvgX(x)} cy={toSvgY(y)} r={0.55} fill={`${markerColor}33`} />
            <Circle cx={toSvgX(x)} cy={toSvgY(y)} r={0.28} fill={markerColor} stroke={colors.surface} strokeWidth={0.05} />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: 1,
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
