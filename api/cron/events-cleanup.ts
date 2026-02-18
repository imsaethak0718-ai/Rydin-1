import { isCronAuthorized } from "../_lib/cronAuth";
import { cleanupExternalEvents } from "../_lib/eventsIngestion";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isCronAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const result = await cleanupExternalEvents();
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("events-cleanup failed:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Unexpected error while cleaning up events",
    });
  }
}
