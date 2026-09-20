import { createApp } from 'vue'
import App from './App.vue'
import { installTheme } from './lib/theme'
import { installVoice } from './lib/voice'
import { installStore } from './store'
import './style.css'

installTheme()
installStore()
installVoice()
createApp(App).mount('#app')
