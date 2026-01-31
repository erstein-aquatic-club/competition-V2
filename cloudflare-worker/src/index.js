import { buildMessageTargetUserIds } from "./messaging.js";
import { fetchFfnBestPerformancesByIuf } from "./ffn.js";

const encoder = new TextEncoder();

const buildMessageTargetUserIdsInternal = ({ targets = [], groupMembersById = new Map(), senderId }) => {
  const resolved = new Set();
  const addId = (value) => {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) {
      resolved.add(id);
    }
  };

  targets.forEach((target) => {
    addId(target?.target_user_id);
    const groupId = Number(target?.target_group_id);
    if (Number.isFinite(groupId) && groupId > 0) {
      const members = groupMembersById.get(groupId) || [];
      members.forEach(addId);
    }
  });

  addId(senderId);

  return Array.from(resolved);
};

export { buildMessageTargetUserIdsInternal as buildMessageTargetUserIds };

const base64UrlEncode = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlDecode = (input) => {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const DEFAULT_PASSWORD_HASH_ITERATIONS = 100000;
const MAX_PASSWORD_HASH_ITERATIONS = 100000;
const PASSWORD_SALT_LENGTH = 16;
const PASSWORD_DERIVED_KEY_LENGTH = 32;
const DEFAULT_LOGIN_MAX_ATTEMPTS = 5;
const DEFAULT_LOGIN_WINDOW_SECONDS = 15 * 60;
const DEFAULT_LOGIN_LOCK_SECONDS = 15 * 60;

const signToken = async (payload, secret, expiresInSeconds, type) => {
  const header = { alg: "HS256", typ: "JWT" };
  const issuedAt = Math.floor(Date.now() / 1000);
  const exp = issuedAt + expiresInSeconds;
  const fullPayload = { ...payload, iat: issuedAt, exp, typ: type };
  const headerEncoded = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadEncoded = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));
  const data = `${headerEncoded}.${payloadEncoded}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return `${data}.${base64UrlEncode(signature)}`;
};

const verifyToken = async (token, secret) => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "invalid_token" };
  }
  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const data = `${headerEncoded}.${payloadEncoded}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signature = base64UrlDecode(signatureEncoded);
  const valid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(data));
  if (!valid) {
    return { valid: false, error: "invalid_signature" };
  }
  const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadEncoded));
  const payload = JSON.parse(payloadJson);
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return { valid: false, error: "token_expired" };
  }
  return { valid: true, payload };
};

const hashLegacyPassword = async (password) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(password));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const derivePasswordKey = async (password, salt, iterations) => {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    PASSWORD_DERIVED_KEY_LENGTH * 8,
  );
  return new Uint8Array(derivedBits);
};

const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
};

const hashPassword = async (password, { iterations = DEFAULT_PASSWORD_HASH_ITERATIONS } = {}) => {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_LENGTH));
  const derived = await derivePasswordKey(password, salt, iterations);
  return `pbkdf2$${iterations}$${base64UrlEncode(salt)}$${base64UrlEncode(derived)}`;
};

const verifyPassword = async (password, storedHash, { iterations = DEFAULT_PASSWORD_HASH_ITERATIONS } = {}) => {
  if (!storedHash) {
    return { valid: false, needsUpgrade: false, newHash: null };
  }
  if (storedHash.startsWith("pbkdf2$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 4) {
      return { valid: false, needsUpgrade: false, newHash: null };
    }
    const storedIterations = Number(parts[1]);
    const salt = base64UrlDecode(parts[2]);
    const expected = base64UrlDecode(parts[3]);
    if (!Number.isFinite(storedIterations) || storedIterations <= 0) {
      return { valid: false, needsUpgrade: false, newHash: null };
    }
    const derived = await derivePasswordKey(password, salt, storedIterations);
    const valid = timingSafeEqual(derived, expected);
    const needsUpgrade = valid && iterations > storedIterations;
    const newHash = needsUpgrade ? await hashPassword(password, { iterations }) : null;
    return { valid, needsUpgrade, newHash };
  }
  const legacyHash = await hashLegacyPassword(password);
  const valid = legacyHash === storedHash;
  const newHash = valid ? await hashPassword(password, { iterations }) : null;
  return { valid, needsUpgrade: valid, newHash };
};

const generatePassword = (length = 12) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
};

const jsonResponse = (payload, status, corsHeaders) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const responseOk = (data, meta, status, corsHeaders) =>
  jsonResponse({ ok: true, data, meta: meta ?? {} }, status, corsHeaders);

const responseError = (error, code, status, corsHeaders) =>
  jsonResponse({ ok: false, error, code }, status, corsHeaders);

