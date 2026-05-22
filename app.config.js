const variant = process.env.APP_VARIANT || process.env.EAS_BUILD_PROFILE || 'development';

export default {
  expo: {
    name:
      variant === 'production'
        ? 'Muscle Manager'
        : variant === 'preview'
          ? 'Muscle Manager [Preview]'
          : 'Muscle Manager [Dev]',
    slug: 'MuscleManager',
    scheme:
      variant === 'production'
        ? 'musclemanager'
        : variant === 'preview'
          ? 'musclemanager-preview'
          : 'musclemanager-dev',
    version: '1.0.0',
    newArchEnabled: true,
    icon: './assets/images/icon.png',
    splash: {
      image: './assets/images/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
    },
    android: {
      package:
        variant === 'production'
          ? 'com.devmindtan.muscleexercisemanager'
          : variant === 'preview'
            ? 'com.devmindtan.muscleexercisemanager.preview'
            : 'com.devmindtan.muscleexercisemanager.dev',
    },
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'a47e764d-1ac7-453f-87f2-2abaab93c07d',
      },
    },
    owner: 'devmindtan',
    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            newArchEnabled: true,
          },
        },
      ],
    ],
  },
};
