/**
 * Google Drive URL Parser & Image Resolver
 * Converts any Google Drive sharing link into direct, high-speed CDN embed URLs
 */

export function extractGoogleDriveId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();

  // Format 1: https://drive.google.com/file/d/1A2B3C4D5E.../view?usp=sharing
  const matchFile = clean.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (matchFile && matchFile[1]) return matchFile[1];

  // Format 2: https://drive.google.com/open?id=1A2B3C4D5E... or ?id=...
  const matchId = clean.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (matchId && matchId[1]) return matchId[1];

  // Format 3: https://drive.google.com/uc?id=1A2B3C4D5E...
  const matchUc = clean.match(/\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]{20,})/);
  if (matchUc && matchUc[1]) return matchUc[1];

  // Format 4: Direct Google Drive ID string (25-45 characters alphanumeric)
  if (/^[a-zA-Z0-9_-]{25,45}$/.test(clean)) {
    return clean;
  }

  return null;
}

export function formatGoogleDriveUrls(urlOrId: string): string[] {
  if (!urlOrId || typeof urlOrId !== 'string') return [];
  const clean = urlOrId.trim();

  const fileId = extractGoogleDriveId(clean);
  if (fileId) {
    return [
      `https://lh3.googleusercontent.com/d/${fileId}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
      `https://drive.google.com/uc?export=view&id=${fileId}`,
    ];
  }

  return [clean];
}

export function isGoogleDriveUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('drive.google.com') || url.includes('docs.google.com') || extractGoogleDriveId(url) !== null;
}
