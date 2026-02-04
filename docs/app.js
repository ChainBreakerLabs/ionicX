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

const buildLinks = (os) => {
  if (os === "windows") {
    return {
      label: "Windows",
      primary: makeLink("Windows (x64)", "ionicx-windows-x64.msi"),
      secondary: [makeLink("Windows (EXE)", "ionicx-windows-x64.exe")],
    };
  }

  if (os === "macos") {
    return {
      label: "macOS",
      primary: makeLink("macOS (Apple Silicon)", "ionicx-macos-arm64.dmg"),
      secondary: [makeLink("macOS (.app.zip)", "ionicx-macos-arm64.app.zip")],
    };
  }

  if (os === "linux") {
    return {
      label: "Linux",
      primary: makeLink("Linux (AppImage)", "ionicx-linux-x86_64.AppImage"),
      secondary: [
        makeLink("Linux (.deb)", "ionicx-linux-amd64.deb"),
        makeLink("Linux (.rpm)", "ionicx-linux-x86_64.rpm"),
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
const { label, primary, secondary } = buildLinks(os);

primaryButton.textContent = `Descargar para ${label}`;
primaryButton.href = primary.url;
primarySubtext.textContent = `Última versión • ${primary.file}`;

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
  makeLink("macOS (Apple Silicon DMG)", "ionicx-macos-arm64.dmg"),
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
