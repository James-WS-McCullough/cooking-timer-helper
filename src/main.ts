import { createApp } from 'vue'
import App from './App.vue'
import { installStore } from './store'
import './style.css'

installStore()
createApp(App).mount('#app')
