"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (window.location.protocol !== "https:" && !isLocalhost) return;

    let activeRegistration: ServiceWorkerRegistration | null = null;
    let refreshing = false;
    let hadController = Boolean(navigator.serviceWorker.controller);

    const refreshOnResume = () => {
      if (document.visibilityState === "visible" && activeRegistration) {
        void activeRegistration.update();
      }
    };

    const handoffController = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          "/sw.js?v=10-private-vary-range-safe-shell",
          {
            scope: "/",
            updateViaCache: "none",
          },
        );
        activeRegistration = registration;
        await registration.update();
      } catch (error) {
        console.error("Falha ao registrar o service worker do NEYVIX", error);
      }
    };

    document.addEventListener("visibilitychange", refreshOnResume);
    navigator.serviceWorker.addEventListener("controllerchange", handoffController);

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", refreshOnResume);
      navigator.serviceWorker.removeEventListener("controllerchange", handoffController);
    };
  }, []);

  return null;
}
