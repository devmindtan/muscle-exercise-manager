import { AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';

export function ExerciseInjuryBadge({ size = 12 }: { size?: number }) {
  return <AlertTriangle color={Colors.warning} size={size} strokeWidth={2.2} />;
}
