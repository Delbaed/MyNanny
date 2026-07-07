import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../constants/theme';

const SIZE = 200;

export function DuckMascot({ size = SIZE }: { size?: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY }, { scale }] }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="body" cx="35%" cy="30%" r="75%">
            <Stop offset="0%" stopColor={colors.duckYellowLight} />
            <Stop offset="55%" stopColor={colors.duckYellowMid} />
            <Stop offset="100%" stopColor={colors.duckYellowDeep} />
          </RadialGradient>
          <RadialGradient id="head" cx="35%" cy="28%" r="75%">
            <Stop offset="0%" stopColor={colors.duckYellowLight} />
            <Stop offset="60%" stopColor={colors.duckYellowMid} />
            <Stop offset="100%" stopColor={colors.duckYellowDeep} />
          </RadialGradient>
          <RadialGradient id="belly" cx="40%" cy="30%" r="75%">
            <Stop offset="0%" stopColor={colors.duckBellyLight} />
            <Stop offset="70%" stopColor={colors.duckBellyDeep} />
          </RadialGradient>
          <LinearGradient id="wing" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.duckWingLight} />
            <Stop offset="100%" stopColor={colors.duckWingDeep} />
          </LinearGradient>
        </Defs>

        {/* feet */}
        <Ellipse cx={79} cy={187} rx={15} ry={7} fill={colors.accent} />
        <Ellipse cx={121} cy={187} rx={15} ry={7} fill={colors.accent} />

        {/* body */}
        <Ellipse cx={99} cy={116} rx={75} ry={70} fill="url(#body)" />

        {/* folded wing */}
        <Ellipse cx={48} cy={112} rx={28} ry={38} fill="url(#wing)" transform="rotate(-14 48 112)" />

        {/* belly patch */}
        <Ellipse cx={101} cy={140} rx={47} ry={42} fill="url(#belly)" />

        {/* head */}
        <Ellipse cx={101} cy={56} rx={61} ry={56} fill="url(#head)" />

        {/* blush */}
        <Ellipse cx={54} cy={62.5} rx={10} ry={6.5} fill={colors.duckBlush} opacity={0.55} />
        <Ellipse cx={146} cy={62.5} rx={10} ry={6.5} fill={colors.duckBlush} opacity={0.55} />

        {/* eyes */}
        <Ellipse cx={65.5} cy={50.5} rx={5.5} ry={6.5} fill={colors.ink} />
        <Circle cx={65} cy={48} r={2} fill="#fff" />
        <Ellipse cx={134.5} cy={50.5} rx={5.5} ry={6.5} fill={colors.ink} />
        <Circle cx={135} cy={48} r={2} fill="#fff" />

        {/* bill */}
        <Ellipse cx={105} cy={76} rx={21} ry={12} fill={colors.accent} />
        <Rect x={84} y={75} width={42} height={2} fill={colors.accentDeep} />
      </Svg>
    </Animated.View>
  );
}
