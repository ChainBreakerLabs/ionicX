const repo = document.body.dataset.repo || "ChainBreakerLabs/ionicX";
const baseUrl = `https://github.com/${repo}/releases/latest/download/`;
const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

const primaryButton = document.getElementById("primary-download");
const primarySubtext = document.getElementById("primary-subtext");
const secondaryLinks = document.getElementById("secondary-links");
const allDownloads = document.getElementById("all-downloads");

const fallbackAssets = [
  "ionicx-windows-x64.msi",
  "ionicx-windows-x64.exe",
  "ionicx-macos-arm64.dmg",
  "ionicx-macos-arm64.app.zip",
  "ionicx-linux-x86_64.AppImage",
  "ionicx-linux-amd64.deb",
  "ionicx-linux-x86_64.rpm",
];

const detectOs = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux") || ua.includes("x11")) return "linux";
  return "unknown";
};

const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const parseAsset = (name) => {
  const patterns = [
    { re: /^ionicx-windows-(.+)\.msi$/i, os: "windows", type: "MSI" },
    { re: /^ionicx-windows-(.+)\.exe$/i, os: "windows", type: "EXE" },
    { re: /^ionicx-macos-(.+)\.dmg$/i, os: "macos", type: "DMG" },
    { re: /^ionicx-macos-(.+)\.app\.zip$/i, os: "macos", type: "APP" },
    { re: /^ionicx-linux-(.+)\.AppImage$/i, os: "linux", type: "AppImage" },
    { re: /^ionicx-linux-(.+)\.deb$/i, os: "linux", type: "DEB" },
    { re: /^ionicx-linux-(.+)\.rpm$/i, os: "linux", type: "RPM" },
  ];

  for (const { re, os, type } of patterns) {
    const match = name.match(re);
    if (match) {
      const arch = match[1];
      const osLabel = os === "macos" ? "macOS" : titleCase(os);
      const archLabel = arch ? ` ${arch}` : "";
      const typeLabel = type === "APP" ? ".app.zip" : type;
      return {
        name,
        os,
        label: `${osLabel} (${typeLabel}${archLabel ? ` •${archLabel}` : ""})`,
      };
    }
  }

  return { name, os: "unknown", label: name };
};

const preferenceOrder = {
  windows: [".msi", ".exe"],
  macos: [".dmg", ".app.zip"],
  linux: [".AppImage", ".deb", ".rpm"],
};

const pickPrimary = (os, assets) => {
  const candidates = assets.filter((asset) => asset.os === os);
  if (candidates.length === 0) return assets[0];

  const order = preferenceOrder[os] || [];
  for (const ext of order) {
    const found = candidates.find((asset) => asset.name.endsWith(ext));
    if (found) return found;
  }
  return candidates[0];
};

const renderLinks = (container, items) => {
  container.innerHTML = "";
  items.forEach((asset) => {
    const a = document.createElement("a");
    a.href = `${baseUrl}${asset.name}`;
    a.textContent = `${asset.label} — ${asset.name}`;
    a.rel = "noopener";
    container.appendChild(a);
  });
};

const loadAssets = async () => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
    const data = await response.json();
    const names = (data.assets || []).map((asset) => asset.name).filter(Boolean);
    return names.length ? names : fallbackAssets;
  } catch (error) {
    return fallbackAssets;
  }
};

const boot = async () => {
  const os = detectOs();
  const assetNames = await loadAssets();
  const assets = assetNames.map((name) => parseAsset(name));

  const primary = pickPrimary(os, assets);
  primaryButton.textContent = `Descargar para ${primary.os === "unknown" ? "tu sistema" : primary.os === "macos" ? "macOS" : titleCase(primary.os)}`;
  primaryButton.href = `${baseUrl}${primary.name}`;
  primarySubtext.textContent = `Disponible ahora • ${primary.name}`;

  const secondary = assets.filter((asset) => asset.name !== primary.name && asset.os === primary.os);
  if (secondary.length === 0) {
    secondary.push(...assets.filter((asset) => asset.name !== primary.name).slice(0, 3));
  }
  renderLinks(secondaryLinks, secondary);

  renderLinks(allDownloads, assets);
};

boot();