const parsePagination = (url) => {
  const limitRaw = Number(url.searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const offsetRaw = Number(url.searchParams.get("offset") || 0);
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  const orderParam = (url.searchParams.get("order") || "desc").toLowerCase();
  const order = orderParam === "asc" ? "ASC" : "DESC";
  return { limit, offset, order };
};

const parseDateRange = (url) => {
  const from = url.searchParams.get("from") || null;
  const to = url.searchParams.get("to") || null;
  return { from, to };
};

const isEmpty = (value) => value === undefined || value === null || value === "";

const ensureEnum = (value, allowed) => allowed.includes(value);

const normalizeIdentifier = (value) => String(value || "").trim();

const normalizeIdentifierLower = (value) => normalizeIdentifier(value).toLowerCase();

const timeOnlyPattern = /^\d{2}:\d{2}(:\d{2})?$/;

const normalizeShiftTime = (value, shiftDate) => {
  const normalized = normalizeIdentifier(value);
  if (!normalized) return "";
  if (timeOnlyPattern.test(normalized)) {
    if (!shiftDate) return "";
    return `${shiftDate}T${normalized}`;
  }
  return normalized;
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const requiresPasswordForRole = (role) => ["athlete", "coach", "comite", "admin"].includes(role);

const getPasswordHashConfig = (env) => {
  const iterations = parsePositiveInt(env.PASSWORD_HASH_ITERATIONS, DEFAULT_PASSWORD_HASH_ITERATIONS);
  return { iterations: Math.min(iterations, MAX_PASSWORD_HASH_ITERATIONS) };
};

const getLoginPolicy = (env) => ({
  maxAttempts: parsePositiveInt(env.LOGIN_MAX_ATTEMPTS, DEFAULT_LOGIN_MAX_ATTEMPTS),
  windowMs: parsePositiveInt(env.LOGIN_WINDOW_SECONDS, DEFAULT_LOGIN_WINDOW_SECONDS) * 1000,
  lockMs: parsePositiveInt(env.LOGIN_LOCK_SECONDS, DEFAULT_LOGIN_LOCK_SECONDS) * 1000,
});

const getClientIp = (request) => {
  const forwarded = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "";
  return forwarded.split(",")[0].trim() || "unknown";
};

const getLoginAttempt = async (query, identifier, ip) => {
  const res = await query(
    `SELECT identifier, ip_address, attempt_count, first_attempt_at, locked_until
     FROM auth_login_attempts
     WHERE identifier = ? AND ip_address = ?
     LIMIT 1`,
    [identifier, ip],
  );
  return res.results?.[0] || null;
};

const clearLoginAttempt = async (run, identifier, ip) =>
  run(`DELETE FROM auth_login_attempts WHERE identifier = ? AND ip_address = ?`, [identifier, ip]);

const registerLoginFailure = async ({ query, run }, identifier, ip, policy, now = new Date()) => {
  const existing = await getLoginAttempt(query, identifier, ip);
  const nowMs = now.getTime();
  let firstAttemptAtMs = nowMs;
  let attemptCount = 1;
  if (existing?.first_attempt_at) {
    const existingFirst = new Date(existing.first_attempt_at).getTime();
    if (Number.isFinite(existingFirst) && nowMs - existingFirst <= policy.windowMs) {
      firstAttemptAtMs = existingFirst;
      attemptCount = (existing.attempt_count || 0) + 1;
    }
  }
  const lockedUntil =
    attemptCount >= policy.maxAttempts ? new Date(nowMs + policy.lockMs).toISOString() : null;
  await run(
    `INSERT INTO auth_login_attempts (identifier, ip_address, attempt_count, first_attempt_at, locked_until, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(identifier, ip_address)
     DO UPDATE SET attempt_count = excluded.attempt_count,
                   first_attempt_at = excluded.first_attempt_at,
                   locked_until = excluded.locked_until,
                   updated_at = CURRENT_TIMESTAMP`,
    [identifier, ip, attemptCount, new Date(firstAttemptAtMs).toISOString(), lockedUntil],
  );
  return { attemptCount, lockedUntil };
};

const hashRefreshTokenId = async (tokenId) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(tokenId));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const applyDateRangeClause = (clauses, params, column, from, to) => {
  if (from) {
    clauses.push(`${column} >= ?`);
    params.push(from);
  }
  if (to) {
    clauses.push(`${column} <= ?`);
    params.push(to);
  }
};

const startOfUtcDay = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const formatDate = (date) => date.toISOString().split("T")[0];

const parseBirthdate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildUpcomingBirthdays = (rows, windowDays = 30, today = new Date()) => {
  const todayUtc = startOfUtcDay(today);
  const todayYear = todayUtc.getUTCFullYear();
  const maxWindow = Number.isFinite(windowDays) ? Math.max(0, Math.min(windowDays, 366)) : 30;
  return rows
    .map((row) => {
      const birthdate = parseBirthdate(row.birthdate);
      if (!birthdate) return null;
      const month = birthdate.getUTCMonth();
      const day = birthdate.getUTCDate();
      let nextBirthday = new Date(Date.UTC(todayYear, month, day));
      if (nextBirthday < todayUtc) {
        nextBirthday = new Date(Date.UTC(todayYear + 1, month, day));
      }
      const daysUntil = Math.round((nextBirthday.getTime() - todayUtc.getTime()) / 86400000);
      if (daysUntil < 0 || daysUntil > maxWindow) return null;
      return {
        id: row.id,
        display_name: row.display_name,
        birthdate: row.birthdate,
        next_birthday: formatDate(nextBirthday),
        days_until: daysUntil,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.days_until - b.days_until || a.display_name.localeCompare(b.display_name));
};

const createBirthdayNotifications = async ({ query, run }, today = new Date()) => {
  const usersRes = await query(
    `SELECT users.id, users.display_name, COALESCE(user_profiles.birthdate, users.birthdate) AS birthdate
     FROM users
     LEFT JOIN user_profiles ON users.id = user_profiles.user_id
     WHERE role = 'athlete'
       AND is_active = 1
       AND COALESCE(user_profiles.birthdate, users.birthdate) IS NOT NULL
       AND COALESCE(user_profiles.birthdate, users.birthdate) != ''`,
  );
  const birthdays = buildUpcomingBirthdays(usersRes.results || [], 0, today);
  if (birthdays.length === 0) return { created: 0 };
  const todayStr = formatDate(startOfUtcDay(today));
  let createdCount = 0;
  for (const birthday of birthdays) {
    const existing = await query(
      `SELECT notification_targets.id
       FROM notification_targets
       JOIN notifications ON notification_targets.notification_id = notifications.id
       WHERE notifications.type = 'birthday'
         AND notification_targets.target_user_id = ?
         AND date(notifications.created_at) = ?
       LIMIT 1`,
      [birthday.id, todayStr],
    );
    if (existing.results?.length) {
      continue;
    }
    const notificationRes = await run(
      `INSERT INTO notifications (title, body, type, created_by, metadata)
       VALUES (?, ?, 'birthday', NULL, ?)`,
      [
        `Anniversaire : ${birthday.display_name}`,
        `Joyeux anniversaire ${birthday.display_name} !`,
        JSON.stringify({ kind: "birthday", user_id: birthday.id, date: todayStr }),
      ],
    );
    const notificationId = notificationRes.meta.last_row_id;
    await run(
      `INSERT INTO notification_targets (notification_id, target_user_id, target_group_id)
       VALUES (?, ?, NULL)`,
      [notificationId, birthday.id],
    );
    createdCount += 1;
  }
  return { created: createdCount };
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const method = request.method;
    const action = url.searchParams.get("action") || "";
    const passwordHashConfig = getPasswordHashConfig(env);
    const loginPolicy = getLoginPolicy(env);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Read request body once (Cloudflare Worker bodies are single-use streams)
    let __bodyLoaded = false;
    let __bodyCache = {};
    const getBody = async () => {
      if (__bodyLoaded) return __bodyCache;
      __bodyLoaded = true;

      if (method === "GET" || method === "HEAD") {
        __bodyCache = {};
        return __bodyCache;
      }

      const text = await request.text();
      if (!text) {
        __bodyCache = {};
        return __bodyCache;
      }
      try {
        __bodyCache = JSON.parse(text);
      } catch (error) {
        __bodyCache = {};
      }
      return __bodyCache;
    };


    const query = async (sql, params = []) => env.DB.prepare(sql).bind(...params).all();
    const run = async (sql, params = []) => env.DB.prepare(sql).bind(...params).run();
    let hasDisplayNameLowerColumn = null;

    if (method === "GET" && url.pathname === "/api/groups") {
      const res = await query(`SELECT id, name FROM DIM_groupes ORDER BY id ASC`);
      return responseOk({ groups: res.results || [] }, {}, 200, corsHeaders);
    }
    const tableExists = async (tableName) => {
      const res = await query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        [tableName],
      );
      return Boolean(res.results?.length);
    };
    const checkDisplayNameLowerColumn = async () => {
      if (hasDisplayNameLowerColumn !== null) return hasDisplayNameLowerColumn;
      const columnsRes = await query(`PRAGMA table_info(users)`);
      hasDisplayNameLowerColumn = Boolean(columnsRes.results?.some((column) => column.name === "display_name_lower"));
      return hasDisplayNameLowerColumn;
    };

    const requireAuth = (user) => {
      if (!user || !user.is_active) {
        return responseError("Unauthorized", "unauthorized", 401, corsHeaders);
      }
      return null;
    };

    const requireRole = (user, roles) => {
      if (user?.role === "admin") return null;
      if (!roles.includes(user?.role)) {
        return responseError("Forbidden", "forbidden", 403, corsHeaders);
      }
      return null;
    };

    const normalizeEventName = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

    const buildClubEventCode = (eventName) => {
      const normalized = normalizeEventName(eventName);
      const distanceMatch = normalized.match(/(\d{2,4})\s*M?/);
      if (!distanceMatch) return null;
      const distance = distanceMatch[1];
      let stroke = null;
      if (/4\s*N/.test(normalized) || /4N/.test(normalized) || /4\s*NAGES/.test(normalized) || /MEDLEY/.test(normalized)) {
        stroke = "IM";
      } else if (/DOS/.test(normalized)) {
        stroke = "BACK";
      } else if (/BRASSE/.test(normalized)) {
        stroke = "BREAST";
      } else if (/PAP/.test(normalized)) {
        stroke = "FLY";
      } else if (/NL/.test(normalized) || /NAGE\s*LIBRE/.test(normalized) || /LIBRE/.test(normalized)) {
        stroke = "FREE";
      }
      if (!stroke) return null;
      return `${distance}_${stroke}`;
    };

    const normalizeSex = (value) => {
      if (!value && value !== 0) return null;
      const normalized = String(value).trim().toUpperCase();
      if (normalized === "M" || normalized === "H" || normalized === "HOMME" || normalized === "MASCULIN") return "M";
      if (normalized === "F" || normalized === "FEMME" || normalized === "FEMININ" || normalized === "FÉMININ") return "F";
      return null;
    };

    const getMergedClubRecordSwimmers = async () => {
      const exists = await tableExists("club_record_swimmers");
      const usersRes = await query(
        `SELECT id, display_name, birthdate, ffn_iuf
         FROM users
         WHERE role = 'athlete' AND is_active = 1
         ORDER BY display_name ASC, id ASC`,
      );
      const users = usersRes.results || [];
      if (!exists) {
        return users.map((user) => ({
          id: null,
          source_type: "user",
          user_id: user.id,
          display_name: user.display_name,
          iuf: user.ffn_iuf ?? null,
          sex: null,
          birthdate: user.birthdate ?? null,
          is_active: 0,
          created_at: null,
          updated_at: null,
        }));
      }
      await run(
        `UPDATE club_record_swimmers
         SET iuf = (
           SELECT users.ffn_iuf
           FROM users
           WHERE users.id = club_record_swimmers.user_id
         )
         WHERE source_type = 'user'
           AND (iuf IS NULL OR iuf = '')
           AND user_id IN (
             SELECT id FROM users WHERE ffn_iuf IS NOT NULL AND ffn_iuf <> ''
           )`,
      );
      const userRecordsRes = await query(
        `SELECT id, user_id, display_name, iuf, sex, birthdate, is_active, created_at, updated_at
         FROM club_record_swimmers
         WHERE source_type = 'user' AND user_id IS NOT NULL`,
      );
      const manualRes = await query(
        `SELECT id, source_type, user_id, display_name, iuf, sex, birthdate, is_active, created_at, updated_at
         FROM club_record_swimmers
         WHERE source_type = 'manual'
         ORDER BY display_name ASC, id ASC`,
      );
      const userRecordMap = new Map(
        (userRecordsRes.results || []).map((row) => [Number(row.user_id), row]),
      );
      const userSwimmers = users.map((user) => {
        const userId = Number(user.id);
        const record = userRecordMap.get(userId);
        const recordIuf = record?.iuf;
        const effectiveIuf = isEmpty(recordIuf) ? user.ffn_iuf ?? null : recordIuf;
        return {
          id: record?.id ?? null,
          source_type: "user",
          user_id: userId,
          display_name: user.display_name,
          iuf: effectiveIuf ?? null,
          sex: record?.sex ?? null,
          birthdate: record?.birthdate ?? user.birthdate ?? null,
          is_active: record?.is_active ?? 0,
          created_at: record?.created_at ?? null,
          updated_at: record?.updated_at ?? null,
        };
      });
      return [...userSwimmers, ...(manualRes.results || [])];
    };

    const getExistingAdmin = async () => {
      const res = await query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
      return res.results?.[0] ?? null;
    };

    const resolveAthleteId = async (payload) => {
      const rawId = payload?.athlete_id ?? null;
      if (rawId !== null && rawId !== undefined && rawId !== "") {
        const candidate = Number(rawId);
        if (Number.isFinite(candidate)) {
          const res = await query(`SELECT id FROM users WHERE id = ? LIMIT 1`, [candidate]);
          if (res.results?.length) {
            return candidate;
          }
        }
        return null;
      }
      const athleteName = normalizeIdentifier(payload?.athleteName);
      if (!athleteName) return null;
      const athleteNameLower = athleteName.toLowerCase();
      const hasLowerColumn = await checkDisplayNameLowerColumn();
      const res = hasLowerColumn
        ? await query(`SELECT id FROM users WHERE display_name_lower = ? LIMIT 1`, [athleteNameLower])
        : await query(`SELECT id FROM users WHERE LOWER(display_name) = ? LIMIT 1`, [athleteNameLower]);
      if (res.results?.length) {
        return res.results[0].id;
      }
      const created = hasLowerColumn
        ? await run(
            `INSERT INTO users (first_name, last_name, display_name, display_name_lower, role, email, password_hash, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [null, null, athleteName, athleteNameLower, "athlete", null, null],
          )
        : await run(
            `INSERT INTO users (first_name, last_name, display_name, role, email, password_hash, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [null, null, athleteName, "athlete", null, null],
          );
      return created.meta.last_row_id ?? null;
    };

    const lookupAthleteId = async (payload) => {
      const rawId = payload?.athlete_id ?? null;
      if (rawId !== null && rawId !== undefined && rawId !== "") {
        const candidate = Number(rawId);
        if (Number.isFinite(candidate)) {
          const res = await query(`SELECT id FROM users WHERE id = ? LIMIT 1`, [candidate]);
          if (res.results?.length) {
            return candidate;
          }
        }
        return null;
      }
      const athleteName = normalizeIdentifier(payload?.athleteName);
      if (!athleteName) return null;
      const athleteNameLower = athleteName.toLowerCase();
      const hasLowerColumn = await checkDisplayNameLowerColumn();
      const res = hasLowerColumn
        ? await query(`SELECT id FROM users WHERE display_name_lower = ? LIMIT 1`, [athleteNameLower])
        : await query(`SELECT id FROM users WHERE LOWER(display_name) = ? LIMIT 1`, [athleteNameLower]);
      if (res.results?.length) {
        return res.results[0].id;
      }
      return null;
    };

    try {
      const sharedToken = env.SHARED_TOKEN || "";
      const authHeader = request.headers.get("Authorization") || "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
      const body = await getBody();
      const bodyToken = body?.token || "";
      const queryToken = url.searchParams.get("token") || "";
      const providedToken = bearerToken || bodyToken || queryToken;
      const isAuthAction = Boolean(action && action.startsWith("auth_"));
      const publicReadOnlyActions = new Set(["get", "hall", "strength_hall", "exercises", "dim_seance", "dim_seance_deroule"]);
      const jwtRequiredPrefixes = [
        "assignments_",
        "users_",
        "notifications_",
        "swim_catalog_",
        "strength_catalog_",
        "timesheet_",
      ];
      const requiresJwt = Boolean(action && jwtRequiredPrefixes.some((prefix) => action.startsWith(prefix)));
      const isPublicReadOnly = (method === "GET" && !action) || (method === "GET" && publicReadOnlyActions.has(action));
      const getAuthUser = async () => {
        const authSecret = env.AUTH_SECRET || "";
        if (!authSecret || !bearerToken) return null;
        const verification = await verifyToken(bearerToken, authSecret);
        if (!verification.valid || verification.payload.typ !== "access") return null;
        const userRes = await query(`SELECT * FROM users WHERE id = ?`, [verification.payload.sub]);
        return userRes.results?.[0] || null;
      };
      const authUser = await getAuthUser();

      if (!isAuthAction && requiresJwt && !authUser) {
        return responseError("Unauthorized", "unauthorized", 401, corsHeaders);
      }

      if (!isAuthAction && !isPublicReadOnly && sharedToken && !authUser && providedToken !== sharedToken) {
        return responseError("Unauthorized", "unauthorized", 401, corsHeaders);
      }
// --- NEW: Sync FFN swim records (MPP) by IUF ---
      if (method === "POST" && (url.pathname === "/api/swim/ffn/sync" || action === "swim_ffn_sync")) {
        const authError = requireAuth(authUser);
        if (authError) return authError;

        const body = await getBody();
        const iuf = normalizeIdentifier(body?.iuf);
        const athleteIdRaw = body?.athlete_id ?? body?.athleteId;
        const athleteNameRaw = body?.athlete_name ?? body?.athleteName;

        if (!iuf) {
          return responseError("Missing iuf", "missing_param", 400, corsHeaders);
        }
        if (!athleteIdRaw && !athleteNameRaw) {
          return responseError("Missing athlete_id or athlete_name", "missing_param", 400, corsHeaders);
        }

        const resolvedAthleteId = athleteIdRaw
          ? Number(athleteIdRaw)
          : await resolveAthleteId({ athleteName: normalizeIdentifier(athleteNameRaw) });

        if (!resolvedAthleteId || !Number.isFinite(resolvedAthleteId)) {
          return responseError("Invalid athlete", "invalid_param", 400, corsHeaders);
        }

        // RBAC inchangé : un athlete ne peut sync que lui-même
        if (authUser?.role === "athlete" && Number(authUser?.id) !== Number(resolvedAthleteId)) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }

        // Fetch FFN MPP (25 + 50)
        let fetched;
        try {
          fetched = await fetchFfnBestPerformancesByIuf(iuf, { activity: "nat" });
        } catch (e) {
          return responseError(
            `FFN fetch failed: ${String(e?.message || e)}`,
            "ffn_fetch_failed",
            502,
            corsHeaders
          );
          
        }

        // Dedupe by (event_name + pool_length) keep best time
        const bestByKey = new Map();
        for (const r of fetched || []) {
          const eventName = normalizeIdentifier(r?.event_name);
          const poolLength = Number(r?.pool_length);
          const timeSeconds = Number(r?.time_seconds);
          if (!eventName || !Number.isFinite(poolLength) || !Number.isFinite(timeSeconds)) continue;

          const key = `${eventName}__${poolLength}`;
          const existing = bestByKey.get(key);
          if (!existing || timeSeconds < existing.time_seconds) {
            bestByKey.set(key, {
              event_name: eventName,
              pool_length: poolLength,
              time_seconds: timeSeconds,
              record_date: r?.record_date || null,
              points: r?.points ?? null,
            });
          }
        }

        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        for (const rec of bestByKey.values()) {
          const ffn_points = rec.points != null && String(rec.points).trim() !== "" ? Number(rec.points) : null;
          const notes = "FFN";

          const existingRes = await query(
            `SELECT id, time_seconds, record_date, notes, ffn_points
             FROM swim_records
             WHERE athlete_id = ? AND event_name = ? AND pool_length = ?
               AND COALESCE(record_type, 'training') = 'comp'
             LIMIT 1`,
            [resolvedAthleteId, rec.event_name, rec.pool_length],
          );
          const existing = existingRes.results?.[0] || null;
          const finalNotes = existing?.notes ?? notes;
          const finalFfnPoints = ffn_points ?? (existing?.ffn_points ?? null);

          if (!existing) {
            await run(
              `INSERT INTO swim_records (athlete_id, event_name, pool_length, time_seconds, record_date, notes, ffn_points, record_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'comp')`,
              [
                resolvedAthleteId,
                rec.event_name,
                rec.pool_length,
                rec.time_seconds,
                rec.record_date,
                finalNotes,
                finalFfnPoints,
              ],
            );
            inserted += 1;
            continue;
          }

          const prev = existing.time_seconds != null ? Number(existing.time_seconds) : null;
          const isBetter = prev === null || (!Number.isNaN(prev) && rec.time_seconds < prev);
          if (!isBetter) {
            skipped += 1;
            continue;
          }

          await run(
            `UPDATE swim_records
             SET athlete_id = ?, event_name = ?, pool_length = ?, time_seconds = ?, record_date = ?, notes = ?, ffn_points = ?, record_type = 'comp'
             WHERE id = ?`,
            [
              resolvedAthleteId,
              rec.event_name,
              rec.pool_length,
              rec.time_seconds,
              rec.record_date,
              finalNotes,
              finalFfnPoints,
              existing.id,
            ],
          );
          updated += 1;
        }

        return responseOk({ inserted, updated, skipped }, {}, 200, corsHeaders);
      }
      if (method === "GET" && !action) {
        return responseOk({ status: "ok" }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "get") {
        const athleteName = normalizeIdentifier(url.searchParams.get("athleteName"));
        const athleteId = url.searchParams.get("athlete_id");
        if (!athleteName && !athleteId) {
          return responseError("Missing athleteName or athlete_id", "missing_param", 400, corsHeaders);
        }
        const res = athleteId
          ? await query(
              `SELECT * FROM DIM_sessions WHERE athlete_id = ? ORDER BY sessionDate DESC, id DESC`,
              [athleteId],
            )
          : await query(
              `SELECT * FROM DIM_sessions WHERE LOWER(athleteName) = ? ORDER BY sessionDate DESC, id DESC`,
              [athleteName.toLowerCase()],
            );
        return responseOk({ sessions: res.results }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "hall") {
        const days = Number(url.searchParams.get("days") || 30);
        const res = await query(
          `SELECT athleteName as athlete_name,
                  SUM(distance) as total_distance,
                  AVG(COALESCE(performance, 0)) as avg_performance,
                  AVG(COALESCE(engagement, 0)) as avg_engagement
           FROM DIM_sessions
           WHERE date(sessionDate) >= date('now', ?)
           GROUP BY athleteName
           ORDER BY total_distance DESC
           LIMIT 5`,
          [`-${days} days`],
        );
        return responseOk({ hall_of_fame: res.results }, { days }, 200, corsHeaders);
      }

      if (method === "GET" && action === "strength_hall") {
        const days = Number(url.searchParams.get("days") || 30);
        const res = await query(
          `SELECT COALESCE(users.display_name, 'Athlète ' || strength_session_runs.athlete_id) as athlete_name,
                  SUM(COALESCE(strength_set_logs.reps, 0) * COALESCE(strength_set_logs.weight, 0)) as total_volume,
                  SUM(COALESCE(strength_set_logs.reps, 0)) as total_reps,
                  COUNT(strength_set_logs.id) as total_sets,
                  MAX(COALESCE(strength_set_logs.weight, 0)) as max_weight
           FROM strength_set_logs
           JOIN strength_session_runs ON strength_session_runs.id = strength_set_logs.run_id
           LEFT JOIN users ON users.id = strength_session_runs.athlete_id
           WHERE strength_set_logs.completed_at IS NOT NULL
             AND date(strength_set_logs.completed_at) >= date('now', ?)
           GROUP BY strength_session_runs.athlete_id, users.display_name
           ORDER BY total_volume DESC
           LIMIT 5`,
          [`-${days} days`],
        );
        return responseOk({ strength: res.results }, { days }, 200, corsHeaders);
      }

      if (method === "GET" && url.pathname === "/api/records/swimmers") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach", "admin"]);
        if (roleError) return roleError;

        const swimmers = await getMergedClubRecordSwimmers();
        return responseOk({ swimmers }, {}, 200, corsHeaders);
      }

      if (method === "POST" && url.pathname === "/api/records/swimmers") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach", "admin"]);
        if (roleError) return roleError;

        const body = await getBody();
        const displayName = typeof body?.display_name === "string" ? body.display_name.trim() : "";
        const iuf = typeof body?.iuf === "string" ? body.iuf.trim() || null : body?.iuf ?? null;
        const sex = typeof body?.sex === "string" ? body.sex.trim().toUpperCase() : null;
        const birthdate = typeof body?.birthdate === "string" ? body.birthdate.trim() || null : null;
        const isActiveRaw = body?.is_active ?? body?.isActive;
        const isActive = isActiveRaw === undefined ? 1 : isActiveRaw ? 1 : 0;

        if (!displayName) {
          return responseError("Missing display_name", "missing_param", 400, corsHeaders);
        }
        if (sex && !["M", "F"].includes(sex)) {
          return responseError("Invalid sex", "invalid_param", 400, corsHeaders);
        }

        const insert = await run(
          `INSERT INTO club_record_swimmers (source_type, user_id, display_name, iuf, sex, birthdate, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ["manual", null, displayName, iuf, sex || null, birthdate, isActive],
        );
        const created = await query(
          `SELECT id, source_type, user_id, display_name, iuf, sex, birthdate, is_active, created_at, updated_at
           FROM club_record_swimmers
           WHERE id = ?`,
          [insert.meta.last_row_id],
        );
        return responseOk({ swimmer: created.results?.[0] ?? null }, {}, 201, corsHeaders);
      }

      if (method === "PATCH" && url.pathname.startsWith("/api/records/swimmers/user/")) {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach", "admin"]);
        if (roleError) return roleError;

        const idRaw = url.pathname.split("/").pop();
        const userId = Number(idRaw);
        if (!Number.isFinite(userId)) {
          return responseError("Invalid user id", "invalid_param", 400, corsHeaders);
        }

        const userRes = await query(
          `SELECT id, display_name, birthdate, ffn_iuf
           FROM users
           WHERE id = ? AND role = 'athlete' AND is_active = 1
           LIMIT 1`,
          [userId],
        );
        const user = userRes.results?.[0];
        if (!user) {
          return responseError("User not found", "not_found", 404, corsHeaders);
        }

        const body = await getBody();
        const iuf = typeof body?.iuf === "string" ? body.iuf.trim() || null : body?.iuf ?? null;
        const sex = typeof body?.sex === "string" ? body.sex.trim().toUpperCase() : undefined;
        const birthdate = typeof body?.birthdate === "string" ? body.birthdate.trim() || null : undefined;
        const isActiveRaw = body?.is_active ?? body?.isActive;
        const isActive = isActiveRaw === undefined ? undefined : isActiveRaw ? 1 : 0;

        if (sex && !["M", "F"].includes(sex)) {
          return responseError("Invalid sex", "invalid_param", 400, corsHeaders);
        }

        const existingRes = await query(
          `SELECT id FROM club_record_swimmers WHERE source_type = 'user' AND user_id = ? LIMIT 1`,
          [userId],
        );
        const existing = existingRes.results?.[0];

        if (!existing) {
          const initialIuf = body?.iuf !== undefined ? iuf : user.ffn_iuf ?? null;
          const initialActive = isActive !== undefined ? isActive : initialIuf ? 1 : 0;
          const insert = await run(
            `INSERT INTO club_record_swimmers (source_type, user_id, display_name, iuf, sex, birthdate, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              "user",
              userId,
              user.display_name,
              initialIuf,
              sex ?? null,
              birthdate ?? user.birthdate ?? null,
              initialActive,
            ],
          );
          if (body?.iuf !== undefined) {
            await run(`UPDATE users SET ffn_iuf = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
              initialIuf,
              userId,
            ]);
          }
          const created = await query(
            `SELECT id, source_type, user_id, display_name, iuf, sex, birthdate, is_active, created_at, updated_at
             FROM club_record_swimmers
             WHERE id = ?`,
            [insert.meta.last_row_id],
          );
          return responseOk({ swimmer: created.results?.[0] ?? null }, {}, 200, corsHeaders);
        }

        const updates = [];
        const params = [];
        if (body?.iuf !== undefined) {
          updates.push("iuf = ?");
          params.push(iuf);
        }
        if (sex !== undefined) {
          updates.push("sex = ?");
          params.push(sex || null);
        }
        if (birthdate !== undefined) {
          updates.push("birthdate = ?");
          params.push(birthdate);
        }
        if (isActive !== undefined) {
          updates.push("is_active = ?");
          params.push(isActive);
        }
        if (!updates.length) {
          return responseOk({ status: "no_changes" }, {}, 200, corsHeaders);
        }
        updates.push("updated_at = CURRENT_TIMESTAMP");
        params.push(existing.id);
        await run(
          `UPDATE club_record_swimmers SET ${updates.join(", ")} WHERE id = ?`,
          params,
        );
        if (body?.iuf !== undefined) {
          await run(`UPDATE users SET ffn_iuf = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
            iuf,
            userId,
          ]);
        }
        const updated = await query(
          `SELECT id, source_type, user_id, display_name, iuf, sex, birthdate, is_active, created_at, updated_at
           FROM club_record_swimmers
           WHERE id = ?`,
          [existing.id],
        );
        return responseOk({ swimmer: updated.results?.[0] ?? null }, {}, 200, corsHeaders);
      }

      if (method === "PATCH" && url.pathname.startsWith("/api/records/swimmers/")) {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach", "admin"]);
        if (roleError) return roleError;

        const idRaw = url.pathname.split("/").pop();
        const swimmerId = Number(idRaw);
        if (!Number.isFinite(swimmerId)) {
          return responseError("Invalid swimmer id", "invalid_param", 400, corsHeaders);
        }

        const body = await getBody();
        const iuf = typeof body?.iuf === "string" ? body.iuf.trim() || null : body?.iuf ?? null;
        const sex = typeof body?.sex === "string" ? body.sex.trim().toUpperCase() : undefined;
        const birthdate = typeof body?.birthdate === "string" ? body.birthdate.trim() || null : undefined;
        const isActiveRaw = body?.is_active ?? body?.isActive;
        const isActive = isActiveRaw === undefined ? undefined : isActiveRaw ? 1 : 0;

        if (sex && !["M", "F"].includes(sex)) {
          return responseError("Invalid sex", "invalid_param", 400, corsHeaders);
        }

        const updates = [];
        const params = [];
        if (body?.iuf !== undefined) {
          updates.push("iuf = ?");
          params.push(iuf);
        }
        if (sex !== undefined) {
          updates.push("sex = ?");
          params.push(sex || null);
        }
        if (birthdate !== undefined) {
          updates.push("birthdate = ?");
          params.push(birthdate);
        }
        if (isActive !== undefined) {
          updates.push("is_active = ?");
          params.push(isActive);
        }
        if (!updates.length) {
          return responseOk({ status: "no_changes" }, {}, 200, corsHeaders);
        }
        updates.push("updated_at = CURRENT_TIMESTAMP");
        params.push(swimmerId);
        await run(
          `UPDATE club_record_swimmers SET ${updates.join(", ")} WHERE id = ?`,
          params,
        );
        const updated = await query(
          `SELECT id, source_type, user_id, display_name, iuf, sex, birthdate, is_active, created_at, updated_at
           FROM club_record_swimmers
           WHERE id = ?`,
          [swimmerId],
        );
        const updatedRow = updated.results?.[0];
        if (body?.iuf !== undefined && updatedRow?.source_type === "user" && updatedRow?.user_id) {
          await run(`UPDATE users SET ffn_iuf = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
            updatedRow.iuf ?? null,
            updatedRow.user_id,
          ]);
        }
        return responseOk({ swimmer: updated.results?.[0] ?? null }, {}, 200, corsHeaders);
      }

      if (method === "POST" && url.pathname === "/api/records/import") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach", "admin"]);
        if (roleError) return roleError;

        const swimmersRes = await query(
          `SELECT id, display_name, iuf, sex, birthdate, is_active
           FROM club_record_swimmers
           WHERE is_active = 1
           ORDER BY display_name ASC`,
        );
        const swimmers = swimmersRes.results || [];
        const importId = crypto.randomUUID();
        const summary = {
          swimmers_total: swimmers.length,
          imported: 0,
          skipped: 0,
          errors: [],
        };

        for (const swimmer of swimmers) {
          const swimmerName = swimmer.display_name;
          const iuf = typeof swimmer.iuf === "string" ? swimmer.iuf.trim() : "";
          if (!iuf) {
            summary.skipped += 1;
            summary.errors.push({ swimmer: swimmerName, reason: "IUF manquant" });
            continue;
          }

          let performances = [];
          try {
            performances = await fetchFfnBestPerformancesByIuf(iuf);
          } catch (error) {
            summary.skipped += 1;
            summary.errors.push({ swimmer: swimmerName, reason: `FFN erreur: ${String(error?.message || error)}` });
            continue;
          }

          for (const perf of performances) {
            const eventCode = buildClubEventCode(perf?.event_name);
            if (!eventCode) {
              summary.skipped += 1;
              summary.errors.push({ swimmer: swimmerName, reason: `Épreuve inconnue: ${perf?.event_name || "-"}` });
              continue;
            }
            const timeSeconds = Number(perf?.time_seconds);
            if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) {
              summary.skipped += 1;
              summary.errors.push({ swimmer: swimmerName, reason: "Temps invalide" });
              continue;
            }
            const pool = Number(perf?.pool_length);
            if (!Number.isFinite(pool) || ![25, 50].includes(pool)) {
              summary.skipped += 1;
              summary.errors.push({ swimmer: swimmerName, reason: "Bassin invalide" });
              continue;
            }
            const perfAgeRaw = perf?.age ?? perf?.age_at_perf ?? perf?.ageAtPerf ?? perf?.age_at_performance;
            const age = perfAgeRaw != null ? Number(perfAgeRaw) : null;
            if (!Number.isFinite(age)) {
              summary.skipped += 1;
              summary.errors.push({ swimmer: swimmerName, reason: "Âge manquant sur la performance" });
              continue;
            }
            const sex = normalizeSex(perf?.sex) ?? normalizeSex(perf?.gender) ?? normalizeSex(swimmer.sex);
            if (!sex) {
              summary.skipped += 1;
              summary.errors.push({ swimmer: swimmerName, reason: "Sexe manquant" });
              continue;
            }
            const timeMs = Math.round(timeSeconds * 1000);
            await run(
              `INSERT INTO club_performances
               (athlete_name, sex, pool_m, event_code, event_label, age, time_ms, record_date, source, import_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                swimmerName,
                sex,
                pool,
                eventCode,
                perf.event_name,
                age,
                timeMs,
                perf.record_date || null,
                "ffn",
                importId,
              ],
            );
            summary.imported += 1;
          }
        }

        await run(`DELETE FROM club_records`);
        await run(
          `INSERT INTO club_records
           (performance_id, athlete_name, sex, pool_m, event_code, event_label, age, time_ms, record_date)
           SELECT id, athlete_name, sex, pool_m, event_code, event_label, age, time_ms, record_date
           FROM (
             SELECT *,
                    ROW_NUMBER() OVER (
                      PARTITION BY pool_m, sex, age, event_code
                      ORDER BY time_ms ASC, record_date ASC, id ASC
                    ) AS rn
             FROM club_performances
           )
           WHERE rn = 1`,
        );

        return responseOk({ summary }, {}, 200, corsHeaders);
      }

      if (method === "GET" && (url.pathname === "/api/records/club" || action === "records_club")) {
        const authError = requireAuth(authUser);
        if (authError) return authError;

        const poolRaw = url.searchParams.get("bassin") || url.searchParams.get("pool_m") || "";
        const sexRaw = url.searchParams.get("sexe") || url.searchParams.get("sex") || "";
        const ageRaw = url.searchParams.get("age") || "";
        const eventCode = url.searchParams.get("event_code") || url.searchParams.get("event") || "";

        const filters = [];
        const params = [];

        if (poolRaw) {
          const pool = Number(poolRaw);
          if (!Number.isFinite(pool)) {
            return responseError("Invalid bassin", "invalid_param", 400, corsHeaders);
          }
          filters.push("pool_m = ?");
          params.push(pool);
        }

        if (sexRaw) {
          const sex = sexRaw.trim().toUpperCase();
          if (!["M", "F"].includes(sex)) {
            return responseError("Invalid sex", "invalid_param", 400, corsHeaders);
          }
          filters.push("sex = ?");
          params.push(sex);
        }

        if (ageRaw) {
          const age = Number(ageRaw);
          if (!Number.isFinite(age)) {
            return responseError("Invalid age", "invalid_param", 400, corsHeaders);
          }
          filters.push("age = ?");
          params.push(age);
        }

        if (eventCode) {
          filters.push("event_code = ?");
          params.push(eventCode);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
        const res = await query(
          `SELECT id, performance_id, athlete_name, sex, pool_m, event_code, event_label, age, time_ms, record_date
           FROM club_records
           ${whereClause}
           ORDER BY event_code ASC, age ASC, time_ms ASC`,
          params,
        );
        return responseOk({ records: res.results }, { filters: { pool_m: poolRaw || null, sex: sexRaw || null, age: ageRaw || null, event_code: eventCode || null } }, 200, corsHeaders);
      }

      if (method === "GET" && action === "exercises") {
        const res = await query(
          `SELECT
            id,
            numero_exercice,
            nom_exercice,
            description,
            illustration_gif,
            exercise_type,
            Nb_series_endurance,
            Nb_reps_endurance,
            Pourcentage_charge_1RM_endurance AS pct_1rm_endurance,
            recup_series_endurance AS recup_endurance,
            recup_exercices_endurance,
            Nb_series_hypertrophie,
            Nb_reps_hypertrophie,
            Pourcentage_charge_1RM_hypertrophie AS pct_1rm_hypertrophie,
            recup_series_hypertrophie AS recup_hypertrophie,
            recup_exercices_hypertrophie,
            Nb_series_force,
            Nb_reps_force,
            Pourcentage_charge_1RM_force AS pct_1rm_force,
            recup_series_force AS recup_force,
            recup_exercices_force
          FROM DIM_exercices ORDER BY nom_exercice ASC`
          ,
        );
        return responseOk({ exercises: res.results }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "dim_seance") {
        const res = await query(`SELECT * FROM dim_seance ORDER BY numero_seance ASC`);
        return responseOk({ seances: res.results }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "dim_seance_deroule") {
        const numeroSeance = url.searchParams.get("numero_seance");
        if (!numeroSeance) {
          return responseError("Missing numero_seance", "missing_param", 400, corsHeaders);
        }
        const res = await query(
          `SELECT * FROM dim_seance_deroule WHERE numero_seance = ? ORDER BY ordre ASC`,
          [numeroSeance],
        );
        return responseOk({ items: res.results }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "auth_me") {
        const authSecret = env.AUTH_SECRET || "";
        if (!authSecret || !bearerToken) {
          return responseError("Unauthorized", "unauthorized", 401, corsHeaders);
        }
        const verification = await verifyToken(bearerToken, authSecret);
        if (!verification.valid || verification.payload.typ !== "access") {
          return responseError("Invalid token", "invalid_token", 401, corsHeaders);
        }
        const userRes = await query(
          `SELECT users.*, user_profiles.group_id,
                  COALESCE(DIM_groupes.name, user_profiles.group_label) AS group_label,
                  user_profiles.display_name AS profile_display_name,
                  user_profiles.email AS profile_email,
                  user_profiles.birthdate AS profile_birthdate,
                  user_profiles.objectives, user_profiles.bio, user_profiles.avatar_url
           FROM users
           LEFT JOIN user_profiles ON users.id = user_profiles.user_id
           LEFT JOIN DIM_groupes ON user_profiles.group_id = DIM_groupes.id
           WHERE users.id = ?`,
          [verification.payload.sub],
        );
        const user = userRes.results?.[0];
        if (!user) {
          return responseError("User not found", "not_found", 404, corsHeaders);
        }
        return responseOk({ user }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "capabilities") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const checkTables = async (tables) => {
          const missingTables = [];
          for (const table of tables) {
            const exists = await tableExists(table);
            if (!exists) {
              missingTables.push(table);
            }
          }
          return { available: missingTables.length === 0, missingTables };
        };
        const timesheet = await checkTables(["timesheet_shifts", "timesheet_locations"]);
        const messaging = await checkTables(["notifications", "notification_targets"]);
        return responseOk(
          {
            capabilities: { timesheet, messaging },
            version: env.APP_VERSION || null,
          },
          {},
          200,
          corsHeaders,
        );
      }

      const isSessionInsert = method === "POST" && (!action || action === "sync" || action === "save");

      if (isSessionInsert) {
        const requiredFields = ["athleteName", "sessionDate", "timeSlot", "duration", "rpe"];
        const missing = requiredFields.filter((field) => !body?.[field]);
        if (missing.length > 0) {
          return responseError(`Missing fields: ${missing.join(", ")}`, "missing_fields", 400, corsHeaders);
        }

        const athleteId = await resolveAthleteId(body);
        const insertResult = await run(
          `INSERT OR IGNORE INTO DIM_sessions (
            athlete_id,
            athleteName,
            timestamp_reception,
            sessionDate,
            timeSlot,
            distance,
            duration,
            rpe,
            performance,
            engagement,
            fatigue,
            training_load,
            comments,
            userAgent,
            raw_payload
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ,
          [
            athleteId,
            body.athleteName,
            new Date().toISOString(),
            body.sessionDate,
            body.timeSlot,
            body.distance ?? null,
            body.duration,
            body.rpe,
            body.performance ?? null,
            body.engagement ?? null,
            body.fatigue ?? null,
            body.training_load ?? null,
            body.comments || null,
            request.headers.get("User-Agent") || "",
            JSON.stringify(body),
          ],
        );
        const inserted = insertResult?.meta?.changes === 1;
        return responseOk({ status: "ok", inserted }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "exercises_add") {
        await run(
          `INSERT INTO DIM_exercices (
            numero_exercice,
            nom_exercice,
            description,
            illustration_gif,
            exercise_type,
            Nb_series_endurance,
            Nb_reps_endurance,
            Pourcentage_charge_1RM_endurance,
            recup_series_endurance,
            recup_exercices_endurance,
            Nb_series_hypertrophie,
            Nb_reps_hypertrophie,
            Pourcentage_charge_1RM_hypertrophie,
            recup_series_hypertrophie,
            recup_exercices_hypertrophie,
            Nb_series_force,
            Nb_reps_force,
            Pourcentage_charge_1RM_force,
            recup_series_force,
            recup_exercices_force
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ,
          [
            body.numero_exercice ?? null,
            body.nom_exercice,
            body.description ?? null,
            body.illustration_gif ?? null,
            body.exercise_type || "strength",
            body.Nb_series_endurance ?? null,
            body.Nb_reps_endurance ?? null,
            body.pct_1rm_endurance ?? null,
            body.recup_endurance ?? null,
            body.recup_exercices_endurance ?? null,
            body.Nb_series_hypertrophie ?? null,
            body.Nb_reps_hypertrophie ?? null,
            body.pct_1rm_hypertrophie ?? null,
            body.recup_hypertrophie ?? null,
            body.recup_exercices_hypertrophie ?? null,
            body.Nb_series_force ?? null,
            body.Nb_reps_force ?? null,
            body.pct_1rm_force ?? null,
            body.recup_force ?? null,
            body.recup_exercices_force ?? null,
          ],
        );
        return responseOk({ status: "ok" }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "exercises_update") {
        if (!body?.id) {
          return responseError("Missing id", "missing_param", 400, corsHeaders);
        }
        const fields = {
          numero_exercice: body.numero_exercice,
          nom_exercice: body.nom_exercice,
          description: body.description,
          illustration_gif: body.illustration_gif,
          exercise_type: body.exercise_type,
          Nb_series_endurance: body.Nb_series_endurance,
          Nb_reps_endurance: body.Nb_reps_endurance,
          Pourcentage_charge_1RM_endurance: body.pct_1rm_endurance,
          recup_series_endurance: body.recup_endurance,
          recup_exercices_endurance: body.recup_exercices_endurance,
          Nb_series_hypertrophie: body.Nb_series_hypertrophie,
          Nb_reps_hypertrophie: body.Nb_reps_hypertrophie,
          Pourcentage_charge_1RM_hypertrophie: body.pct_1rm_hypertrophie,
          recup_series_hypertrophie: body.recup_hypertrophie,
          recup_exercices_hypertrophie: body.recup_exercices_hypertrophie,
          Nb_series_force: body.Nb_series_force,
          Nb_reps_force: body.Nb_reps_force,
          Pourcentage_charge_1RM_force: body.pct_1rm_force,
          recup_series_force: body.recup_force,
          recup_exercices_force: body.recup_exercices_force,
        };
        const updates = Object.entries(fields)
          .filter(([, value]) => value !== undefined)
          .map(([key]) => `${key} = ?`);
        const values = Object.entries(fields)
          .filter(([, value]) => value !== undefined)
          .map(([, value]) => value);

        if (updates.length === 0) {
          return responseError("No fields to update", "missing_param", 400, corsHeaders);
        }

        await run(
          `UPDATE DIM_exercices SET ${updates.join(", ")} WHERE id = ?`,
          [...values, body.id],
        );
        return responseOk({ status: "ok" }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "exercises_delete") {
        if (!body?.id) {
          return responseError("Missing id", "missing_param", 400, corsHeaders);
        }
        await run(`DELETE FROM DIM_exercices WHERE id = ?`, [body.id]);
        return responseOk({ status: "ok" }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "dim_seance_deroule_add") {
        if (!body?.numero_seance || body?.ordre === undefined || !body?.numero_exercice) {
          return responseError("Missing fields", "missing_param", 400, corsHeaders);
        }
        await run(
          `INSERT INTO dim_seance_deroule (numero_seance, ordre, numero_exercice) VALUES (?, ?, ?)`
          ,
          [body.numero_seance, body.ordre, body.numero_exercice],
        );
        return responseOk({ status: "ok" }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "dim_seance_deroule_replace") {
        if (!body?.numero_seance || !Array.isArray(body?.items)) {
          return responseError("Missing numero_seance or items", "missing_param", 400, corsHeaders);
        }
        await run(`DELETE FROM dim_seance_deroule WHERE numero_seance = ?`, [body.numero_seance]);
        for (const item of body.items) {
          await run(
            `INSERT INTO dim_seance_deroule (numero_seance, ordre, numero_exercice) VALUES (?, ?, ?)`
            ,
            [body.numero_seance, item.ordre, item.numero_exercice],
          );
        }
        return responseOk({ status: "ok" }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "auth_login_precheck") {
        const { identifier } = body || {};
        const normalizedIdentifier = normalizeIdentifier(identifier);
        if (!normalizedIdentifier) {
          return responseError("Missing identifier", "missing_param", 400, corsHeaders);
        }
        const identifierLower = normalizedIdentifier.toLowerCase();
        const clientIp = getClientIp(request);
        const now = new Date();
        const attempt = await getLoginAttempt(query, identifierLower, clientIp);
        if (attempt?.locked_until) {
          const lockedUntil = new Date(attempt.locked_until);
          if (Number.isFinite(lockedUntil.getTime()) && lockedUntil > now) {
            return responseError("Too many attempts. Try again later.", "rate_limited", 429, corsHeaders);
          }
        }
        const hasLowerColumn = await checkDisplayNameLowerColumn();
        const userRes = hasLowerColumn
          ? await query(
              `SELECT role FROM users WHERE LOWER(email) = ? OR display_name_lower = ? LIMIT 1`,
              [identifierLower, identifierLower],
            )
          : await query(
              `SELECT role FROM users WHERE LOWER(email) = ? OR LOWER(display_name) = ? LIMIT 1`,
              [identifierLower, identifierLower],
            );
        const user = userRes.results?.[0];
        const accountExists = Boolean(user);
        const requiresPassword = user ? requiresPasswordForRole(user.role) : false;
        return responseOk({ requiresPassword, accountExists }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "auth_login") {
        const { identifier, password } = body || {};
        const normalizedIdentifier = normalizeIdentifier(identifier);
        if (!normalizedIdentifier) {
          return responseError("Missing identifier", "missing_param", 400, corsHeaders);
        }
        if (isEmpty(password)) {
          return responseError("Mot de passe requis.", "missing_param", 400, corsHeaders);
        }
        const authSecret = env.AUTH_SECRET || "";
        if (!authSecret) {
          return responseError("AUTH_SECRET not configured", "config_error", 500, corsHeaders);
        }
        const identifierLower = normalizedIdentifier.toLowerCase();
        const clientIp = getClientIp(request);
        const now = new Date();
        const attempt = await getLoginAttempt(query, identifierLower, clientIp);
        if (attempt?.locked_until) {
          const lockedUntil = new Date(attempt.locked_until);
          if (Number.isFinite(lockedUntil.getTime()) && lockedUntil > now) {
            return responseError("Too many attempts. Try again later.", "rate_limited", 429, corsHeaders);
          }
        }
        const hasLowerColumn = await checkDisplayNameLowerColumn();
        const userRes = hasLowerColumn
          ? await query(
              `SELECT * FROM users WHERE LOWER(email) = ? OR display_name_lower = ? LIMIT 1`,
              [identifierLower, identifierLower],
            )
          : await query(
              `SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(display_name) = ? LIMIT 1`,
              [identifierLower, identifierLower],
            );
        let user = userRes.results?.[0];
        if (!user) {
          const failure = await registerLoginFailure(
            { query, run },
            identifierLower,
            clientIp,
            loginPolicy,
            now,
          );
          if (failure.lockedUntil) {
            return responseError("Too many attempts. Try again later.", "rate_limited", 429, corsHeaders);
          }
          return responseError(
            "Ce compte n'existe pas, voulez-vous créer un nouveau compte ?",
            "account_not_found",
            404,
            corsHeaders,
          );
        } else if (requiresPasswordForRole(user.role)) {
          if (!password) {
            return responseError("Mot de passe requis pour ce compte.", "missing_param", 400, corsHeaders);
          }
          if (user.password_hash) {
            const verification = await verifyPassword(password, user.password_hash, passwordHashConfig);
            if (!verification.valid) {
              const failure = await registerLoginFailure(
                { query, run },
                identifierLower,
                clientIp,
                loginPolicy,
                now,
              );
              if (failure.lockedUntil) {
                return responseError("Too many attempts. Try again later.", "rate_limited", 429, corsHeaders);
              }
              return responseError("Invalid credentials", "invalid_credentials", 401, corsHeaders);
            }
            if (verification.needsUpgrade && verification.newHash) {
              await run(`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
                verification.newHash,
                user.id,
              ]);
            }
          } else if (password) {
            const passwordHash = await hashPassword(password, passwordHashConfig);
            await run(`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
              passwordHash,
              user.id,
            ]);
            const updated = await query(`SELECT * FROM users WHERE id = ?`, [user.id]);
            user = updated.results?.[0];
          }
        }

        await clearLoginAttempt(run, identifierLower, clientIp);

        const refreshTokenId = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
        const refreshToken = await signToken(
          { sub: user.id, jti: refreshTokenId },
          authSecret,
          60 * 60 * 24 * 30,
          "refresh",
        );
        await run(
          `INSERT INTO refresh_tokens (id, user_id, issued_at, expires_at, token_hash)
           VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now', '+30 days'), ?)`,
          [refreshTokenId, user.id, await hashRefreshTokenId(refreshTokenId)],
        );
        const accessToken = await signToken({ sub: user.id }, authSecret, 60 * 15, "access");

        return responseOk({ user, access_token: accessToken, refresh_token: refreshToken }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "auth_refresh") {
        const authSecret = env.AUTH_SECRET || "";
        const token = body?.refresh_token || bearerToken;
        if (!authSecret || !token) {
          return responseError("Missing refresh token", "missing_param", 400, corsHeaders);
        }
        const verification = await verifyToken(token, authSecret);
        if (!verification.valid || verification.payload.typ !== "refresh") {
          return responseError("Invalid refresh token", "invalid_token", 401, corsHeaders);
        }
        if (!verification.payload.jti) {
          return responseError("Invalid refresh token", "invalid_token", 401, corsHeaders);
        }
        const userRes = await query(`SELECT * FROM users WHERE id = ?`, [verification.payload.sub]);
        const user = userRes.results?.[0];
        if (!user || !user.is_active) {
          return responseError("User not found", "not_found", 404, corsHeaders);
        }
        const storedTokenRes = await query(
          `SELECT id, expires_at, revoked_at FROM refresh_tokens WHERE id = ? AND user_id = ? LIMIT 1`,
          [verification.payload.jti, user.id],
        );
        const storedToken = storedTokenRes.results?.[0];
        if (!storedToken || storedToken.revoked_at) {
          return responseError("Invalid refresh token", "invalid_token", 401, corsHeaders);
        }
        const expiresAt = storedToken.expires_at ? new Date(storedToken.expires_at) : null;
        if (expiresAt && expiresAt < new Date()) {
          return responseError("Refresh token expired", "invalid_token", 401, corsHeaders);
        }
        const newRefreshTokenId = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
        const newRefreshToken = await signToken(
          { sub: user.id, jti: newRefreshTokenId },
          authSecret,
          60 * 60 * 24 * 30,
          "refresh",
        );
        await run(
          `INSERT INTO refresh_tokens (id, user_id, issued_at, expires_at, token_hash)
           VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now', '+30 days'), ?)`,
          [newRefreshTokenId, user.id, await hashRefreshTokenId(newRefreshTokenId)],
        );
        await run(
          `UPDATE refresh_tokens
           SET revoked_at = CURRENT_TIMESTAMP, replaced_by = ?
           WHERE id = ? AND user_id = ?`,
          [newRefreshTokenId, verification.payload.jti, user.id],
        );
        const accessToken = await signToken({ sub: user.id }, authSecret, 60 * 15, "access");
        return responseOk({ access_token: accessToken, refresh_token: newRefreshToken }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "auth_logout") {
        const authSecret = env.AUTH_SECRET || "";
        const token = body?.refresh_token || bearerToken;
        if (authSecret && token) {
          const verification = await verifyToken(token, authSecret);
          if (verification.valid && verification.payload.typ === "refresh" && verification.payload.jti) {
            await run(
              `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
              [verification.payload.jti, verification.payload.sub],
            );
          }
        }
        return responseOk({ status: "ok" }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "auth_register") {
        const { identifier, password, group_id, birthdate, email } = body || {};
        const normalizedIdentifier = normalizeIdentifier(identifier);
        if (!normalizedIdentifier) {
          return responseError("Missing identifier", "missing_param", 400, corsHeaders);
        }
        if (isEmpty(password)) {
          return responseError("Missing password", "missing_param", 400, corsHeaders);
        }
        if (isEmpty(group_id)) {
          return responseError("Missing group_id", "missing_param", 400, corsHeaders);
        }
        if (isEmpty(birthdate)) {
          return responseError("Missing birthdate", "missing_param", 400, corsHeaders);
        }
        const authSecret = env.AUTH_SECRET || "";
        if (!authSecret) {
          return responseError("AUTH_SECRET not configured", "config_error", 500, corsHeaders);
        }
        const parsedBirthdate = parseBirthdate(birthdate);
        if (!parsedBirthdate) {
          return responseError("Invalid birthdate", "invalid_param", 400, corsHeaders);
        }
        const groupRes = await query(`SELECT id FROM DIM_groupes WHERE id = ?`, [group_id]);
        if (!groupRes.results?.length) {
          return responseError("Group not found", "not_found", 404, corsHeaders);
        }
        const identifierLower = normalizedIdentifier.toLowerCase();
        const hasLowerColumn = await checkDisplayNameLowerColumn();
        const existingRes = hasLowerColumn
          ? await query(
              `SELECT id FROM users WHERE LOWER(email) = ? OR display_name_lower = ? LIMIT 1`,
              [identifierLower, identifierLower],
            )
          : await query(
              `SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(display_name) = ? LIMIT 1`,
              [identifierLower, identifierLower],
            );
        if (existingRes.results?.length) {
          return responseError("Account already exists", "already_exists", 409, corsHeaders);
        }
        const displayName = normalizedIdentifier;
        const displayNameLower = displayName.toLowerCase();
        const passwordHash = await hashPassword(password, passwordHashConfig);
        const emailValue = email || (displayName.includes("@") ? displayName : null);
        const birthdateValue = formatDate(parsedBirthdate);
        const createRes = hasLowerColumn
          ? await run(
              `INSERT INTO users (first_name, last_name, display_name, display_name_lower, role, email, password_hash, birthdate, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [null, null, displayName, displayNameLower, "athlete", emailValue, passwordHash, birthdateValue],
            )
          : await run(
              `INSERT INTO users (first_name, last_name, display_name, role, email, password_hash, birthdate, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
              [null, null, displayName, "athlete", emailValue, passwordHash, birthdateValue],
            );
        const userId = createRes.meta.last_row_id;
        await run(
          `INSERT INTO user_profiles (user_id, group_id, display_name, email, birthdate)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             group_id = excluded.group_id,
             display_name = excluded.display_name,
             email = excluded.email,
             birthdate = excluded.birthdate,
             updated_at = CURRENT_TIMESTAMP`,
          [userId, group_id, displayName, emailValue, birthdateValue],
        );
        const createdUserRes = await query(`SELECT * FROM users WHERE id = ?`, [userId]);
        const user = createdUserRes.results?.[0];
        await clearLoginAttempt(run, identifierLower, getClientIp(request));

        const refreshTokenId = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
        const refreshToken = await signToken(
          { sub: userId, jti: refreshTokenId },
          authSecret,
          60 * 60 * 24 * 30,
          "refresh",
        );
        await run(
          `INSERT INTO refresh_tokens (id, user_id, issued_at, expires_at, token_hash)
           VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now', '+30 days'), ?)`,
          [refreshTokenId, userId, await hashRefreshTokenId(refreshTokenId)],
        );
        const accessToken = await signToken({ sub: userId }, authSecret, 60 * 15, "access");

        return responseOk({ user, access_token: accessToken, refresh_token: refreshToken }, {}, 201, corsHeaders);
      }

      if (method === "POST" && action === "auth_password_update") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const targetIdRaw = body?.user_id ?? authUser.id;
        const targetId = Number(targetIdRaw);
        if (!Number.isFinite(targetId)) {
          return responseError("Invalid user_id", "invalid_param", 400, corsHeaders);
        }
        if (targetId !== authUser.id && authUser.role !== "admin") {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const password = body?.password;
        if (isEmpty(password)) {
          return responseError("Missing password", "missing_param", 400, corsHeaders);
        }
        const userRes = await query(`SELECT id FROM users WHERE id = ? AND is_active = 1`, [targetId]);
        if (!userRes.results?.length) {
          return responseError("User not found", "not_found", 404, corsHeaders);
        }
        const passwordHash = await hashPassword(password, passwordHashConfig);
        await run(`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
          passwordHash,
          targetId,
        ]);
        return responseOk({ status: "updated" }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "users_get") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const userId = url.searchParams.get("user_id");
        const displayName = url.searchParams.get("display_name");
        const lookupId = userId ? Number(userId) : null;
        if (userId && !Number.isFinite(lookupId)) {
          return responseError("Invalid user_id", "invalid_param", 400, corsHeaders);
        }
        if (!lookupId && !displayName && !authUser) {
          return responseError("Missing user_id or display_name", "missing_param", 400, corsHeaders);
        }
        const targetQuery = lookupId || displayName ? "users.id = ? OR users.display_name = ?" : "users.id = ?";
        const params = lookupId || displayName ? [lookupId || null, displayName || null] : [authUser.id];
        const res = await query(
          `SELECT users.*, user_profiles.group_id,
                  COALESCE(DIM_groupes.name, user_profiles.group_label) AS group_label,
                  user_profiles.display_name AS profile_display_name,
                  user_profiles.email AS profile_email,
                  user_profiles.birthdate AS profile_birthdate,
                  user_profiles.objectives, user_profiles.bio, user_profiles.avatar_url
           FROM users
           LEFT JOIN user_profiles ON users.id = user_profiles.user_id
           LEFT JOIN DIM_groupes ON user_profiles.group_id = DIM_groupes.id
           WHERE ${targetQuery}
           LIMIT 1`,
          params,
        );
        const user = res.results?.[0];
        if (!user) {
          return responseError("User not found", "not_found", 404, corsHeaders);
        }
        if (authUser.role !== "admin" && user.id !== authUser.id) {
          const roleError = requireRole(authUser, ["coach"]);
          if (roleError) return roleError;
        }
        return responseOk({ user }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "users_list") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const role = normalizeIdentifierLower(url.searchParams.get("role") || "athlete");
        const includeInactive = url.searchParams.get("include_inactive") === "1";
        if (!ensureEnum(role, ["athlete", "coach", "comite", "admin"])) {
          return responseError("Invalid role", "invalid_param", 400, corsHeaders);
        }
        if (role !== "athlete" && authUser.role !== "admin") {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const allowInactive = includeInactive && authUser.role === "admin";
        const hasLowerColumn = await checkDisplayNameLowerColumn();
        const orderBy = hasLowerColumn ? "users.display_name_lower" : "LOWER(users.display_name)";
        const whereClause = allowInactive ? "users.role = ?" : "users.role = ? AND users.is_active = 1";
        const res = await query(
          `SELECT users.id, users.display_name, users.role, users.email, users.is_active,
                  user_profiles.group_id,
                  COALESCE(DIM_groupes.name, user_profiles.group_label) AS group_label,
                  user_profiles.objectives, user_profiles.bio, user_profiles.avatar_url
           FROM users
           LEFT JOIN user_profiles ON users.id = user_profiles.user_id
           LEFT JOIN DIM_groupes ON user_profiles.group_id = DIM_groupes.id
           WHERE ${whereClause}
           ORDER BY ${orderBy} ASC`,
          [role],
        );
        return responseOk({ users: res.results }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "users_create") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const { display_name, role, email, password, profile } = body || {};
        if (isEmpty(display_name) || isEmpty(role)) {
          return responseError("Missing display_name or role", "missing_param", 400, corsHeaders);
        }
        if (!ensureEnum(role, ["athlete", "coach", "comite", "admin"])) {
          return responseError("Invalid role", "invalid_param", 400, corsHeaders);
        }
        if (role === "admin" && authUser.role !== "admin") {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        if (role === "admin") {
          const existingAdmin = await getExistingAdmin();
          if (existingAdmin) {
            return responseError("Admin already exists", "admin_exists", 409, corsHeaders);
          }
        }
        const displayName = normalizeIdentifier(display_name);
        const displayNameLower = displayName.toLowerCase();
        const shouldGeneratePassword = role === "coach" && isEmpty(password);
        const initialPassword = shouldGeneratePassword ? generatePassword() : null;
        const passwordSource = shouldGeneratePassword ? initialPassword : password;
        const passwordHash = passwordSource ? await hashPassword(passwordSource, passwordHashConfig) : null;
        const hasLowerColumn = await checkDisplayNameLowerColumn();
        const createRes = hasLowerColumn
          ? await run(
              `INSERT INTO users (first_name, last_name, display_name, display_name_lower, role, email, password_hash, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
              [null, null, displayName, displayNameLower, role, email || null, passwordHash],
            )
          : await run(
              `INSERT INTO users (first_name, last_name, display_name, role, email, password_hash, is_active)
               VALUES (?, ?, ?, ?, ?, ?, 1)`,
              [null, null, displayName, role, email || null, passwordHash],
            );
        const userId = createRes.meta.last_row_id;
        if (profile) {
          const profileFields = {
            group_id: profile.group_id,
            group_label: profile.group_label,
            display_name: profile.display_name,
            email: profile.email,
            birthdate: profile.birthdate,
            objectives: profile.objectives,
            bio: profile.bio,
            avatar_url: profile.avatar_url,
          };
          const profileUpdates = Object.entries(profileFields)
            .filter(([, value]) => value !== undefined)
            .map(([key]) => `${key} = ?`);
          const profileValues = Object.entries(profileFields)
            .filter(([, value]) => value !== undefined)
            .map(([, value]) => value);
          if (profileUpdates.length) {
            await run(
              `INSERT INTO user_profiles (user_id, ${profileUpdates
                .map((update) => update.split(" = ")[0])
                .join(", ")})
               VALUES (${["?"].concat(profileValues.map(() => "?")).join(", ")})
               ON CONFLICT(user_id) DO UPDATE SET ${profileUpdates.join(", ")}, updated_at = CURRENT_TIMESTAMP`,
              [userId, ...profileValues, ...profileValues],
            );
          }
        }
        const created = await query(
          `SELECT users.*, user_profiles.group_id,
                  COALESCE(DIM_groupes.name, user_profiles.group_label) AS group_label,
                  user_profiles.display_name AS profile_display_name,
                  user_profiles.email AS profile_email,
                  user_profiles.birthdate AS profile_birthdate,
                  user_profiles.objectives, user_profiles.bio, user_profiles.avatar_url
           FROM users
           LEFT JOIN user_profiles ON users.id = user_profiles.user_id
           LEFT JOIN DIM_groupes ON user_profiles.group_id = DIM_groupes.id
           WHERE users.id = ?`,
          [userId],
        );
        return responseOk({ user: created.results?.[0], initial_password: initialPassword }, {}, 201, corsHeaders);
      }

      if (method === "POST" && action === "users_update") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const targetIdRaw = body?.user_id || authUser.id;
        const targetId = Number(targetIdRaw);
        if (!Number.isFinite(targetId)) {
          return responseError("Invalid user_id", "invalid_param", 400, corsHeaders);
        }
        if (body?.role !== undefined && authUser.role !== "admin") {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        if (targetId !== authUser.id && authUser.role !== "admin") {
          const roleError = requireRole(authUser, ["coach"]);
          if (roleError) return roleError;
        }
        const role = body?.role;
        if (role !== undefined && isEmpty(role)) {
          return responseError("Missing role", "missing_param", 400, corsHeaders);
        }
        if (role !== undefined && !ensureEnum(role, ["athlete", "coach", "comite", "admin"])) {
          return responseError("Invalid role", "invalid_param", 400, corsHeaders);
        }
        if (role === "admin") {
          const existingAdmin = await getExistingAdmin();
          if (existingAdmin && Number(existingAdmin.id) !== targetId) {
            return responseError("Admin already exists", "admin_exists", 409, corsHeaders);
          }
        }
        const profileGroupId = body?.profile?.group_id;
        if (profileGroupId !== undefined && profileGroupId !== null && profileGroupId !== "") {
          const normalizedGroupId = Number(profileGroupId);
          if (!Number.isFinite(normalizedGroupId)) {
            return responseError("Invalid group_id", "invalid_param", 400, corsHeaders);
          }
          const groupRes = await query(`SELECT id FROM DIM_groupes WHERE id = ?`, [normalizedGroupId]);
          if (!groupRes.results?.length) {
            return responseError("Group not found", "not_found", 404, corsHeaders);
          }
        }
        const displayName = body?.display_name;
        const displayNameLower = displayName !== undefined ? normalizeIdentifierLower(displayName) : undefined;
        const hasLowerColumn = await checkDisplayNameLowerColumn();
        const fields = {
          display_name: displayName,
          ...(hasLowerColumn ? { display_name_lower: displayNameLower } : {}),
          email: body?.email,
          birthdate: body?.birthdate,
          ffn_iuf: (typeof (body?.profile?.ffn_iuf ?? body?.ffn_iuf) === "string"
            ? ((body?.profile?.ffn_iuf ?? body?.ffn_iuf).trim() || null)
            : (body?.profile?.ffn_iuf ?? body?.ffn_iuf)),
          role,
          updated_at: "CURRENT_TIMESTAMP",
        };
        const updates = Object.entries(fields)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => (value === "CURRENT_TIMESTAMP" ? `${key} = CURRENT_TIMESTAMP` : `${key} = ?`));
        const values = Object.entries(fields)
          .filter(([, value]) => value !== undefined && value !== "CURRENT_TIMESTAMP")
          .map(([, value]) => value);
        if (updates.length > 0) {
          await run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, [...values, targetId]);
        }
        if (body?.profile) {
          const profileFields = {
            group_id: body.profile.group_id,
            group_label: body.profile.group_label,
            display_name: body.profile.display_name,
            email: body.profile.email,
            birthdate: body.profile.birthdate,
            objectives: body.profile.objectives,
            bio: body.profile.bio,
            avatar_url: body.profile.avatar_url,
          };
          const profileUpdates = Object.entries(profileFields)
            .filter(([, value]) => value !== undefined)
            .map(([key]) => `${key} = ?`);
          const profileValues = Object.entries(profileFields)
            .filter(([, value]) => value !== undefined)
            .map(([, value]) => value);
          if (profileUpdates.length) {
            await run(
              `INSERT INTO user_profiles (user_id, ${profileUpdates
                .map((update) => update.split(" = ")[0])
                .join(", ")})
               VALUES (${["?"].concat(profileValues.map(() => "?")).join(", ")})
               ON CONFLICT(user_id) DO UPDATE SET ${profileUpdates.join(", ")}, updated_at = CURRENT_TIMESTAMP`,
              [targetId, ...profileValues, ...profileValues],
            );
          }
        }
        const updated = await query(
          `SELECT users.*, user_profiles.group_id,
                  COALESCE(DIM_groupes.name, user_profiles.group_label) AS group_label,
                  user_profiles.display_name AS profile_display_name,
                  user_profiles.email AS profile_email,
                  user_profiles.birthdate AS profile_birthdate,
                  user_profiles.objectives, user_profiles.bio, user_profiles.avatar_url
           FROM users
           LEFT JOIN user_profiles ON users.id = user_profiles.user_id
           LEFT JOIN DIM_groupes ON user_profiles.group_id = DIM_groupes.id
           WHERE users.id = ?`,
          [targetId],
        );
        return responseOk({ user: updated.results?.[0] }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "users_delete") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        if (authUser.role !== "admin") {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const targetIdRaw = body?.user_id;
        const targetId = Number(targetIdRaw);
        if (!Number.isFinite(targetId)) {
          return responseError("Invalid user_id", "invalid_param", 400, corsHeaders);
        }
        if (targetId === authUser.id) {
          return responseError("Cannot disable self", "invalid_action", 400, corsHeaders);
        }
        const targetRes = await query(`SELECT id, role FROM users WHERE id = ? LIMIT 1`, [targetId]);
        const targetUser = targetRes.results?.[0];
        if (!targetUser) {
          return responseError("User not found", "not_found", 404, corsHeaders);
        }
        if (targetUser.role === "admin") {
          return responseError("Cannot disable admin", "invalid_action", 400, corsHeaders);
        }
        await run(`UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [targetId]);
        const updated = await query(
          `SELECT users.*, user_profiles.group_id,
                  COALESCE(DIM_groupes.name, user_profiles.group_label) AS group_label,
                  user_profiles.display_name AS profile_display_name,
                  user_profiles.email AS profile_email,
                  user_profiles.birthdate AS profile_birthdate,
                  user_profiles.objectives, user_profiles.bio, user_profiles.avatar_url
           FROM users
           LEFT JOIN user_profiles ON users.id = user_profiles.user_id
           LEFT JOIN DIM_groupes ON user_profiles.group_id = DIM_groupes.id
           WHERE users.id = ?`,
          [targetId],
        );
        return responseOk({ user: updated.results?.[0] }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "timesheet_locations") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach", "comite"]);
        if (roleError) return roleError;
        const locationsRes = await query(
          `SELECT *
           FROM timesheet_locations
           ORDER BY name ASC`,
        );
        return responseOk({ locations: locationsRes.results || [] }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "timesheet_location_create") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const name = normalizeIdentifier(body?.name);
        if (!name) {
          return responseError("Missing name", "missing_param", 400, corsHeaders);
        }
        const existing = await query(
          `SELECT id FROM timesheet_locations WHERE name = ? LIMIT 1`,
          [name],
        );
        if (existing.results?.length) {
          return responseError("Location already exists", "already_exists", 409, corsHeaders);
        }
        const created = await run(
          `INSERT INTO timesheet_locations (name)
           VALUES (?)`,
          [name],
        );
        return responseOk({ id: created.meta.last_row_id }, {}, 201, corsHeaders);
      }

      if (method === "POST" && action === "timesheet_location_delete") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const locationId = Number(body?.id);
        if (!Number.isFinite(locationId)) {
          return responseError("Invalid id", "invalid_param", 400, corsHeaders);
        }
        const existingRes = await query(`SELECT id FROM timesheet_locations WHERE id = ? LIMIT 1`, [locationId]);
        const existing = existingRes.results?.[0];
        if (!existing) {
          return responseError("Location not found", "not_found", 404, corsHeaders);
        }
        await run(`DELETE FROM timesheet_locations WHERE id = ?`, [locationId]);
        return responseOk({ id: locationId }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "timesheet_list") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach", "comite"]);
        if (roleError) return roleError;
        const coachIdParam = url.searchParams.get("coach_id");
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const canViewAll = authUser.role === "admin" || authUser.role === "comite";
        const coachId = coachIdParam ? Number(coachIdParam) : null;
        if (coachIdParam && !Number.isFinite(coachId)) {
          return responseError("Invalid coach_id", "invalid_param", 400, corsHeaders);
        }
        if (authUser.role === "coach" && coachId && coachId !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const resolvedCoachId = canViewAll ? coachId : authUser.id;
        const where = [];
        const params = [];
        if (resolvedCoachId) {
          where.push("timesheet_shifts.coach_id = ?");
          params.push(resolvedCoachId);
        }
        if (from) {
          where.push("timesheet_shifts.shift_date >= ?");
          params.push(from);
        }
        if (to) {
          where.push("timesheet_shifts.shift_date <= ?");
          params.push(to);
        }
        const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const shiftsRes = await query(
          `SELECT timesheet_shifts.*, users.display_name as coach_name
           FROM timesheet_shifts
           JOIN users ON users.id = timesheet_shifts.coach_id
           ${whereClause}
           ORDER BY timesheet_shifts.shift_date DESC, timesheet_shifts.start_time DESC, timesheet_shifts.id DESC`,
          params,
        );
        return responseOk({ shifts: shiftsRes.results || [] }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "timesheet_coaches") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach", "comite"]);
        if (roleError) return roleError;
        if (authUser.role === "coach") {
          return responseOk({ coaches: [{ id: authUser.id, display_name: authUser.display_name }] }, {}, 200, corsHeaders);
        }
        const coachesRes = await query(
          `SELECT id, display_name
           FROM users
           WHERE role = 'coach' AND is_active = 1
           ORDER BY display_name ASC`,
        );
        return responseOk({ coaches: coachesRes.results || [] }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "timesheet_create") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const coachIdRaw = body?.coach_id ?? authUser.id;
        const coachId = Number(coachIdRaw);
        if (!Number.isFinite(coachId)) {
          return responseError("Invalid coach_id", "invalid_param", 400, corsHeaders);
        }
        if (authUser.role === "coach" && coachId !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const shiftDateInput = normalizeIdentifier(body?.shift_date);
        const startTimeInput = normalizeIdentifier(body?.start_time);
        if (!startTimeInput) {
          return responseError("Missing start_time", "missing_param", 400, corsHeaders);
        }
        const derivedShiftDate = shiftDateInput || (startTimeInput.includes("T") ? startTimeInput.split("T")[0] : "");
        const startTime = normalizeShiftTime(startTimeInput, derivedShiftDate);
        if (!startTime) {
          return responseError("Invalid start_time", "invalid_param", 400, corsHeaders);
        }
        const startDate = new Date(startTime);
        if (Number.isNaN(startDate.getTime())) {
          return responseError("Invalid start_time", "invalid_param", 400, corsHeaders);
        }
        const endTimeInput = normalizeIdentifier(body?.end_time);
        const endTime = endTimeInput ? normalizeShiftTime(endTimeInput, derivedShiftDate) : "";
        if (endTimeInput && !endTime) {
          return responseError("Invalid end_time", "invalid_param", 400, corsHeaders);
        }
        if (endTime) {
          const endDate = new Date(endTime);
          if (Number.isNaN(endDate.getTime())) {
            return responseError("Invalid end_time", "invalid_param", 400, corsHeaders);
          }
          if (endDate < startDate) {
            return responseError("end_time must be after start_time", "invalid_param", 400, corsHeaders);
          }
        }
        const shiftDate = shiftDateInput || startTime.split("T")[0];
        if (!shiftDate) {
          return responseError("Missing shift_date", "missing_param", 400, corsHeaders);
        }
        const location = isEmpty(body?.location) ? null : String(body.location);
        const isTravel = Number(body?.is_travel) === 1 || body?.is_travel === true ? 1 : 0;
        const created = await run(
          `INSERT INTO timesheet_shifts (coach_id, shift_date, start_time, end_time, location, is_travel)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [coachId, shiftDate, startTime, endTime || null, location, isTravel],
        );
        return responseOk({ id: created.meta.last_row_id }, {}, 201, corsHeaders);
      }

      if (method === "POST" && action === "timesheet_update") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const shiftId = Number(body?.id);
        if (!Number.isFinite(shiftId)) {
          return responseError("Invalid id", "invalid_param", 400, corsHeaders);
        }
        const existingRes = await query(`SELECT * FROM timesheet_shifts WHERE id = ? LIMIT 1`, [shiftId]);
        const existing = existingRes.results?.[0];
        if (!existing) {
          return responseError("Shift not found", "not_found", 404, corsHeaders);
        }
        if (authUser.role === "coach" && existing.coach_id !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const shiftDateInput =
          body?.shift_date !== undefined ? normalizeIdentifier(body?.shift_date) : existing.shift_date;
        const startTimeInput =
          body?.start_time !== undefined ? normalizeIdentifier(body?.start_time) : existing.start_time;
        if (!startTimeInput) {
          return responseError("Missing start_time", "missing_param", 400, corsHeaders);
        }
        const derivedShiftDate = shiftDateInput || (startTimeInput.includes("T") ? startTimeInput.split("T")[0] : "");
        const startTime = normalizeShiftTime(startTimeInput, derivedShiftDate);
        if (!startTime) {
          return responseError("Invalid start_time", "invalid_param", 400, corsHeaders);
        }
        const startDate = new Date(startTime);
        if (Number.isNaN(startDate.getTime())) {
          return responseError("Invalid start_time", "invalid_param", 400, corsHeaders);
        }
        const endTimeInput =
          body?.end_time !== undefined ? normalizeIdentifier(body?.end_time) : existing.end_time;
        const endTime = endTimeInput ? normalizeShiftTime(endTimeInput, derivedShiftDate) : "";
        if (endTimeInput && !endTime) {
          return responseError("Invalid end_time", "invalid_param", 400, corsHeaders);
        }
        if (endTime) {
          const endDate = new Date(endTime);
          if (Number.isNaN(endDate.getTime())) {
            return responseError("Invalid end_time", "invalid_param", 400, corsHeaders);
          }
          if (endDate < startDate) {
            return responseError("end_time must be after start_time", "invalid_param", 400, corsHeaders);
          }
        }
        const shiftDate = shiftDateInput;
        const location = body?.location !== undefined ? (isEmpty(body?.location) ? null : String(body.location)) : existing.location;
        const isTravel = body?.is_travel !== undefined ? (Number(body?.is_travel) === 1 || body?.is_travel === true ? 1 : 0) : existing.is_travel;
        await run(
          `UPDATE timesheet_shifts
           SET shift_date = ?, start_time = ?, end_time = ?, location = ?, is_travel = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [shiftDate, startTime, endTime || null, location, isTravel, shiftId],
        );
        return responseOk({ id: shiftId }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "timesheet_delete") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const shiftId = Number(body?.id);
        if (!Number.isFinite(shiftId)) {
          return responseError("Invalid id", "invalid_param", 400, corsHeaders);
        }
        const existingRes = await query(`SELECT * FROM timesheet_shifts WHERE id = ? LIMIT 1`, [shiftId]);
        const existing = existingRes.results?.[0];
        if (!existing) {
          return responseError("Shift not found", "not_found", 404, corsHeaders);
        }
        if (authUser.role === "coach" && existing.coach_id !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        await run(`DELETE FROM timesheet_shifts WHERE id = ?`, [shiftId]);
        return responseOk({ id: shiftId }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "birthdays_upcoming") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const daysRaw = Number(url.searchParams.get("days") || 30);
        const days = Number.isFinite(daysRaw) ? Math.max(0, Math.min(daysRaw, 366)) : 30;
        const usersRes = await query(
          `SELECT users.id, users.display_name, COALESCE(user_profiles.birthdate, users.birthdate) AS birthdate
           FROM users
           LEFT JOIN user_profiles ON users.id = user_profiles.user_id
           WHERE role = 'athlete'
             AND is_active = 1
             AND COALESCE(user_profiles.birthdate, users.birthdate) IS NOT NULL
             AND COALESCE(user_profiles.birthdate, users.birthdate) != ''`,
        );
        const birthdays = buildUpcomingBirthdays(usersRes.results || [], days);
        return responseOk({ birthdays }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "groups_get") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const groupId = url.searchParams.get("group_id");
        if (groupId) {
          const groupRes = await query(`SELECT * FROM groups WHERE id = ?`, [groupId]);
          const group = groupRes.results?.[0];
          if (!group) {
            return responseError("Group not found", "not_found", 404, corsHeaders);
          }
          const members = await query(
            `SELECT group_members.*, users.display_name, users.role
             FROM group_members
             JOIN users ON group_members.user_id = users.id
             WHERE group_members.group_id = ?`,
            [groupId],
          );
          return responseOk({ group, members: members.results }, {}, 200, corsHeaders);
        }
        const res = await query(`SELECT * FROM groups ORDER BY name ASC`);
        return responseOk({ groups: res.results }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "groups_add_member") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const { group_id, user_id, role_in_group } = body || {};
        if (isEmpty(group_id) || isEmpty(user_id)) {
          return responseError("Missing group_id or user_id", "missing_param", 400, corsHeaders);
        }
        await run(
          `INSERT INTO group_members (group_id, user_id, role_in_group)
           VALUES (?, ?, ?)
           ON CONFLICT(group_id, user_id) DO UPDATE SET role_in_group = excluded.role_in_group`,
          [group_id, user_id, role_in_group || null],
        );
        return responseOk({ status: "ok" }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "notifications_list") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { limit, offset, order } = parsePagination(url);
        const { from, to } = parseDateRange(url);
        const status = url.searchParams.get("status");
        const type = url.searchParams.get("type");
        const targetUserId = url.searchParams.get("target_user_id") || authUser.id;
        const targetGroupId = url.searchParams.get("target_group_id");
        if (authUser.role === "athlete" && Number(targetUserId) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const clauses = [];
        const params = [];
        if (targetUserId) {
          clauses.push("notification_targets.target_user_id = ?");
          params.push(targetUserId);
        }
        if (targetGroupId) {
          clauses.push("notification_targets.target_group_id = ?");
          params.push(targetGroupId);
        }
        if (type) {
          clauses.push("notifications.type = ?");
          params.push(type);
        }
        if (status === "read") {
          clauses.push("notification_targets.read_at IS NOT NULL");
        } else if (status === "unread") {
          clauses.push("notification_targets.read_at IS NULL");
        }
        applyDateRangeClause(clauses, params, "notifications.created_at", from, to);
        const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
        const totalRes = await query(
          `SELECT COUNT(*) as total
           FROM notification_targets
           JOIN notifications ON notification_targets.notification_id = notifications.id
           ${where}`,
          params,
        );
        const res = await query(
          `SELECT notification_targets.id as target_id,
                  notification_targets.read_at,
                  notification_targets.target_user_id,
                  notification_targets.target_group_id,
                  notifications.*,
                  users.display_name as sender_name,
                  users.role as sender_role,
                  groups.name as target_group_name,
                  (
                    SELECT u2.id
                    FROM notification_targets nt2
                    JOIN users u2 ON nt2.target_user_id = u2.id
                    WHERE nt2.notification_id = notifications.id
                      AND nt2.target_user_id != notification_targets.target_user_id
                    LIMIT 1
                  ) as counterparty_id,
                  (
                    SELECT u2.display_name
                    FROM notification_targets nt2
                    JOIN users u2 ON nt2.target_user_id = u2.id
                    WHERE nt2.notification_id = notifications.id
                      AND nt2.target_user_id != notification_targets.target_user_id
                    LIMIT 1
                  ) as counterparty_name,
                  (
                    SELECT u2.role
                    FROM notification_targets nt2
                    JOIN users u2 ON nt2.target_user_id = u2.id
                    WHERE nt2.notification_id = notifications.id
                      AND nt2.target_user_id != notification_targets.target_user_id
                    LIMIT 1
                  ) as counterparty_role
           FROM notification_targets
           JOIN notifications ON notification_targets.notification_id = notifications.id
           LEFT JOIN users ON notifications.created_by = users.id
           LEFT JOIN groups ON notification_targets.target_group_id = groups.id
           ${where}
           ORDER BY notifications.created_at ${order}
           LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        );
        return responseOk(
          { notifications: res.results },
          { pagination: { limit, offset, total: totalRes.results?.[0]?.total ?? 0 } },
          200,
          corsHeaders,
        );
      }

      if (method === "POST" && action === "notifications_send") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { title, body: messageBody, type, targets, reply_to_target_id: replyTargetIdRaw } = body || {};
        if (!ensureEnum(type, ["message", "assignment", "birthday"])) {
          return responseError("Invalid type", "invalid_param", 400, corsHeaders);
        }
        if (authUser.role === "athlete") {
          if (isEmpty(replyTargetIdRaw)) {
            return responseError("Missing reply_to_target_id", "missing_param", 400, corsHeaders);
          }
          const replyTargetId = Number(replyTargetIdRaw);
          if (!Number.isFinite(replyTargetId)) {
            return responseError("Invalid reply_to_target_id", "invalid_param", 400, corsHeaders);
          }
          const replyTargetRes = await query(
            `SELECT notification_targets.target_user_id,
                    notification_targets.target_group_id,
                    notifications.created_by
             FROM notification_targets
             JOIN notifications ON notification_targets.notification_id = notifications.id
             WHERE notification_targets.id = ? AND notifications.type = 'message'
             LIMIT 1`,
            [replyTargetId],
          );
          const replyTarget = replyTargetRes.results?.[0];
          if (!replyTarget) {
            return responseError("Forbidden", "forbidden", 403, corsHeaders);
          }
          if (replyTarget.target_user_id) {
            if (Number(replyTarget.target_user_id) !== authUser.id) {
              return responseError("Forbidden", "forbidden", 403, corsHeaders);
            }
          } else if (replyTarget.target_group_id) {
            const membershipRes = await query(
              `SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1`,
              [replyTarget.target_group_id, authUser.id],
            );
            if (!membershipRes.results?.length) {
              return responseError("Forbidden", "forbidden", 403, corsHeaders);
            }
          } else {
            return responseError("Invalid reply target", "invalid_param", 400, corsHeaders);
          }
          if (!replyTarget.created_by) {
            return responseError("Invalid reply target", "invalid_param", 400, corsHeaders);
          }
          if (isEmpty(title) || isEmpty(type)) {
            return responseError("Missing title or type", "missing_param", 400, corsHeaders);
          }
          const notificationRes = await run(
            `INSERT INTO notifications (title, body, type, created_by)
             VALUES (?, ?, ?, ?)`,
            [title, messageBody || null, type, authUser.id],
          );
          const notificationId = notificationRes.meta.last_row_id;
          let targetUserIds = new Set([replyTarget.created_by, authUser.id]);
          if (replyTarget.target_group_id) {
            const membersRes = await query(
              `SELECT user_id FROM group_members WHERE group_id = ?`,
              [replyTarget.target_group_id],
            );
            const memberIds =
              membersRes.results?.map((row) => Number(row.user_id)).filter((id) => Number.isFinite(id) && id > 0) || [];
            targetUserIds = new Set([...targetUserIds, ...memberIds]);
          }
          const readAt = new Date().toISOString();
          for (const targetUserId of targetUserIds) {
            await run(
              `INSERT INTO notification_targets (notification_id, target_user_id, target_group_id, read_at)
               VALUES (?, ?, ?, ?)`,
              [
                notificationId,
                targetUserId,
                replyTarget.target_group_id ?? null,
                targetUserId === authUser.id ? readAt : null,
              ],
            );
          }
          return responseOk({ notification_id: notificationId }, {}, 201, corsHeaders);
        }
        const roleError = requireRole(authUser, ["coach", "comite"]);
        if (roleError) return roleError;
        if (isEmpty(title) || isEmpty(type) || !Array.isArray(targets) || targets.length === 0) {
          return responseError("Missing title, type, or targets", "missing_param", 400, corsHeaders);
        }
        const notificationRes = await run(
          `INSERT INTO notifications (title, body, type, created_by)
           VALUES (?, ?, ?, ?)`,
          [title, messageBody || null, type, authUser.id],
        );
        const notificationId = notificationRes.meta.last_row_id;
        if (type === "message") {
          const groupMembersById = new Map();
          for (const target of targets) {
            const targetGroupId = Number(target?.target_group_id);
            if (!Number.isFinite(targetGroupId) || targetGroupId <= 0) {
              continue;
            }
            if (!groupMembersById.has(targetGroupId)) {
              const membersRes = await query(
                `SELECT user_id FROM group_members WHERE group_id = ?`,
                [targetGroupId],
              );
              const memberIds =
                membersRes.results?.map((row) => Number(row.user_id)).filter((id) => Number.isFinite(id) && id > 0) ||
                [];
              groupMembersById.set(targetGroupId, memberIds);
            }
          }
          const targetUserIds = buildMessageTargetUserIds({
            targets,
            groupMembersById,
            senderId: authUser.id,
          });
          const readAt = new Date().toISOString();
          for (const targetUserId of targetUserIds) {
            const matchingGroupTarget = targets.find(
              (target) => Number(target?.target_group_id) && groupMembersById.has(Number(target?.target_group_id)),
            );
            const targetGroupId = matchingGroupTarget?.target_group_id
              ? Number(matchingGroupTarget.target_group_id)
              : null;
            await run(
              `INSERT INTO notification_targets (notification_id, target_user_id, target_group_id, read_at)
               VALUES (?, ?, ?, ?)`,
              [notificationId, targetUserId, targetGroupId, targetUserId === authUser.id ? readAt : null],
            );
          }
          return responseOk({ notification_id: notificationId }, {}, 201, corsHeaders);
        }
        for (const target of targets) {
          const targetUserId = target?.target_user_id || null;
          const targetGroupId = target?.target_group_id || null;
          if (!targetUserId && !targetGroupId) {
            continue;
          }
          await run(
            `INSERT INTO notification_targets (notification_id, target_user_id, target_group_id)
             VALUES (?, ?, ?)`,
            [notificationId, targetUserId, targetGroupId],
          );
        }
        return responseOk({ notification_id: notificationId }, {}, 201, corsHeaders);
      }

      if (method === "POST" && action === "notifications_mark_read") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const targetId = body?.target_id;
        if (isEmpty(targetId)) {
          return responseError("Missing target_id", "missing_param", 400, corsHeaders);
        }
        const targetRes = await query(
          `SELECT * FROM notification_targets WHERE id = ?`,
          [targetId],
        );
        const target = targetRes.results?.[0];
        if (!target) {
          return responseError("Notification target not found", "not_found", 404, corsHeaders);
        }
        if (authUser.role !== "admin") {
          if (target.target_user_id) {
            if (Number(target.target_user_id) !== authUser.id) {
              return responseError("Forbidden", "forbidden", 403, corsHeaders);
            }
          } else if (target.target_group_id) {
            const membershipRes = await query(
              `SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1`,
              [target.target_group_id, authUser.id],
            );
            if (!membershipRes.results?.length) {
              return responseError("Forbidden", "forbidden", 403, corsHeaders);
            }
          }
        }
        await run(`UPDATE notification_targets SET read_at = CURRENT_TIMESTAMP WHERE id = ?`, [targetId]);
        return responseOk({ status: "ok" }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "swim_catalog_list") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const catalogRes = await query(`SELECT * FROM swim_sessions_catalog ORDER BY created_at DESC`);
        const catalogs = catalogRes.results || [];
        if (catalogs.length === 0) {
          return responseOk({ catalogs: [] }, {}, 200, corsHeaders);
        }
        const catalogIds = catalogs.map((row) => row.id);
        const placeholders = catalogIds.map(() => "?").join(", ");
        const itemsRes = await query(
          `SELECT * FROM swim_session_items WHERE catalog_id IN (${placeholders}) ORDER BY catalog_id, ordre ASC`,
          catalogIds,
        );
        const itemsByCatalog = itemsRes.results.reduce((acc, item) => {
          acc[item.catalog_id] = acc[item.catalog_id] || [];
          acc[item.catalog_id].push(item);
          return acc;
        }, {});
        const enriched = catalogs.map((catalog) => ({
          ...catalog,
          items: itemsByCatalog[catalog.id] || [],
        }));
        return responseOk({ catalogs: enriched }, {}, 200, corsHeaders);
      }

      if (method === "POST" && (action === "swim_catalog_upsert" || action === "swim_catalog_create" || action === "swim_catalog_update")) {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const { catalog, items } = body || {};
        if (!catalog?.name) {
          return responseError("Missing catalog.name", "missing_param", 400, corsHeaders);
        }
        const catalogId = catalog.id ? Number(catalog.id) : null;
        let resolvedId = catalogId;
        if (catalogId) {
          await run(
            `UPDATE swim_sessions_catalog SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [catalog.name, catalog.description || null, catalogId],
          );
        } else {
          const createRes = await run(
            `INSERT INTO swim_sessions_catalog (name, description, created_by)
             VALUES (?, ?, ?)`,
            [catalog.name, catalog.description || null, authUser.id],
          );
          resolvedId = createRes.meta.last_row_id;
        }
        if (Array.isArray(items)) {
          await run(`DELETE FROM swim_session_items WHERE catalog_id = ?`, [resolvedId]);
          for (const item of items) {
            const rawPayload =
              item.raw_payload === undefined || item.raw_payload === null
                ? null
                : typeof item.raw_payload === "string"
                  ? item.raw_payload
                  : JSON.stringify(item.raw_payload);
            await run(
              `INSERT INTO swim_session_items (catalog_id, ordre, label, distance, duration, intensity, notes, raw_payload)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                resolvedId,
                item.ordre ?? 0,
                item.label || null,
                item.distance ?? null,
                item.duration ?? null,
                item.intensity || null,
                item.notes || null,
                rawPayload,
              ],
            );
          }
        }
        return responseOk({ catalog_id: resolvedId }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "swim_catalog_delete") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const catalogId = Number(body?.catalog_id);
        if (!Number.isFinite(catalogId)) {
          return responseError("Missing catalog_id", "missing_param", 400, corsHeaders);
        }
        const usageRes = await query(
          `SELECT COUNT(1) as usage_count FROM assignments WHERE swim_catalog_id = ?`,
          [catalogId],
        );
        const usageCount = Number(usageRes.results?.[0]?.usage_count ?? 0);
        if (usageCount > 0) {
          return responseError("Catalog has assignments", "catalog_in_use", 409, corsHeaders);
        }
        await run(`DELETE FROM swim_sessions_catalog WHERE id = ?`, [catalogId]);
        return responseOk({ status: "deleted" }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "strength_catalog_list") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const sessionRes = await query(`SELECT * FROM strength_sessions ORDER BY created_at DESC`);
        const sessions = sessionRes.results || [];
        if (sessions.length === 0) {
          return responseOk({ sessions: [] }, {}, 200, corsHeaders);
        }
        const sessionIds = sessions.map((row) => row.id);
        const placeholders = sessionIds.map(() => "?").join(", ");
        const itemsRes = await query(
          `SELECT * FROM strength_session_items WHERE session_id IN (${placeholders}) ORDER BY session_id, ordre ASC`,
          sessionIds,
        );
        const itemsBySession = itemsRes.results.reduce((acc, item) => {
          acc[item.session_id] = acc[item.session_id] || [];
          acc[item.session_id].push(item);
          return acc;
        }, {});
        const enriched = sessions.map((session) => ({
          ...session,
          items: itemsBySession[session.id] || [],
        }));
        return responseOk({ sessions: enriched }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "strength_catalog_delete") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const sessionId = body?.session_id ? Number(body.session_id) : null;
        if (!sessionId) {
          return responseError("Missing session_id", "missing_param", 400, corsHeaders);
        }
        await run(`DELETE FROM strength_session_items WHERE session_id = ?`, [sessionId]);
        await run(`DELETE FROM strength_sessions WHERE id = ?`, [sessionId]);
        return responseOk({ status: "ok" }, {}, 200, corsHeaders);
      }

      if (method === "POST" && (action === "strength_catalog_upsert" || action === "strength_catalog_create" || action === "strength_catalog_update")) {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const { session, items } = body || {};
        if (!session?.name) {
          return responseError("Missing session.name", "missing_param", 400, corsHeaders);
        }
        const sessionId = session.id ? Number(session.id) : null;
        let resolvedId = sessionId;
        if (sessionId) {
          await run(
            `UPDATE strength_sessions SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [session.name, session.description || null, sessionId],
          );
        } else {
          const createRes = await run(
            `INSERT INTO strength_sessions (name, description, created_by)
             VALUES (?, ?, ?)`,
            [session.name, session.description || null, authUser.id],
          );
          resolvedId = createRes.meta.last_row_id;
        }
        if (Array.isArray(items)) {
          await run(`DELETE FROM strength_session_items WHERE session_id = ?`, [resolvedId]);
          for (const item of items) {
            await run(
              `INSERT INTO strength_session_items (
                 session_id, ordre, exercise_id, block, cycle_type, sets, reps, pct_1rm, rest_series_s, rest_exercise_s, notes, raw_payload
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                resolvedId,
                item.ordre ?? 0,
                item.exercise_id,
                item.block || "main",
                item.cycle_type || "endurance",
                item.sets ?? null,
                item.reps ?? null,
                item.pct_1rm ?? null,
                item.rest_series_s ?? null,
                item.rest_exercise_s ?? null,
                item.notes || null,
                item.raw_payload ? JSON.stringify(item.raw_payload) : null,
              ],
            );
          }
        }
        return responseOk({ session_id: resolvedId }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "assignments_create") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const roleError = requireRole(authUser, ["coach"]);
        if (roleError) return roleError;
        const { assignment_type, session_id, target_user_id, target_group_id, scheduled_date } = body || {};
        if (isEmpty(assignment_type) || isEmpty(session_id) || (!target_user_id && !target_group_id)) {
          return responseError("Missing assignment_type, session_id, or target", "missing_param", 400, corsHeaders);
        }
        if (!ensureEnum(assignment_type, ["swim", "strength"])) {
          return responseError("Invalid assignment_type", "invalid_param", 400, corsHeaders);
        }
        const sessionId = Number(session_id);
        if (!Number.isFinite(sessionId)) {
          return responseError("Invalid session_id", "invalid_param", 400, corsHeaders);
        }
        const targetUserId = isEmpty(target_user_id) ? null : Number(target_user_id);
        const targetGroupId = isEmpty(target_group_id) ? null : Number(target_group_id);
        if ((targetUserId !== null && !Number.isFinite(targetUserId)) || (targetGroupId !== null && !Number.isFinite(targetGroupId))) {
          return responseError("Invalid target_user_id or target_group_id", "invalid_param", 400, corsHeaders);
        }
        let sessionName = null;
        if (assignment_type === "swim") {
          const sessionRes = await query(`SELECT id, name FROM swim_sessions_catalog WHERE id = ?`, [sessionId]);
          const sessionRow = sessionRes.results?.[0] ?? null;
          if (!sessionRow) {
            return responseError("Swim session not found", "not_found", 404, corsHeaders);
          }
          sessionName = sessionRow.name ?? null;
        } else if (assignment_type === "strength") {
          const sessionRes = await query(`SELECT id, name FROM strength_sessions WHERE id = ?`, [sessionId]);
          const sessionRow = sessionRes.results?.[0] ?? null;
          if (!sessionRow) {
            return responseError("Strength session not found", "not_found", 404, corsHeaders);
          }
          sessionName = sessionRow.name ?? null;
        }
        if (targetUserId !== null) {
          const userRes = await query(`SELECT id FROM users WHERE id = ?`, [targetUserId]);
          if (!userRes.results?.length) {
            return responseError("User not found", "not_found", 404, corsHeaders);
          }
        }
        if (targetGroupId !== null) {
          const groupRes = await query(`SELECT id FROM groups WHERE id = ?`, [targetGroupId]);
          if (!groupRes.results?.length) {
            return responseError("Group not found", "not_found", 404, corsHeaders);
          }
        }
        const swimCatalogId = assignment_type === "swim" ? sessionId : null;
        const strengthSessionId = assignment_type === "strength" ? sessionId : null;
        const createRes = await run(
          `INSERT INTO session_assignments (
             assignment_type, swim_catalog_id, strength_session_id, target_user_id, target_group_id, assigned_by, scheduled_date
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            assignment_type,
            swimCatalogId,
            strengthSessionId,
            targetUserId,
            targetGroupId,
            authUser.id,
            scheduled_date || null,
          ],
        );
        const notificationTitle = "Nouvelle séance assignée";
        const notificationBody = sessionName
          ? `Séance ${sessionName} prévue le ${scheduled_date || "bientôt"}.`
          : "Une nouvelle séance a été assignée.";
        const notificationRes = await run(
          `INSERT INTO notifications (title, body, type, created_by)
           VALUES (?, ?, 'assignment', ?)`,
          [notificationTitle, notificationBody, authUser.id],
        );
        const notificationId = notificationRes.meta.last_row_id;
        await run(
          `INSERT INTO notification_targets (notification_id, target_user_id, target_group_id)
           VALUES (?, ?, ?)`,
          [notificationId, targetUserId, targetGroupId],
        );
        return responseOk({ assignment_id: createRes.meta.last_row_id }, {}, 201, corsHeaders);
      }

      if (method === "DELETE" && action === "assignments_delete") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        if (authUser.role !== "athlete") {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const assignmentId = Number(url.searchParams.get("assignment_id") || "");
        if (!Number.isFinite(assignmentId)) {
          return responseError("Invalid assignment_id", "invalid_param", 400, corsHeaders);
        }
        const assignmentRes = await query(
          `SELECT id, target_user_id FROM session_assignments WHERE id = ?`,
          [assignmentId],
        );
        const assignment = assignmentRes.results?.[0] ?? null;
        if (!assignment) {
          return responseError("Assignment not found", "not_found", 404, corsHeaders);
        }
        if (Number(assignment.target_user_id) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        await run(`DELETE FROM session_assignments WHERE id = ?`, [assignmentId]);
        return responseOk({ status: "deleted" }, {}, 200, corsHeaders);
      }

      if (method === "GET" && action === "assignments_list") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { limit, offset, order } = parsePagination(url);
        const { from, to } = parseDateRange(url);
        const status = url.searchParams.get("status");
        const assignmentType = url.searchParams.get("assignment_type");
        const targetUserId = url.searchParams.get("target_user_id") || (authUser.role === "athlete" ? authUser.id : null);
        const targetGroupId = url.searchParams.get("target_group_id");
        if (authUser.role === "athlete" && targetUserId && Number(targetUserId) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const clauses = [];
        const params = [];
        if (targetUserId) {
          clauses.push("session_assignments.target_user_id = ?");
          params.push(targetUserId);
        }
        if (targetGroupId) {
          clauses.push("session_assignments.target_group_id = ?");
          params.push(targetGroupId);
        }
        if (status) {
          clauses.push("session_assignments.status = ?");
          params.push(status);
        }
        if (assignmentType) {
          clauses.push("session_assignments.assignment_type = ?");
          params.push(assignmentType);
        }
        applyDateRangeClause(clauses, params, "session_assignments.scheduled_date", from, to);
        const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
        const totalRes = await query(`SELECT COUNT(*) as total FROM session_assignments ${where}`, params);
        const res = await query(
          `SELECT * FROM session_assignments ${where} ORDER BY scheduled_date ${order}, id ${order} LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        );
        return responseOk(
          { assignments: res.results },
          { pagination: { limit, offset, total: totalRes.results?.[0]?.total ?? 0 } },
          200,
          corsHeaders,
        );
      }

      if (method === "POST" && action === "strength_run_start") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { assignment_id, athlete_id, athleteName, session_id } = body || {};
        const resolvedAthleteId = athlete_id || (athleteName ? await resolveAthleteId({ athleteName }) : null);
        if (isEmpty(resolvedAthleteId)) {
          return responseError("Missing athlete_id", "missing_param", 400, corsHeaders);
        }
        if (isEmpty(assignment_id) && isEmpty(session_id)) {
          return responseError("Missing session_id", "missing_param", 400, corsHeaders);
        }
        if (authUser.role === "athlete" && Number(resolvedAthleteId) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const createRes = await run(
          `INSERT INTO strength_session_runs (assignment_id, athlete_id, status, progress_pct, started_at, raw_payload)
           VALUES (?, ?, 'in_progress', ?, ?, ?)`,
          [
            assignment_id ?? null,
            resolvedAthleteId,
            body?.progress_pct ?? 0,
            new Date().toISOString(),
            JSON.stringify(body || {}),
          ],
        );
        if (!isEmpty(assignment_id)) {
          await run(
            `UPDATE session_assignments SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [assignment_id],
          );
        }
        return responseOk({ run_id: createRes.meta.last_row_id }, {}, 201, corsHeaders);
      }

      if (method === "POST" && action === "strength_run_update") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { run_id, progress_pct, status, fatigue, comments } = body || {};
        if (isEmpty(run_id)) {
          return responseError("Missing run_id", "missing_param", 400, corsHeaders);
        }
        const runRes = await query(`SELECT * FROM strength_session_runs WHERE id = ?`, [run_id]);
        const runRow = runRes.results?.[0];
        if (!runRow) {
          return responseError("Run not found", "not_found", 404, corsHeaders);
        }
        if (authUser.role === "athlete" && Number(runRow.athlete_id) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        if (status && !ensureEnum(status, ["in_progress", "completed", "abandoned"])) {
          return responseError("Invalid status", "invalid_param", 400, corsHeaders);
        }
        const updates = [];
        const params = [];
        if (progress_pct !== undefined) {
          updates.push("progress_pct = ?");
          params.push(progress_pct);
        }
        if (status) {
          updates.push("status = ?");
          params.push(status);
          if (status === "completed") {
            updates.push("completed_at = CURRENT_TIMESTAMP");
          }
        }
        if (fatigue !== undefined || comments !== undefined) {
          let rawPayload = {};
          if (runRow?.raw_payload) {
            try {
              rawPayload = JSON.parse(runRow.raw_payload);
            } catch {
              rawPayload = {};
            }
          }
          const mergedPayload = {
            ...rawPayload,
            ...body,
            fatigue: fatigue ?? rawPayload.fatigue ?? null,
            comments: comments ?? rawPayload.comments ?? null,
          };
          updates.push("raw_payload = ?");
          params.push(JSON.stringify(mergedPayload));
        }
        if (!updates.length) {
          return responseError("No fields to update", "missing_param", 400, corsHeaders);
        }
        await run(`UPDATE strength_session_runs SET ${updates.join(", ")} WHERE id = ?`, [...params, run_id]);
        if (status === "completed" && runRow.assignment_id) {
          await run(
            `UPDATE session_assignments SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [runRow.assignment_id],
          );
        }
        return responseOk({ status: "ok" }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "strength_run_delete") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { run_id } = body || {};
        if (isEmpty(run_id)) {
          return responseError("Missing run_id", "missing_param", 400, corsHeaders);
        }
        const runRes = await query(`SELECT * FROM strength_session_runs WHERE id = ?`, [run_id]);
        const runRow = runRes.results?.[0];
        if (!runRow) {
          return responseError("Run not found", "not_found", 404, corsHeaders);
        }
        if (authUser.role === "athlete" && Number(runRow.athlete_id) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        await run(`DELETE FROM strength_set_logs WHERE run_id = ?`, [run_id]);
        await run(`DELETE FROM strength_session_runs WHERE id = ?`, [run_id]);
        if (runRow.assignment_id) {
          await run(
            `UPDATE session_assignments SET status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [runRow.assignment_id],
          );
        }
        return responseOk({ status: "deleted" }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "strength_set_log") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { run_id, exercise_id, set_index, reps, weight } = body || {};
        if (isEmpty(run_id) || isEmpty(exercise_id)) {
          return responseError("Missing run_id or exercise_id", "missing_param", 400, corsHeaders);
        }
        const runRes = await query(`SELECT * FROM strength_session_runs WHERE id = ?`, [run_id]);
        const runRow = runRes.results?.[0];
        if (!runRow) {
          return responseError("Run not found", "not_found", 404, corsHeaders);
        }
        if (authUser.role === "athlete" && Number(runRow.athlete_id) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        await run(
          `INSERT INTO strength_set_logs (
             run_id, exercise_id, set_index, reps, weight, pct_1rm_suggested, rest_seconds, rpe, notes, completed_at, raw_payload
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            run_id,
            exercise_id,
            set_index ?? null,
            reps ?? null,
            weight ?? null,
            body?.pct_1rm_suggested ?? null,
            body?.rest_seconds ?? null,
            body?.rpe ?? null,
            body?.notes || null,
            new Date().toISOString(),
            JSON.stringify(body || {}),
          ],
        );
        return responseOk({ status: "ok" }, {}, 201, corsHeaders);
      }

      if (method === "GET" && action === "strength_history") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { limit, offset, order } = parsePagination(url);
        const { from, to } = parseDateRange(url);
        const athleteIdParam = url.searchParams.get("athlete_id");
        const athleteName = url.searchParams.get("athleteName");
        const resolvedAthleteId =
          athleteIdParam || (athleteName ? await lookupAthleteId({ athleteName }) : null) || authUser.id;
        if (!resolvedAthleteId) {
          return responseError("Missing athlete_id or athleteName", "missing_param", 400, corsHeaders);
        }
        if (authUser.role === "athlete" && Number(resolvedAthleteId) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const status = url.searchParams.get("status");
        const clauses = ["strength_session_runs.athlete_id = ?"];
        const params = [resolvedAthleteId];
        if (status) {
          clauses.push("strength_session_runs.status = ?");
          params.push(status);
        }
        applyDateRangeClause(clauses, params, "strength_session_runs.started_at", from, to);
        const where = `WHERE ${clauses.join(" AND ")}`;
        const totalRes = await query(`SELECT COUNT(*) as total FROM strength_session_runs ${where}`, params);
        const runsRes = await query(
          `SELECT * FROM strength_session_runs ${where}
           ORDER BY started_at ${order}, id ${order}
           LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        );
        const runs = runsRes.results || [];
        if (runs.length === 0) {
          return responseOk(
            { runs: [], exercise_summary: [] },
            { pagination: { limit, offset, total: 0 } },
            200,
            corsHeaders,
          );
        }
        const runIds = runs.map((row) => row.id);
        const placeholders = runIds.map(() => "?").join(", ");
        const logsRes = await query(
          `SELECT * FROM strength_set_logs WHERE run_id IN (${placeholders}) ORDER BY completed_at ASC`,
          runIds,
        );
        const exerciseSummaryRes = await query(
          `SELECT
             strength_set_logs.exercise_id as exercise_id,
             COALESCE(DIM_exercices.nom_exercice, 'Exercice ' || strength_set_logs.exercise_id) as exercise_name,
             COUNT(strength_set_logs.id) as total_sets,
             SUM(COALESCE(strength_set_logs.reps, 0)) as total_reps,
             SUM(COALESCE(strength_set_logs.reps, 0) * COALESCE(strength_set_logs.weight, 0)) as total_volume,
             MAX(strength_set_logs.weight) as max_weight,
             MAX(strength_set_logs.completed_at) as last_performed_at
           FROM strength_set_logs
           INNER JOIN strength_session_runs ON strength_session_runs.id = strength_set_logs.run_id
           LEFT JOIN DIM_exercices ON DIM_exercices.id = strength_set_logs.exercise_id
           ${where}
           GROUP BY strength_set_logs.exercise_id, DIM_exercices.nom_exercice
           ORDER BY total_volume DESC, exercise_name ASC`,
          params,
        );
        const logsByRun = logsRes.results.reduce((acc, log) => {
          acc[log.run_id] = acc[log.run_id] || [];
          acc[log.run_id].push(log);
          return acc;
        }, {});
        const enrichedRuns = runs.map((run) => ({
          ...run,
          logs: logsByRun[run.id] || [],
        }));
        return responseOk(
          { runs: enrichedRuns, exercise_summary: exerciseSummaryRes.results || [] },
          { pagination: { limit, offset, total: totalRes.results?.[0]?.total ?? 0 } },
          200,
          corsHeaders,
        );
      }

      if (method === "GET" && action === "strength_history_aggregate") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { limit, offset, order } = parsePagination(url);
        const { from, to } = parseDateRange(url);
        const athleteIdParam = url.searchParams.get("athlete_id");
        const athleteName = url.searchParams.get("athleteName");
        const resolvedAthleteId =
          athleteIdParam || (athleteName ? await lookupAthleteId({ athleteName }) : null) || authUser.id;
        if (!resolvedAthleteId) {
          return responseError("Missing athlete_id or athleteName", "missing_param", 400, corsHeaders);
        }
        if (authUser.role === "athlete" && Number(resolvedAthleteId) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const status = url.searchParams.get("status");
        const periodParam = (url.searchParams.get("period") || "day").toLowerCase();
        const period = ["day", "week", "month"].includes(periodParam) ? periodParam : "day";
        const groupExpression =
          period === "week"
            ? "strftime('%Y-W%W', strength_set_logs.completed_at)"
            : period === "month"
              ? "strftime('%Y-%m', strength_set_logs.completed_at)"
              : "strftime('%Y-%m-%d', strength_set_logs.completed_at)";
        const clauses = ["strength_session_runs.athlete_id = ?", "strength_set_logs.completed_at IS NOT NULL"];
        const params = [resolvedAthleteId];
        if (status) {
          clauses.push("strength_session_runs.status = ?");
          params.push(status);
        }
        applyDateRangeClause(clauses, params, "strength_set_logs.completed_at", from, to);
        const where = `WHERE ${clauses.join(" AND ")}`;
        const totalRes = await query(
          `SELECT COUNT(DISTINCT ${groupExpression}) as total
           FROM strength_set_logs
           JOIN strength_session_runs ON strength_session_runs.id = strength_set_logs.run_id
           ${where}`,
          params,
        );
        const rowsRes = await query(
          `SELECT ${groupExpression} as period,
                  SUM(COALESCE(strength_set_logs.reps, 0) * COALESCE(strength_set_logs.weight, 0)) as tonnage,
                  SUM(COALESCE(strength_set_logs.reps, 0)) as volume
           FROM strength_set_logs
           JOIN strength_session_runs ON strength_session_runs.id = strength_set_logs.run_id
           ${where}
           GROUP BY period
           ORDER BY period ${order}
           LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        );
        const periods = rowsRes.results || [];
        return responseOk(
          { periods },
          { pagination: { limit, offset, total: totalRes.results?.[0]?.total ?? 0 } },
          200,
          corsHeaders,
        );
      }

      if (method === "GET" && action === "one_rm_upsert") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const athleteIdParam = url.searchParams.get("athlete_id");
        const athleteName = url.searchParams.get("athleteName");
        const resolvedAthleteId =
          athleteIdParam || (athleteName ? await lookupAthleteId({ athleteName }) : null) || authUser.id;
        if (!resolvedAthleteId) {
          return responseError("Missing athlete_id or athleteName", "missing_param", 400, corsHeaders);
        }
        if (authUser.role === "athlete" && Number(resolvedAthleteId) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const res = await query(
          `SELECT id, athlete_id, exercise_id, one_rm, recorded_at
           FROM one_rm_records
           WHERE athlete_id = ?
           ORDER BY recorded_at DESC, id DESC`,
          [resolvedAthleteId],
        );
        return responseOk({ records: res.results }, {}, 200, corsHeaders);
      }

      if (method === "POST" && action === "one_rm_upsert") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { athlete_id, exercise_id, one_rm } = body || {};
        if (isEmpty(athlete_id) || isEmpty(exercise_id) || isEmpty(one_rm)) {
          return responseError("Missing athlete_id, exercise_id, or one_rm", "missing_param", 400, corsHeaders);
        }
        if (authUser.role === "athlete" && Number(athlete_id) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const existing = await query(
          `SELECT id FROM one_rm_records WHERE athlete_id = ? AND exercise_id = ? LIMIT 1`,
          [athlete_id, exercise_id],
        );
        if (existing.results?.length) {
          await run(
            `UPDATE one_rm_records SET one_rm = ?, recorded_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [one_rm, existing.results[0].id],
          );
          return responseOk({ record_id: existing.results[0].id }, {}, 200, corsHeaders);
        }
        const createRes = await run(
          `INSERT INTO one_rm_records (athlete_id, exercise_id, one_rm) VALUES (?, ?, ?)`,
          [athlete_id, exercise_id, one_rm],
        );
        return responseOk({ record_id: createRes.meta.last_row_id }, {}, 201, corsHeaders);
      }

      if (method === "GET" && (action === "swim_records" || action === "swim_records_list")) {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { limit, offset, order } = parsePagination(url);
        const { from, to } = parseDateRange(url);
        const athleteId = url.searchParams.get("athlete_id");
        const athleteName = url.searchParams.get("athleteName");
        let resolvedId = athleteId;
        if (!resolvedId && athleteName) {
          resolvedId = await resolveAthleteId({ athleteName });
        }
        if (!resolvedId) {
          return responseError("Missing athlete_id or athleteName", "missing_param", 400, corsHeaders);
        }
        if (authUser.role === "athlete" && Number(resolvedId) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        const clauses = ["athlete_id = ?"];
        const params = [resolvedId];
        applyDateRangeClause(clauses, params, "record_date", from, to);
        const where = `WHERE ${clauses.join(" AND ")}`;
        const totalRes = await query(`SELECT COUNT(*) as total FROM swim_records ${where}`, params);
        const res = await query(
          `SELECT * FROM swim_records ${where} ORDER BY record_date ${order}, id ${order} LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        );
        return responseOk(
          { records: res.results },
          { pagination: { limit, offset, total: totalRes.results?.[0]?.total ?? 0 } },
          200,
          corsHeaders,
        );
      }

      if (method === "POST" && action === "swim_records_upsert") {
        const authError = requireAuth(authUser);
        if (authError) return authError;
        const { athlete_id, athleteName, event_name, pool_length, time_seconds, record_date } = body || {};
        const recordType = body?.record_type ?? body?.recordType ?? null;
        const ffnPoints = body?.ffn_points ?? body?.ffnPoints ?? null;
        if (isEmpty(event_name)) {
          return responseError("Missing event_name", "missing_param", 400, corsHeaders);
        }
        const resolvedId = athlete_id || (athleteName ? await resolveAthleteId({ athleteName }) : null);
        if (!resolvedId) {
          return responseError("Missing athlete_id", "missing_param", 400, corsHeaders);
        }
        if (authUser.role === "athlete" && Number(resolvedId) !== authUser.id) {
          return responseError("Forbidden", "forbidden", 403, corsHeaders);
        }
        if (body?.id) {
          await run(
            `UPDATE swim_records
             SET event_name = ?, pool_length = ?, time_seconds = ?, record_date = ?, notes = ?, ffn_points = COALESCE(?, ffn_points), record_type = COALESCE(?, record_type)
             WHERE id = ?`,
            [
              event_name,
              pool_length ?? null,
              time_seconds ?? null,
              record_date || null,
              body?.notes || null,
              ffnPoints,
              recordType,
              body.id,
            ],
          );
          return responseOk({ record_id: body.id }, {}, 200, corsHeaders);
        }
        const createRes = await run(
          `INSERT INTO swim_records (athlete_id, event_name, pool_length, time_seconds, record_date, notes, ffn_points, record_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'training'))`,
          [resolvedId, event_name, pool_length ?? null, time_seconds ?? null, record_date || null, body?.notes || null, ffnPoints, recordType],
        );
        return responseOk({ record_id: createRes.meta.last_row_id }, {}, 201, corsHeaders);
      }

      if (action) {
        return responseError(`Unknown action: ${action}`, "unknown_action", 404, corsHeaders);
      }
      return responseError("Not Found", "not_found", 404, corsHeaders);

    } catch (err) {
      const message = err?.message || "Unknown error";
      const tableMatch = message.match(/no such table: ([a-zA-Z0-9_]+)/i);
      if (tableMatch) {
        return responseError(`Missing table: ${tableMatch[1]}`, "table_missing", 500, corsHeaders);
      }
      if (message.includes("FOREIGN KEY constraint failed") || message.includes("UNIQUE constraint failed")) {
        return responseError(message, "constraint_failed", 409, corsHeaders);
      }
      return responseError(message, "server_error", 500, corsHeaders);
    }
  },
  async scheduled(event, env, ctx) {
    const query = async (sql, params = []) => env.DB.prepare(sql).bind(...params).all();
    const run = async (sql, params = []) => env.DB.prepare(sql).bind(...params).run();
    ctx.waitUntil(createBirthdayNotifications({ query, run }));
  },
};
