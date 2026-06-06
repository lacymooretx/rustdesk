import logging
import re

import httpx
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["update"])

# Cache the latest release info for 10 minutes to avoid hammering GitHub
_release_cache: dict = {}
_cache_ts: float = 0

GITHUB_REPO = "lacymooretx/rustdesk"
CACHE_TTL = 600  # 10 minutes

# Regex to extract version from asset filenames like "rustdesk-1.3.8-x86_64.exe"
_VERSION_RE = re.compile(r"rustdesk-(\d+\.\d+\.\d+)")


async def _fetch_latest_release() -> dict | None:
    """Fetch the latest nightly release from GitHub."""
    import time

    global _release_cache, _cache_ts

    now = time.time()
    if _release_cache and (now - _cache_ts) < CACHE_TTL:
        return _release_cache

    try:
        async with httpx.AsyncClient() as client:
            # Get the "nightly" release (pre-release tag)
            resp = await client.get(
                f"https://api.github.com/repos/{GITHUB_REPO}/releases/tags/nightly",
                headers={"Accept": "application/vnd.github.v3+json"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                _release_cache = data
                _cache_ts = now
                return data

            # Fallback: get latest release (non-prerelease)
            resp = await client.get(
                f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest",
                headers={"Accept": "application/vnd.github.v3+json"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                _release_cache = data
                _cache_ts = now
                return data

    except Exception as e:
        logger.warning("Failed to fetch GitHub release: %s", e)

    return _release_cache or None


def _extract_version(assets: list) -> str:
    """Return the HIGHEST version found across asset filenames.

    The 'nightly' release accumulates assets over time, so older builds
    (e.g. 1.4.6) linger alongside the newest (1.4.7). Pick the max so we
    never surface a stale version.
    """
    versions = set()
    for asset in assets:
        m = _VERSION_RE.search(asset.get("name", ""))
        if m:
            versions.add(m.group(1))
    if not versions:
        return ""
    return max(versions, key=lambda v: tuple(int(p) for p in v.split(".")))


def _find_asset(assets: list, platform: str, arch: str) -> dict | None:
    """Find the matching download asset for the given platform and arch."""
    platform = platform.lower()
    arch = arch.lower()

    # Map platform/arch to expected filename patterns
    patterns = []
    if platform in ("windows", "win"):
        if arch in ("x86_64", "amd64", "x64"):
            patterns = ["-x86_64.exe", "-x86_64.msi"]
        elif arch in ("aarch64", "arm64"):
            patterns = ["-aarch64.exe", "-aarch64.msi"]
    elif platform in ("macos", "darwin", "mac"):
        if arch in ("aarch64", "arm64"):
            patterns = ["-aarch64.dmg"]
        elif arch in ("x86_64", "amd64", "x64"):
            patterns = ["-x86_64.dmg"]
    elif platform == "linux":
        if arch in ("x86_64", "amd64", "x64"):
            patterns = ["-x86_64.deb", "-x86_64.AppImage"]
        elif arch in ("aarch64", "arm64"):
            patterns = ["-aarch64.deb", "-aarch64.AppImage"]

    for pattern in patterns:
        for asset in assets:
            name = asset.get("name", "")
            if name.endswith(pattern):
                return {
                    "name": name,
                    "url": asset.get("browser_download_url", ""),
                    "size": asset.get("size", 0),
                }

    return None


def _find_asset_by_filename(assets: list, filename: str) -> str | None:
    """Find the download URL for an asset by exact filename."""
    for asset in assets:
        if asset.get("name", "") == filename:
            return asset.get("browser_download_url", "")
    return None


def _branded_name(filename: str) -> str:
    """Map the internal 'rustdesk-*' asset name to the Aspendora brand name
    shown to users in their browser's download (Content-Disposition only —
    the GitHub asset itself is unchanged so client auto-update still works).
    """
    if filename.startswith("rustdesk-"):
        return "Aspendora-Remote-" + filename[len("rustdesk-"):]
    return filename


# User-facing installers to surface on the console Downloads page.
# Each entry: (platform label, arch label, filename suffix, kind label).
# Order here controls display order within a platform group.
_DOWNLOAD_CATALOG = [
    ("Windows", "x86_64", "-x86_64.msi", "Installer (MSI)"),
    ("Windows", "x86_64", "-x86_64.exe", "Installer (EXE)"),
    ("Windows", "aarch64", "-aarch64.msi", "Installer (MSI)"),
    ("Windows", "aarch64", "-aarch64.exe", "Installer (EXE)"),
    ("macOS", "Apple Silicon", "-aarch64.dmg", "Disk Image (DMG)"),
    ("macOS", "Intel", "-x86_64.dmg", "Disk Image (DMG)"),
    ("Linux", "x86_64", "-x86_64.deb", "Debian Package (DEB)"),
    ("Linux", "x86_64", "-x86_64.AppImage", "AppImage"),
    ("Linux", "aarch64", "-aarch64.deb", "Debian Package (DEB)"),
]


def _list_downloads(assets: list, version: str, base_url: str) -> list:
    """Build the grouped list of available installers from release assets.

    Download URLs point at our own /api/update/release/{version}/{filename}
    redirect so links stay on rd.aspendora.com and survive GitHub URL changes.
    """
    groups: dict = {}
    version_prefix = f"rustdesk-{version}" if version else "rustdesk-"
    for platform, arch, suffix, kind in _DOWNLOAD_CATALOG:
        for asset in assets:
            name = asset.get("name", "")
            # Only the latest version; skip the legacy unsigned sciter build
            if name.startswith(version_prefix) and name.endswith(suffix) and "-sciter" not in name:
                groups.setdefault(platform, [])
                # Avoid duplicate filenames within a platform
                if any(d["filename"] == name for d in groups[platform]):
                    continue
                groups[platform].append({
                    "filename": _branded_name(name),
                    "arch": arch,
                    "kind": kind,
                    "size": asset.get("size", 0),
                    "url": f"{base_url}/api/update/download/{name}",
                })
                break
    return [{"platform": p, "files": f} for p, f in groups.items() if f]


@router.get("/update/downloads")
async def list_downloads(request: Request):
    """List all available signed installers for the Downloads page."""
    release = await _fetch_latest_release()
    if not release:
        return {"version": "", "released_at": "", "groups": []}

    assets = release.get("assets", [])
    version = _extract_version(assets) or release.get("tag_name", "")
    scheme = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("host", "rd.aspendora.com")
    base_url = f"{scheme}://{host}"

    return {
        "version": version,
        "released_at": release.get("published_at", ""),
        "release_url": release.get("html_url", ""),
        "groups": _list_downloads(assets, version, base_url),
    }


@router.post("/version/latest")
async def version_check(request: Request):
    """Version check endpoint compatible with the RustDesk client's native format.

    The client POSTs a VersionCheckRequest and expects a VersionCheckResponse
    with a `url` field. The client extracts the version from the URL's last
    path segment and uses it for comparison and download URL construction.

    We return a URL pointing to our own /api/update/release/{version} so that:
    1. The version is correctly extracted from the path
    2. Download URLs (constructed by replacing 'tag' with 'download') resolve
       to our redirect endpoint that proxies to the actual GitHub asset
    """
    release = await _fetch_latest_release()
    if not release:
        return JSONResponse(content={"url": ""})

    assets = release.get("assets", [])
    version = _extract_version(assets)
    if not version:
        return JSONResponse(content={"url": ""})

    # Build the base URL from forwarded headers (behind nginx proxy)
    scheme = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("host", "rd.aspendora.com")
    base_url = f"{scheme}://{host}"
    # Use our release endpoint so the client extracts the version correctly
    # and download URL construction hits our redirect endpoint
    url = f"{base_url}/api/update/release/{version}"
    return JSONResponse(content={"url": url})


@router.get("/update/release/{version}/{filename}")
async def download_redirect(version: str, filename: str):
    """Redirect to the actual GitHub asset download URL.

    The client constructs download URLs like:
      {release_url}/{filename}
    Since our release_url is /api/update/release/{version}, the download
    request hits this endpoint and we redirect to the real GitHub asset.
    """
    release = await _fetch_latest_release()
    if not release:
        return JSONResponse(status_code=404, content={"detail": "No release found"})

    assets = release.get("assets", [])
    download_url = _find_asset_by_filename(assets, filename)
    if not download_url:
        return JSONResponse(
            status_code=404,
            content={"detail": f"Asset '{filename}' not found in release"},
        )

    return RedirectResponse(url=download_url, status_code=302)


@router.get("/update/download/{filename}")
async def branded_download(filename: str):
    """Stream a release asset to the browser with the Aspendora brand name.

    Used by the console Downloads page so users save e.g.
    'Aspendora-Remote-1.4.7-x86_64.msi' instead of 'rustdesk-...'. The
    underlying GitHub asset name is unchanged (client auto-update uses the
    separate /update/release redirect, which still serves rustdesk-* names).
    """
    release = await _fetch_latest_release()
    if not release:
        return JSONResponse(status_code=404, content={"detail": "No release found"})

    download_url = _find_asset_by_filename(release.get("assets", []), filename)
    if not download_url:
        return JSONResponse(
            status_code=404,
            content={"detail": f"Asset '{filename}' not found in release"},
        )

    branded = _branded_name(filename)
    client = httpx.AsyncClient(follow_redirects=True, timeout=None)
    upstream = await client.send(client.build_request("GET", download_url), stream=True)
    if upstream.status_code != 200:
        await upstream.aclose()
        await client.aclose()
        return JSONResponse(
            status_code=502,
            content={"detail": "Upstream asset fetch failed"},
        )

    headers = {"Content-Disposition": f'attachment; filename="{branded}"'}
    if "content-length" in upstream.headers:
        headers["Content-Length"] = upstream.headers["content-length"]

    async def _iter():
        try:
            async for chunk in upstream.aiter_bytes(64 * 1024):
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        _iter(),
        media_type=upstream.headers.get("content-type", "application/octet-stream"),
        headers=headers,
    )


@router.get("/update/release/{version}")
async def release_page(version: str):
    """Redirect to the GitHub release page (used by changelog links)."""
    release = await _fetch_latest_release()
    if not release:
        return JSONResponse(status_code=404, content={"detail": "No release found"})

    html_url = release.get("html_url", "")
    if html_url:
        return RedirectResponse(url=html_url, status_code=302)
    return JSONResponse(status_code=404, content={"detail": "No release URL"})


@router.get("/update/check")
async def update_check(
    platform: str = Query(default="", description="OS platform (windows, macos, linux)"),
    arch: str = Query(default="", description="CPU architecture (x86_64, aarch64)"),
    version: str = Query(default="", description="Current client version"),
):
    """Check for client updates. Returns latest version info and download URL.

    This is used by the console UI and can also be called by custom update scripts.
    """
    release = await _fetch_latest_release()
    if not release:
        return {"update_available": False}

    assets = release.get("assets", [])
    latest_version = _extract_version(assets)

    # Find matching asset for the platform
    asset = _find_asset(assets, platform, arch) if platform else None

    return {
        "update_available": True,
        "version": latest_version or release.get("tag_name", ""),
        "release_url": release.get("html_url", ""),
        "download_url": asset["url"] if asset else None,
        "filename": asset["name"] if asset else None,
        "file_size": asset["size"] if asset else None,
        "published_at": release.get("published_at", ""),
    }
