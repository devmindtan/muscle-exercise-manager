import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '@/src/constants/colors';

interface ProgressRingProps {
  progress: number; // 0-1
  color: string;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  textColor?: string;
}

// Vòng tròn tiến độ dùng chung — trước đây MusclesScreen tự vẽ bằng cách tô
// màu từng góc viền (chỉ đúng ở 4 mốc 25/50/75/100%, không mượt), còn trang
// Dinh dưỡng vẽ đúng bằng SVG (stroke-dasharray xoay -90°). Dùng chung cách
// vẽ đúng của Dinh dưỡng cho mọi nơi cần vòng tròn tiến độ.
export function ProgressRing({
  progress,
  color,
  size = 44,
  strokeWidth = 5,
  trackColor = Colors.border,
  textColor,
}: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(progress, 0), 1);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circ}`}
          strokeDashoffset={`${circ * (1 - pct)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <Text style={{ fontSize: size * 0.23, fontWeight: '700', color: textColor ?? color }}>
        {Math.round(pct * 100)}%
      </Text>
    </View>
  );
}
