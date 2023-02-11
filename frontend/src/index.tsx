import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import ThemeProvider, { ThemedGlobalStyle } from 'theme'

import store from './appState'
import ApplicationUpdater from './appState/application/updater'
import UserUpdater from './appState/user/updater'
import App from './pages/App'

const container = document.getElementById('root') as HTMLElement

function Updaters() {
  return (
    <>
      <UserUpdater />
      <ApplicationUpdater />
    </>
  )
}

createRoot(container).render(
  <StrictMode>
    <Provider store={store}>
      <Updaters />
      <ThemeProvider>
        <ThemedGlobalStyle />
        <App />
      </ThemeProvider>
    </Provider>
  </StrictMode>
)
