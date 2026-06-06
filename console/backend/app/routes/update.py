import logging
import re

import httpx
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse

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
    """Extract the actual version number from release asset filenames."""
    for asset in assets:
        name = asset.get("name", "")
        m = _VERSION_RE.search(name)
        if m:
            return m.group(1)
    return ""


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
