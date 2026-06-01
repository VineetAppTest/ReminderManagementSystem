export type FeedbackRepositoryProvider = "supabase" | "firebase" | "sheets";

export type SupabaseFeedbackConfig = {
  provider: "supabase";
  supabaseUrl: string;
  supabaseAnonKey: string;
  tableName: string;
};

export type FirebaseFeedbackConfig = {
  provider: "firebase";
  firebaseProjectId: string;
  firebaseApiKey: string;
  firebaseCollection: string;
};

export type SheetsFeedbackConfig = {
  provider: "sheets";
  sheetsWebhookUrl: string;
};

export type RemoteFeedbackConfig = SupabaseFeedbackConfig | FirebaseFeedbackConfig | SheetsFeedbackConfig;

export type FeedbackRepositoryResult = {
  ok: boolean;
  error?: string;
};

function normalizeUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

function envString(name: string) {
  return String(import.meta.env[name] || "").trim();
}

function normalizeProvider(value: string): FeedbackRepositoryProvider | null {
  const provider = value.trim().toLowerCase();
  if (provider === "supabase" || provider === "firebase" || provider === "sheets") return provider;
  return null;
}

export function getRemoteFeedbackConfig(): RemoteFeedbackConfig | null {
  const explicitProvider = normalizeProvider(envString("VITE_FEEDBACK_PROVIDER"));

  const firebaseProjectId = envString("VITE_FIREBASE_PROJECT_ID");
  const firebaseApiKey = envString("VITE_FIREBASE_API_KEY");
  const firebaseCollection = envString("VITE_FIREBASE_FEEDBACK_COLLECTION") || "remindiq_feedback_items";

  const supabaseUrl = normalizeUrl(envString("VITE_SUPABASE_URL"));
  const supabaseAnonKey = envString("VITE_SUPABASE_ANON_KEY");
  const tableName = envString("VITE_FEEDBACK_TABLE") || "remindiq_feedback_items";

  const sheetsWebhookUrl = normalizeUrl(envString("VITE_SHEETS_FEEDBACK_WEBHOOK_URL"));

  const inferredProvider: FeedbackRepositoryProvider | null = explicitProvider
    || (firebaseProjectId && firebaseApiKey ? "firebase" : null)
    || (supabaseUrl && supabaseAnonKey ? "supabase" : null)
    || (sheetsWebhookUrl ? "sheets" : null);

  if (inferredProvider === "firebase") {
    if (!firebaseProjectId || !firebaseApiKey || !firebaseCollection) return null;
    return {
      provider: "firebase",
      firebaseProjectId,
      firebaseApiKey,
      firebaseCollection,
    };
  }

  if (inferredProvider === "supabase") {
    if (!supabaseUrl || !supabaseAnonKey || !tableName) return null;
    return {
      provider: "supabase",
      supabaseUrl,
      supabaseAnonKey,
      tableName,
    };
  }

  if (inferredProvider === "sheets") {
    if (!sheetsWebhookUrl) return null;
    return {
      provider: "sheets",
      sheetsWebhookUrl,
    };
  }

  return null;
}

export async function pushFeedbackToRepository(
  config: RemoteFeedbackConfig,
  payload: Record<string, unknown>,
): Promise<FeedbackRepositoryResult> {
  if (config.provider === "firebase") return pushFeedbackToFirebase(config, payload);
  if (config.provider === "sheets") return pushFeedbackToSheets(config, payload);
  return pushFeedbackToSupabase(config, payload);
}

async function pushFeedbackToSupabase(
  config: SupabaseFeedbackConfig,
  payload: Record<string, unknown>,
): Promise<FeedbackRepositoryResult> {
  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.tableName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        error: text || `HTTP ${response.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

async function pushFeedbackToFirebase(
  config: FirebaseFeedbackConfig,
  payload: Record<string, unknown>,
): Promise<FeedbackRepositoryResult> {
  try {
    const documentPayload = {
      fields: toFirestoreFields({
        ...payload,
        repository_provider: "firebase",
        repository_received_at: new Date().toISOString(),
      }),
    };

    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.firebaseProjectId)}/databases/(default)/documents/${encodeURIComponent(config.firebaseCollection)}?key=${encodeURIComponent(config.firebaseApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentPayload),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        error: text || `HTTP ${response.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

async function pushFeedbackToSheets(
  config: SheetsFeedbackConfig,
  payload: Record<string, unknown>,
): Promise<FeedbackRepositoryResult> {
  try {
    const response = await fetch(config.sheetsWebhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        ...payload,
        repository_provider: "sheets",
        repository_received_at: new Date().toISOString(),
      }),
    });

    // Apps Script web apps commonly require no-cors from browser clients; that
    // returns an opaque response even when the write succeeds. Treat the request
    // dispatch as success and keep local export as fallback.
    if (response.type === "opaque") return { ok: true };

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        error: text || `HTTP ${response.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { nullValue: null }
  | { mapValue: { fields: Record<string, FirestoreValue> } }
  | { arrayValue: { values: FirestoreValue[] } };

function toFirestoreFields(value: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [key, toFirestoreValue(fieldValue)]),
  );
}

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value))) {
      return { timestampValue: new Date(value).toISOString() };
    }
    return { stringValue: value };
  }

  if (typeof value === "boolean") return { booleanValue: value };

  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }

  if (typeof value === "object") {
    return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } };
  }

  return { stringValue: String(value) };
}
