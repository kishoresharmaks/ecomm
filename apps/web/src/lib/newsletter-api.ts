import { apiBaseUrl } from "./api";

export type NewsletterSubscribeResponse = {
  success: boolean;
  message?: string;
};

const NEWSLETTER_BASE = `${apiBaseUrl}/api/newsletter`;

export async function subscribeToNewsletter(
  email: string,
  name?: string,
): Promise<NewsletterSubscribeResponse> {
  const response = await fetch(`${NEWSLETTER_BASE}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, ...(name ? { name } : {}) }),
  });

  if (!response.ok) {
    let message = "Could not subscribe. Try again later.";
    try {
      const error = await response.json();
      if (typeof error.message === "string") message = error.message;
    } catch {
      // keep default
    }
    throw new Error(message);
  }

  return response.json();
}
