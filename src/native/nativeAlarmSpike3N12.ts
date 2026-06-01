import { Capacitor, registerPlugin } from "@capacitor/core";

export type NativeAlarmSchedulePayload3N12 = {
  id: string;
  title: string;
  body?: string;
  dueAt: string;
  timeText?: string;
  category?: string;
};

export type NativeAlarmCapability3N12 = {
  nativeSpike?: string;
  notificationsAllowed?: boolean;
  exactAllowed?: boolean;
  fullScreenIntentAllowed?: boolean;
  lastScheduledAtEpochMs?: number;
  lastScheduleUsedAlarmClock?: boolean;
};

export type RemindIqNativeAlarmPlugin3N12 = {
  scheduleAlarm(payload: NativeAlarmSchedulePayload3N12): Promise<NativeAlarmCapability3N12 & {
    scheduled: boolean;
    usedAlarmClock: boolean;
    id: string;
    dueAtEpochMs: number;
  }>;
  cancelAlarm(payload: { id: string }): Promise<{ cancelled: boolean; id: string }>;
  stopRinging(): Promise<{ stopped: boolean }>;
  getAlarmCapability(): Promise<NativeAlarmCapability3N12>;
  openAlarmSettings(): Promise<{ opened: boolean }>;
};

export const RemindIqNativeAlarm3N12 =
  registerPlugin<RemindIqNativeAlarmPlugin3N12>("RemindIqNativeAlarm");

export const REMINDIQ_3N12_BUILD_LABEL =
  "Sprint 3N.12 · P0 Native Alarm Spike";

export const REMINDIQ_3N12_APP_VERSION = "3N.12-P0";

export function isNativeAlarmSpikeAvailable3N12() {
  return Capacitor.isNativePlatform();
}
