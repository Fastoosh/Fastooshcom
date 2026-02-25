import { RouterProvider } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { router } from './routes';
import { TrackingProvider } from './components/TrackingProvider';

function App() {
  return (
    <HelmetProvider>
      <TrackingProvider>
        <RouterProvider router={router} />
      </TrackingProvider>
    </HelmetProvider>
  );
}

export default App;