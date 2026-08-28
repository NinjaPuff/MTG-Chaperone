import { describe, expect, it } from 'vitest';
import {
  QA_SCENARIOS,
  formatScenariosToon,
  parseQaSeedArgs,
} from '../../lib/qaSeedCli.js';

describe('parseQaSeedArgs', () => {
  it('returns help for empty argv and --help', () => {
    expect(parseQaSeedArgs([])).toEqual({ ok: true, command: 'help' });
    expect(parseQaSeedArgs(['--help'])).toEqual({ ok: true, command: 'help' });
    expect(parseQaSeedArgs(['load', '--help'])).toEqual({ ok: true, command: 'help' });
  });

  it('lists scenarios', () => {
    expect(parseQaSeedArgs(['scenarios'])).toEqual({ ok: true, command: 'scenarios' });
    expect(formatScenariosToon()).toContain(`scenarios[${QA_SCENARIOS.length}]`);
    expect(formatScenariosToon()).toContain('archive');
  });

  it('requires --scenario for load', () => {
    const result = parseQaSeedArgs(['load']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.exitCode).toBe(2);
      expect(result.error).toBe('--scenario is required for `load`');
    }
  });

  it('rejects unknown scenario and unknown flags', () => {
    const scenario = parseQaSeedArgs(['load', '--scenario=nope']);
    expect(scenario.ok).toBe(false);
    if (!scenario.ok) {
      expect(scenario.error).toBe('unknown scenario nope');
    }

    const flag = parseQaSeedArgs(['load', '--scenario=archive', '--force']);
    expect(flag.ok).toBe(false);
    if (!flag.ok) {
      expect(flag.exitCode).toBe(2);
      expect(flag.error).toBe('unknown flag --force for `load`');
    }
  });

  it('parses load with optional slugs', () => {
    expect(parseQaSeedArgs(['load', '--scenario=builder-draft', '--alice=ninjapuff', '--bob=boltbrian'])).toEqual({
      ok: true,
      command: 'load',
      scenario: 'builder-draft',
      alice: 'ninjapuff',
      bob: 'boltbrian',
      league: null,
    });
  });

  it('parses restore with optional league', () => {
    expect(parseQaSeedArgs(['restore', '--league=friday-night'])).toEqual({
      ok: true,
      command: 'restore',
      league: 'friday-night',
    });
  });
});
