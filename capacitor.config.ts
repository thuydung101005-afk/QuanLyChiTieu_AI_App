import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nckh.quanlychitieu',
  appName: 'QuanLyChiTieu AI',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: 'Native',
      resizeOnFullScreen: true
    }
  }
};

export default config;
