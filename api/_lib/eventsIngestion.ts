import { createClient } from "@supabase/supabase-js";

type TicketmasterVenue = {
  name?: string;
  city?: { name?: string };
  country?: { countryCode?: string };
  location?: { latitude?: string; longitude?: string };
};

type TicketmasterEvent = {
  id: string;
  name: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  images?: Array<{ url?: string; width?: number; height?: number }>;
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTime?: string };
    end?: { localDate?: string; localTime?: string; dateTime?: string };
  };
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
    subGenre?: { name?: string };
  }>;
  _embedded?: {
    venues?: TicketmasterVenue[];
  };
};

type TicketmasterResponse = {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
  page?: {
    totalPages?: number;
    number?: number;
    size?: number;
    totalElements?: number;
  };
};

type Coordinates = { latitude: number; longitude: number };

const DEFAULT_TICKETMASTER_BASE_URL = "https://app.ticketmaster.com/discovery/v2";
const DEFAULT_NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_COUNTRY_CODE = "IN";
const DEFAULT_FETCH_SIZE = 100;
const DEFAULT_FETCH_PAGES = 2;
const DEFAULT_EVENT_GRACE_HOURS = 24;
const NOMINATIM_MIN_DELAY_MS = 1100;

const toNumberOrNull = (value?: string | number | null) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeTime = (time?: string | null) => {
  if (!time) return "00:00:00";
  const cleaned = time.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(cleaned)) return cleaned;
  if (/^\d{2}:\d{2}$/.test(cleaned)) return `${cleaned}:00`;
  return "00:00:00";
};

const pickImage = (images?: Array<{ url?: string; width?: number; height?: number }>) => {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => {
    const areaA = (a.width || 0) * (a.height || 0);
    const areaB = (b.width || 0) * (b.height || 0);
    return areaB - areaA;
  });
  return sorted[0]?.url || null;
};

