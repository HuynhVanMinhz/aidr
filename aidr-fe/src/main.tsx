import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { attachStore } from './services/apiClient';
import { store } from './store';
import { applyThemeToDocument, getInitialTheme } from './utils/themeStorage';
import './styles/theme.css';
import './styles/global.css';
import './styles/auth.css';
import './styles/account.css';
import './styles/catalog.css';
import './styles/cart.css';
import './styles/checkout.css';
import './styles/support.css';

attachStore(store);
applyThemeToDocument(getInitialTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
