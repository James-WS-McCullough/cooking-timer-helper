// Dev-only playground (npm run lab). Nothing here is part of the production build.
import { createApp } from 'vue'
import '../../src/style.css'
import VoiceLab from './VoiceLab.vue'

document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
createApp(VoiceLab).mount('#lab')
