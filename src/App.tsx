import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { scheduleNativeReminderAlarm3N12_5 } from "./native/nativeAlarmBridge3N12_5";
import "./App.css";
import {
  DEFAULT_LEARNING_MEMORY,
  createEmptyDraft,
  createRemindersFromDraft,
  getTestBank,
  isCancelIntent,
  isChangeIntent,
  isSaveIntent,
  processUserText,
  updateLearningMemory,
  visibleReminders,
} from "./lib/reminderEngine";
import type { ChatMessage, LearningMemory, Reminder, ReminderCategory, ReminderDraft } from "./lib/reminderTypes";
import { miniViktorReportToText, runMiniViktorRegressionArena } from "./brain/miniViktorRegressionArena";
import { runMiniViktorCorpusRegressionArena } from "./brain/miniViktorCorpusRegression";
import { getMiniViktorReminderCorpus, summarizeMiniViktorCorpus, exportMiniViktorCorpusAsJsonl } from "./brain/miniViktorReminderCorpus";
import type { MiniViktorRegressionReport } from "./brain/miniViktorRegressionArena";
import { miniViktorSimulationReportToText, runMiniViktorSimulationLab } from "./brain/miniViktorSimulationLab";
import type { MiniViktorSimulationReport } from "./brain/miniViktorSimulationLab";
import { buildMiniViktorTrainingDataset, miniViktorDatasetToJson, miniViktorDatasetToJsonl } from "./brain/miniViktorDatasetExport";
import type { MiniViktorDatasetExport } from "./brain/miniViktorDatasetExport";
import { getRemoteFeedbackConfig, pushFeedbackToRepository } from "./lib/feedbackRepository";
import FullScreenAlarm from "./components/FullScreenAlarm";

type NotificationState = NotificationPermission | "unsupported" | "https-needed";

type FeedbackIssueType =
  | "Did not understand"
  | "Wrong date"
  | "Wrong time"
  | "Wrong reminder/event split"
  | "Wrong AM/PM assumption"
  | "Multiple reminders issue"
  | "Save/notification issue"
  | "Voice input issue"
  | "UI issue"
  | "App/runtime issue"
  | "Other";

type BetaFeedbackSyncStatus = "local-only" | "pending" | "synced" | "failed";
type BetaFeedbackSource = "manual" | "auto";

type BetaFeedbackItem = {
  id: string;
  createdAt: string;
  testerId: string;
  issueType: FeedbackIssueType;
  comment: string;
  conversation: ChatMessage[];
  activeDraft: ReminderDraft | null;
  visibleRemindersSnapshot: Reminder[];
  appUrl: string;
  userAgent: string;
  source: BetaFeedbackSource;
  syncStatus: BetaFeedbackSyncStatus;
  syncedAt: string | null;
  syncError: string | null;
  buildLabel: string;
  appVersion: string;
  platform: string;
  nativeShell: boolean;
};

const FEEDBACK_ISSUE_TYPES: FeedbackIssueType[] = [
  "Did not understand",
  "Wrong date",
  "Wrong time",
  "Wrong reminder/event split",
  "Wrong AM/PM assumption",
  "Multiple reminders issue",
  "Save/notification issue",
  "Voice input issue",
  "UI issue",
  "App/runtime issue",
  "Other",
];

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

const NativeSpeechRecognition = registerPlugin<any>("SpeechRecognition");
const NativeTextToSpeech = registerPlugin<any>("TextToSpeech");
const LocalNotifications = registerPlugin<any>("LocalNotifications");
const RemindIqNativeAlarm = registerPlugin<any>("RemindIqNativeAlarm");

const REMINDERS_KEY = "remindiq_reminders_v2d_stable";
const DRAFT_KEY = "remindiq_active_draft_v2d_stable";
const MESSAGES_KEY = "remindiq_messages_v2d_stable";
const LEARNING_KEY = "remindiq_learning_v2d_stable";
const FEEDBACK_KEY = "remindiq_beta_feedback_v3n";
const TESTER_KEY = "remindiq_beta_tester_id_v2h";
const APP_VERSION = "3N.12.6-P0";
const APP_BUILD_LABEL = "Sprint 3N.12.6 · P0 Native Schedule Wired";
const BUILD_STATE_KEY = "remindiq_last_clean_build_version";

const FILTERS: Array<"All" | "Today" | "Upcoming" | "Done" | ReminderCategory> = [
  "All",
  "Today",
  "Upcoming",
  "Done",
  "Work",
  "Personal",
  "Health",
  "Finance",
  "Family",
  "Social",
  "Travel",
  "Home",
  "General",
];

function safeId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // fallback below
  }

  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function voiceLoopInstruction(draft: ReminderDraft | null, readyToSave: boolean) {
  if (!Capacitor.isNativePlatform()) {
    return "Web voice is fallback only. Android app uses native mic.";
  }

  if (!draft) {
    return "Tap Mic, speak the full reminder, and MiniViktor will process it automatically.";
  }

  if (readyToSave) {
    return "Tap Mic and say “save it”, “change it”, or “drop it”.";
  }

  if (draft.pendingAmbiguousTime) {
    return "Tap Mic and answer AM or PM.";
  }

  if (draft.pendingInferenceConfirmation) {
    return "Tap Mic and say “yes” to confirm, or correct the reminder time.";
  }

  if (!draft.task) {
    return "Tap Mic and say what the reminder is about.";
  }

  if (!draft.eventDateISO) {
    return "Tap Mic and say the day or date.";
  }

  if (!draft.eventTimeText && draft.alerts.length === 0) {
    return "Tap Mic and say the time.";
  }

  return "Tap Mic to answer MiniViktor’s follow-up.";
}

function addMessageToList(messages: ChatMessage[], role: "user" | "assistant", text: string): ChatMessage[] {
  return [
    ...messages,
    {
      id: safeId(),
      role,
      text,
      createdAt: new Date().toISOString(),
    },
  ];
}


function isHardVoiceCorrection(text: string) {
  return /^(that'?s wrong|thats wrong|wrong|no that'?s wrong|correct that|retry|try again|misheard|you heard wrong)$/i.test(text.trim());
}

function isStartOverIntent(text: string) {
  return /^(start over|restart|new reminder|reset|clear|clear it|clear this|clear that|clear draft|clear the draft|clear reminder|clear this reminder|cancel|cancel it|cancel that|cancel this|cancel current|cancel draft|cancel the draft|cancel this reminder|drop|drop it|drop this|drop that|drop this reminder|ignore|ignore it|ignore this|ignore that|ignore previous|ignore the previous|ignore previous one|ignore the previous one|ignore last|ignore the last|ignore last one|forget it|forget this|forget that|forget previous|forget the previous|forget last|discard|discard it|discard this|discard that|discard previous|discard the previous|scrap|scrap it|scrap this|scrap that|scrap this one|scratch it|scratch this|scratch that|delete it|delete this|delete that|delete draft|delete the draft|delete this reminder|remove it|remove this|remove that|remove draft|remove this reminder|erase it|erase this|erase draft|wipe it|wipe this|abandon it|abandon this|abort|abort it|ditch it|ditch this|kill it|kill this|void it|void this|bin it|bin this|trash it|trash this|stop it|stop this|skip it|skip this|not now|not this|not this one|leave it|leave this|leave that|never mind|nevermind)$/i.test(text.trim());
}

function isToday(iso: string | null) {
  if (!iso) return false;
  const date = new Date(iso);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}


