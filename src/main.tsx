import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Todo } from './components/Todo'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Todo />
  </StrictMode>,
)
