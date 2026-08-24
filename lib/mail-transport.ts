export type MailTransportMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

const MAIL_TIMEOUT_MS = 15_000;

export async function deliverMail(message: MailTransportMessage) {
  const endpoint = process.env.MAIL_TRANSPORT_URL?.trim();
  const secret = process.env.MAIL_TRANSPORT_SECRET?.trim();
  if (!endpoint || !secret) return { ok: false as const, reason: "transport_not_configured" };

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false as const, reason: "transport_invalid" };
  }
  if (url.protocol !== "https:") return { ok: false as const, reason: "transport_invalid" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAIL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
        "X-NEYVIX-Source": "mail",
      },
      body: JSON.stringify(message),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false as const, reason: "transport_failed", status: response.status };
    const data = await response.json().catch(() => ({})) as { id?: string; messageId?: string };
    const providerMessageId = typeof data.id === "string"
      ? data.id.slice(0, 240)
      : typeof data.messageId === "string"
        ? data.messageId.slice(0, 240)
        : null;
    return { ok: true as const, providerMessageId };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return { ok: false as const, reason: timedOut ? "transport_timeout" : "transport_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