function buildSpokenReply(text: string) {
  return text
    .replace(/RemindIQ Assistant:?/gi, "")
    .replace(/Perfect —/gi, "Perfect.")
    .replace(/Got it —/gi, "Got it.")
    .replace(/Done —/gi, "Done.")
    .replace(/I’ll remind you at the event time unless you want an earlier reminder\.\s*/gi, "I will remind you at the event time. ")
    .replace(/Should I save this reminder, adjust it, or drop it\?/gi, "Should I save it, adjust it, or drop it?")
    .replace(/Should I save these reminders, adjust them, or drop them\?/gi, "Should I save these reminders?")
    .replace(/This is the event time you gave me\./gi, "")
    .replace(/\(Repeats every 1 hour · today only\)/gi, "It repeats every one hour today only.")
    .replace(/\(Repeats daily\)/gi, "It repeats daily.")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSpokenText(text: string, maxLength = 170) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength - 1);
  const lastSentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (lastSentence > 80) return cut.slice(0, lastSentence + 1).trim();
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, Math.max(60, lastSpace)).trim()}...`;
}

function selectMiniViktorVoice(voices: SpeechSynthesisVoice[]) {
  const scored = voices
    .filter((voice) => /^en[-_]/i.test(voice.lang))
    .map((voice) => {
      const name = `${voice.name} ${voice.lang}`.toLowerCase();
      let score = 0;
      if (/en[-_]in/i.test(voice.lang)) score += 60;
      if (/en[-_]gb/i.test(voice.lang)) score += 35;
      if (/google|microsoft|natural|neural|premium|enhanced/.test(name)) score += 25;
      if (/ravi|amit|aarav|aditya|kabir|daniel|george|david|mark|male/.test(name)) score += 18;
      if (/female|zira|susan|samantha|victoria/.test(name)) score -= 10;
      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.voice || voices.find((voice) => /^en[-_]/i.test(voice.lang));
}

function isAndroidNativeShell() {
  return Capacitor.isNativePlatform() || /; wv\)/i.test(navigator.userAgent);
}


function isReminderRelatedDuringConfirmation(text: string) {
  const value = text.trim().toLowerCase();
  if (!value) return false;
  if (/^(yes|save|save it|save reminder|looks good|go ahead|ok|okay|done|perfect)$/i.test(value)) return true;
  if (/^(no|cancel|cancel it|cancel that|cancel this reminder|drop|drop it|drop this|drop that|ignore|ignore it|ignore this|ignore that|not needed|doesn't work|doesnt work|scrap|scrap it|scrap this|scrap that|scratch it|scratch that|delete it|remove it|discard it|forget it|never mind|nevermind|start over|restart|reset)$/i.test(value)) return true;
  if (/^(change|change it|change something|edit|edit it|adjust|adjust it|adjusted|tweak|modify|modify it)$/i.test(value)) return true;
  if (/\b(remind|reminder|alarm|name|rename|title|earlier|early|before|after|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm|a\.m|p\.m|at\s+\d|\d{1,2}:\d{2}|save|drop|cancel|change|correct|wrong|i said|actually|call it|make it|repeat|repeats|repeating|repetition|repeaters|every|hour|minute|from now)\b/i.test(text)) return true;
  return false;
}

function looksLikeDraftRenameIntent(text: string) {
  return Boolean(extractDraftRenameText(text));
}

function isContextualTimeOrRepeatEdit(text: string) {
  return /\b(today only|only today|today|tomorrow|for today|repeat|repeats|repeating|repetition|repeaters?|every\s+(?:one|1|\d+)|hour|minute|from now|make it|change it to|at\s+\d|\d{1,2}:\d{2}|am|pm|a\.m|p\.m)\b/i.test(text);
}

function contextualFallbackText() {
  return "I’m not fully sure how this changes the current reminder. Are you trying to rename it, change the time, change the repeat, save it, or cancel it?";
}

function extractDraftRenameText(text: string) {
  const value = text.trim();
  const patterns = [
    /^(?:name|rename|title)\s+(?:the\s+)?(?:alarm|reminder|it)\s+(?:as|to)\s+(.+)$/i,
    /^(?:name|rename|title)\s+(?:as\s+)?(.+)$/i,
    /^(?:call|save)\s+(?:it|this|the\s+alarm|the\s+reminder)\s+(?:as\s+)?(.+)$/i,
    /^call\s+it\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return cleanDraftTitleCandidate(match[1]);
  }

  return "";
}

function cleanDraftTitleCandidate(value: string) {
  return value
    .replace(/^(?:as|to)\s+/i, "")
    .replace(/\b(?:reminder|alarm)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeBareTaskChange(text: string) {
  const value = text.trim();
  if (!value) return false;
  if (value.split(/\s+/).length > 6) return false;
  if (/^(save|save it|save reminder|cancel|drop|change|change it|adjust|adjusted|edit|reminder|alarm)$/i.test(value)) return false;
  if (/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm|a\.m|p\.m|\d{1,2}:\d{2}|\b\d{1,2}\b)\b/i.test(value)) return false;
  return /[a-z]/i.test(value);
}

function parseSingleTimeFromText(text: string) {
  const value = text.toLowerCase();
  const match = value.match(/\b(\d{1,2})(?::|\.)(\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b|\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (!match) return null;

  const rawHour = Number(match[1] || match[4]);
  const minute = match[2] ? Number(match[2]) : 0;
  const periodRaw = (match[3] || match[5] || "").replace(/\./g, "").toLowerCase();
  if (!Number.isFinite(rawHour) || rawHour < 1 || rawHour > 12 || !Number.isFinite(minute) || minute > 59) return null;

  let hour = rawHour;
  if (periodRaw === "pm" && hour < 12) hour += 12;
  if (periodRaw === "am" && hour === 12) hour = 0;
  if (!periodRaw) return null;

  return {
    hour,
    minute,
    timeText: `${rawHour}:${String(minute).padStart(2, "0")} ${periodRaw}`,
  };
}

function hasPastDraftAlert(draft: ReminderDraft) {
  const now = Date.now();
  return draft.alerts.some((alert) => new Date(alert.dueAt).getTime() <= now);
}

function updateFirstPastAlertTime(draft: ReminderDraft, text: string): ReminderDraft | null {
  const parsed = parseSingleTimeFromText(text);
  if (!parsed) return null;

  const index = draft.alerts.findIndex((alert) => new Date(alert.dueAt).getTime() <= Date.now());
  if (index < 0) return null;

  const existing = draft.alerts[index];
  const nextDue = new Date(existing.dueAt || existing.dateISO);
  nextDue.setHours(parsed.hour, parsed.minute, 0, 0);

  const nextAlert = {
    ...existing,
    timeText: parsed.timeText,
    dueAt: nextDue.toISOString(),
    dateLabel: existing.dateLabel || (existing.datePhrase === "today" ? "Today" : existing.datePhrase === "tomorrow" ? "Tomorrow" : existing.datePhrase),
  };

  const alerts = [...draft.alerts];
  alerts[index] = nextAlert;
  alerts.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  return {
    ...draft,
    alerts,
    pendingAmbiguousTime: null,
    pendingInferenceConfirmation: null,
    lastQuestion: "confirm",
  };
}

function confirmationTextForDraft(draft: ReminderDraft) {
  if (draft.alerts.length > 1) {
    const alertText = draft.alerts.map((alert) => `${alert.datePhrase} at ${alert.timeText}`).join(" and ");
    const eventText = draft.eventAt && draft.eventTimeText ? ` The event is at ${draft.eventTimeText}.` : "";
    return `Got it — I’ll remind you about ${draft.task} ${alertText}.${eventText} Should I save these reminders, adjust them, or drop them?`;
  }

  const alert = draft.alerts[0];
  if (!alert) return `Updated — ${draft.task}. What else would you like to change?`;
  const repeatText = draft.repeatRule ? ` ${draft.repeatRule.label}.` : "";
  if (draft.isAlarm) {
    return `Updated — your alarm is set for ${alert.datePhrase} at ${alert.timeText}.${repeatText} Should I save this alarm, adjust it, or drop it?`;
  }
  const eventText = draft.eventAt && draft.eventTimeText && draft.eventTimeText !== alert.timeText ? ` The event is at ${draft.eventTimeText}.` : "";
  return `Updated — ${draft.task} is ${alert.datePhrase} at ${alert.timeText}.${eventText}${repeatText} Should I save this reminder, adjust it, or drop it?`;
}

function compactForEchoCheck(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(miniviktor|remindiq|assistant)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeMiniViktorEcho(transcript: string, lastSpoken: string) {
  const heard = compactForEchoCheck(transcript);
  const spoken = compactForEchoCheck(lastSpoken);
  if (!heard || !spoken) return false;
  if (heard.includes("should i save") || heard.includes("i will remind") || heard.includes("ill remind")) return true;
  const heardWords = new Set(heard.split(" ").filter((word) => word.length > 2));
  const spokenWords = spoken.split(" ").filter((word) => word.length > 2);
  if (heardWords.size < 4 || spokenWords.length < 4) return false;
  const overlap = spokenWords.filter((word) => heardWords.has(word)).length;
  return overlap / Math.max(heardWords.size, 1) >= 0.65;
}

async function ensureAndroidAlarmChannel() {
  if (!isAndroidNativeShell()) return;
  try {
    await LocalNotifications.createChannel({
      id: "remindiq_alarms_v5",
      name: "RemindIQ Ringing Alarms v5",
      description: "High priority sound and vibration alarms from RemindIQ",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "default",
      lights: true,
      lightColor: "#f7b955",
    });
  } catch {
    // Channel creation can fail on web or some plugin versions. Notification scheduling will still attempt fallback.
  }
}

function normalizeReminder(item: any): Reminder {
  return {
    id: item.id || safeId(),
    title: item.title || "Untitled reminder",
    rawText: item.rawText || item.title || "",
    dateText: item.dateText || "Date missing",
    datePhrase: item.datePhrase || item.dateText || "",
    timeText: item.timeText || "Time missing",
    dueAt: item.dueAt || null,
    status: item.status || "needs_info",
    category: item.category || "General",
    createdAt: item.createdAt || new Date().toISOString(),
    notifiedAt: item.notifiedAt || null,
    approximateTime: item.approximateTime || false,
    eventAt: item.eventAt || null,
    eventDateText: item.eventDateText,
    eventTimeText: item.eventTimeText,
    eventPhrase: item.eventPhrase,
    sourceDraftId: item.sourceDraftId,
    repeatRule: item.repeatRule || null,
    isAlarm: item.isAlarm || false,
  };
}

function detectPlatformLabel() {
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    return platform === "android" ? "Android" : platform;
  }

  return "Web";
}

function normalizeFeedbackItem(item: any): BetaFeedbackItem {
  return {
    id: item.id || safeId(),
    createdAt: item.createdAt || new Date().toISOString(),
    testerId: item.testerId || "anonymous",
    issueType: item.issueType || "Other",
    comment: item.comment || "",
    conversation: Array.isArray(item.conversation) ? item.conversation : [],
    activeDraft: item.activeDraft || null,
    visibleRemindersSnapshot: Array.isArray(item.visibleRemindersSnapshot) ? item.visibleRemindersSnapshot.map(normalizeReminder) : [],
    appUrl: item.appUrl || window.location.href,
    userAgent: item.userAgent || navigator.userAgent,
    source: item.source || "manual",
    syncStatus: item.syncStatus || "local-only",
    syncedAt: item.syncedAt || null,
    syncError: item.syncError || null,
    buildLabel: item.buildLabel || APP_BUILD_LABEL,
    appVersion: item.appVersion || APP_VERSION,
    platform: item.platform || detectPlatformLabel(),
    nativeShell: Boolean(item.nativeShell),
  };
}

function toFeedbackRepositoryPayload(item: BetaFeedbackItem) {
  return {
    feedback_id: item.id,
    created_at: item.createdAt,
    tester_id: item.testerId,
    issue_type: item.issueType,
    comment: item.comment,
    conversation: item.conversation,
    active_draft: item.activeDraft,
    visible_reminders_snapshot: item.visibleRemindersSnapshot,
    app_url: item.appUrl,
    user_agent: item.userAgent,
    source: item.source,
    sync_status: item.syncStatus,
    synced_at: item.syncedAt,
    sync_error: item.syncError,
    build_label: item.buildLabel,
    app_version: item.appVersion,
    platform: item.platform,
    native_shell: item.nativeShell,
  };
}

function App() {
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<ReminderDraft | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [learning, setLearning] = useState<LearningMemory>(DEFAULT_LEARNING_MEMORY);
  const [notificationState, setNotificationState] = useState<NotificationState>("unsupported");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [lastVoiceTranscript, setLastVoiceTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("All");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [actionButtonsArmed, setActionButtonsArmed] = useState(false);
  const [draftChangeMode, setDraftChangeMode] = useState(false);
  const [brainReport, setBrainReport] = useState<MiniViktorRegressionReport | null>(null);
  const [corpusReport, setCorpusReport] = useState<MiniViktorRegressionReport | null>(null);
  const [simulationReport, setSimulationReport] = useState<MiniViktorSimulationReport | null>(null);
  const [datasetExport, setDatasetExport] = useState<MiniViktorDatasetExport | null>(null);
  const corpusSummary = useMemo(() => summarizeMiniViktorCorpus(getMiniViktorReminderCorpus()), []);
  const [testerId, setTesterId] = useState("");
  const [issueType, setIssueType] = useState<FeedbackIssueType>("Did not understand");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<BetaFeedbackItem[]>([]);
  const remoteFeedbackConfig = useMemo(() => getRemoteFeedbackConfig(), []);
  const [feedbackSyncMessage, setFeedbackSyncMessage] = useState(remoteFeedbackConfig ? "Central repository configured. Pending items will sync automatically." : "Central repository not configured yet. Feedback will stay local until repository keys are added.");
  const [exportPreview, setExportPreview] = useState<{ filename: string; contents: string; mimeType: string } | null>(null);
  const [sidePanel, setSidePanel] = useState<"reminders" | "feedback" | "tests">("reminders");
  const [activeMainTab, setActiveMainTab] = useState<"chat" | "reminders" | "feedback" | "tests">("chat");
  const [spokenRepliesEnabled, setSpokenRepliesEnabled] = useState(true);
  const [isMiniViktorSpeaking, setIsMiniViktorSpeaking] = useState(false);
  const [alarmStatus, setAlarmStatus] = useState("3N.12.6 native alarm wiring active.");
  const [alarmCapability, setAlarmCapability] = useState("Native alarm diagnostics not checked yet.");
  const [ringingReminders, setRingingReminders] = useState<Reminder[]>([]);
  // Sprint 3N.11.6 P0: WebView alarm control surface is the source of truth.
  // Native fullscreen is unreliable on the tested Android/WebView environment and was
  // producing the broken white screen / floating pill UI. Keep the in-app alarm
  // takeover enabled so Snooze/Done/Open controls are always visible when WebView is active.
  const useNativeAlarmOnly = true;

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const lastSpokenAssistantRef = useRef("");
  const speechReleaseTimerRef = useRef<number | null>(null);
  const spokenMessagesCountRef = useRef(0);
  const alarmToneTimerRef = useRef<number | null>(null);
  const alarmAudioContextRef = useRef<AudioContext | null>(null);
  const alarmOscillatorRef = useRef<OscillatorNode | null>(null);
  const feedbackSyncInFlightRef = useRef(false);

  function stopInAppAlarmTone() {
    if (alarmToneTimerRef.current) {
      window.clearInterval(alarmToneTimerRef.current);
      alarmToneTimerRef.current = null;
    }

    try {
      alarmOscillatorRef.current?.stop();
    } catch {
      // Oscillator may already be stopped.
    }
    alarmOscillatorRef.current = null;

    try {
      void alarmAudioContextRef.current?.close();
    } catch {
      // Ignore audio cleanup failures.
    }
    alarmAudioContextRef.current = null;

    try {
      if ("vibrate" in navigator) navigator.vibrate(0);
    } catch {
      // Vibration is optional.
    }
  }

  function stopAllAudioNow() {
    // Sprint 3L: hard-stop every in-app sound path immediately. This is used by
    // full-screen Done/Snooze, app close/background, and voice barge-in paths.
    stopInAppAlarmTone();

    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {
      // Ignore browser TTS cleanup failures.
    }

    try {
      if (isAndroidNativeShell() && typeof NativeTextToSpeech.stop === "function") {
        void NativeTextToSpeech.stop();
      }
    } catch {
      // Native stop is best-effort only.
    }

    try {
      if (isAndroidNativeShell() && typeof RemindIqNativeAlarm.stopRinging === "function") {
        void RemindIqNativeAlarm.stopRinging();
      }
    } catch {
      // Native alarm service cleanup is best-effort only.
    }

    setIsMiniViktorSpeaking(false);
  }

  function startInAppAlarmTone() {
    if (alarmToneTimerRef.current) return;

    const playPulse = () => {
      try {
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextCtor) return;

        const context = new AudioContextCtor();
        alarmAudioContextRef.current = context;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
        oscillator.connect(gain);
        gain.connect(context.destination);
        alarmOscillatorRef.current = oscillator;
        oscillator.start();
        oscillator.stop(context.currentTime + 0.55);
      } catch {
        // Mobile browsers may block audio until user interaction. Full-screen UI remains primary.
      }

      try {
        if ("vibrate" in navigator) navigator.vibrate([450, 180, 450]);
      } catch {
        // Vibration is optional.
      }
    };

    playPulse();
    alarmToneTimerRef.current = window.setInterval(playPulse, 1800);
  }

  async function stopMiniViktorSpeechForBargeIn() {
    stopInAppAlarmTone();
    if (speechReleaseTimerRef.current) {
      window.clearTimeout(speechReleaseTimerRef.current);
      speechReleaseTimerRef.current = null;
    }

    try {
      if (isAndroidNativeShell() && typeof NativeTextToSpeech.stop === "function") {
        await NativeTextToSpeech.stop();
      }
    } catch {
      // Some Android TTS bridges do not expose stop(). Web cancellation below remains the fallback.
    }

    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {
      // Ignore cancellation failures.
    }

    stopInAppAlarmTone();
    setIsMiniViktorSpeaking(false);
  }

  useEffect(() => {
    void ensureAndroidAlarmChannel();

    // Sprint 3N.8: hard reset stale speech/draft state on build update/start.
    // This prevents MiniViktor from finishing an old spoken sentence after reinstall/update.
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {
      // Browser TTS cleanup is best-effort.
    }
    try {
      if (isAndroidNativeShell() && typeof NativeTextToSpeech.stop === "function") void NativeTextToSpeech.stop();
    } catch {
      // Native TTS cleanup is best-effort.
    }
    try {
      const previousBuild = localStorage.getItem(BUILD_STATE_KEY);
      if (previousBuild !== APP_VERSION) {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(MESSAGES_KEY);
        localStorage.setItem(BUILD_STATE_KEY, APP_VERSION);
      }
    } catch {
      // Local state cleanup is best-effort.
    }

    const isHttps = window.location.protocol === "https:" || window.location.hostname === "localhost";

    if (!("Notification" in window)) {
      setNotificationState("unsupported");
    } else if (!isHttps) {
      setNotificationState("https-needed");
    } else {
      setNotificationState(Notification.permission);
    }

    try {
      const savedReminders = localStorage.getItem(REMINDERS_KEY);
      if (savedReminders) {
        const parsed = JSON.parse(savedReminders);
        setReminders(Array.isArray(parsed) ? parsed.map(normalizeReminder) : []);
      }

      const savedMessages = localStorage.getItem(MESSAGES_KEY);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        const restoredMessages = Array.isArray(parsed) ? parsed.slice(-8) : [];
        spokenMessagesCountRef.current = restoredMessages.length;
        setMessages(restoredMessages);
      }

      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && parsed.id) setDraft(parsed);
      }

      const savedLearning = localStorage.getItem(LEARNING_KEY);
      if (savedLearning) {
        setLearning({ ...DEFAULT_LEARNING_MEMORY, ...JSON.parse(savedLearning) });
      }

      const savedTesterId = localStorage.getItem(TESTER_KEY);
      if (savedTesterId) setTesterId(savedTesterId);

      const savedFeedback = localStorage.getItem(FEEDBACK_KEY);
      if (savedFeedback) {
        const parsed = JSON.parse(savedFeedback);
        setFeedbackItems(Array.isArray(parsed) ? parsed.map(normalizeFeedbackItem) : []);
      }
    } catch {
      // Ignore corrupted local state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-12)));
  }, [messages]);

  useEffect(() => {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  }, [draft]);

  useEffect(() => {
    localStorage.setItem(LEARNING_KEY, JSON.stringify(learning));
  }, [learning]);

  useEffect(() => {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackItems));
  }, [feedbackItems]);

  useEffect(() => {
    localStorage.setItem(TESTER_KEY, testerId);
  }, [testerId]);

  useEffect(() => {
    if (!remoteFeedbackConfig) return;
    const pendingCount = feedbackItems.filter((item) => item.syncStatus !== "synced").length;
    if (pendingCount === 0) return;
    void syncFeedbackItems();
  }, [feedbackItems, remoteFeedbackConfig]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, draft]);

  useEffect(() => {
    const cleanupAudio = () => {
      void stopMiniViktorSpeechForBargeIn();
    };
    const handleVisibility = () => {
      if (document.hidden) cleanupAudio();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", cleanupAudio);
    window.addEventListener("beforeunload", cleanupAudio);
    window.addEventListener("blur", cleanupAudio);
    document.addEventListener("freeze", cleanupAudio as EventListener);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", cleanupAudio);
      window.removeEventListener("beforeunload", cleanupAudio);
      window.removeEventListener("blur", cleanupAudio);
      document.removeEventListener("freeze", cleanupAudio as EventListener);
      cleanupAudio();
    };
  }, []);

  useEffect(() => {
    if (ringingReminders.length > 0 && !useNativeAlarmOnly) startInAppAlarmTone();
    else stopInAppAlarmTone();

    return () => stopInAppAlarmTone();
  }, [ringingReminders.length, useNativeAlarmOnly]);

  useEffect(() => {
    const previousMessageCount = spokenMessagesCountRef.current;
    if (messages.length <= previousMessageCount) {
      spokenMessagesCountRef.current = messages.length;
      return;
    }
    spokenMessagesCountRef.current = messages.length;

    if (!spokenRepliesEnabled || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;

    const spoken = buildSpokenReply(last.text);
    if (!spoken) return;
    const shortSpoken = compactSpokenText(spoken, 170);
    lastSpokenAssistantRef.current = shortSpoken;

    async function releaseSpeakingSoon(delay = 600) {
      if (speechReleaseTimerRef.current) window.clearTimeout(speechReleaseTimerRef.current);
      speechReleaseTimerRef.current = window.setTimeout(() => setIsMiniViktorSpeaking(false), delay);
    }

    async function speakWithBestAvailableEngine() {
      setIsMiniViktorSpeaking(true);
      try {
        if (isAndroidNativeShell()) {
          await NativeTextToSpeech.speak({
            text: shortSpoken,
            lang: "en-IN",
            rate: 0.84,
            pitch: 0.86,
            volume: 1.0,
          });
          await releaseSpeakingSoon(900);
          return;
        }
      } catch {
        // Fall back to Web Speech below.
      }

      try {
        if (!("speechSynthesis" in window)) {
          setIsMiniViktorSpeaking(false);
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(shortSpoken);
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = selectMiniViktorVoice(voices);
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.lang = preferredVoice?.lang || "en-IN";
        utterance.rate = 0.84;
        utterance.pitch = 0.86;
        utterance.onend = () => setIsMiniViktorSpeaking(false);
        utterance.onerror = () => setIsMiniViktorSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsMiniViktorSpeaking(false);
        // Ignore text-to-speech failures. Text response remains primary.
      }
    }

    void speakWithBestAvailableEngine();
  }, [messages, spokenRepliesEnabled]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setReminders((previous) => {
        const now = Date.now();
        const dueItems: Reminder[] = [];

        const next = previous.map((item): Reminder => {
          const isDue =
            item.status === "confirmed" &&
            item.dueAt &&
            !item.notifiedAt &&
            new Date(item.dueAt).getTime() <= now;

          if (isDue) {
            dueItems.push(item);
            const nextDueAt = nextRepeatDueAt(item);
            if (nextDueAt) {
              return updateReminderScheduleFromIso(item, nextDueAt);
            }

            // Sprint 3N.11.6: do NOT mark notifiedAt merely because the due time arrived.
            // Marking notifiedAt here caused visibleReminders() to archive/hide the reminder
            // before the user pressed Done/Dismiss. The reminder must remain in the
            // Reminders tab until the alarm is explicitly dismissed.
            return item;
          }

          if (
            item.status === "confirmed" &&
            item.dueAt &&
            item.notifiedAt &&
            new Date(item.dueAt).getTime() < now &&
            !(item.repeatRule && item.repeatRule.kind !== "none")
          ) {
            return {
              ...item,
              status: "archived",
            };
          }

          return item;
        });

        // Sprint 3N.1 P0: always force the in-app alarm control surface when a
        // due alarm/reminder is detected. The prior native-only guard meant Android
        // testers could hear/receive an alarm without seeing Snooze/Done controls.
        if (dueItems.length > 0) {
          window.setTimeout(() => {
            setRingingReminders((current) => {
              const existingIds = new Set(current.map((item) => item.id));
              const freshDueItems = dueItems.filter((item) => !existingIds.has(item.id));
              return [...current, ...freshDueItems].slice(-3);
            });
          }, 0);
        }

        // Browser notifications remain web-only so the Android APK uses the single
        // RemindIQ in-app control screen rather than a second notification surface.
        if (!isAndroidNativeShell()) {
          dueItems.forEach((item) => {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("RemindIQ", { body: item.title });
            }
          });
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (ringingReminders.length > 0) {
      stopMiniViktorSpeechForBargeIn().catch(() => undefined);
      if (!useNativeAlarmOnly) startInAppAlarmTone();
    } else {
      stopInAppAlarmTone();
    }
  }, [ringingReminders.length, useNativeAlarmOnly]);

  const activeReminders = useMemo(() => {
    const visible = visibleReminders(reminders);
    const visibleIds = new Set(visible.map((item) => item.id));
    const alarmFallback = reminders.filter(
      (item) => item.isAlarm && item.status !== "archived" && !visibleIds.has(item.id)
    );
    return [...visible, ...alarmFallback];
  }, [reminders]);

  const filteredReminders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return activeReminders.filter((reminder) => {
      const matchesSearch =
        !term ||
        reminder.title.toLowerCase().includes(term) ||
        reminder.category.toLowerCase().includes(term) ||
        reminder.dateText.toLowerCase().includes(term) ||
        reminder.timeText.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      if (activeFilter === "All") return true;
      if (activeFilter === "Today") return isToday(reminder.dueAt);
      if (activeFilter === "Upcoming") return reminder.status === "confirmed" && (Boolean(reminder.dueAt) || Boolean(reminder.repeatRule));
      if (activeFilter === "Done") return reminder.status === "done";

      return reminder.category === activeFilter;
    });
  }, [activeReminders, activeFilter, search]);

  const activeCount = activeReminders.filter((item) => item.status === "confirmed").length;
  const doneCount = activeReminders.filter((item) => item.status === "done").length;
  const readyToSave = Boolean(
    draft &&
      draft.alerts.length > 0 &&
      draft.task.trim() &&
      !draft.pendingAmbiguousTime &&
      !draft.pendingInferenceConfirmation
  );

  const voiceLoopText = useMemo(() => voiceLoopInstruction(draft, readyToSave), [draft, readyToSave]);
  const micButtonLabel = isListening
    ? "Listening..."
    : Capacitor.isNativePlatform()
      ? draft
        ? "Mic reply"
        : "Mic"
      : "Speak";

  useEffect(() => {
    if (!readyToSave) {
      setActionButtonsArmed(false);
      return;
    }

    setActionButtonsArmed(false);
    const timer = window.setTimeout(() => setActionButtonsArmed(true), 450);
    return () => window.clearTimeout(timer);
  }, [readyToSave, draft?.id, draft?.alerts.length]);

  async function requestNotifications() {
    const isHttps = window.location.protocol === "https:" || window.location.hostname === "localhost";

    if (!("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }

    if (!isHttps) {
      setNotificationState("https-needed");
      setVoiceMessage("Notifications need HTTPS on mobile. Local Wi-Fi preview can still test typing and reminders.");
      return;
    }

    const result = await Notification.requestPermission();
    setNotificationState(result);
  }


  async function checkNativeAlarmDiagnostics() {
    if (!isAndroidNativeShell()) {
      setAlarmCapability("Web preview: native Android alarm diagnostics are available only in the APK.");
      return;
    }

    try {
      if (typeof RemindIqNativeAlarm.getAlarmCapability === "function") {
        const capability = await RemindIqNativeAlarm.getAlarmCapability();
        const notification = capability?.notificationsAllowed === false ? "notifications blocked" : "notifications allowed";
        const exact = capability?.exactAllowed === false ? "exact alarm off" : "exact alarm allowed";
        const full = capability?.fullScreenIntentAllowed === false ? "full-screen blocked by Android" : "full-screen allowed/unknown";
        const scheduled = capability?.lastScheduledAtEpochMs ? ` · scheduled ${new Date(capability.lastScheduledAtEpochMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "";
        const fired = capability?.lastReceiverFiredAtEpochMs ? ` · receiver fired ${new Date(capability.lastReceiverFiredAtEpochMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : " · receiver not fired yet";
        const action = capability?.lastNativeAction ? ` · last action ${capability.lastNativeAction}` : "";
        const scheduler = capability?.lastScheduleUsedAlarmClock ? " · AlarmClock scheduler" : "";
        setAlarmCapability(`${notification} · ${exact} · ${full}${scheduler}${scheduled}${fired}${action}`);
        return;
      }
      setAlarmCapability("Native diagnostics plugin not available in this installed build.");
    } catch (error: any) {
      setAlarmCapability(`Native alarm diagnostic failed: ${error?.message || "unknown error"}`);
    }
  }

  async function requestNativeAlarmPermissions() {
    if (!isAndroidNativeShell()) return true;
    try {
      await ensureAndroidAlarmChannel();
      const current = await LocalNotifications.checkPermissions();
      const permission = current?.display === "granted" ? current : await LocalNotifications.requestPermissions();
      if (permission?.display !== "granted") {
        setAlarmStatus("Android notification permission was not granted. Alarm cannot ring outside the app.");
        return false;
      }

      try {
        if (typeof LocalNotifications.checkExactNotificationSetting === "function") {
          const exact = await LocalNotifications.checkExactNotificationSetting();
          const exactStatus = String(exact?.exactAlarm ?? exact?.value ?? exact?.setting ?? "").toLowerCase();
          if (exactStatus && !exactStatus.includes("granted") && !exactStatus.includes("enabled")) {
            setAlarmStatus("Notifications are allowed, but exact alarm permission may be off. Android may delay the alarm.");
          }
        }
      } catch {
        // Exact alarm setting is not available on every plugin/device version.
      }

      return true;
    } catch {
      setAlarmStatus("Could not verify Android alarm permission. In-app fallback remains active.");
      return false;
    }
  }

  async function scheduleNativeAlarm(reminder: Reminder) {
    if (!reminder.dueAt || reminder.status !== "confirmed") {
      setAlarmStatus(`Native alarm skipped for ${reminder.title}: missing due time or reminder not confirmed.`);
      return;
    }

    const when = new Date(reminder.dueAt);
    if (when.getTime() <= Date.now()) {
      setAlarmStatus(`Skipped past alarm for ${reminder.title}.`);
      return;
    }

    if (isAndroidNativeShell()) {
      try {
        setAlarmStatus(`Scheduling native alarm for ${reminder.title} at ${reminder.timeText}...`);

        try {
          await requestNativeAlarmPermissions();
        } catch {
          // Permission helper is best-effort. Native scheduler will still report capability/failure.
        }

        const result = await scheduleNativeReminderAlarm3N12_5(reminder);

        if (result?.skipped) {
          setAlarmStatus(`Native alarm not scheduled: ${result.reason || "unknown reason"}.`);
          setAlarmCapability(`Native schedule skipped: ${result.reason || "unknown reason"}`);
          return;
        }

        const scheduler = result?.usedAlarmClock ? "AlarmClock scheduler" : "native scheduler";
        setAlarmStatus(`Native alarm scheduled for ${reminder.dateText} at ${reminder.timeText}.`);
        setAlarmCapability(`${scheduler} · id ${reminder.id}`);

        try {
          await checkNativeAlarmDiagnostics();
        } catch {
          // Diagnostics are useful but should not block scheduling.
        }

        return;
      } catch (error: any) {
        const message = error?.message || String(error || "unknown error");
        setAlarmStatus(`Native alarm schedule failed for ${reminder.title}: ${message}`);
        setAlarmCapability(`Native schedule failed: ${message}`);
        console.error("[3N.12.6] Native alarm schedule failed", error);
        return;
      }
    }

    // Web/PWA fallback only.
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.abs(Array.from(reminder.id).reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 2147483647,
            title: "RemindIQ reminder",
            body: reminder.eventTimeText
              ? `${reminder.title} · reminder ${reminder.timeText} · event ${reminder.eventTimeText}`
              : `${reminder.title} · ${reminder.timeText}`,
            schedule: { at: when, allowWhileIdle: true },
            channelId: "remindiq_web_fallback",
            sound: "default",
            smallIcon: "ic_launcher",
            autoCancel: true,
            ongoing: false,
            extra: { reminderId: reminder.id },
          },
        ],
      });
      setAlarmStatus(`Web fallback notification scheduled for ${reminder.dateText} at ${reminder.timeText}.`);
    } catch {
      setAlarmStatus("Saved reminder. Web fallback notification could not be scheduled.");
    }
  }

  async function cancelNativeAlarm(reminderId: string) {
    if (!isAndroidNativeShell()) return;
    try {
      if (typeof RemindIqNativeAlarm.cancelAlarm === "function") {
        await RemindIqNativeAlarm.cancelAlarm({ id: reminderId });
        return;
      }
      const notificationId = Math.abs(Array.from(reminderId).reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 2147483647;
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    } catch {
      // Cancellation failure should not block UI state changes.
    }
  }

  function nextRepeatDueAt(reminder: Reminder): string | null {
    if (!reminder.repeatRule || reminder.repeatRule.kind === "none" || !reminder.dueAt) return null;
    const current = new Date(reminder.dueAt);
    const now = Date.now();
    let next = new Date(current);

    const withinRepeatEnd = (candidate: Date) => {
      if (!reminder.repeatRule?.endDateISO) return true;
      const end = new Date(reminder.repeatRule.endDateISO);
      end.setHours(23, 59, 59, 999);
      return candidate.getTime() <= end.getTime();
    };

    if (reminder.repeatRule.kind === "hourly") {
      const interval = Math.max(reminder.repeatRule.intervalMinutes || 60, 1);
      do {
        next = new Date(next.getTime() + interval * 60 * 1000);
      } while (next.getTime() <= now);
      return withinRepeatEnd(next) ? next.toISOString() : null;
    }

    if (reminder.repeatRule.kind === "daily") {
      do {
        next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
      } while (next.getTime() <= now);
      return withinRepeatEnd(next) ? next.toISOString() : null;
    }

    if (reminder.repeatRule.kind === "weekly") {
      do {
        next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
      } while (next.getTime() <= now);
      return withinRepeatEnd(next) ? next.toISOString() : null;
    }

    return null;
  }

  function updateReminderScheduleFromIso(reminder: Reminder, dueAt: string): Reminder {
    const due = new Date(dueAt);
    return {
      ...reminder,
      dueAt,
      dateText: due.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
      timeText: due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase(),
      notifiedAt: null,
    };
  }

  function saveDraft() {
    if (!draft) return;

    const result = createRemindersFromDraft(draft);

    if (result.reminders.length === 0) {
      setMessages((prev) => addMessageToList(prev, "assistant", result.assistantText));
      return;
    }

    setReminders((prev) => [...result.reminders, ...prev]);
    result.reminders.forEach((reminder) => void scheduleNativeAlarm(reminder));
    setLearning((prev) => updateLearningMemory(prev, result.reminders));
    setMessages((prev) => addMessageToList(prev, "assistant", result.assistantText));
    setDraft(null);
    setDraftChangeMode(false);
  }

  function processText(text: string) {
    const cleanText = text.trim();
    if (!cleanText) return;

    setMessages((prev) => addMessageToList(prev, "user", cleanText));

    if (draft && isStartOverIntent(cleanText)) {
      setDraft(null);
      setDraftChangeMode(false);
      setInput("");
      setVoiceMessage("Draft cleared. Tell me the next reminder when ready.");
      setMessages((prev) =>
        addMessageToList(prev, "assistant", "Got it — I’ve cleared this reminder draft. Tell me the next reminder when ready.")
      );
      return;
    }

    if (draft && !draft.pendingInferenceConfirmation && isHardVoiceCorrection(cleanText)) {
      setDraft(null);
      setDraftChangeMode(false);
      setInput("");
      setVoiceMessage("I’ll ignore the last draft. Tap Mic and repeat the full reminder clearly.");
      setMessages((prev) =>
        addMessageToList(prev, "assistant", "Understood — I’ll ignore that draft. Tap Mic and repeat the full reminder clearly.")
      );
      return;
    }

    if (draft && readyToSave && isSaveIntent(cleanText)) {
      setTimeout(saveDraft, 0);
      return;
    }

    if (draft && isCancelIntent(cleanText)) {
      setDraft(null);
      setDraftChangeMode(false);
      setMessages((prev) =>
        addMessageToList(prev, "assistant", "Got it — I’ve cleared this reminder draft. Tell me the next reminder when ready.")
      );
      return;
    }

    if (draft && readyToSave && isChangeIntent(cleanText)) {
      setDraftChangeMode(true);
      setMessages((prev) =>
        addMessageToList(
          prev,
          "assistant",
          "Sure — what would you like to change? You can say ‘name it study time’, ‘change it to 10 pm’, ‘call Raj’, or ‘cancel it’."
        )
      );
      return;
    }

    if (draft && draftChangeMode) {
      const renamed = extractDraftRenameText(cleanText) || (looksLikeBareTaskChange(cleanText) ? cleanDraftTitleCandidate(cleanText) : "");
      if (renamed) {
        const updatedDraft = {
          ...draft,
          task: renamed,
          rawText: `${draft.rawText} | ${cleanText}`,
          lastQuestion: "confirm" as const,
        };
        setDraft(updatedDraft);
        setDraftChangeMode(false);
        setMessages((prev) => addMessageToList(prev, "assistant", confirmationTextForDraft(updatedDraft)));
        return;
      }
    }

    if (draft && hasPastDraftAlert(draft)) {
      const updatedDraft = updateFirstPastAlertTime(draft, cleanText);
      if (updatedDraft) {
        setDraft(updatedDraft);
        setDraftChangeMode(false);
        setMessages((prev) => addMessageToList(prev, "assistant", confirmationTextForDraft(updatedDraft)));
        return;
      }
    }

    if (draft && readyToSave && !draftChangeMode && looksLikeDraftRenameIntent(cleanText)) {
      const renamed = extractDraftRenameText(cleanText);
      const updatedDraft = {
        ...draft,
        task: renamed,
        rawText: `${draft.rawText} | ${cleanText}`,
        lastQuestion: "confirm" as const,
      };
      setDraft(updatedDraft);
      setMessages((prev) => addMessageToList(prev, "assistant", confirmationTextForDraft(updatedDraft)));
      return;
    }

    if (draft && readyToSave && !draftChangeMode && isContextualTimeOrRepeatEdit(cleanText)) {
      const result = processUserText(draft, cleanText, learning);
      setDraft(result.draft);
      setMessages((prev) => addMessageToList(prev, "assistant", result.assistantText));
      return;
    }

    if (draft && readyToSave && !draftChangeMode && !isReminderRelatedDuringConfirmation(cleanText)) {
      const response = contextualFallbackText();
      setVoiceMessage("I’m not fully sure how this changes the current reminder.");
      setMessages((prev) => addMessageToList(prev, "assistant", response));
      return;
    }

    const result = processUserText(draft, cleanText, learning);
    setDraft(result.draft);
    if (!result.draft) setDraftChangeMode(false);
    setMessages((prev) => addMessageToList(prev, "assistant", result.assistantText));
  }

  function handleSend() {
    const cleanText = input.trim();
    if (!cleanText) return;
    setInput("");
    setVoiceMessage("");
    processText(cleanText);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleSaveClick() {
    if (!actionButtonsArmed) return;
    saveDraft();
  }

  function handleChangeClick() {
    if (!actionButtonsArmed) return;
    if (!draft) return;
    setDraftChangeMode(true);
    setMessages((prev) =>
      addMessageToList(
        prev,
        "assistant",
        "Sure — what would you like to change? You can say things like ‘name the alarm as study time’, ‘change it to 10 am’, or ‘cancel it’."
      )
    );
  }

  function handleDropClick() {
    if (!actionButtonsArmed) return;
    setDraft(null);
    setDraftChangeMode(false);
    setMessages((prev) =>
      addMessageToList(prev, "assistant", "Got it — I’ve cleared this reminder draft. Tell me the next reminder when ready.")
    );
  }


  function handleRunBrainRegression() {
    const report = runMiniViktorRegressionArena();
    setBrainReport(report);
  }

  function handleRunCorpusRegression() {
    const report = runMiniViktorCorpusRegressionArena();
    setCorpusReport(report);
  }

  function handleCopyBrainReport() {
    if (!brainReport) return;
    const text = miniViktorReportToText(brainReport);
    try {
      navigator.clipboard?.writeText(text);
      setVoiceMessage("MiniViktor regression report copied.");
    } catch {
      setVoiceMessage("Could not copy automatically. Run the report and review it on screen.");
    }
  }

  function handleRunSimulationLab() {
    const report = runMiniViktorSimulationLab();
    setSimulationReport(report);
  }

  function handleCopySimulationReport() {
    if (!simulationReport) return;
    const text = miniViktorSimulationReportToText(simulationReport);
    try {
      navigator.clipboard?.writeText(text);
      setVoiceMessage("MiniViktor simulation report copied.");
    } catch {
      setVoiceMessage("Could not copy automatically. Run the simulation report and review it on screen.");
    }
  }

  function handleBuildDatasetExport() {
    const exportData = buildMiniViktorTrainingDataset();
    setDatasetExport(exportData);
  }

  function handleCopyDatasetJson() {
    if (!datasetExport) return;
    try {
      navigator.clipboard?.writeText(miniViktorDatasetToJson(datasetExport));
      setVoiceMessage("MiniViktor dataset JSON copied.");
    } catch {
      setVoiceMessage("Could not copy dataset JSON automatically.");
    }
  }

  function handleCopyDatasetJsonl() {
    if (!datasetExport) return;
    try {
      navigator.clipboard?.writeText(miniViktorDatasetToJsonl(datasetExport));
      setVoiceMessage("MiniViktor dataset JSONL copied.");
    } catch {
      setVoiceMessage("Could not copy dataset JSONL automatically.");
    }
  }

  function handleCopyCorpusReport() {
    if (!corpusReport) return;
    const text = miniViktorReportToText(corpusReport);
    try {
      navigator.clipboard?.writeText(text);
      setVoiceMessage("MiniViktor corpus regression report copied.");
    } catch {
      setVoiceMessage("Could not copy corpus report automatically. Run the report and review it on screen.");
    }
  }

  function handleCopyCorpusJsonl() {
    const text = exportMiniViktorCorpusAsJsonl(getMiniViktorReminderCorpus());
    try {
      navigator.clipboard?.writeText(text);
      setVoiceMessage("MiniViktor corpus JSONL copied.");
    } catch {
      setVoiceMessage("Could not copy corpus JSONL automatically.");
    }
  }

  const unsyncedFeedbackCount = useMemo(
    () => feedbackItems.filter((item) => item.syncStatus !== "synced").length,
    [feedbackItems],
  );

  const feedbackProviderLabel = remoteFeedbackConfig
    ? remoteFeedbackConfig.provider === "firebase"
      ? "Firebase Firestore"
      : remoteFeedbackConfig.provider === "supabase"
        ? "Supabase"
        : "Google Sheets webhook"
    : "Local only";

  const feedbackConfigLabel = remoteFeedbackConfig
    ? "Ready"
    : "Missing repository keys — local capture/export remains active";

  async function syncFeedbackItems(itemsToSync?: BetaFeedbackItem[]) {
    if (!remoteFeedbackConfig) {
      setFeedbackSyncMessage("Central repository not configured yet. Feedback is being stored locally only.");
      return;
    }

    const queue = (itemsToSync || feedbackItems).filter((item) => item.syncStatus !== "synced");
    if (queue.length === 0) {
      setFeedbackSyncMessage("All captured feedback is already synced to the central repository.");
      return;
    }

    if (feedbackSyncInFlightRef.current) return;
    feedbackSyncInFlightRef.current = true;
    setFeedbackSyncMessage(`Syncing ${queue.length} feedback item${queue.length === 1 ? "" : "s"} to the central repository...`);

    let successCount = 0;
    let failureCount = 0;

    for (const item of queue) {
      const result = await pushFeedbackToRepository(remoteFeedbackConfig, toFeedbackRepositoryPayload(item));
      if (result.ok) {
        successCount += 1;
        setFeedbackItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, syncStatus: "synced", syncedAt: new Date().toISOString(), syncError: null } : entry));
      } else {
        failureCount += 1;
        setFeedbackItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, syncStatus: "failed", syncError: result.error || "Sync failed" } : entry));
      }
    }

    feedbackSyncInFlightRef.current = false;

    if (failureCount === 0) {
      setFeedbackSyncMessage(`Central repository sync complete. ${successCount} feedback item${successCount === 1 ? "" : "s"} synced.`);
    } else if (successCount === 0) {
      setFeedbackSyncMessage(`Central repository sync failed for ${failureCount} item${failureCount === 1 ? "" : "s"}. Review repository keys or internet access.`);
    } else {
      setFeedbackSyncMessage(`Partial sync complete. ${successCount} synced, ${failureCount} failed.`);
    }
  }

  function buildFeedbackSnapshot(overrides?: Partial<BetaFeedbackItem>): BetaFeedbackItem {
    return {
      id: safeId(),
      createdAt: new Date().toISOString(),
      testerId: testerId.trim() || "anonymous",
      issueType,
      comment: feedbackComment.trim(),
      conversation: messages,
      activeDraft: draft,
      visibleRemindersSnapshot: activeReminders,
      appUrl: window.location.href,
      userAgent: navigator.userAgent,
      source: "manual",
      syncStatus: remoteFeedbackConfig ? "pending" : "local-only",
      syncedAt: null,
      syncError: null,
      buildLabel: APP_BUILD_LABEL,
      appVersion: APP_VERSION,
      platform: detectPlatformLabel(),
      nativeShell: isNativeAndroidShell(),
      ...overrides,
    };
  }

  function handleReportIssue() {
    const snapshot = buildFeedbackSnapshot();
    setFeedbackItems((prev) => [snapshot, ...prev].slice(0, 200));
    setFeedbackComment("");
    setMessages((prev) =>
      addMessageToList(
        prev,
        "assistant",
        remoteFeedbackConfig
          ? "Issue captured and queued for the central repository. Tap End Test to start the next test flow."
          : "Issue captured locally. Add repository keys later to sync centrally. Tap End Test to start the next test flow.",
      )
    );

    if (remoteFeedbackConfig) {
      void syncFeedbackItems([snapshot]);
    }
  }

  function handleSyncAllFeedback() {
    void syncFeedbackItems();
  }

  function handleEndTest() {
    setDraft(null);
    setInput("");
    setVoiceMessage("");
    setLastVoiceTranscript("");
    setMessages([
      {
        id: safeId(),
        role: "assistant",
        text: "New beta test started. Try the next reminder phrase.",
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function feedbackToCsv(items: BetaFeedbackItem[]) {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ["createdAt", "testerId", "issueType", "comment", "conversation", "draft", "reminders", "appUrl", "userAgent"],
      ...items.map((item) => [
        item.createdAt,
        item.testerId,
        item.issueType,
        item.comment,
        item.conversation.map((message) => `${message.role}: ${message.text}`).join("\n"),
        JSON.stringify(item.activeDraft),
        JSON.stringify(item.visibleRemindersSnapshot),
        item.appUrl,
        item.userAgent,
      ]),
    ];

    return rows.map((row) => row.map((cell) => escape(String(cell ?? ""))).join(",")).join("\n");
  }

  function isNativeAndroidShell() {
    const capacitor = (window as any).Capacitor;
    return Boolean(capacitor?.isNativePlatform?.()) || /; wv\)/i.test(navigator.userAgent);
  }

  async function copyTextToClipboard(contents: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(contents);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = contents;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }

  async function exportText(filename: string, contents: string, mimeType: string) {
    const payload = { filename, contents, mimeType };
    setExportPreview(payload);

    try {
      const file = new File([contents], filename, { type: mimeType });
      const nav = navigator as any;
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ title: filename, text: "RemindIQ beta feedback export", files: [file] });
        setVoiceMessage(`${filename} shared successfully.`);
        return;
      }
    } catch {
      // Continue to download/copy fallback.
    }

    if (!isNativeAndroidShell()) {
      try {
        const blob = new Blob([contents], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        setVoiceMessage(`${filename} downloaded.`);
        return;
      } catch {
        // Continue to copy fallback.
      }
    }

    try {
      const copied = await copyTextToClipboard(contents);
      setVoiceMessage(
        copied
          ? `${filename} copied. If download is blocked in the Android app, paste this into WhatsApp/email or use the export preview.`
          : `Download is blocked in this app view. Export preview is shown below.`
      );
    } catch {
      setVoiceMessage("Download is blocked in this app view. Export preview is shown below for manual copy.");
    }
  }

  function handleExportFeedbackJson() {
    void exportText("remindiq-beta-feedback.json", JSON.stringify(feedbackItems, null, 2), "application/json");
  }

  function handleExportFeedbackCsv() {
    void exportText("remindiq-beta-feedback.csv", feedbackToCsv(feedbackItems), "text/csv");
  }

  function handleCopyExportPreview() {
    if (!exportPreview) return;
    void copyTextToClipboard(exportPreview.contents).then((copied) => {
      setVoiceMessage(copied ? `${exportPreview.filename} copied.` : "Could not copy automatically. Long-press the export text and copy manually.");
    });
  }

  function handleClearFeedback() {
    setFeedbackItems([]);
    setVoiceMessage("Local beta feedback cleared.");
  }

  function extractNativeTranscript(result: any) {
    const candidates = [
      result?.matches?.[0],
      result?.matches?.[0]?.text,
      result?.matches?.[0]?.transcript,
      result?.result,
      result?.text,
      result?.transcript,
    ];

    return candidates.find((candidate) => typeof candidate === "string" && candidate.trim())?.trim() || "";
  }

  async function handleNativeVoiceInput() {
    if (!Capacitor.isNativePlatform()) return false;
    if (isListening) return true;
    if (isMiniViktorSpeaking) {
      setVoiceMessage("Interrupting MiniViktor — listening now.");
      await stopMiniViktorSpeechForBargeIn();
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }

    try {
      setIsListening(true);
      setVoiceMessage("Native mic is listening. Speak your full reminder, then finish speaking.");

      const permission = await NativeSpeechRecognition.requestPermissions();
      const states = Object.values(permission || {});
      const denied = states.some((value) => value === "denied");
      const granted = states.length === 0 || states.some((value) => value === "granted");

      if (denied || !granted) {
        setVoiceMessage("Microphone permission is not available. Allow microphone access for RemindIQ in Android settings.");
        setIsListening(false);
        return true;
      }

      const availability = await NativeSpeechRecognition.available();
      if (availability && availability.available === false) {
        setVoiceMessage("Native speech recognition is not available on this Android device. Use typing while we validate this device.");
        setIsListening(false);
        return true;
      }

      const result = await NativeSpeechRecognition.start({
        language: "en-IN",
        maxResults: 3,
        partialResults: false,
        popup: true,
        prompt: "Speak your RemindIQ reminder",
      });

      const spokenText = extractNativeTranscript(result);
      setIsListening(false);

      if (!spokenText) {
        setVoiceMessage("I did not catch that. Tap Mic and try again, or say “start over” if the previous draft is wrong.");
        return true;
      }

      if (looksLikeMiniViktorEcho(spokenText, lastSpokenAssistantRef.current)) {
        setVoiceMessage("I ignored MiniViktor’s own spoken response. Tap Mic again when you are ready to reply.");
        return true;
      }

      setInput("");
      setLastVoiceTranscript(spokenText);
      setVoiceMessage(`Captured: “${spokenText}”. Auto-sent to MiniViktor.`);
      processText(spokenText);
      return true;
    } catch (error: any) {
      setIsListening(false);
      const message = error?.message || error?.errorMessage || String(error || "unknown error");
      setVoiceMessage(`Native voice failed: ${message}. Check microphone permission and try again.`);
      return true;
    }
  }

  async function handleVoiceInput() {
    const nativeHandled = await handleNativeVoiceInput();
    if (nativeHandled) return;

    if (isMiniViktorSpeaking) {
      setVoiceMessage("Interrupting MiniViktor — listening now.");
      await stopMiniViktorSpeechForBargeIn();
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const isSecureEnough = window.location.protocol === "https:" || isLocalhost;

    if (!isSecureEnough) {
      setVoiceMessage("Voice needs HTTPS on phones. Open the deployed Vercel link, not the local Wi-Fi link.");
      return;
    }

    if (!SpeechRecognition) {
      setVoiceMessage("Voice input is not supported in this browser. Use Chrome/Edge, or use the phone keyboard mic.");
      return;
    }

    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let handledResult = false;
    let handledError = false;
    let silenceTimer: number | undefined;

    const cleanup = () => {
      if (silenceTimer) window.clearTimeout(silenceTimer);
      setIsListening(false);
    };

    setIsListening(true);
    setVoiceMessage("Listening... speak now.");

    silenceTimer = window.setTimeout(() => {
      if (!handledResult && !handledError) {
        handledError = true;
        try {
          recognition.stop();
        } catch {
          // Ignore stop failures from browser speech engine.
        }
        cleanup();
        setVoiceMessage("I did not hear anything. Tap Speak and start talking immediately.");
      }
    }, 9000);

    recognition.onresult = (event: any) => {
      handledResult = true;
      cleanup();

      const spokenText = event.results?.[0]?.[0]?.transcript || "";
      if (!spokenText.trim()) {
        setVoiceMessage("I did not catch that. Please try again.");
        return;
      }

      setInput("");
      setVoiceMessage(`Heard: “${spokenText}”. Sent to MiniViktor. Tap Speak again to answer.`);
      processText(spokenText);
    };

    recognition.onerror = (event: any) => {
      handledError = true;
      cleanup();

      const error = event?.error || "unknown";
      if (error === "not-allowed" || error === "service-not-allowed") {
        setVoiceMessage(
          "Voice permission was blocked by the browser speech service. Open the HTTPS link in Chrome, allow Microphone for this site, then tap Speak again. If it still fails, use the phone keyboard mic."
        );
      } else if (error === "no-speech") {
        setVoiceMessage("No speech was detected. Tap Speak and start talking immediately.");
      } else if (error === "audio-capture") {
        setVoiceMessage("Microphone is not available. Close other apps using the mic and try again.");
      } else if (error === "network") {
        setVoiceMessage("Voice service failed on this browser. Try Chrome/Edge over HTTPS, or use the keyboard mic.");
      } else if (error === "aborted") {
        setVoiceMessage("Voice capture stopped. Tap Speak to try again.");
      } else {
        setVoiceMessage(`Voice capture failed: ${error}. Try Chrome/Edge over HTTPS, or use the keyboard mic.`);
      }
    };

    recognition.onend = () => {
      if (!handledResult && !handledError) {
        cleanup();
      }
    };

    try {
      recognition.start();
    } catch (error: any) {
      cleanup();
      const message = error?.message || "unknown error";
      setVoiceMessage(`Voice could not start: ${message}. Try Chrome/Edge over HTTPS, or use the keyboard mic.`);
    }
  }

  function dismissRingingReminder(id: string) {
    setRingingReminders((prev) => prev.filter((item) => item.id !== id));
  }

  function handleSnoozeRinging(item: Reminder, minutes = 5) {
    stopAllAudioNow();
    void cancelNativeAlarm(item.id);
    const snoozeDue = new Date(Date.now() + minutes * 60 * 1000);
    const snoozedReminder: Reminder = {
      ...item,
      id: safeId(),
      title: item.title,
      rawText: `${item.rawText || item.title} | snoozed ${minutes} minutes`,
      dateText: snoozeDue.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
      datePhrase: "today",
      timeText: snoozeDue.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase(),
      dueAt: snoozeDue.toISOString(),
      status: "confirmed",
      createdAt: new Date().toISOString(),
      notifiedAt: null,
      repeatRule: null,
      sourceDraftId: item.sourceDraftId || item.id,
    };
    setReminders((prev) => [snoozedReminder, ...prev]);
    dismissRingingReminder(item.id);
    setVoiceMessage(`Snoozed ${item.title} for ${minutes} minutes.`);
    void scheduleNativeAlarm(snoozedReminder);
  }

  function handleDoneRinging(item: Reminder) {
    stopAllAudioNow();
    void cancelNativeAlarm(item.id);
    dismissRingingReminder(item.id);
    setReminders((prev) =>
      prev.map((reminder) => {
        if (reminder.id !== item.id) return reminder;

        if (reminder.repeatRule && reminder.repeatRule.kind !== "none") {
          const updatedRepeat = {
            ...reminder,
            notifiedAt: null,
            status: "confirmed" as const,
          };
          window.setTimeout(() => void scheduleNativeAlarm(updatedRepeat), 0);
          return updatedRepeat;
        }

        return {
          ...reminder,
          status: "done",
          notifiedAt: new Date().toISOString(),
        };
      })
    );
    setVoiceMessage(`${item.title} dismissed.`);
  }

  function handleStopRingingRepeat(item: Reminder) {
    stopAllAudioNow();
    void cancelNativeAlarm(item.id);
    dismissRingingReminder(item.id);
    setReminders((prev) =>
      prev.map((reminder) =>
        reminder.id === item.id
          ? {
              ...reminder,
              repeatRule: null,
              status: "done",
              notifiedAt: new Date().toISOString(),
            }
          : reminder
      )
    );
    setVoiceMessage(`${item.title} repeat alarm stopped.`);
  }

  function handleMarkDone(id: string) {
    void stopMiniViktorSpeechForBargeIn();
    void cancelNativeAlarm(id);
    setReminders((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "done" ? "confirmed" : "done",
            }
          : item
      )
    );
  }

  function handleDelete(id: string) {
    void cancelNativeAlarm(id);
    setReminders((prev) => prev.filter((item) => item.id !== id));
  }


  function handleStopRepeat(id: string) {
    void stopMiniViktorSpeechForBargeIn();
    void cancelNativeAlarm(id);
    setReminders((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              repeatRule: null,
              status: "done",
              notifiedAt: new Date().toISOString(),
            }
          : item
      )
    );
    setVoiceMessage("Repeating alarm stopped and marked done.");
  }

  function handleStartEdit(item: Reminder) {
    setEditingId(item.id);
    setEditText(item.rawText || item.title);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function handleSaveEdit(id: string) {
    const empty = createEmptyDraft();
    const result = processUserText(empty, editText, learning);
    const save = result.draft ? createRemindersFromDraft(result.draft) : { reminders: [] as Reminder[], assistantText: "" };

    if (save.reminders.length === 0) {
      setMessages((prev) => addMessageToList(prev, "assistant", "I could not fully understand that edit. Please include task, day, and time."));
      return;
    }

    const replacement = save.reminders[0];
    setReminders((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...replacement,
              id,
              createdAt: item.createdAt,
            }
          : item
      )
    );

    setEditingId(null);
    setEditText("");
  }

  return (
    <main className="app-shell">
      {!useNativeAlarmOnly && (
        <FullScreenAlarm
          alarm={ringingReminders.length > 0 ? ringingReminders[ringingReminders.length - 1] : null}
          onSnooze={(item, minutes) => handleSnoozeRinging(item as Reminder, minutes)}
          onDone={(item) => handleDoneRinging(item as Reminder)}
          onClose={(item) => handleDoneRinging(item as Reminder)}
          snoozeMinutes={5}
        />
      )}
      <nav className="mobile-main-tabs" aria-label="RemindIQ sections">
        <button className={activeMainTab === "chat" ? "main-tab active" : "main-tab"} onClick={() => setActiveMainTab("chat")} type="button">Chat</button>
        <button className={activeMainTab === "reminders" ? "main-tab active" : "main-tab"} onClick={() => { setActiveMainTab("reminders"); setSidePanel("reminders"); }} type="button">Reminders</button>
        <button className={activeMainTab === "feedback" ? "main-tab active" : "main-tab"} onClick={() => { setActiveMainTab("feedback"); setSidePanel("feedback"); }} type="button">Feedback</button>
        <button className={activeMainTab === "tests" ? "main-tab active" : "main-tab"} onClick={() => { setActiveMainTab("tests"); setSidePanel("tests"); }} type="button">Tests</button>
      </nav>
      <section className={activeMainTab === "chat" ? "conversation-shell active-mobile-section" : "conversation-shell"}>
        <header className="app-header">
          <div>
            <div className="top-line">
              <span className="brand-name">RemindIQ</span>
              <span className="memory-pill">Local memory</span>
              <span className="memory-pill">Retriever brain</span>
              <span className="memory-pill">Simulation lab</span>
              <span className="memory-pill">Dataset export</span>
              <span className="memory-pill">Corpus wired</span>
              <span className="memory-pill beta-pill">Beta feedback</span>
            </div>
            <p className="tagline">Natural reminders. Smarter follow-through.</p>
            <p className="build-label">{APP_BUILD_LABEL}</p>
          </div>

          <div className="status-stack">
            <span>{getTodayLabel()}</span>
            <span>Alerts: {notificationState}</span>
          </div>
        </header>

        <div className="utility-row">
          <button className="secondary-button compact" onClick={requestNotifications} type="button">
            Enable Notifications
          </button>
          <button className="secondary-button compact" onClick={() => setSpokenRepliesEnabled((value) => !value)} type="button">
            {spokenRepliesEnabled ? "Mute MiniViktor" : "Unmute MiniViktor"}
          </button>
          <span className="helper-text">{alarmStatus}</span>
          <button className="secondary-button compact" onClick={checkNativeAlarmDiagnostics} type="button">
            Alarm diagnostics
          </button>
          <span className="helper-text alarm-diagnostic-text">{alarmCapability}</span>
        </div>

        <div className="chat-panel">
          <div className="chat-thread">
            {messages.length === 0 && (
              <div className="message-row assistant-row">
                <div className="message-bubble assistant-bubble">
                  <span className="message-name">RemindIQ Assistant</span>
                  <p>Hi, I’m ready. Tell me what you want to be reminded about.</p>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === "user" ? "message-row user-row" : "message-row assistant-row"}
              >
                <div className={message.role === "user" ? "message-bubble user-bubble" : "message-bubble assistant-bubble"}>
                  <span className="message-name">{message.role === "user" ? "You" : "RemindIQ Assistant"}</span>
                  <p>{message.text}</p>
                </div>
              </div>
            ))}

            {readyToSave && (
              <div className="message-row assistant-row">
                <div className="action-bubble">
                  <button className="confirm-button" onClick={handleSaveClick} disabled={!actionButtonsArmed} type="button">
                    Save reminder
                  </button>
                  <button className="quiet-action-button" onClick={handleChangeClick} disabled={!actionButtonsArmed} type="button">
                    Change something
                  </button>
                  <button className="danger-action-button" onClick={handleDropClick} disabled={!actionButtonsArmed} type="button">
                    Doesn’t work
                  </button>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="composer">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type naturally, e.g. Meeting at 7 pm today, remind me at 6 and 6.30"
              rows={2}
            />

            <div className="composer-actions">
              <button className={isListening ? "secondary-button listening" : "secondary-button"} onClick={handleVoiceInput} type="button">
                {micButtonLabel}
              </button>

              <button className="primary-button" onClick={handleSend} type="button">
                Send
              </button>
            </div>

            <p className="voice-loop-hint">{voiceLoopText}</p>
            {isMiniViktorSpeaking && <p className="voice-message">MiniViktor is speaking. Tap Mic to interrupt and reply.</p>}
            {voiceMessage && <p className="voice-message">{voiceMessage}</p>}
            {lastVoiceTranscript && (
              <div className="voice-transcript-review">
                <span>Last heard: “{lastVoiceTranscript}”</span>
                <button type="button" onClick={() => setInput(lastVoiceTranscript)}>Edit</button>
                <button type="button" onClick={() => processText("that's wrong")}>Wrong</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={activeMainTab !== "chat" ? "list-card active-mobile-section" : "list-card"}>
        <div className="side-panel-tabs">
          <button
            className={sidePanel === "feedback" ? "side-tab active" : "side-tab"}
            onClick={() => setSidePanel("feedback")}
            type="button"
          >
            <span>Feedback</span>
            <strong>{feedbackItems.length}</strong>
          </button>

          <button
            className={sidePanel === "reminders" ? "side-tab active" : "side-tab"}
            onClick={() => setSidePanel("reminders")}
            type="button"
          >
            <span>Saved reminders</span>
            <strong>{filteredReminders.length}</strong>
          </button>

          <button
            className={sidePanel === "tests" ? "side-tab active" : "side-tab"}
            onClick={() => setSidePanel("tests")}
            type="button"
          >
            <span>Tests</span>
            <strong>{brainReport ? `${brainReport.passed}/${brainReport.total}` : "Run"}</strong>
          </button>
        </div>

        {sidePanel === "reminders" && (
          <div className="side-panel-body reminders-panel-body">
            <div className="list-header compact-list-header">
              <div>
                <h2>Saved reminders</h2>
                <p>{activeCount} active · {doneCount} done</p>
              </div>
              <span>{filteredReminders.length}</span>
            </div>

            <input
              className="search-box"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reminders..."
            />

            <div className="filter-wrap">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  className={activeFilter === filter ? "filter-chip active" : "filter-chip"}
                  onClick={() => setActiveFilter(filter)}
                  type="button"
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="reminder-list">
              {filteredReminders.length === 0 ? (
                <div className="empty-state">No reminders in this view.</div>
              ) : (
                filteredReminders.map((item) => (
                  <article key={item.id} className={`reminder-item compact-reminder-item ${item.status === "done" ? "done-item" : ""} ${item.isAlarm ? "alarm-reminder-item" : ""}`.trim()}>
                    <div className="reminder-main">
                      <div className="status-line compact-status-line">
                        <span className={`status-dot ${item.status === "done" ? "done" : item.status === "confirmed" ? "confirmed" : "warning"}`} />
                        <small>{item.status === "done" ? "Done" : item.status === "confirmed" ? "Confirmed" : "Needs info"}</small>
                        <span className={`category-chip category-${item.category.toLowerCase()}`}>{item.category}</span>
                        {item.repeatRule && item.repeatRule.kind !== "none" && <span className="repeat-chip">Repeating</span>}
                      </div>

                      {editingId === item.id ? (
                        <div className="edit-box">
                          <textarea value={editText} onChange={(event) => setEditText(event.target.value)} rows={3} />
                          <div className="edit-actions">
                            <button className="done-button" onClick={() => handleSaveEdit(item.id)} type="button">
                              Save Edit
                            </button>
                            <button className="quiet-button" onClick={handleCancelEdit} type="button">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3>{item.title}</h3>
                          <p className="reminder-when">{item.isAlarm ? "Alarm" : "Reminder"}: {item.dateText} · {item.timeText}</p>
                          {item.eventTimeText && <p className="event-line">Event: {item.eventDateText || item.dateText} · {item.eventTimeText}</p>}
                          {item.repeatRule && <p className="event-line repeat-line">{item.repeatRule.label}</p>}
                          {item.repeatRule && item.repeatRule.kind !== "none" && <p className="event-line next-line">Next: {item.dateText} · {item.timeText}</p>}
                          {item.rawText && item.rawText !== item.title && (
                            <details className="reminder-details">
                              <summary>Details</summary>
                              <p>{item.rawText}</p>
                            </details>
                          )}
                        </>
                      )}
                    </div>

                    {editingId !== item.id && (
                      <div className="item-actions compact-item-actions">
                        {item.repeatRule && item.repeatRule.kind !== "none" && (
                          <button className="stop-repeat-button" onClick={() => handleStopRepeat(item.id)} type="button">
                            Stop repeat
                          </button>
                        )}
                        <button className="done-button" onClick={() => handleMarkDone(item.id)} type="button">
                          {item.status === "done" ? "Restore" : "Done"}
                        </button>
                        <button className="quiet-button" onClick={() => handleStartEdit(item)} type="button">
                          Edit
                        </button>
                        <button className="warning-button" onClick={() => handleDelete(item.id)} type="button">
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        {sidePanel === "feedback" && (
          <div className="side-panel-body feedback-panel-body">
            <div className="list-header compact-list-header">
              <div>
                <h2>Feedback</h2>
                <p>Report issues during beta testing</p>
              </div>
              <span>{feedbackItems.length}</span>
            </div>

            <div className="beta-feedback inline-feedback">
              <div className="beta-grid">
                <label>
                  <span>Tester ID</span>
                  <input
                    className="search-box"
                    value={testerId}
                    onChange={(event) => setTesterId(event.target.value)}
                    placeholder="Optional, e.g. tester-01"
                  />
                </label>

                <label>
                  <span>Issue type</span>
                  <select className="search-box" value={issueType} onChange={(event) => setIssueType(event.target.value as FeedbackIssueType)}>
                    {FEEDBACK_ISSUE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <textarea
                className="feedback-note"
                value={feedbackComment}
                onChange={(event) => setFeedbackComment(event.target.value)}
                placeholder="Optional comment: what went wrong or what you expected"
                rows={2}
              />

              <div className="brain-actions beta-actions">
                <button className="danger-action-button" onClick={handleReportIssue} type="button">
                  Report issue
                </button>
                <button className="quiet-action-button" onClick={handleEndTest} type="button">
                  End test / reset chat
                </button>
                <button className="quiet-action-button" onClick={handleSyncAllFeedback} disabled={feedbackItems.length === 0 || !remoteFeedbackConfig} type="button">
                  Sync pending
                </button>
                <button className="quiet-action-button" onClick={handleExportFeedbackJson} disabled={feedbackItems.length === 0} type="button">
                  Export JSON
                </button>
                <button className="quiet-action-button" onClick={handleExportFeedbackCsv} disabled={feedbackItems.length === 0} type="button">
                  Export CSV
                </button>
              </div>

              <div className="sync-status-card feedback-diagnostics-card">
                <strong>Feedback repository diagnostics</strong>
                <span>Provider: {feedbackProviderLabel}</span>
                <span>Configuration: {feedbackConfigLabel}</span>
                <p>{feedbackSyncMessage}</p>
                <small>Pending local items: {unsyncedFeedbackCount}</small>
                <small>Webhook mode uses VITE_FEEDBACK_PROVIDER=webhook and VITE_FEEDBACK_WEBHOOK_URL in .env.</small>
              </div>

              <div className="beta-footer">
                <span>{feedbackItems.length} issue{feedbackItems.length === 1 ? "" : "s"} captured · {unsyncedFeedbackCount} pending sync</span>
                <button className="warning-button" onClick={handleClearFeedback} disabled={feedbackItems.length === 0} type="button">
                  Clear local feedback
                </button>
              </div>


              {exportPreview && (
                <div className="export-preview-card">
                  <div className="export-preview-header">
                    <strong>{exportPreview.filename}</strong>
                    <button className="quiet-action-button mini-button" onClick={() => setExportPreview(null)} type="button">
                      Close
                    </button>
                  </div>
                  <textarea className="export-preview-text" value={exportPreview.contents} readOnly rows={4} />
                  <button className="quiet-action-button" onClick={handleCopyExportPreview} type="button">
                    Copy export text
                  </button>
                </div>
              )}

              <p className="brain-hint">
                Feedback is always stored locally first. When repository keys are configured, MiniViktor also syncs the issue payload to the central repository automatically. JSON/CSV export remains as fallback.
              </p>
            </div>
          </div>
        )}

        {sidePanel === "tests" && (
        <div className="test-bank side-panel-body tests-panel-body">
          <div className="list-header compact-list-header">
            <div>
              <h2>MiniViktor tests</h2>
              <p>Regression, simulation, and dataset export</p>
            </div>
          </div>

          <div className="brain-actions">
            <button className="primary-button" onClick={handleRunBrainRegression} type="button">
              Run regression
            </button>

            <button className="quiet-action-button" onClick={handleCopyBrainReport} disabled={!brainReport} type="button">
              Copy report
            </button>
          </div>

          {brainReport ? (
            <div className={brainReport.criticalFailed > 0 ? "brain-report fail" : "brain-report pass"}>
              <strong>MiniViktor Regression Report</strong>
              <p>
                Passed: {brainReport.passed}/{brainReport.total} · Failed: {brainReport.failed} · Critical failed: {brainReport.criticalFailed}
              </p>

              <div className="brain-category-grid">
                {Object.entries(brainReport.byCategory).map(([category, value]) => (
                  <span key={category}>
                    {category}: {value.total - value.failed}/{value.total}
                  </span>
                ))}
              </div>

              {brainReport.results
                .filter((result) => !result.passed)
                .slice(0, 5)
                .map((result) => (
                  <div className="brain-failure" key={result.id}>
                    <strong>{result.id}: {result.name}</strong>
                    <ul>
                      {result.failures.map((failure) => (
                        <li key={failure}>{failure}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : (
            <p className="brain-hint">Run this before calendar integration. Any critical failure blocks the next phase.</p>
          )}

          <div className="brain-divider" />

          <h3>Simulation learning lab</h3>
          <div className="brain-actions">
            <button className="primary-button" onClick={handleRunSimulationLab} type="button">
              Run simulations
            </button>

            <button className="quiet-action-button" onClick={handleCopySimulationReport} disabled={!simulationReport} type="button">
              Copy simulation report
            </button>
          </div>

          {simulationReport ? (
            <div className={simulationReport.criticalFailed > 0 ? "brain-report fail" : "brain-report pass"}>
              <strong>MiniViktor Simulation Lab Report</strong>
              <p>
                Passed: {simulationReport.passed}/{simulationReport.total} · Failed: {simulationReport.failed} · Critical failed: {simulationReport.criticalFailed}
              </p>
              <div className="brain-category-grid">
                {Object.entries(simulationReport.byCategory).map(([category, value]) => (
                  <span key={category}>
                    {category}: {value.total - value.failed}/{value.total}
                  </span>
                ))}
              </div>
              {simulationReport.results
                .filter((result) => !result.passed)
                .slice(0, 5)
                .map((result) => (
                  <div className="brain-failure" key={result.id}>
                    <strong>{result.id}: {result.name}</strong>
                    <ul>
                      {result.failures.map((failure) => (
                        <li key={failure}>{failure}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : (
            <p className="brain-hint">Run this to simulate multi-turn conversations before exporting training data.</p>
          )}

          <div className="brain-divider" />

          <h3>Corpus-driven regression</h3>
          <p className="brain-hint">MiniViktor corpus: {corpusSummary.total} cases · {corpusSummary.critical} critical · used by retriever and dataset export.</p>
          <div className="brain-actions">
            <button className="primary-button" onClick={handleRunCorpusRegression} type="button">
              Run corpus regression
            </button>
            <button className="quiet-action-button" onClick={handleCopyCorpusReport} disabled={!corpusReport} type="button">
              Copy corpus report
            </button>
            <button className="quiet-action-button" onClick={handleCopyCorpusJsonl} type="button">
              Copy corpus JSONL
            </button>
          </div>

          {corpusReport ? (
            <div className={corpusReport.criticalFailed > 0 ? "brain-report fail" : "brain-report pass"}>
              <strong>MiniViktor Corpus Regression Report</strong>
              <p>
                Passed: {corpusReport.passed}/{corpusReport.total} · Failed: {corpusReport.failed} · Critical failed: {corpusReport.criticalFailed}
              </p>
              <div className="brain-category-grid">
                {Object.entries(corpusReport.byCategory).map(([category, value]) => (
                  <span key={category}>
                    {category}: {value.total - value.failed}/{value.total}
                  </span>
                ))}
              </div>
              {corpusReport.results
                .filter((result) => !result.passed)
                .slice(0, 5)
                .map((result) => (
                  <div className="brain-failure" key={result.id}>
                    <strong>{result.id}: {result.name}</strong>
                    <ul>
                      {result.failures.map((failure) => (
                        <li key={failure}>{failure}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : (
            <p className="brain-hint">Run this after standard regression. Corpus failures become candidates for MiniViktor hardening.</p>
          )}

          <div className="brain-divider" />

          <h3>Training dataset export</h3>
          <div className="brain-actions">
            <button className="primary-button" onClick={handleBuildDatasetExport} type="button">
              Build dataset
            </button>
            <button className="quiet-action-button" onClick={handleCopyDatasetJson} disabled={!datasetExport} type="button">
              Copy JSON
            </button>
            <button className="quiet-action-button" onClick={handleCopyDatasetJsonl} disabled={!datasetExport} type="button">
              Copy JSONL
            </button>
          </div>

          {datasetExport ? (
            <div className={datasetExport.needsReview > 0 ? "brain-report fail" : "brain-report pass"}>
              <strong>MiniViktor Dataset Export</strong>
              <p>
                Total: {datasetExport.total} · Clean: {datasetExport.clean} · Needs review: {datasetExport.needsReview}
              </p>
              <p className="brain-hint">Dataset now includes standard regression plus corpus examples. Only clean examples should be used for future fine-tuning or AI-parser experiments.</p>
            </div>
          ) : (
            <p className="brain-hint">Build this only after regression and simulation reports pass.</p>
          )}

          <div className="brain-divider" />

          <h3>Current reminder test bank</h3>
          <ul>
            {getTestBank().map((test) => (
              <li key={test}>{test}</li>
            ))}
          </ul>
        </div>
        )}
      </section>
    </main>
  );
}

export default App;


