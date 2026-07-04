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
  { id: 'd_car_trouble', weight: 3, text: 'Your car needed an unexpected repair.', effects: { money: -150, happiness: -1 } },
  { id: 'd_streak_workout', weight: 4, text: 'You kept your workout streak alive.', effects: { health: 1, happiness: 1 } },
  { id: 'd_overslept', weight: 4, text: 'You overslept and rushed out the door.', effects: { happiness: -1 } },
  { id: 'd_free_coffee', weight: 4, text: 'The barista gave you a free coffee — small win.', effects: { happiness: 1 } },
  { id: 'd_recycled_win', weight: 3, text: 'You finally organized your closet. Oddly satisfying.', effects: { happiness: 1 } },
  { id: 'd_spam_call', weight: 4, text: 'Yet another spam call interrupted your afternoon.', effects: { happiness: -1 } },
  { id: 'd_podcast_insight', weight: 4, text: 'A podcast episode gave you a genuinely useful idea.', effects: { skillXp: [SK.economics, 1], happiness: 1 } },
  { id: 'd_lost_umbrella', weight: 3, text: 'You lost your umbrella in the rain.', effects: { money: -20, happiness: -1 } },
  { id: 'd_good_haircut', weight: 3, text: 'A great haircut boosted your confidence.', effects: { money: -40, happiness: 2 } },
  { id: 'd_traffic_ticket_dodged', weight: 3, text: 'You just barely avoided a speeding ticket.', effects: { happiness: 1 } },
  {
    id: 'd_meeting_ran_long', weight: 4, text: 'A meeting that should have been an email ran two hours long.',
    effects: { happiness: -1 }, conditions: { employed: true },
  },
  {
    id: 'd_client_referral', weight: 3, text: 'A happy client referred you new business.',
    effects: { reputation: 1, money: 100 }, conditions: { hasBusiness: true },
  },
  {
    id: 'd_family_game_night', weight: 4, text: 'A fun family game night lifted everyone\'s spirits.',
    effects: { happiness: 2 }, conditions: { hasChildren: true },
  },
  {
    id: 'd_spouse_surprise', weight: 3, text: 'Your spouse surprised you with a small thoughtful gift.',
    effects: { happiness: 2 }, conditions: { hasSpouse: true },
  },
  {
    id: 'd_market_dip_scare', weight: 3, text: 'A brief market dip had you nervously checking your portfolio.',
    effects: { happiness: -1 }, conditions: { hasStocks: true },
  },
  { id: 'd_neighbor_noise', weight: 3, text: 'Noisy neighbors kept you up half the night.', effects: { happiness: -1, health: -1 } },
  { id: 'd_solid_sleep', weight: 4, text: 'You got a genuinely great night of sleep.', effects: { health: 1, happiness: 1 } },
  { id: 'd_charity_ask', weight: 3, text: 'You gave a few dollars to a street fundraiser.', effects: { money: -10, karma: 1 } },
  { id: 'd_inbox_zero', weight: 3, text: 'You finally reached inbox zero. Small victory.', effects: { happiness: 1 }, conditions: { employed: true } },
  { id: 'd_weekend_hike', weight: 4, text: 'A weekend hike cleared your head.', effects: { health: 1, happiness: 2 } },
  { id: 'd_good_review_online', weight: 3, text: 'Someone left a glowing review that made your day.', effects: { happiness: 1 }, conditions: { hasBusiness: true } },
  { id: 'd_bad_review_online', weight: 3, text: 'A harsh online review stung more than it should have.', effects: { happiness: -1 }, conditions: { hasBusiness: true } },
  { id: 'd_free_sample', weight: 3, text: 'A free sample at the store made for a nice surprise.', effects: { happiness: 1 } },
  { id: 'd_missed_bus', weight: 4, text: 'You missed the bus and had to wait in the cold.', effects: { happiness: -1 } },
  { id: 'd_old_song', weight: 4, text: 'An old favorite song came on the radio at just the right moment.', effects: { happiness: 1 } },
  { id: 'd_small_investment_win', weight: 3, text: 'A small position ticked up nicely today.', effects: { money: 60 }, conditions: { hasStocks: true } },
  { id: 'd_printer_jam', weight: 3, text: 'The office printer jammed at the worst possible time.', effects: { happiness: -1 }, conditions: { employed: true } },
  { id: 'd_good_haircut_day', weight: 3, text: 'You are having a surprisingly good hair day.', effects: { happiness: 1 } },
  { id: 'd_spontaneous_trip', weight: 3, text: 'A spontaneous day trip with friends was exactly what you needed.', effects: { happiness: 2, money: -60 } },
  { id: 'd_forgot_umbrella', weight: 3, text: 'You got caught in the rain without an umbrella.', effects: { happiness: -1, health: -1 } },
];
