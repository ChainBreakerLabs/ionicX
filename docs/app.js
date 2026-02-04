const repo = document.body.dataset.repo || "ChainBreakerLabs/ionicX";
const baseUrl = `https://github.com/${repo}/releases/latest/download/`;
const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

const primaryButton = document.getElementById("primary-download");
const primarySubtext = document.getElementById("primary-subtext");
const secondaryLinks = document.getElementById("secondary-links");
const allDownloads = document.getElementById("all-downloads");

const fallbackAssets = [
  // Windows
  "ionicx-windows-x64.msi",
  "ionicx-windows-x64.exe",
  // macOS
  "ionicx-macos-arm64.dmg",
  "ionicx-macos-arm64.app.zip",
  "ionicx-macos-x64.dmg",
  "ionicx-macos-x64.app.zip",
  // Linux
  "ionicx-linux-x86_64.AppImage",
  "ionicx-linux-x86_64.deb",
  "ionicx-linux-x86_64.rpm",
  "ionicx-linux-arm64.AppImage",
  "ionicx-linux-arm64.deb",
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
    // Windows
    { re: /^ionicx-windows-x64\.msi$/i, os: "windows", arch: "x64", type: "MSI" },
    { re: /^ionicx-windows-x64\.exe$/i, os: "windows", arch: "x64", type: "EXE" },
    // macOS
    { re: /^ionicx-macos-arm64\.dmg$/i, os: "macos", arch: "arm64", type: "DMG" },
    { re: /^ionicx-macos-arm64\.app\.zip$/i, os: "macos", arch: "arm64", type: "APP" },
    { re: /^ionicx-macos-x64\.dmg$/i, os: "macos", arch: "x64", type: "DMG" },
    { re: /^ionicx-macos-x64\.app\.zip$/i, os: "macos", arch: "x64", type: "APP" },
    // Linux
    { re: /^ionicx-linux-x86_64\.AppImage$/i, os: "linux", arch: "x86_64", type: "AppImage" },
    { re: /^ionicx-linux-x86_64\.deb$/i, os: "linux", arch: "x86_64", type: "DEB" },
    { re: /^ionicx-linux-x86_64\.rpm$/i, os: "linux", arch: "x86_64", type: "RPM" },
    { re: /^ionicx-linux-arm64\.AppImage$/i, os: "linux", arch: "arm64", type: "AppImage" },
    { re: /^ionicx-linux-arm64\.deb$/i, os: "linux", arch: "arm64", type: "DEB" },
  ];

  for (const { re, os, arch, type } of patterns) {
    if (re.test(name)) {
      const osLabel = os === "macos" ? "macOS" : titleCase(os);
      const archLabel = arch ? ` ${arch}` : "";
      const typeLabel = type;
      return {
        name,
        os,
        arch,
        label: `${osLabel} (${typeLabel}${archLabel ? ` •${archLabel}` : ""})`,
      };
    }
  }

  return { name, os: "unknown", arch: "unknown", label: name };
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
  try {
    const os = detectOs();
    const assetNames = await loadAssets();
    const assets = assetNames.map((name) => parseAsset(name));

    const primary = pickPrimary(os, assets);

    if (primary.os === "unknown") {
      primaryButton.textContent = "Descargar IonicX";
      primaryButton.href = "#";
      primaryButton.disabled = true;
    } else {
      const osDisplay = primary.os === "macos" ? "macOS" : titleCase(primary.os);
      const archDisplay = primary.arch && primary.arch !== "unknown" ? ` (${primary.arch})` : "";
      primaryButton.textContent = `Descargar para ${osDisplay}${archDisplay}`;
      primaryButton.href = `${baseUrl}${primary.name}`;
    }

    primarySubtext.textContent = `Última versión • ${primary.name}`;

    const secondary = assets.filter((asset) => asset.name !== primary.name && asset.os === primary.os);
    if (secondary.length === 0) {
      secondary.push(...assets.filter((asset) => asset.name !== primary.name).slice(0, 3));
    }
    renderLinks(secondaryLinks, secondary);

    renderLinks(allDownloads, assets);
  } catch (error) {
    console.error("Error al cargar assets:", error);
    primaryButton.textContent = "Descargar IonicX";
    primaryButton.href = "https://github.com/ChainBreakerLabs/ionicX/releases/latest";
    primarySubtext.textContent = "Ver releases en GitHub";
  }
};

boot();
