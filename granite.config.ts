import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'jump-egg',
  brand: {
    displayName: '점프에그',
    primaryColor: '#fbbf24',
    icon: '',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [],
});
