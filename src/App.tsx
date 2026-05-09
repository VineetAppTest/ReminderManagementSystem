import { useEffect, useMemo, useRef, useState } from "react";
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

type NotificationState = NotificationPermission | "unsupported" | "https-needed";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

const REMINDERS_KEY = "remindiq_reminders_v2d_stable";
const DRAFT_KEY = "remindiq_active_draft_v2d_stable";
const MESSAGES_KEY = "remindiq_messages_v2d_stable";
const LEARNING_KEY = "remindiq_learning_v2d_stable";

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
  const [isListening, setIsListening] = useState(false);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("All");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [actionButtonsArmed, setActionButtonsArmed] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
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
        setMessages(Array.isArray(parsed) ? parsed.slice(-8) : []);
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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, draft]);

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
            return {
              ...item,
              notifiedAt: new Date().toISOString(),
            };
          }

          if (
            item.status === "confirmed" &&
            item.dueAt &&
            item.notifiedAt &&
            new Date(item.dueAt).getTime() < now
          ) {
            return {
              ...item,
              status: "archived",
            };
          }

          return item;
        });

        dueItems.forEach((item) => {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("RemindIQ", { body: item.title });
          } else {
            window.alert(`Reminder due: ${item.title}`);
          }
        });

        return next;
      });
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  const activeReminders = useMemo(() => visibleReminders(reminders), [reminders]);

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
      if (activeFilter === "Upcoming") return reminder.status === "confirmed" && Boolean(reminder.dueAt);
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

  function saveDraft() {
    if (!draft) return;

    const result = createRemindersFromDraft(draft);

    if (result.reminders.length === 0) {
      setMessages((prev) => addMessageToList(prev, "assistant", result.assistantText));
      return;
    }

    setReminders((prev) => [...result.reminders, ...prev]);
    setLearning((prev) => updateLearningMemory(prev, result.reminders));
    setMessages((prev) => addMessageToList(prev, "assistant", result.assistantText));
    setDraft(null);
  }

  function processText(text: string) {
    const cleanText = text.trim();
    if (!cleanText) return;

    setMessages((prev) => addMessageToList(prev, "user", cleanText));

    if (draft && readyToSave && isSaveIntent(cleanText)) {
      setTimeout(saveDraft, 0);
      return;
    }

    if (draft && isCancelIntent(cleanText)) {
      setDraft(null);
      setMessages((prev) =>
        addMessageToList(prev, "assistant", "No problem — I won’t save it. Tell me the next reminder when ready.")
      );
      return;
    }

    if (draft && readyToSave && isChangeIntent(cleanText)) {
      setInput(draft.rawText || draft.task);
      setDraft(null);
      setMessages((prev) => addMessageToList(prev, "assistant", "Sure — make the change and send it again."));
      return;
    }

    const result = processUserText(draft, cleanText, learning);
    setDraft(result.draft);
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
    setInput(draft.rawText || draft.task);
    setDraft(null);
    setMessages((prev) => addMessageToList(prev, "assistant", "Sure — make the change and send it again."));
  }

  function handleDropClick() {
    if (!actionButtonsArmed) return;
    setDraft(null);
    setMessages((prev) =>
      addMessageToList(prev, "assistant", "No problem — I won’t save it. Tell me the next reminder when ready.")
    );
  }

  function handleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceMessage("Voice input is not supported in this browser. Try Chrome/Edge over HTTPS.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    setVoiceMessage("Listening... speak now.");

    recognition.start();

    recognition.onresult = (event: any) => {
      const spokenText = event.results?.[0]?.[0]?.transcript || "";
      setIsListening(false);

      if (!spokenText.trim()) {
        setVoiceMessage("I did not catch that. Please try again.");
        return;
      }

      setInput("");
      setVoiceMessage("Voice captured.");
      processText(spokenText);
    };

    recognition.onerror = (event: any) => {
      const error = event?.error || "unknown";
      setIsListening(false);

      if (error === "not-allowed") {
        setVoiceMessage("Microphone permission is blocked. Allow microphone access in browser settings.");
      } else if (error === "no-speech") {
        setVoiceMessage("No speech was detected. Tap Speak and start talking immediately.");
      } else if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
        setVoiceMessage("Voice may need HTTPS on mobile. Typing still works in local preview.");
      } else {
        setVoiceMessage(`Voice capture failed: ${error}.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };
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

  function handleDelete(id: string) {
    setReminders((prev) => prev.filter((item) => item.id !== id));
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
      <section className="conversation-shell">
        <header className="app-header">
          <div>
            <div className="top-line">
              <span className="brand-name">RemindIQ</span>
              <span className="memory-pill">Local memory</span>
            </div>
            <p className="tagline">Natural reminders. Smarter follow-through.</p>
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
          <span className="helper-text">Voice/alerts are best after HTTPS deployment.</span>
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
                {isListening ? "Listening..." : "Speak"}
              </button>

              <button className="primary-button" onClick={handleSend} type="button">
                Send
              </button>
            </div>

            {voiceMessage && <p className="voice-message">{voiceMessage}</p>}
          </div>
        </div>
      </section>

      <section className="list-card">
        <div className="list-header">
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
              <article key={item.id} className={item.status === "done" ? "reminder-item done-item" : "reminder-item"}>
                <div className="reminder-main">
                  <div className="status-line">
                    <span className={`status-dot ${item.status === "done" ? "done" : item.status === "confirmed" ? "confirmed" : "warning"}`} />
                    <small>{item.status === "done" ? "Done" : item.status === "confirmed" ? "Confirmed" : "Needs info"}</small>
                    <span className={`category-chip category-${item.category.toLowerCase()}`}>{item.category}</span>
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
                      <p>Reminder: {item.dateText} · {item.timeText}</p>
                      {item.eventTimeText && <p className="event-line">Event: {item.eventDateText || item.dateText} · {item.eventTimeText}</p>}
                    </>
                  )}
                </div>

                {editingId !== item.id && (
                  <div className="item-actions">
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

        <details className="test-bank">
          <summary>Stabilisation test bank</summary>
          <ul>
            {getTestBank().map((test) => (
              <li key={test}>{test}</li>
            ))}
          </ul>
        </details>
      </section>
    </main>
  );
}

export default App;