import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../constants/theme';

export function DuckAvatar({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      <Defs>
        <RadialGradient id="avatarHead" cx="35%" cy="30%" r="75%">
          <Stop offset="0%" stopColor={colors.duckYellowLight} />
          <Stop offset="60%" stopColor={colors.duckYellowMid} />
          <Stop offset="100%" stopColor={colors.duckYellowDeep} />
        </RadialGradient>
      </Defs>
      <Circle cx={22} cy={22} r={22} fill="url(#avatarHead)" />
      <Ellipse cx={12.5} cy={18} rx={2.5} ry={3} fill={colors.ink} />
      <Ellipse cx={31.5} cy={18} rx={2.5} ry={3} fill={colors.ink} />
      <Ellipse cx={22} cy={25.5} rx={8} ry={4.5} fill={colors.accent} />
    </Svg>
  );
}