const sanitizeText = (value?: string | null, maxLength = 1200) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 3)}...`;
};

const buildLocation = (venue?: TicketmasterVenue) => {
  if (!venue) return "Location TBA";
  const parts = [venue.name, venue.city?.name].filter(Boolean);
  return parts.length ? parts.join(", ") : "Location TBA";
};

const buildCategory = (event: TicketmasterEvent) => {
  const name = (event.name || "").toLowerCase();
  const segment = (event.classifications?.[0]?.segment?.name || "").toLowerCase();
  const genre = (event.classifications?.[0]?.genre?.name || "").toLowerCase();
  const subGenre = (event.classifications?.[0]?.subGenre?.name || "").toLowerCase();
  const searchable = `${name} ${segment} ${genre} ${subGenre}`;

  if (
    searchable.includes("hackathon") ||
    searchable.includes("hack day") ||
    searchable.includes("coding challenge") ||
    searchable.includes("codefest")
  ) {
    return "hackathon";
  }

  if (
    searchable.includes("tech talk") ||
    searchable.includes("developer") ||
    searchable.includes("technology") ||
    searchable.includes("workshop") ||
    searchable.includes("conference")
  ) {
    return "tech_talk";
  }

  if (searchable.includes("sport") || searchable.includes("cricket") || searchable.includes("football")) {
    return "sports";
  }

  if (searchable.includes("music") || searchable.includes("concert")) {
    return "concert";
  }

  if (searchable.includes("fest") || searchable.includes("festival")) {
    return "fest";
  }

  return "fest";
};

const calculateDistanceKm = (from: Coordinates | null, to: Coordinates | null) => {
  if (!from || !to) return null;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) *
    Math.cos(toRad(to.latitude)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadius * c).toFixed(2));
};

const buildFallbackDateTime = (date: string, time: string) => {
  const candidate = new Date(`${date}T${time}`);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
};

const computeExpiresAt = (
  event: TicketmasterEvent,
  graceHours: number,
  fallbackDate: string,
  fallbackTime: string
) => {
  const endIso = event.dates?.end?.dateTime;
  const startIso = event.dates?.start?.dateTime;
  const fromIso = endIso || startIso;

  let baseDate: Date | null = null;
  if (fromIso) {
    const parsed = new Date(fromIso);
    if (!Number.isNaN(parsed.getTime())) baseDate = parsed;
  }

  if (!baseDate) {
    baseDate = buildFallbackDateTime(fallbackDate, fallbackTime);
  }

  if (!baseDate) return null;
  const expires = new Date(baseDate);
  expires.setHours(expires.getHours() + graceHours);
  return expires.toISOString();
};

const getEnvNumber = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const getCampusCoordinates = (): Coordinates | null => {
  const lat = toNumberOrNull(process.env.EVENTS_DEFAULT_LAT);
  const lng = toNumberOrNull(process.env.EVENTS_DEFAULT_LNG);
  if (lat === null || lng === null) return null;
  return { latitude: lat, longitude: lng };
};

const createAdminClient = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE credentials. Set VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const resolveEventCreatorId = async (supabase: ReturnType<typeof createAdminClient>) => {
  if (process.env.AUTO_EVENT_CREATOR_ID) return process.env.AUTO_EVENT_CREATOR_ID;

  const { data, error } = await supabase.from("profiles").select("id").limit(1);
  if (error) throw new Error(`Unable to resolve AUTO_EVENT_CREATOR_ID: ${error.message}`);
  if (!data?.length) {
    throw new Error("No profile found. Set AUTO_EVENT_CREATOR_ID in environment variables.");
  }

  return data[0].id as string;
};

const queryVariants = [
  { keyword: "", label: "general" },
  { keyword: "hackathon", label: "hackathon" },
  { keyword: "tech talk", label: "tech-talk" },
];

const fetchTicketmasterEvents = async () => {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) throw new Error("Missing TICKETMASTER_API_KEY");

  const baseUrl = process.env.TICKETMASTER_BASE_URL || DEFAULT_TICKETMASTER_BASE_URL;
  const city = process.env.EVENTS_FETCH_CITY || "Chennai";
  const countryCode = process.env.EVENTS_FETCH_COUNTRY_CODE || DEFAULT_COUNTRY_CODE;
  const size = getEnvNumber("EVENTS_FETCH_SIZE", DEFAULT_FETCH_SIZE);
  const maxPages = getEnvNumber("EVENTS_FETCH_PAGES", DEFAULT_FETCH_PAGES);
  const radiusKm = getEnvNumber("EVENTS_FETCH_RADIUS_KM", 60);
  const campusCoordinates = getCampusCoordinates();

  const eventsById = new Map<string, TicketmasterEvent>();
  const startDateTime = new Date().toISOString().split(".")[0] + "Z";

  for (const variant of queryVariants) {
    let page = 0;
    let totalPages = 1;

    while (page < totalPages && page < maxPages) {
      const params = new URLSearchParams({
        apikey: apiKey,
        size: String(size),
        page: String(page),
        sort: "date,asc",
        locale: "*",
        startDateTime,
        countryCode,
      });

      if (campusCoordinates) {
        params.set("latlong", `${campusCoordinates.latitude},${campusCoordinates.longitude}`);
        params.set("radius", String(radiusKm));
        params.set("unit", "km");
      } else {
        params.set("city", city);
      }

      if (variant.keyword) {
        params.set("keyword", variant.keyword);
      }

      const fetchUrl = `${baseUrl}/events.json?${params.toString()}`;
      console.log(`🔍 Fetching: ${fetchUrl.replace(apiKey, "REDACTED")}`);

      const response = await fetch(fetchUrl);
      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Ticketmaster fetch failed (${variant.label}, page ${page}): ${response.status} ${body}`
        );
      }

      const payload = (await response.json()) as TicketmasterResponse;
      const events = payload._embedded?.events || [];
      for (const event of events) {
        if (event?.id) {
          eventsById.set(event.id, event);
        }
      }

      totalPages = payload.page?.totalPages || 1;
      page += 1;
    }
  }

  return {
    events: Array.from(eventsById.values()),
    campusCoordinates,
  };
};

