import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/roboto/wght.css'
import '@fontsource-variable/roboto-slab/wght.css'
import './index.css'
import App from './App.tsx'
import { ContentProvider } from './content'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('The application root element is missing.')

const initialNow = Date.now()

createRoot(rootElement).render(
  <StrictMode>
    <ContentProvider appId="fulfillops" modelUrl="/fulfillops-model.json">
      <App initialNow={initialNow} />
    </ContentProvider>
  </StrictMode>,
)
