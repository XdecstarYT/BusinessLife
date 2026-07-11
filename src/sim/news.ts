/**
 * Dynamic news generation. Headlines are synthesised from what actually
 * happened in the simulation this year — regime shifts, market moves,
 * corporate results, political shake-ups — plus society color pieces.
 */
import type { GameState, NewsItem } from './types';
import { NEWS_OUTLETS } from '../data/names';
import { INDUSTRY_BY_ID } from '../data/industries';
import type { RNG } from './rng';

function item(
  state: GameState,
  rng: RNG,
  category: NewsItem['category'],
  headline: string,
  sentiment: number,
  subtype?: NewsItem['subtype'],
): NewsItem {
  return { year: state.year, category, subtype, headline, outlet: rng.pick(NEWS_OUTLETS), sentiment };
}

export function generateNews(state: GameState, rng: RNG, politicalHeadlines: string[], businessHeadlines: string[], playerHeadlines: string[] = [], sportsHeadlines: string[] = []): NewsItem[] {
  const news: NewsItem[] = [];
  const home = state.countries.find((c) => c.id === state.player.countryId)!;
  const e = home.economy;

  // Economy coverage
  const growthPct = (e.gdpGrowth * 100).toFixed(1);
  if (e.regime === 'boom') news.push(item(state, rng, 'economy', `Boom times: ${home.name}'s economy roars ahead at ${growthPct}% growth`, 0.8));
  else if (e.regime === 'recession') news.push(item(state, rng, 'economy', `Recession confirmed: ${home.name} GDP shrinks ${growthPct}%`, -0.8));
  else if (e.regime === 'depression') news.push(item(state, rng, 'economy', `Depression deepens in ${home.name}: unemployment hits ${(e.unemployment * 100).toFixed(1)}%`, -1));
  else news.push(item(state, rng, 'economy', `${home.name} economy grows ${growthPct}% as ${e.regime} continues`, 0.2));

  if (e.inflation > 0.06) news.push(item(state, rng, 'economy', `Cost-of-living crunch: inflation reaches ${(e.inflation * 100).toFixed(1)}%`, -0.7));
  if (e.interestRate > 0.08) news.push(item(state, rng, 'economy', `Central bank holds rates at painful ${(e.interestRate * 100).toFixed(1)}%`, -0.5));
  if (e.housingIndex > 160) news.push(item(state, rng, 'economy', `Housing affordability collapses as prices hit record highs`, -0.4));

  // Markets
  const hist = e.history;
  if (hist.length >= 2) {
    const change = hist[hist.length - 1].stockIndex / hist[hist.length - 2].stockIndex - 1;
    if (change > 0.15) news.push(item(state, rng, 'markets', `Bull run: national stock index surges ${(change * 100).toFixed(0)}% this year`, 0.8));
    else if (change < -0.15) news.push(item(state, rng, 'markets', `Market rout: index plunges ${(-change * 100).toFixed(0)}% amid panic selling`, -0.9));
  }
  const oil = e.commodities.oil;
  if (oil > 160) news.push(item(state, rng, 'markets', `Oil shock: crude prices spike to multi-year highs`, -0.5));
  if (oil < 60) news.push(item(state, rng, 'markets', `Crude glut sends petrol prices tumbling`, 0.4));

  // Corporate results: biggest winner & loser among public companies
  const publics = Object.values(state.companies).filter((c) => c.isPublic && c.status === 'active' && c.history.length >= 2);
  if (publics.length) {
    const withMove = publics
      .map((c) => {
        const a = c.history[c.history.length - 2].sharePrice;
        const b = c.history[c.history.length - 1].sharePrice;
        return { c, move: a && b ? b / a - 1 : 0 };
      })
      .sort((x, y) => y.move - x.move);
    const top = withMove[0];
    const bottom = withMove[withMove.length - 1];
    if (top && top.move > 0.25) {
      news.push(item(state, rng, 'business', `${top.c.name} shares rocket ${(top.move * 100).toFixed(0)}% on blowout ${INDUSTRY_BY_ID[top.c.industryId].name.toLowerCase()} demand`, 0.7));
    }
    if (bottom && bottom.move < -0.25) {
      news.push(item(state, rng, 'business', `${bottom.c.name} craters ${(-bottom.move * 100).toFixed(0)}% after dismal results`, -0.7));
    }
  }

  for (const h of businessHeadlines) news.push(item(state, rng, 'business', h, -0.2));
  for (const h of politicalHeadlines) news.push(item(state, rng, 'politics', h, 0));
  for (const h of playerHeadlines) news.push(item(state, rng, 'player', h, h.includes('convicted') || h.includes('burning out') ? -0.5 : 0.2));
  for (const h of sportsHeadlines) {
    const negative = h.includes('relegated') || h.includes('lost a star');
    news.push(item(state, rng, 'sports', h, negative ? -0.4 : 0.4));
  }

  // World color
  const other = rng.pick(state.countries.filter((c) => c.id !== home.id));
  const colorTemplates = [
    [`${other.flag} ${other.name} unveils ambitious ${rng.pick(['infrastructure', 'space', 'AI', 'green energy', 'defense'])} programme`, 0.3],
    [`Scientists in ${other.name} report breakthrough in ${rng.pick(['battery storage', 'cancer treatment', 'quantum computing', 'drought-resistant crops'])}`, 0.6],
    [`Viral trend: ${rng.pick(['silent networking dinners', 'micro-retirement', 'analogue Sundays', 'extreme frugality clubs'])} sweeps social media`, 0.1],
    [`${other.flag} Corruption trial grips ${other.name} as former minister testifies`, -0.3],
    [`Record ${rng.pick(['heatwave', 'floods', 'wildfires', 'storm season'])} tests emergency services in ${other.name}`, -0.5],
    [`${other.flag} ${other.name} breaks ground on a record-setting ${rng.pick(['skyscraper', 'bridge', 'dam', 'stadium'])}`, 0.4],
    [`Archaeologists in ${other.name} uncover a site rewriting local history`, 0.3],
    [`${rng.pick(['A dockworkers', 'A teachers', 'An air-traffic controllers', 'A rail workers'])} strike disrupts ${other.name}`, -0.4],
    [`${other.flag} ${other.name} announces a national holiday after a historic sporting win`, 0.6],
    [`Cybersecurity researchers warn of a new threat targeting ${rng.pick(['banks', 'hospitals', 'utilities', 'airlines'])} worldwide`, -0.4],
  ] as const;
  const picked = rng.pick(colorTemplates);
  news.push(item(state, rng, rng.chance(0.5) ? 'world' : 'society', picked[0], picked[1]));

  // Player coverage when notable
  const p = state.player;
  if (p.popularity > 60) news.push(item(state, rng, 'player', `Profile: how ${p.name} became one of ${home.name}'s most talked-about figures`, 0.5));
  const playerCos = p.companies.map((id) => state.companies[id]).filter((c) => c && c.status === 'active');
  const big = playerCos.find((c) => c.revenue > 50_000_000);
  if (big && rng.chance(0.5)) news.push(item(state, rng, 'business', `Inside ${big.name}: ${p.name}'s ${INDUSTRY_BY_ID[big.industryId].name.toLowerCase()} juggernaut`, 0.4));

  // Editorials: opinion pieces reacting to the state of the nation.
  if (rng.chance(0.5)) {
    const editorialTemplates: [string, number][] = [
      [`EDITORIAL: Why ${home.name}'s ${e.regime.replace('_', ' ')} won't last`, -0.1],
      [`OPINION: The case for and against ${home.name}'s current tax settings`, 0],
      [`EDITORIAL: ${home.leaderId === 'player' ? p.name : 'The government'} is ${e.gdpGrowth > 0.02 ? 'finally getting it right' : 'losing the economic argument'}`, e.gdpGrowth > 0.02 ? 0.3 : -0.3],
      [`OPINION: What ${home.name} gets wrong about immigration policy`, -0.1],
      [`EDITORIAL: The market's verdict on the last twelve months`, hist.length >= 2 && hist[hist.length - 1].stockIndex > hist[hist.length - 2].stockIndex ? 0.4 : -0.4],
    ];
    const [headline, sentiment] = rng.pick(editorialTemplates);
    news.push(item(state, rng, 'politics', headline, sentiment, 'editorial'));
  }

  // Investigative journalism: digs into corruption, corporate conduct, or public figures.
  if (rng.chance(0.35)) {
    const investigativeTemplates: [string, number][] = [
      [`INVESTIGATION: How corruption quietly costs ${home.name} billions each year`, -0.5],
      [`INVESTIGATION: Inside the lobbying money reshaping ${home.name}'s parliament`, -0.4],
      [`Months-long probe finds regulatory gaps across ${home.name}'s biggest industries`, -0.3],
      [`Investigative team traces a web of shell companies back to ${home.name}'s elite`, -0.5],
    ];
    const [headline, sentiment] = rng.pick(investigativeTemplates);
    news.push(item(state, rng, rng.chance(0.5) ? 'politics' : 'business', headline, sentiment, 'investigative'));
  }

  // Interview: a sit-down with a notable figure when the player has real standing.
  if (p.reputation > 55 || p.influence > 55) {
    news.push(item(state, rng, 'player', `INTERVIEW: "${p.name} On The Record" — a candid sit-down on ambition, risk, and what comes next`, 0.4, 'interview'));
  }

  // Election coverage: campaign season or an election due next year anywhere.
  if (p.campaign) {
    news.push(item(state, rng, 'politics', `ELECTION WATCH: ${p.name}'s campaign for ${p.campaign.officeKind.replace('_', ' ')} heats up`, 0.1, 'election'));
  } else if (home.electionInYears === 1) {
    news.push(item(state, rng, 'politics', `ELECTION WATCH: ${home.name} heads to the polls next year`, 0, 'election'));
  }

  return news;
}
