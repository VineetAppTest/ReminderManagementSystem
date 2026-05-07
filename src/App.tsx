import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Reminder = {
  id: string;
  title: string;
  rawText: string;
  dateText: string;
  timeText: string;
  status: "confirmed" | "needs_info";
  createdAt: string;
};

type DraftReminder = {
  title: string;
  dateText: string;
  timeText: string;
  missing: string[];
};

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

const STORAGE_KEY = "rms_reminders_v1";

function getTodayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parseReminderText(text: string): DraftReminder {
  const cleanText = text.trim();
  const lower = cleanText.toLowerCase();

  let dateText = "";
  let timeText = "";

  if (lower.includes("today")) {
    dateText = "Today";
  } else if (lower.includes("tomorrow")) {
    dateText = "Tomorrow";
  } else {
    const dateMatch = lower.match(/\b(\d{1,2})(st|nd|rd|th)?\b/);
    if (dateMatch) {
      dateText = `${dateMatch[1]}${dateMatch[2] || ""} of this month`;
    }
  }

  const timeMatch =
    lower.match(/\b(\d{1,2})(:|\.)?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/) ||
    lower.match(/\bat\s+(\d{1,2})\b/);

  if (timeMatch) {
    if (timeMatch[4]) {
      timeText = `${timeMatch[1]}${timeMatch[3] ? ":" + timeMatch[3] : ""} ${timeMatch[4]
        .replace(".", "")
        .toUpperCase()}`;
    } else {
      timeText = `${timeMatch[1]}:00`;
    }
  }

  let title = cleanText
    .replace(/today/gi, "")
    .replace(/tomorrow/gi, "")
    .replace(/\b\d{1,2}(st|nd|rd|th)?\b/gi, "")
    .replace(/\bat\s+\d{1,2}(:|\.)?\d{0,2}\s*(am|pm|a\.m\.|p\.m\.)?/gi, "")
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
    missing,
  };
}

function App() {
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<DraftReminder | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setReminders(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  const confirmedCount = useMemo(
    () => reminders.filter((item) => item.status === "confirmed").length,
    [reminders]
  );

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
      status: draft.missing.length === 0 ? "confirmed" : "needs_info",
      createdAt: new Date().toISOString(),
    };

    setReminders((prev) => [newReminder, ...prev]);
    setInput("");
    setDraft(null);
  }

  function handleDelete(id: string) {
    setReminders((prev) => prev.filter((item) => item.id !== id));
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
        <div className="top-pill">RMS Sprint 1 · Local Prototype</div>

        <h1>Reminder Management System</h1>
        <p className="subtitle">
          Speak or type a natural reminder. RMS will understand the task, date,
          and time before saving it.
        </p>

        <div className="today-card">
          <span>Today</span>
          <strong>{getTodayLabel()}</strong>
        </div>

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
              className={isListening ? "secondary-button listening" : "secondary-button"}
              onClick={handleVoiceInput}
              type="button"
            >
              {isListening ? "Listening..." : "Speak"}
            </button>

            <button className="primary-button" onClick={handleUnderstand} type="button">
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

            <button className="confirm-button" onClick={handleConfirm} type="button">
              Save Reminder
            </button>
          </div>
        )}
      </section>

      <section className="list-card">
        <div className="list-header">
          <div>
            <h2>Saved reminders</h2>
            <p>{confirmedCount} confirmed reminder(s)</p>
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
              <article key={item.id} className="reminder-item">
                <div>
                  <div className="status-line">
                    <span
                      className={
                        item.status === "confirmed"
                          ? "status-dot confirmed"
                          : "status-dot warning"
                      }
                    />
                    <small>
                      {item.status === "confirmed" ? "Confirmed" : "Needs info"}
                    </small>
                  </div>

                  <h3>{item.title}</h3>
                  <p>
                    {item.dateText} · {item.timeText}
                  </p>
                </div>

                <button onClick={() => handleDelete(item.id)} type="button">
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;