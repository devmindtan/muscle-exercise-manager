import { View, Image, StyleSheet } from 'react-native';
import { User as UserIcon } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';

interface AvatarCircleProps {
  uri?: string | null;
  size?: number;
}

export function AvatarCircle({ uri, size = 36 }: AvatarCircleProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, dimension]} />;
  }

  return (
    <View style={[styles.fallback, dimension]}>
      <UserIcon color={Colors.accent} size={Math.round(size * 0.55)} strokeWidth={1.6} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: Colors.surfaceElevated },
  fallback: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
