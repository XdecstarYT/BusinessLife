/** Player-facing "What's New" changelog — a condensed patch-notes view of CHANGELOG (see
 * data/changelog.ts), which every future version adds one entry to. */
import { CHANGELOG } from '../../data/changelog';
import { Card, SectionHeader } from '../components';

export function Updates() {
  return (
    <div>
      <SectionHeader title="🆕 Update Log" />
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
        What's changed in the game, newest first.
      </p>
      <div className="space-y-3">
        {CHANGELOG.map((entry) => (
          <Card key={entry.version} className="p-4">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-xs font-bold text-brand-500 uppercase tracking-wide shrink-0">{entry.version}</span>
              <span className="font-bold text-sm text-slate-900 dark:text-white">{entry.title}</span>
            </div>
            <ul className="space-y-1">
              {entry.bullets.map((b, i) => (
                <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex gap-2">
                  <span className="text-slate-300 dark:text-slate-600 shrink-0">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
