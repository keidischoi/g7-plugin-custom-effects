import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, EFFECT_KINDS, normalizeConfig, shouldStart } from './config';
import { particleCount } from './engine';

describe('normalizeConfig', () => {
    it('uses safe defaults for a missing payload', () => {
        expect(normalizeConfig(undefined)).toEqual(DEFAULT_CONFIG);
    });

    it('normalizes booleans and clamps numeric settings', () => {
        expect(normalizeConfig({
            enabled: '0',
            effect: 'rain',
            intensity: 999,
            speed: '10',
            opacity: 44.6,
            wind: -500,
            mobile_enabled: '1',
            admin_enabled: true,
            respect_reduced_motion: false,
        })).toMatchObject({
            enabled: false,
            effect: 'rain',
            intensity: 200,
            speed: 25,
            opacity: 45,
            wind: -100,
            mobileEnabled: true,
            adminEnabled: true,
            respectReducedMotion: false,
        });
    });

    it('rejects color values that could escape a style context', () => {
        expect(normalizeConfig({ color: 'red; display:none' }).color).toBe('#ffffff');
    });

    it.each(EFFECT_KINDS)('accepts the %s effect', (effect) => {
        expect(normalizeConfig({ effect }).effect).toBe(effect);
    });

    it('falls back to snow for an unknown effect', () => {
        expect(normalizeConfig({ effect: 'unknown' }).effect).toBe('snow');
    });
});

describe('shouldStart', () => {
    const enabled = normalizeConfig({});

    it('skips admin, mobile, and reduced-motion visitors by default', () => {
        expect(shouldStart(enabled, {
            pathname: '/admin/plugins',
            mobile: false,
            reducedMotion: false,
        })).toBe(false);
        expect(shouldStart(enabled, {
            pathname: '/',
            mobile: true,
            reducedMotion: false,
        })).toBe(false);
        expect(shouldStart(enabled, {
            pathname: '/',
            mobile: false,
            reducedMotion: true,
        })).toBe(false);
    });

    it('starts on an eligible visitor page', () => {
        expect(shouldStart(enabled, {
            pathname: '/board/free',
            mobile: false,
            reducedMotion: false,
        })).toBe(true);
    });
});

describe('particleCount', () => {
    it('scales with area and density while enforcing limits', () => {
        expect(particleCount(1, 1, 10)).toBe(8);
        expect(particleCount(1920, 1080, 200)).toBe(259);
        expect(particleCount(10000, 10000, 200)).toBe(300);
    });

    it('uses effect-specific density profiles', () => {
        expect(particleCount(1920, 1080, 100, 'rain')).toBeGreaterThan(
            particleCount(1920, 1080, 100, 'snow'),
        );
        expect(particleCount(1920, 1080, 100, 'fireflies')).toBeLessThan(
            particleCount(1920, 1080, 100, 'snow'),
        );
    });
});
