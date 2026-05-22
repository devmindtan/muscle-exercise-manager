export default {
  expo: {
    name:
      process.env.EAS_BUILD_PROFILE === 'production'
        ? 'Muscle Manager'
        : process.env.EAS_BUILD_PROFILE === 'preview'
          ? 'Muscle Manager [Preview]'
          : 'Muscle Manager [Dev]',
    slug: 'MuscleManager',
    scheme:
      process.env.EAS_BUILD_PROFILE === 'production'
        ? 'musclemanager'
        : process.env.EAS_BUILD_PROFILE === 'preview'
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
        process.env.EAS_BUILD_PROFILE === 'production'
          ? 'com.devmindtan.muscleexercisemanager'
          : process.env.EAS_BUILD_PROFILE === 'preview'
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
