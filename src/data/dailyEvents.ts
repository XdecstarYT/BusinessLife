/**
 * Daily flavor events: small, guaranteed-effect, no-choice scenarios that
 * fire occasionally during day/week advancement so time-skipping feels
 * alive without interrupting the player with a modal every single day.
 * Effects are deliberately tiny — roughly 1/50th the scale of a yearly
 * event — since dozens of these can fire across a single "Advance Week".
 */
import type { DailyEventTemplate } from '../sim/types';
import { SK } from './skills';

export const DAILY_EVENTS: DailyEventTemplate[] = [
  { id: 'd_coffee_friend', weight: 6, text: 'You grabbed coffee with an old friend.', effects: { happiness: 2 } },
  { id: 'd_traffic', weight: 6, text: 'Stuck in traffic for an hour.', effects: { happiness: -1 } },
  { id: 'd_found_money', weight: 4, text: 'You found a $20 bill on the sidewalk.', effects: { money: 20 } },
  { id: 'd_cracked_phone', weight: 3, text: 'Your phone screen cracked.', effects: { money: -80, happiness: -1 } },
  { id: 'd_gym_win', weight: 5, text: 'A great workout at the gym.', effects: { health: 1 } },
  { id: 'd_binge', weight: 5, text: 'Binge-watched a show until 2am.', effects: { health: -1, happiness: 1 } },
  { id: 'd_helped_neighbor', weight: 4, text: 'You helped a neighbor carry groceries upstairs.', effects: { karma: 1 } },
  { id: 'd_parking_ticket', weight: 4, text: 'You got a parking ticket.', effects: { money: -60, happiness: -1 } },
  { id: 'd_team_won', weight: 4, text: 'Your favorite team won last night.', effects: { happiness: 2 } },
  {
    id: 'd_coworker_compliment', weight: 4, text: 'A coworker complimented your work.',
    effects: { jobPerformance: 1, happiness: 1 }, conditions: { employed: true },
  },
  {
    id: 'd_client_praise', weight: 4, text: 'A client praised your business.',
    effects: { reputation: 1, happiness: 1 }, conditions: { hasBusiness: true },
  },
  {
    id: 'd_spouse_evening', weight: 5, text: 'You spent a quiet evening with your spouse.',
    effects: { happiness: 2 }, conditions: { hasSpouse: true },
  },
  {
    id: 'd_kid_funny', weight: 5, text: 'Your kid said something hilarious at dinner.',
    effects: { happiness: 2 }, conditions: { hasChildren: true },
  },
  {
    id: 'd_dividend_check', weight: 3, text: 'A small dividend check arrived in the mail.',
    effects: { money: 50 }, conditions: { hasStocks: true },
  },
  { id: 'd_good_book', weight: 4, text: 'You read a great book this week.', effects: { skillXp: [SK.economics, 1] } },
  { id: 'd_skipped_gym', weight: 4, text: "You skipped the gym again — didn't feel like it.", effects: { happiness: -1 } },
  { id: 'd_scratcher', weight: 3, text: 'You bought a lottery scratcher. Won nothing.', effects: { money: -10 } },
  { id: 'd_free_lunch', weight: 3, text: 'A coworker shared their lunch with you.', effects: { money: 15, happiness: 1 }, conditions: { employed: true } },
  { id: 'd_office_cold', weight: 3, text: "There's a cold going around the office.", effects: { health: -1 }, conditions: { employed: true } },
  { id: 'd_random_kindness', weight: 3, text: 'A random act of kindness brightened your day.', effects: { karma: 2, happiness: 1 } },
  { id: 'd_nice_weather', weight: 5, text: 'Beautiful weather today — you took a long walk.', effects: { happiness: 1, health: 1 } },
  { id: 'd_argument', weight: 3, text: 'A minor argument with a friend put you in a mood.', effects: { happiness: -2 } },
];
