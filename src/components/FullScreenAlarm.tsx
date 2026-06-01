import React, { useEffect } from "react";
import "../styles/fullScreenAlarm.css";

const ALARM_CONTROL_BUILD_LABEL = "Sprint 3N.11.6 P0 WebView-Only Alarm Surface";

function isAndroidNativeAlarmShell(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const cap = (window as any)?.Capacitor;
  return /Android/i.test(ua) || Boolean(cap?.isNativePlatform?.() && cap?.getPlatform?.() === "android");
}

export type FullScreenAlarmModel = {
  id: string;
  title?: string;
  rawText?: string;
  timeText?: string;
  dateText?: string;
  datePhrase?: string;
  dueAt?: string | null;
  eventTimeText?: string;
  eventDateText?: string;
  eventPhrase?: string;
  repeatRule?: {
    label?: string;
    kind?: string;
    intervalMinutes?: number;
  } | null;
  isAlarm?: boolean;
};

type FullScreenAlarmProps = {
  alarm: FullScreenAlarmModel | null;
  onSnooze: (alarm: FullScreenAlarmModel, minutes?: number) => void;
  onDone: (alarm: FullScreenAlarmModel) => void;
  onClose?: (alarm: FullScreenAlarmModel) => void;
  snoozeMinutes?: number;
};

export default function FullScreenAlarm({
  alarm,
  onSnooze,
  onDone,
  onClose,
  snoozeMinutes = 5,
}: FullScreenAlarmProps) {
  // Sprint 3N.11.6: never suppress this control surface on Android.
  // The native-only approach produced the broken white/pill screen; this WebView
  // overlay is now the reliable Snooze/Done surface when the app is active.
  const suppressForNativeAndroid = false;

  useEffect(() => {
    if (!alarm) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDone(alarm);
      if (event.key.toLowerCase() === "s") onSnooze(alarm, snoozeMinutes);
      if (event.key.toLowerCase() === "d") onDone(alarm);
    };

    document.body.classList.add("ri-alarm-body-lock");
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("ri-alarm-body-lock");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [alarm, onDone, onSnooze, snoozeMinutes]);

  if (!alarm || suppressForNativeAndroid) return null;

  const title = cleanAlarmTitle(alarm.title || alarm.rawText || "Alarm");
  const primaryTime = alarm.timeText || alarm.eventTimeText || formatDueAt(alarm.dueAt) || "Now";
  const dateLabel = alarm.dateText || alarm.eventDateText || alarm.datePhrase || "Today";
  const repeatLabel = alarm.repeatRule?.label;
  const alarmTypeLabel = alarm.isAlarm ? "Alarm ringing" : "Reminder due";

  return (
    <section className="ri-alarm-control-overlay" role="dialog" aria-modal="true" aria-label="Alarm controls">
      <div className="ri-alarm-control-card">
        <button
          type="button"
          className="ri-alarm-control-close"
          onClick={() => (onClose ? onClose(alarm) : onDone(alarm))}
          aria-label="Close and stop alarm"
        >
          ×
        </button>

        <div className="ri-alarm-control-status">
          <span className="ri-alarm-control-dot" aria-hidden="true" />
          <span>{alarmTypeLabel}</span>
        </div>

        <h1 className="ri-alarm-control-title" title={title}>{title}</h1>

        <div className="ri-alarm-control-details" aria-label="Alarm details">
          <span>{dateLabel}</span>
          <strong>{primaryTime}</strong>
          {repeatLabel ? <span>{repeatLabel}</span> : null}
        </div>

        <div className="ri-alarm-control-actions" aria-label="Alarm actions">
          <button
            type="button"
            className="ri-alarm-control-button ri-alarm-control-button--snooze"
            onClick={() => onSnooze(alarm, snoozeMinutes)}
          >
            Snooze {snoozeMinutes} min
          </button>

          <button
            type="button"
            className="ri-alarm-control-button ri-alarm-control-button--done"
            onClick={() => onDone(alarm)}
          >
            Done / Stop
          </button>
        </div>

        <p className="ri-alarm-control-hint">RemindIQ · {ALARM_CONTROL_BUILD_LABEL}</p>
      </div>
    </section>
  );
}

function cleanAlarmTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, " ");
  if (!title) return "Alarm";
  if (/^alarm$/i.test(title)) return "Alarm";
  return title;
}

function formatDueAt(dueAt?: string | null): string | null {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
