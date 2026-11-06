import { TransportProvider } from './audio/transport';
import { GlobalShortcuts } from './components/GlobalShortcuts';
import { Header } from './components/Header';
import { LiveRegion } from './components/LiveRegion';
import { SessionTracker } from './components/SessionTracker';
import { ShortcutHelp } from './components/ShortcutHelp';
import { TransportDock } from './components/TransportDock';
import { GamePage } from './pages/GamePage';
import { About } from './pages/About';
import { Home } from './pages/Home';
import { Onboarding } from './pages/Onboarding';
import { Placeholder } from './pages/Placeholder';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { useHashPath } from './router';
import { resolveRoute } from './routes';
import { AppStateProvider, useApp } from './state/AppState';

function Page({ path }: { path: string }) {
  const route = resolveRoute(path);
  switch (route.page) {
    case 'home':
      return <Home />;
    case 'game':
      return <GamePage game={route.game!} />;
    case 'profile':
      return <Profile />;
    case 'settings':
      return <Settings />;
    case 'about':
      return <About />;
    default:
      return (
        <Placeholder title="Nothing here">
          <p>
            That page doesn&apos;t exist. <a href="#/">Back to the jam room</a>.
          </p>
        </Placeholder>
      );
  }
}

function Shell() {
  const path = useHashPath();
  const { focus, setFocus, profile } = useApp();
  return (
    <div className="app" data-focus={focus}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <GlobalShortcuts />
      <SessionTracker />
      <LiveRegion />
      {focus && (
        <button type="button" className="btn focus-exit" onClick={() => setFocus(false)}>
          Exit Focus Mode (Esc)
        </button>
      )}
      <Header atHome={path === '/'} />
      <main id="main" className="main" tabIndex={-1}>
        <Page path={path} />
      </main>
      <TransportDock />
      <ShortcutHelp />
      {!profile.onboarded && <Onboarding />}
    </div>
  );
}

export function App() {
  return (
    <AppStateProvider>
      <TransportProvider>
        <Shell />
      </TransportProvider>
    </AppStateProvider>
  );
}
