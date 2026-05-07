import { useEffect, useMemo, useState } from "react";
import "./App.css";

type ReminderStatus = "confirmed" | "needs_info" | "done";

type Reminder = {
  id: string;
  title: string;
  rawText: string;
  dateText: string;
  timeText: string;
  dueAt: string | null;
  status: ReminderStatus;
  createdAt: string;
  notifiedAt?: string | null;
};

type DraftReminder = {
  title: string;
  dateText: string;
  timeText: string;
  dueAt: string | null;
  missing: string[];
};

type NotificationState = NotificationPermission | "unsupported";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

const STORAGE_KEY = "rms_reminders_v2";

function getTodayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function sameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (sameDate(date, today)) return "Today";
  if (sameDate(date, tomorrow)) return "Tomorrow";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeLabel(date: Date) {
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseReminderText(text: string): DraftReminder {
  const cleanText = text.trim();
  const lower = cleanText.toLowerCase();

  let dateValue: Date | null = null;
  let timeHour: number | null = null;
  let timeMinute = 0;
  let period = "";

  if (lower.includes("today")) {
    dateValue = new Date();
  } else if (lower.includes("tomorrow")) {
    dateValue = new Date();
    dateValue.setDate(dateValue.getDate() + 1);
  } else {
    const ordinalMatch =
      lower.match(/\b(?:on\s+|the\s+)?(\d{1,2})(st|nd|rd|th)\b/) ||
      lower.match(/\bon\s+(\d{1,2})\b/);

    if (ordinalMatch) {
      const day = Number(ordinalMatch[1]);
      const possibleDate = new Date();

      possibleDate.setDate(day);
      possibleDate.setHours(0, 0, 0, 0);

      if (possibleDate < new Date()) {
        possibleDate.setMonth(possibleDate.getMonth() + 1);
      }

      dateValue = possibleDate;
    }
  }

  const timeWithMinutes = lower.match(
    /\b(?:at\s*)?(\d{1,2})(?::|\.)(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?\b/
  );

  const timeWithAmPm = lower.match(
    /\b(?:at\s*)?(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\b/
  );

  const timeAtOnly = lower.match(/\bat\s+(\d{1,2})\b/);

  if (timeWithMinutes) {
    timeHour = Number(timeWithMinutes[1]);
    timeMinute = Number(timeWithMinutes[2]);
    period = timeWithMinutes[3] || "";
  } else if (timeWithAmPm) {
    timeHour = Number(timeWithAmPm[1]);
    period = timeWithAmPm[2] || "";
  } else if (timeAtOnly) {
    timeHour = Number(timeAtOnly[1]);
  }

  period = period.replaceAll(".", "").toLowerCase();

  if (timeHour !== null) {
    if (period === "pm" && timeHour < 12) timeHour += 12;
    if (period === "am" && timeHour === 12) timeHour = 0;
  }

  let dueAt: string | null = null;
  let dateText = "";
  let timeText = "";

  if (dateValue) {
    dateText = formatDateLabel(dateValue);
  }

  if (dateValue && timeHour !== null) {
    const finalDate = new Date(dateValue);
    finalDate.setHours(timeHour, timeMinute, 0, 0);
    dueAt = finalDate.toISOString();
    timeText = formatTimeLabel(finalDate);
  } else if (timeHour !== null) {
    const tempDate = new Date();
    tempDate.setHours(timeHour, timeMinute, 0, 0);
    timeText = formatTimeLabel(tempDate);
  }

  let title = cleanText
    .replace(/today/gi, "")
    .replace(/tomorrow/gi, "")
    .replace(/\bon\s+\d{1,2}(st|nd|rd|th)?\b/gi, "")
    .replace(/\bthe\s+\d{1,2}(st|nd|rd|th)?\b/gi, "")
    .replace(/\b\d{1,2}(st|nd|rd|th)\b/gi, "")
    .replace(/\bat\s+\d{1,2}(:|\.)?\d{0,2}\s*(am|pm|a\.m\.|p\.m\.)?/gi, "")
    .replace(/\b\d{1,2}(:|\.)\d{2}\s*(am|pm|a\.m\.|p\.m\.)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) {
    title = cleanText || "Untitled reminder";
  }

  const missing: string[] = [];
  if (!cleanText) missing.push("reminder details");
  if (!dateText) missing.push("date");
  if (!timeText) missing.push("time");

  return {
    title,
    dateText,
    timeText,
    dueAt,
    missing,
  };
}

function App() {
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<DraftReminder | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [notificationState, setNotificationState] =
    useState<NotificationState>("unsupported");

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationState(Notification.permission);
    }

    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        setReminders(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setReminders((previous) => {
        const now = Date.now();
        const dueItems: Reminder[] = [];

        const next = previous.map((item) => {
          const isDue =
            item.status === "confirmed" &&
            item.dueAt &&
            !item.notifiedAt &&
            new Date(item.dueAt).getTime() <= now;

          if (isDue) {
            dueItems.push(item);
            return {
              ...item,
              notifiedAt: new Date().toISOString(),
            };
          }

          return item;
        });

        dueItems.forEach((item) => {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Reminder due", {
              body: item.title,
            });
          } else {
            window.alert(`Reminder due: ${item.title}`);
          }
        });

        return next;
      });
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  const confirmedCount = useMemo(
    () => reminders.filter((item) => item.status === "confirmed").length,
    [reminders]
  );

  const doneCount = useMemo(
    () => reminders.filter((item) => item.status === "done").length,
    [reminders]
  );

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }

    const result = await Notification.requestPermission();
    setNotificationState(result);
  }

  function handleUnderstand() {
    const result = parseReminderText(input);
    setDraft(result);
  }

  function handleConfirm() {
    if (!draft) return;

    const newReminder: Reminder = {
      id: crypto.randomUUID(),
      title: draft.title,
      rawText: input,
      dateText: draft.dateText || "Date missing",
      timeText: draft.timeText || "Time missing",
      dueAt: draft.dueAt,
      status: draft.missing.length === 0 ? "confirmed" : "needs_info",
      createdAt: new Date().toISOString(),
      notifiedAt: null,
    };

    setReminders((prev) => [newReminder, ...prev]);
    setInput("");
    setDraft(null);
  }

  function handleDelete(id: string) {
    setReminders((prev) => prev.filter((item) => item.id !== id));
  }

  function handleMarkDone(id: string) {
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

  function handleStartEdit(item: Reminder) {
    setEditingId(item.id);
    setEditText(item.rawText || item.title);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function handleSaveEdit(id: string) {
    const updated = parseReminderText(editText);

    setReminders((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              title: updated.title,
              rawText: editText,
              dateText: updated.dateText || "Date missing",
              timeText: updated.timeText || "Time missing",
              dueAt: updated.dueAt,
              status: updated.missing.length === 0 ? "confirmed" : "needs_info",
              notifiedAt: null,
            }
          : item
      )
    );

    setEditingId(null);
    setEditText("");
  }

  function handleVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceMessage("Voice input is not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    setVoiceMessage("Listening... speak your reminder now.");

    recognition.start();

    recognition.onresult = (event: any) => {
      const spokenText = event.results[0][0].transcript;
      setInput(spokenText);
      setVoiceMessage("Voice captured successfully.");
      setIsListening(false);
    };

    recognition.onerror = () => {
      setVoiceMessage("Voice capture failed. Please try again or type the reminder.");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="top-pill">RMS Sprint 1B · Local Prototype</div>

        <h1>Reminder Management System</h1>
        <p className="subtitle">
          Speak or type a natural reminder. RMS will understand the task, date,
          and time before saving it.
        </p>

        <div className="today-card">
          <span>Today</span>
          <strong>{getTodayLabel()}</strong>
        </div>

        <div className="utility-row">
          <div className="mini-panel">
            <span>Browser alerts</span>
            <strong className="permission-pill">{notificationState}</strong>
          </div>

          <button
            className="secondary-button"
            onClick={requestNotifications}
            type="button"
          >
            Enable Notifications
          </button>
        </div>

        <p className="helper-text">
          Reminder alerts currently work when this browser tab is open. Full
          background/mobile alerts will come in the PWA sprint.
        </p>

        <div className="input-panel">
          <label htmlFor="reminderInput">What should I remind you about?</label>

          <textarea
            id="reminderInput"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder='Example: "Table tennis match at 7 pm today"'
            rows={4}
          />

          <div className="action-row">
            <button
              className={
                isListening ? "secondary-button listening" : "secondary-button"
              }
              onClick={handleVoiceInput}
              type="button"
            >
              {isListening ? "Listening..." : "Speak"}
            </button>

            <button
              className="primary-button"
              onClick={handleUnderstand}
              type="button"
            >
              Understand Reminder
            </button>
          </div>

          {voiceMessage && <p className="voice-message">{voiceMessage}</p>}
        </div>

        {draft && (
          <div className="preview-card">
            <div className="preview-header">
              <span>RMS understood this</span>
              <strong>{draft.missing.length === 0 ? "Ready" : "Needs info"}</strong>
            </div>

            <div className="preview-grid">
              <div>
                <small>Reminder</small>
                <p>{draft.title}</p>
              </div>

              <div>
                <small>Date</small>
                <p>{draft.dateText || "Missing"}</p>
              </div>

              <div>
                <small>Time</small>
                <p>{draft.timeText || "Missing"}</p>
              </div>
            </div>

            {draft.missing.length > 0 && (
              <div className="missing-box">
                RMS still needs: <strong>{draft.missing.join(", ")}</strong>
              </div>
            )}

            <button
              className="confirm-button"
              onClick={handleConfirm}
              type="button"
            >
              Save Reminder
            </button>
          </div>
        )}
      </section>

      <section className="list-card">
        <div className="list-header">
          <div>
            <h2>Saved reminders</h2>
            <p>
              {confirmedCount} active · {doneCount} done
            </p>
          </div>
          <span>{reminders.length}</span>
        </div>

        {reminders.length === 0 ? (
          <div className="empty-state">
            No reminders yet. Add your first one using voice or text.
          </div>
        ) : (
          <div className="reminder-list">
            {reminders.map((item) => (
              <article
                key={item.id}
                className={
                  item.status === "done"
                    ? "reminder-item done-item"
                    : "reminder-item"
                }
              >
                <div className="reminder-main">
                  <div className="status-line">
                    <span
                      className={
                        item.status === "confirmed"
                          ? "status-dot confirmed"
                          : item.status === "done"
                          ? "status-dot done"
                          : "status-dot warning"
                      }
                    />
                    <small>
                      {item.status === "confirmed"
                        ? "Confirmed"
                        : item.status === "done"
                        ? "Done"
                        : "Needs info"}
                    </small>
                  </div>

                  {editingId === item.id ? (
                    <div className="edit-box">
                      <textarea
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
                        rows={3}
                      />

                      <div className="edit-actions">
                        <button
                          className="done-button"
                          onClick={() => handleSaveEdit(item.id)}
                          type="button"
                        >
                          Save Edit
                        </button>

                        <button
                          className="quiet-button"
                          onClick={handleCancelEdit}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3>{item.title}</h3>
                      <p>
                        {item.dateText} · {item.timeText}
                      </p>
                    </>
                  )}
                </div>

                {editingId !== item.id && (
                  <div className="item-actions">
                    <button
                      className="done-button"
                      onClick={() => handleMarkDone(item.id)}
                      type="button"
                    >
                      {item.status === "done" ? "Restore" : "Done"}
                    </button>

                    <button
                      className="quiet-button"
                      onClick={() => handleStartEdit(item)}
                      type="button"
                    >
                      Edit
                    </button>

                    <button
                      className="warning-button"
                      onClick={() => handleDelete(item.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;