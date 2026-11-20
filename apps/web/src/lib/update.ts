import { Browser } from '@capacitor/browser';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { ReleaseInfo } from '../types';
import { isNativeAndroid, isNativeIos, sleep } from './utils';
import { isNewerVersion } from './version';

export { isNewerVersion, parseVersion } from './version';

const REPO = (import.meta.env.VITE_GITHUB_REPO ?? '').trim();
const API = 'https://api.github.com';

interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  body: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: Array<{ name: string; browser_download_url: string }>;
}

export function repoSlug(): string {
  return REPO;
}

export async function checkForRelease(): Promise<ReleaseInfo | null> {
  if (!REPO) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${API}/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GitHubRelease;
    if (data.draft || data.prerelease) return null;
    const apk = data.assets?.find((asset) => asset.name.toLowerCase().endsWith('.apk'));
    return {
      version: data.tag_name.replace(/^v/i, ''),
      tag: data.tag_name,
      url: data.html_url,
      apkUrl: apk?.browser_download_url ?? null,
      notes: data.body ?? '',
      publishedAt: data.published_at,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type InstallResult = 'installed' | 'opened' | 'failed';

async function openExternal(url: string): Promise<void> {
  try {
    await Browser.open({ url });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export async function installRelease(release: ReleaseInfo): Promise<InstallResult> {
  const url = release.apkUrl ?? release.url;

  if (!isNativeAndroid() || !release.apkUrl) {
    await openExternal(url);
    return 'opened';
  }

  try {
    const fileName = `tessera-${release.version}.apk`;
    const result = await Filesystem.downloadFile({
      url: release.apkUrl,
      path: fileName,
      directory: Directory.Cache,
    });

    let filePath = result.path;
    if (!filePath) {
      const uri = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
      filePath = uri.uri;
    }

    await sleep(250);
    const opener = window.cordova?.plugins?.fileOpener2;
    if (opener && filePath) {
      await opener.open({
        filePath,
        contentType: 'application/vnd.android.package-archive',
        openWithDefault: true,
      });
      return 'installed';
    }

    await openExternal(release.apkUrl);
    return 'opened';
  } catch {
    await openExternal(url);
    return isNativeIos() ? 'opened' : 'failed';
  }
}
