import { createApp } from 'vue'
import App from './App.vue'
import { installStore } from './store'
import { installTheme } from './lib/theme'
import './style.css'

installTheme()
installStore()
createApp(App).mount('#app')
