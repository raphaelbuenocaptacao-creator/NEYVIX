"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone) {
      setInstalled(true);
      return;
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!installEvent || installed) return null;

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setInstalled(true);
      setInstallEvent(null);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      aria-label="Instalar NEYVIX neste dispositivo"
      style={{
        position: "fixed",
        right: "18px",
        bottom: "18px",
        zIndex: 1000,
        border: "1px solid rgba(0,168,255,.45)",
        borderRadius: "999px",
        padding: "12px 16px",
        background: "rgba(2,8,16,.9)",
        color: "#fff",
        fontWeight: 700,
        letterSpacing: ".02em",
        backdropFilter: "blur(18px)",
        boxShadow: "0 12px 40px rgba(0,0,0,.35)",
        cursor: "pointer",
      }}
    >
      Instalar NEYVIX
    </button>
  );
}
