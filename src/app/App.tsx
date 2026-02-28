import { RouterProvider } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { router } from './routes';
import { TrackingProvider } from './components/TrackingProvider';
import { StyleProvider } from './context/StyleContext';
import { LogoProvider } from './context/LogoContext';
import './i18n'; // initialise i18next + apply dir/lang on load

function App() {
  return (
    <HelmetProvider>
      <StyleProvider>
        <LogoProvider>
          <TrackingProvider>
            <RouterProvider router={router} />
          </TrackingProvider>
        </LogoProvider>
      </StyleProvider>
    </HelmetProvider>
  );
}

export default App;