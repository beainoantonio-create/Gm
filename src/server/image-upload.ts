/**
 * Uploads a base64 data-URI image straight to a dedicated branch of your own
 * GitHub repo, then serves it through jsDelivr's free public CDN for GitHub.
 *
 * This deliberately avoids third-party image-hosting services like Cloudinary,
 * which are blocked for accounts signing up from some countries (including
 * Lebanon). GitHub itself is not on that kind of restricted list, and you
 * already have a working GitHub account - so this reuses something proven to
 * work instead of gambling on another new sign-up.
 *
 * Requires 3 environment variables (set in your Vercel project settings):
 *   GITHUB_TOKEN         - a Personal Access Token with "repo" permission
 *   GITHUB_IMAGE_REPO    - "your-username/your-repo-name"
 *   GITHUB_IMAGE_BRANCH  - the branch to store images in (e.g. "images")
 */
export async function uploadImageToGithub(dataUri: string, folder = 'uploads'): Promise<string | null> {
  if (!dataUri || typeof dataUri !== 'string') return null;
  const matches = dataUri.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
  if (!matches) return null;

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_IMAGE_REPO;
  const branch = process.env.GITHUB_IMAGE_BRANCH || 'images';

  if (!token || !repo) {
    console.error('[GitHub Upload] Missing GITHUB_TOKEN / GITHUB_IMAGE_REPO env vars.');
    return null;
  }

  try {
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Content = matches[2];
    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `${folder}/${fileName}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // GitHub's "create file" API - commits the image as a new file on the given branch.
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add photo ${fileName}`,
        content: base64Content,
        branch
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[GitHub Upload] Failed (${res.status}):`, errBody);
      return null;
    }

    const cdnUrl = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${filePath}`;

    // jsDelivr caches files aggressively. Ping its purge endpoint right away so
    // the new photo shows up immediately instead of being stale for hours.
    fetch(`https://purge.jsdelivr.net/gh/${repo}@${branch}/${filePath}`).catch(() => {});

    return cdnUrl;
  } catch (err) {
    console.error('[GitHub Upload] Error uploading image:', err);
    return null;
  }
}
