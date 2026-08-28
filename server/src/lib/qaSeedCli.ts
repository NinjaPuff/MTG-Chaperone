export const QA_SCENARIOS = [
  'archive',
  'builder-draft',
  'matches-complete',
  'deck-checks',
  'privacy-off',
  'carry-forward',
] as const;

export type QaScenario = (typeof QA_SCENARIOS)[number];

export type QaSeedCommand = 'load' | 'restore' | 'scenarios' | 'help';

export type QaSeedArgs =
  | { ok: true; command: 'help' }
  | { ok: true; command: 'scenarios' }
  | { ok: true; command: 'restore'; league: string | null }
  | {
      ok: true;
      command: 'load';
      scenario: QaScenario;
      alice: string | null;
      bob: string | null;
      league: string | null;
    }
  | { ok: false; exitCode: 2; error: string; help: string };

const KNOWN_FLAGS = new Set(['--scenario', '--alice', '--bob', '--league', '--help']);

export const QA_SEED_HELP = `qa-seed — load named QA snapshots for branch manual testing
usage:
  npx tsx server/scripts/qa-seed.ts load --scenario=<name> [--alice=<slug>] [--bob=<slug>] [--league=<slug>]
  npx tsx server/scripts/qa-seed.ts restore [--league=<slug>]
  npx tsx server/scripts/qa-seed.ts scenarios
scenarios: ${QA_SCENARIOS.join(', ')}
notes:
  Defaults to the first league (the one the UI shows). Creates/resets season 990 "QA Branch Fixes" and deactivates the prior active season. restore puts that season back.
  --alice/--bob must be existing user slugs who can sign in. Cara/Dave are synthetic and do not need to log in.`;

function splitFlag(raw: string): { name: string; value: string | true } | null {
  if (raw === '--help' || raw === '-h') {
    return { name: '--help', value: true };
  }
  if (!raw.startsWith('--')) {
    return null;
  }
  const eq = raw.indexOf('=');
  if (eq === -1) {
    return { name: raw, value: true };
  }
  return { name: raw.slice(0, eq), value: raw.slice(eq + 1) };
}

export function isQaScenario(value: string): value is QaScenario {
  return (QA_SCENARIOS as readonly string[]).includes(value);
}

export function parseQaSeedArgs(argv: string[]): QaSeedArgs {
  const tokens = argv.filter((token) => token.length > 0);
  if (tokens.length === 0 || tokens[0] === 'help' || tokens.includes('--help') || tokens.includes('-h')) {
    return { ok: true, command: 'help' };
  }

  const command = tokens[0];
  const flags = tokens.slice(1);
  const parsed: Record<string, string | true> = {};

  for (const raw of flags) {
    const flag = splitFlag(raw);
    if (!flag) {
      return {
        ok: false,
        exitCode: 2,
        error: `unexpected argument ${raw}`,
        help: QA_SEED_HELP,
      };
    }
    if (!KNOWN_FLAGS.has(flag.name)) {
      return {
        ok: false,
        exitCode: 2,
        error: `unknown flag ${flag.name} for \`${command}\``,
        help: QA_SEED_HELP,
      };
    }
    parsed[flag.name] = flag.value;
  }

  if (command === 'scenarios') {
    return { ok: true, command: 'scenarios' };
  }

  if (command === 'restore') {
    const league = typeof parsed['--league'] === 'string' && parsed['--league'] ? parsed['--league'] : null;
    return { ok: true, command: 'restore', league };
  }

  if (command === 'load') {
    const scenarioRaw = parsed['--scenario'];
    if (typeof scenarioRaw !== 'string' || !scenarioRaw) {
      return {
        ok: false,
        exitCode: 2,
        error: '--scenario is required for `load`',
        help: QA_SEED_HELP,
      };
    }
    if (!isQaScenario(scenarioRaw)) {
      return {
        ok: false,
        exitCode: 2,
        error: `unknown scenario ${scenarioRaw}`,
        help: QA_SEED_HELP,
      };
    }
    return {
      ok: true,
      command: 'load',
      scenario: scenarioRaw,
      alice: typeof parsed['--alice'] === 'string' && parsed['--alice'] ? parsed['--alice'] : null,
      bob: typeof parsed['--bob'] === 'string' && parsed['--bob'] ? parsed['--bob'] : null,
      league: typeof parsed['--league'] === 'string' && parsed['--league'] ? parsed['--league'] : null,
    };
  }

  return {
    ok: false,
    exitCode: 2,
    error: `unknown command ${command}`,
    help: QA_SEED_HELP,
  };
}

export function formatScenariosToon() {
  const lines = QA_SCENARIOS.map((id) => `  ${id}`).join('\n');
  return `scenarios[${QA_SCENARIOS.length}]:\n${lines}\nhelp: npx tsx server/scripts/qa-seed.ts load --scenario=<name>`;
}
