/** Root component: theme handling, screen routing, global overlays. */
import { useEffect } from 'react';
import { useGame } from './store/gameStore';
import { AppShell } from './ui/AppShell';
import { EventModal } from './ui/EventModal';
import { ElectionResultModal } from './ui/ElectionResultModal';
import { SuccessionModal } from './ui/SuccessionModal';
import { YearRecapModal } from './ui/YearRecapModal';
import { TutorialOverlay } from './ui/TutorialOverlay';
import { GameOver, Toasts } from './ui/Overlays';
import { Menu } from './ui/screens/Menu';
import { Life } from './ui/screens/Life';
import { Career } from './ui/screens/Career';
import { Business } from './ui/screens/Business';
import { Market } from './ui/screens/Market';
import { Assets } from './ui/screens/Assets';
import { Politics } from './ui/screens/Politics';
import { World } from './ui/screens/World';
import { Explore } from './ui/screens/Explore';
import { News } from './ui/screens/News';
import { Stats } from './ui/screens/Stats';
import { Family } from './ui/screens/Family';
import { Studio } from './ui/screens/Studio';

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
          {screen === 'studio' && <Studio />}
          {screen === 'market' && <Market />}
          {screen === 'assets' && <Assets />}
          {screen === 'politics' && <Politics />}
          {screen === 'world' && <World />}
          {screen === 'explore' && <Explore />}
          {screen === 'news' && <News />}
          {screen === 'stats' && <Stats />}
          {screen === 'family' && <Family />}
        </div>
      </AppShell>
      <YearRecapModal />
      <EventModal />
      <ElectionResultModal />
      <TutorialOverlay />
      <SuccessionModal />
      <GameOver />
      <Toasts />
    </>
  );
}
