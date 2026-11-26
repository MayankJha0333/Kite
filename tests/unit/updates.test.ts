import { describe, expect, it } from 'vitest';
import { RELEASES_PAGE, compareVersions, isUpdateUrl, parseVersion, pickUpdate } from '../../src/shared/updates';

const release = (over: Record<string, unknown> = {}) => ({
  tag_name: 'v0.3.0',
  html_url: 'https://github.com/MayankJha0333/M-Arc/releases/tag/v0.3.0',
  draft: false,
  prerelease: false,
  body: '## What changed\n\n- Faster start\n- A calmer sidebar\n',
  assets: [
    { name: 'Kite-0.3.0-mac-arm64.dmg', browser_download_url: 'https://github.com/MayankJha0333/M-Arc/releases/download/v0.3.0/Kite-0.3.0-mac-arm64.dmg' },
    { name: 'Kite-0.3.0-mac-x64.dmg', browser_download_url: 'https://github.com/MayankJha0333/M-Arc/releases/download/v0.3.0/Kite-0.3.0-mac-x64.dmg' },
    { name: 'Kite-0.3.0-mac-arm64.zip', browser_download_url: 'https://github.com/MayankJha0333/M-Arc/releases/download/v0.3.0/Kite-0.3.0-mac-arm64.zip' },
    { name: 'Kite-0.3.0-linux-x64.AppImage', browser_download_url: 'https://github.com/MayankJha0333/M-Arc/releases/download/v0.3.0/Kite-0.3.0-linux-x64.AppImage' },
  ],
  ...over,
});

describe('versions', () => {
  it('reads versions with or without a leading v', () => {
    expect(parseVersion('v1.2.3')?.parts).toEqual([1, 2, 3]);
    expect(parseVersion('1.2.3-beta.1')?.pre).toBe('beta.1');
    expect(parseVersion('latest')).toBeNull();
    expect(parseVersion('1.2')).toBeNull();
  });

  it('orders versions by number, not by text', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('v1.0.0', '1.0.1')).toBeLessThan(0);
  });

  it('puts a pre-release before the release it leads to', () => {
    expect(compareVersions('1.2.0-beta', '1.2.0')).toBeLessThan(0);
    expect(compareVersions('1.2.0', '1.2.0-beta')).toBeGreaterThan(0);
  });

  it('treats an unreadable version as the oldest', () => {
    expect(compareVersions('nonsense', '0.0.1')).toBeLessThan(0);
  });
});

describe('pickUpdate', () => {
  it('offers a newer release with the installer for this computer', () => {
    const u = pickUpdate(release(), '0.1.0', 'darwin', 'arm64');
    expect(u?.version).toBe('0.3.0');
    expect(u?.downloadUrl).toMatch(/mac-arm64\.dmg$/);
    expect(u?.pageUrl).toContain('/releases/tag/v0.3.0');
    expect(u?.notes).toBe('What changed\nFaster start\nA calmer sidebar');
  });

  it('picks the Intel build on an Intel Mac and the AppImage on Linux', () => {
    expect(pickUpdate(release(), '0.1.0', 'darwin', 'x64')?.downloadUrl).toMatch(/mac-x64\.dmg$/);
    expect(pickUpdate(release(), '0.1.0', 'linux', 'x64')?.downloadUrl).toMatch(/\.AppImage$/);
  });

  it('falls back to the release page when no installer fits', () => {
    const u = pickUpdate(release(), '0.1.0', 'win32', 'arm64');
    expect(u?.downloadUrl).toBeUndefined();
    expect(u?.pageUrl).toContain('github.com');
  });

  it('says nothing when Kite is already up to date or ahead', () => {
    expect(pickUpdate(release(), '0.3.0', 'darwin', 'arm64')).toBeNull();
    expect(pickUpdate(release(), '0.4.0', 'darwin', 'arm64')).toBeNull();
  });

  it('ignores drafts, pre-releases and answers that are not a release', () => {
    expect(pickUpdate(release({ draft: true }), '0.1.0', 'darwin', 'arm64')).toBeNull();
    expect(pickUpdate(release({ prerelease: true }), '0.1.0', 'darwin', 'arm64')).toBeNull();
    expect(pickUpdate(release({ tag_name: 'v0.3.0-beta.1' }), '0.1.0', 'darwin', 'arm64')).toBeNull();
    expect(pickUpdate(release({ tag_name: 'nightly' }), '0.1.0', 'darwin', 'arm64')).toBeNull();
    expect(pickUpdate(null, '0.1.0', 'darwin', 'arm64')).toBeNull();
    expect(pickUpdate({ message: 'Not Found' }, '0.1.0', 'darwin', 'arm64')).toBeNull();
  });

  it('never hands back a link that leaves GitHub', () => {
    const u = pickUpdate(
      release({
        html_url: 'https://example.com/kite',
        assets: [{ name: 'Kite-0.3.0-mac-arm64.dmg', browser_download_url: 'https://evil.example/Kite-0.3.0-mac-arm64.dmg' }],
      }),
      '0.1.0',
      'darwin',
      'arm64',
    );
    expect(u?.pageUrl).toBe(RELEASES_PAGE);
    expect(u?.downloadUrl).toBeUndefined();
  });

  it('only lets GitHub links be opened', () => {
    expect(isUpdateUrl('https://github.com/MayankJha0333/M-Arc/releases/latest')).toBe(true);
    expect(isUpdateUrl('https://objects.githubusercontent.com/x/Kite.dmg')).toBe(true);
    expect(isUpdateUrl('http://github.com/x')).toBe(false);
    expect(isUpdateUrl('https://github.com.evil.example/x')).toBe(false);
    expect(isUpdateUrl('javascript:alert(1)')).toBe(false);
  });
});
