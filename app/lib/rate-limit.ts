import { getCloudflareContext } from "@opennextjs/cloudflare";

export type RateLimitResult =
  | { status: "allowed" }
  | { status: "limited" }
  | { status: "unavailable" };

export async function checkRateLimit(
  request: Request,
): Promise<RateLimitResult> {
  try {
    const { env } = getCloudflareContext();
    const rateLimiter = env.MAIL_CHECK_RATE_LIMITER;

    if (!rateLimiter) {
      console.error("MAIL_CHECK_RATE_LIMITER binding is not configured.");
      return { status: "unavailable" };
    }

    const { success } = await rateLimiter.limit({
      key: getClientIdentifier(request),
    });

    return success ? { status: "allowed" } : { status: "limited" };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return { status: "unavailable" };
  }
}

function getClientIdentifier(request: Request): string {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();

  return cloudflareIp || "unknown-client";
}
