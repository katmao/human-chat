import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

type CliOptions = {
  serviceAccountPath: string;
  outputPath: string;
  includeActive: boolean;
  startDate?: number;
  endDate?: number;
  timeZone: string;
};

const DEFAULT_OUTPUT = path.resolve(process.cwd(), 'chat-logs.csv');
const CSV_HEADERS = [
  'sessionId',
  'archived',
  'messageId',
  'sender',
  'timestamp',
  'content',
  'participant1Online',
  'participant1LastSeen',
  'participant1Heartbeat',
  'participant2Online',
  'participant2LastSeen',
  'participant2Heartbeat',
];

type ParticipantPresence = {
  online?: boolean;
  lastSeen?: unknown;
  heartbeat?: unknown;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(process.cwd(), 'serviceAccount.json');
  let outputPath = process.env.CHAT_EXPORT_PATH || DEFAULT_OUTPUT;
  let includeActive = process.env.INCLUDE_ACTIVE_SESSIONS === 'true';
  let startDateInput = process.env.CHAT_EXPORT_START_DATE;
  let endDateInput = process.env.CHAT_EXPORT_END_DATE;
  let timeZone = process.env.CHAT_EXPORT_TIMEZONE || 'UTC';
  let dayInput = process.env.CHAT_EXPORT_DAY;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--service-account':
      case '-k':
        serviceAccountPath = args[i + 1];
        i += 1;
        break;
      case '--output':
      case '-o':
        outputPath = args[i + 1];
        i += 1;
        break;
      case '--include-active':
        includeActive = true;
        break;
      case '--timezone':
        timeZone = args[i + 1];
        i += 1;
        break;
      case '--start-date':
        startDateInput = args[i + 1];
        i += 1;
        break;
      case '--end-date':
        endDateInput = args[i + 1];
        i += 1;
        break;
      case '--day':
        dayInput = args[i + 1];
        i += 1;
        break;
      default:
        break;
    }
  }

  if (!serviceAccountPath) {
    throw new Error('Missing path to Firebase service account JSON.');
  }

  validateTimeZone(timeZone);

  let startDate = parseDateInput(startDateInput, 'start-date');
  let endDate = parseDateInput(endDateInput, 'end-date');
  if (dayInput) {
    const { start, end } = resolveDayRange(dayInput, timeZone);
    startDate = start;
    endDate = end;
  }

  if (startDate && endDate && startDate > endDate) {
    throw new Error('Start date must be before or equal to end date.');
  }

  return { serviceAccountPath, outputPath, includeActive, startDate, endDate, timeZone };
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function parseDateInput(value: string | undefined, label: 'start-date' | 'end-date'): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${label} value. Use an ISO date (e.g., 2024-01-31 or 2024-01-31T15:00:00Z).`);
  }
  return parsed;
}

function parsePresence(value: unknown): ParticipantPresence {
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return {
      online: typeof obj.online === 'boolean' ? obj.online : undefined,
      lastSeen: obj.lastSeen,
      heartbeat: obj.heartbeat,
    };
  }
  return {};
}

function resolveTimestampMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function formatDateValue(value: unknown): string {
  const millis = resolveTimestampMillis(value);
  if (millis === null) return '';
  return new Date(millis).toISOString();
}

function formatLocalTimestamp(value: number | null, timeZone: string): string {
  if (value === null) return '';
  return formatInTimeZone(value, timeZone, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

function resolveDayRange(day: string, timeZone: string): { start: number; end: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error('Invalid --day value. Use YYYY-MM-DD format.');
  }
  const start = fromZonedTime(`${day}T00:00:00`, timeZone).getTime();
  const end = fromZonedTime(`${day}T23:59:59.999`, timeZone).getTime();
  return { start, end };
}

function validateTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new Error(`Invalid time zone "${timeZone}". Use an IANA zone like America/New_York.`);
  }
}

function timestampInRange(timestampMs: number | null, options: CliOptions): boolean {
  if (timestampMs === null) {
    return !(options.startDate || options.endDate);
  }
  if (options.startDate && timestampMs < options.startDate) {
    return false;
  }
  if (options.endDate && timestampMs > options.endDate) {
    return false;
  }
  return true;
}

async function exportSessions(options: CliOptions) {
  if (!fs.existsSync(options.serviceAccountPath)) {
    throw new Error(`Service account file not found at ${options.serviceAccountPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(options.serviceAccountPath, 'utf-8'));

  initializeApp({
    credential: cert(serviceAccount),
  });

  const db = getFirestore();
  const sessionsRef = db.collection('sessions');
  const sessionsQuery = options.includeActive
    ? sessionsRef
    : sessionsRef.where('archived', '==', true);

  const sessionsSnapshot = await sessionsQuery.get();
  console.log(`Found ${sessionsSnapshot.size} session(s) to export.`);

  const csvRows: string[] = [CSV_HEADERS.join(',')];
  let messageCounter = 0;

  for (const sessionDoc of sessionsSnapshot.docs) {
    const messagesSnapshot = await sessionDoc.ref
      .collection('messages')
      .orderBy('timestamp')
      .get();

    const presenceSnapshot = await sessionDoc.ref.collection('presence').get();
    const presence = presenceSnapshot.docs.reduce<Record<string, unknown>>((acc, presenceDoc) => {
      acc[presenceDoc.id] = presenceDoc.data();
      return acc;
    }, {});

    const participant1 = parsePresence(presence.participant1);
    const participant2 = parsePresence(presence.participant2);
    const archived = sessionDoc.data().archived ?? false;

    if (messagesSnapshot.empty) {
      csvRows.push(
        [
          sessionDoc.id,
          archived,
          '',
          '',
          '',
          '',
          participant1?.online ?? '',
          formatDateValue(participant1?.lastSeen),
          formatDateValue(participant1?.heartbeat),
          participant2?.online ?? '',
          formatDateValue(participant2?.lastSeen),
          formatDateValue(participant2?.heartbeat),
        ].map(toCsvValue).join(',')
      );
      continue;
    }

    for (const messageDoc of messagesSnapshot.docs) {
      const data = messageDoc.data();
      const timestampMillis = resolveTimestampMillis(data.timestamp);
      if (!timestampInRange(timestampMillis, options)) {
        continue;
      }

      const timestamp = formatLocalTimestamp(timestampMillis, options.timeZone);

      csvRows.push(
        [
          sessionDoc.id,
          archived,
          messageDoc.id,
          data.sender ?? '',
          timestamp,
          data.content ?? '',
          participant1?.online ?? '',
          formatDateValue(participant1?.lastSeen),
          formatDateValue(participant1?.heartbeat),
          participant2?.online ?? '',
          formatDateValue(participant2?.lastSeen),
          formatDateValue(participant2?.heartbeat),
        ].map(toCsvValue).join(',')
      );
      messageCounter += 1;
    }
  }

  fs.writeFileSync(options.outputPath, csvRows.join('\n'), 'utf-8');
  console.log(
    `Export complete. Wrote ${messageCounter} message row(s) across ${sessionsSnapshot.size} session(s) to ${options.outputPath}`
  );
}

const options = parseArgs();

exportSessions(options).catch((error) => {
  console.error('Failed to export chat logs:', error);
  process.exitCode = 1;
});