let lastNominatimAt = 0;

const waitForNominatimWindow = async () => {
  const now = Date.now();
  const elapsed = now - lastNominatimAt;
  if (elapsed < NOMINATIM_MIN_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_MIN_DELAY_MS - elapsed));
  }
  lastNominatimAt = Date.now();
};

const geocodeFromNominatim = async (
  supabase: ReturnType<typeof createAdminClient>,
  rawQuery: string
): Promise<Coordinates | null> => {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return null;

  const nowIso = new Date().toISOString();
  try {
    const { data: cacheHit, error: cacheError } = await supabase
      .from("geocode_cache")
      .select("latitude, longitude, expires_at")
      .eq("query_text", query)
      .maybeSingle();

    if (!cacheError && cacheHit?.expires_at && new Date(cacheHit.expires_at) > new Date()) {
      return {
        latitude: Number(cacheHit.latitude),
        longitude: Number(cacheHit.longitude),
      };
    }
  } catch (error) {
    // Continue without cache if table is not present yet.
  }

  await waitForNominatimWindow();

  const baseUrl = process.env.NOMINATIM_BASE_URL || DEFAULT_NOMINATIM_BASE_URL;
  const userAgent = process.env.NOMINATIM_USER_AGENT || "RydinEventsBot/1.0 (hello@rydin.app)";
  const countryCode = (process.env.EVENTS_FETCH_COUNTRY_CODE || DEFAULT_COUNTRY_CODE).toLowerCase();
  const url = `${baseUrl}/search?format=json&limit=1&countrycodes=${countryCode}&q=${encodeURIComponent(
    rawQuery
  )}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
    },
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  if (!payload.length) return null;

  const lat = toNumberOrNull(payload[0].lat);
  const lon = toNumberOrNull(payload[0].lon);
  if (lat === null || lon === null) return null;

  try {
    await supabase.from("geocode_cache").upsert(
      {
        query_text: query,
        latitude: lat,
        longitude: lon,
        provider: "nominatim",
        created_at: nowIso,
        expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "query_text" }
    );
  } catch (error) {
    // Cache write failure should not block ingestion.
  }

  return { latitude: lat, longitude: lon };
};

const toEventRecord = async (
  supabase: ReturnType<typeof createAdminClient>,
  event: TicketmasterEvent,
  creatorId: string,
  fetchedAtIso: string,
  campusCoordinates: Coordinates | null,
  graceHours: number
) => {
  const date = event.dates?.start?.localDate;
  if (!date) return null;

  const venue = event._embedded?.venues?.[0];
  const location = buildLocation(venue);

  let latitude = toNumberOrNull(venue?.location?.latitude);
  let longitude = toNumberOrNull(venue?.location?.longitude);

  if ((latitude === null || longitude === null) && location !== "Location TBA") {
    const geocoded = await geocodeFromNominatim(supabase, location);
    if (geocoded) {
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }
  }

  const coords = latitude !== null && longitude !== null ? { latitude, longitude } : null;
  const distanceKm = calculateDistanceKm(campusCoordinates, coords);
  const startTime = normalizeTime(event.dates?.start?.localTime);
  const endTime = normalizeTime(event.dates?.end?.localTime || null);
  const expiresAt = computeExpiresAt(event, graceHours, date, startTime);
  const imageUrl = pickImage(event.images);

  return {
    source: "ticketmaster",
    source_event_id: event.id,
    source_url: sanitizeText(event.url, 500),
    status: "active",
    last_seen_at: fetchedAtIso,
    fetched_at: fetchedAtIso,
    expires_at: expiresAt,
    name: sanitizeText(event.name, 200) || "Untitled event",
    location,
    latitude,
    longitude,
    distance_km: distanceKm,
    date,
    start_time: startTime,
    end_time: endTime === "00:00:00" ? null : endTime,
    category: buildCategory(event),
    description: sanitizeText(event.info || event.pleaseNote, 1800),
    image_url: imageUrl,
    created_by: creatorId,
    external_payload: {
      source: "ticketmaster",
      source_event_id: event.id,
      classification: event.classifications?.[0] || null,
    },
  };
};

const chunk = <T>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

export const ingestTicketmasterEvents = async () => {
  const supabase = createAdminClient();
  const fetchedAtIso = new Date().toISOString();
  const staleHours = getEnvNumber("EVENT_STALE_EXPIRE_HOURS", 72);
  const graceHours = getEnvNumber("EVENT_EXPIRE_GRACE_HOURS", DEFAULT_EVENT_GRACE_HOURS);

  const creatorId = await resolveEventCreatorId(supabase);
  const { events: ticketmasterEvents, campusCoordinates } = await fetchTicketmasterEvents();

  const mappedRecords = [];
  for (const ticketmasterEvent of ticketmasterEvents) {
    const mapped = await toEventRecord(
      supabase,
      ticketmasterEvent,
      creatorId,
      fetchedAtIso,
      campusCoordinates,
      graceHours
    );
    if (mapped) mappedRecords.push(mapped);
  }

  if (mappedRecords.length > 0) {
    for (const batch of chunk(mappedRecords, 100)) {
      const { error } = await supabase
        .from("events")
        .upsert(batch, { onConflict: "source,source_event_id" });
      if (error) {
        throw new Error(`Failed to upsert events batch: ${error.message}`);
      }
    }
  }

  const staleCutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString();
  await supabase
    .from("events")
    .update({ status: "expired" })
    .eq("source", "ticketmaster")
    .eq("status", "active")
    .lt("last_seen_at", staleCutoff);

  await supabase
    .from("events")
    .update({ status: "expired" })
    .eq("source", "ticketmaster")
    .eq("status", "active")
    .lt("expires_at", fetchedAtIso);

  return {
    ok: true,
    fetched: ticketmasterEvents.length,
    upserted: mappedRecords.length,
    fetchedAt: fetchedAtIso,
  };
};

export const cleanupExternalEvents = async () => {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const graceHours = getEnvNumber("EVENT_EXPIRE_GRACE_HOURS", DEFAULT_EVENT_GRACE_HOURS);
  const hardDeleteDays = getEnvNumber("EVENT_HARD_DELETE_DAYS", 30);
  const staleDateCutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const deleteBeforeIso = new Date(
    Date.now() - hardDeleteDays * 24 * 60 * 60 * 1000
  ).toISOString();

  await supabase
    .from("events")
    .update({ status: "expired" })
    .eq("source", "ticketmaster")
    .eq("status", "active")
    .lt("expires_at", nowIso);

  // Fallback expiry for rows that may not have expires_at populated.
  await supabase
    .from("events")
    .update({ status: "expired" })
    .eq("source", "ticketmaster")
    .eq("status", "active")
    .lt("date", staleDateCutoff);

  const { data: deletedRows, error: deleteError } = await supabase
    .from("events")
    .delete()
    .eq("source", "ticketmaster")
    .in("status", ["expired", "cancelled", "hidden"])
    .lt("expires_at", deleteBeforeIso)
    .select("id");

  if (deleteError) {
    throw new Error(`Failed to delete expired external events: ${deleteError.message}`);
  }

  try {
    await supabase.from("geocode_cache").delete().lt("expires_at", nowIso);
  } catch (error) {
    // Geocode cache cleanup is best effort.
  }

  return {
    ok: true,
    deleted: deletedRows?.length || 0,
    cleanedAt: nowIso,
  };
};
