const repo = document.body.dataset.repo || "ChainBreakerLabs/ionicX";
const baseUrl = `https://github.com/${repo}/releases/latest/download/`;

const primaryButton = document.getElementById("primary-download");
const primarySubtext = document.getElementById("primary-subtext");
const secondaryLinks = document.getElementById("secondary-links");
const allDownloads = document.getElementById("all-downloads");

const makeLink = (label, file) => ({ label, url: `${baseUrl}${file}`, file });

const detectOs = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux") || ua.includes("x11")) return "linux";
  return "unknown";
};

const detectArch = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("arm64") || ua.includes("aarch64")) return "arm64";
  if (ua.includes("x86_64") || ua.includes("amd64") || ua.includes("x64")) return "x64";
  if (navigator.userAgentData && navigator.userAgentData.architecture) {
    return navigator.userAgentData.architecture.toLowerCase().includes("arm")
      ? "arm64"
      : "x64";
  }
  return "x64";
};

const buildLinks = (os, arch) => {
  if (os === "windows") {
    const winArch = arch === "arm64" ? "arm64" : "x64";
    return {
      label: "Windows",
      primary: makeLink(`Windows (${winArch.toUpperCase()})`, `ionicx-windows-${winArch}.msi`),
      secondary: [makeLink("Windows (EXE)", `ionicx-windows-${winArch}.exe`)],
    };
  }

  if (os === "macos") {
    const macArch = arch === "arm64" ? "arm64" : "x64";
    const otherArch = macArch === "arm64" ? "x64" : "arm64";
    return {
      label: "macOS",
      primary: makeLink(`macOS (${macArch})`, `ionicx-macos-${macArch}.dmg`),
      secondary: [
        makeLink("macOS (Universal)", "ionicx-macos-universal.dmg"),
        makeLink(`macOS (${otherArch})`, `ionicx-macos-${otherArch}.dmg`),
        makeLink(`macOS (${macArch}) .app.zip`, `ionicx-macos-${macArch}.app.zip`),
      ],
    };
  }

  if (os === "linux") {
    const isArm = arch === "arm64";
    const appImageArch = isArm ? "aarch64" : "x86_64";
    const debArch = isArm ? "arm64" : "amd64";
    const rpmArch = isArm ? "aarch64" : "x86_64";
    return {
      label: "Linux",
      primary: makeLink("Linux (AppImage)", `ionicx-linux-${appImageArch}.AppImage`),
      secondary: [
        makeLink("Linux (.deb)", `ionicx-linux-${debArch}.deb`),
        makeLink("Linux (.rpm)", `ionicx-linux-${rpmArch}.rpm`),
      ],
    };
  }

  return {
    label: "Desktop",
    primary: makeLink("Windows (MSI)", "ionicx-windows-x64.msi"),
    secondary: [
      makeLink("macOS (DMG)", "ionicx-macos-arm64.dmg"),
      makeLink("Linux (AppImage)", "ionicx-linux-x86_64.AppImage"),
    ],
  };
};

const os = detectOs();
const arch = detectArch();
const { label, primary, secondary } = buildLinks(os, arch);

primaryButton.textContent = `Download for ${label}`;
primaryButton.href = primary.url;
primarySubtext.textContent = `Latest release • ${primary.file}`;

secondaryLinks.innerHTML = "";
secondary
  .filter((link) => link.file !== primary.file)
  .forEach((link) => {
    const a = document.createElement("a");
    a.href = link.url;
    a.textContent = link.label;
    a.rel = "noopener";
    secondaryLinks.appendChild(a);
  });

const allLinks = [
  makeLink("Windows (MSI)", "ionicx-windows-x64.msi"),
  makeLink("Windows (EXE)", "ionicx-windows-x64.exe"),
  makeLink("macOS (arm64 DMG)", "ionicx-macos-arm64.dmg"),
  makeLink("macOS (x64 DMG)", "ionicx-macos-x64.dmg"),
  makeLink("macOS (Universal DMG)", "ionicx-macos-universal.dmg"),
  makeLink("macOS (.app.zip)", "ionicx-macos-arm64.app.zip"),
  makeLink("Linux (AppImage)", "ionicx-linux-x86_64.AppImage"),
  makeLink("Linux (.deb)", "ionicx-linux-amd64.deb"),
  makeLink("Linux (.rpm)", "ionicx-linux-x86_64.rpm"),
];

allDownloads.innerHTML = "";
allLinks.forEach((link) => {
  const a = document.createElement("a");
  a.href = link.url;
  a.textContent = link.label;
  a.rel = "noopener";
  allDownloads.appendChild(a);
});
