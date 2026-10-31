import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.murat.koktakip',
  appName: 'Kök',
  webDir: 'dist',
  ios: {
    // Durum çubuğu ve alt çentik boşluğunu CSS safe-area değerleri yönetir.
    contentInset: 'never',
  },
}

export default config
