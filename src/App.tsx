import { Header } from './components/Header';
import { Onboarding } from './pages/Onboarding';
import { Profile } from './pages/Profile';
import { Home } from './pages/Home';
import { GamePage } from './pages/GamePage';
import { Placeholder } from './pages/Placeholder';
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
      return <Placeholder title="Settings" />;
    case 'about':
      return <Placeholder title="About" />;
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
  const { focus, profile } = useApp();
  return (
    <div className="app" data-focus={focus}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header atHome={path === '/'} />
      <main id="main" className="main" tabIndex={-1}>
        <Page path={path} />
      </main>
      {!profile.onboarded && <Onboarding />}
    </div>
  );
}

export function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}
