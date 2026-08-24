export type MailTransportMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

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
    });
    if (!response.ok) return { ok: false as const, reason: "transport_failed", status: response.status };
    const data = await response.json().catch(() => ({})) as { id?: string; messageId?: string };
    return { ok: true as const, providerMessageId: data.id ?? data.messageId ?? null };
  } catch {
    return { ok: false as const, reason: "transport_failed" };
  }
}
