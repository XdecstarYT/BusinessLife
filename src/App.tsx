/** Root component: theme handling, screen routing, global overlays. */
import { useEffect } from 'react';
import { useGame } from './store/gameStore';
import { AppShell } from './ui/AppShell';
import { EventModal } from './ui/EventModal';
import { GameOver, Toasts } from './ui/Overlays';
import { Menu } from './ui/screens/Menu';
import { Life } from './ui/screens/Life';
import { Career } from './ui/screens/Career';
import { Business } from './ui/screens/Business';
import { Market } from './ui/screens/Market';
import { Assets } from './ui/screens/Assets';
import { Politics } from './ui/screens/Politics';
import { World } from './ui/screens/World';
import { News } from './ui/screens/News';
import { Stats } from './ui/screens/Stats';
import { Family } from './ui/screens/Family';

export default function App() {
  const { state, screen, darkMode } = useGame();

  // Apply the theme class to <html> so it covers the whole viewport.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  if (!state || screen === 'menu') {
    return (
      <>
        <Menu />
        <Toasts />
      </>
    );
  }

  return (
    <>
      <AppShell>
        <div key={screen} className="anim-in">
          {screen === 'life' && <Life />}
          {screen === 'career' && <Career />}
          {screen === 'business' && <Business />}
          {screen === 'market' && <Market />}
          {screen === 'assets' && <Assets />}
          {screen === 'politics' && <Politics />}
          {screen === 'world' && <World />}
          {screen === 'news' && <News />}
          {screen === 'stats' && <Stats />}
          {screen === 'family' && <Family />}
        </div>
      </AppShell>
      <EventModal />
      <GameOver />
      <Toasts />
    </>
  );
}
