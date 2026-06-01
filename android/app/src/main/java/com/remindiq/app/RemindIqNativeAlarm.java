package com.remindiq.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.time.Instant;

/**
 * RemindIQ 3N.12-P0 Native Alarm Spike
 *
 * Native owner for alarm scheduling.
 *
 * React/WebView should only call:
 * - scheduleAlarm(...)
 * - cancelAlarm(...)
 * - stopRinging(...)
 * - getAlarmCapability()
 */
@CapacitorPlugin(name = "RemindIqNativeAlarm")
public class RemindIqNativeAlarm extends Plugin {

    public static final String PREFS = "remindiq_native_alarm_prefs";
    public static final String EXTRA_ID = "remindiq.extra.ID";
    public static final String EXTRA_TITLE = "remindiq.extra.TITLE";
    public static final String EXTRA_BODY = "remindiq.extra.BODY";
    public static final String EXTRA_DUE_AT = "remindiq.extra.DUE_AT";
    public static final String EXTRA_TIME_TEXT = "remindiq.extra.TIME_TEXT";
    public static final String EXTRA_CATEGORY = "remindiq.extra.CATEGORY";
    public static final String ACTION_FIRE = "remindiq.action.FIRE_NATIVE_ALARM";
    public static final String ACTION_SNOOZE = "remindiq.action.SNOOZE_NATIVE_ALARM";
    public static final String ACTION_DISMISS = "remindiq.action.DISMISS_NATIVE_ALARM";
    public static final String ACTION_STOP = "remindiq.action.STOP_NATIVE_ALARM";
    public static final String CHANNEL_ID = "remindiq_3n12_native_alarm";
    public static final int SNOOZE_MINUTES = 5;

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        try {
            String id = call.getString("id", "");
            String title = call.getString("title", "Reminder");
            String body = call.getString("body", title);
            String dueAt = call.getString("dueAt", "");
            String timeText = call.getString("timeText", "");
            String category = call.getString("category", "General");

            if (id == null || id.trim().isEmpty()) {
                call.reject("Missing reminder id.");
                return;
            }

            long dueAtEpochMs = parseDueAt(dueAt);
            if (dueAtEpochMs <= System.currentTimeMillis()) {
                call.reject("Cannot schedule native alarm in the past.");
                return;
            }

            Context context = getContext();
            RemindIqAlarmReceiver.ensureChannel(context);

            Intent fireIntent = new Intent(context, RemindIqAlarmReceiver.class);
            fireIntent.setAction(ACTION_FIRE);
            putAlarmExtras(fireIntent, id, title, body, dueAt, timeText, category);

            PendingIntent firePendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode(id),
                fireIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag()
            );

            Intent showIntent = RemindIqAlarmActivity.buildIntent(context, id, title, body, dueAt, timeText, category);
            PendingIntent showPendingIntent = PendingIntent.getActivity(
                context,
                requestCode(id + "_show"),
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag()
            );

            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            /*
             * setAlarmClock is intentionally used for this spike.
             * It is user-visible alarm behavior and is the closest fit for RemindIQ's "real alarm" requirement.
             */
            AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(dueAtEpochMs, showPendingIntent);
            alarmManager.setAlarmClock(info, firePendingIntent);

            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString("last_id", id)
                .putString("last_title", title)
                .putString("last_dueAt", dueAt)
                .putLong("lastScheduledAtEpochMs", dueAtEpochMs)
                .putBoolean("lastScheduleUsedAlarmClock", true)
                .apply();

            JSObject result = buildCapabilityResult(context);
            result.put("scheduled", true);
            result.put("usedAlarmClock", true);
            result.put("id", id);
            result.put("dueAtEpochMs", dueAtEpochMs);
            call.resolve(result);
        } catch (Exception ex) {
            call.reject("Native alarm schedule failed: " + ex.getMessage(), ex);
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        String id = call.getString("id", "");
        if (id == null || id.trim().isEmpty()) {
            call.reject("Missing reminder id.");
            return;
        }

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        Intent fireIntent = new Intent(context, RemindIqAlarmReceiver.class);
        fireIntent.setAction(ACTION_FIRE);

        PendingIntent firePendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode(id),
            fireIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag()
        );

        alarmManager.cancel(firePendingIntent);
        NotificationManagerCompat.from(context).cancel(requestCode(id));
        RemindIqRingingService.stop(context);

        JSObject result = new JSObject();
        result.put("cancelled", true);
        result.put("id", id);
        call.resolve(result);
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        RemindIqRingingService.stop(getContext());
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }

    @PluginMethod
    public void openAlarmSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception ex) {
            call.reject("Could not open alarm settings: " + ex.getMessage(), ex);
        }
    }

    @PluginMethod
    public void getAlarmCapability(PluginCall call) {
        call.resolve(buildCapabilityResult(getContext()));
    }

    public static void putAlarmExtras(Intent intent, String id, String title, String body, String dueAt, String timeText, String category) {
        intent.putExtra(EXTRA_ID, id);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_BODY, body);
        intent.putExtra(EXTRA_DUE_AT, dueAt);
        intent.putExtra(EXTRA_TIME_TEXT, timeText);
        intent.putExtra(EXTRA_CATEGORY, category);
    }

    public static long parseDueAt(String dueAt) {
        if (dueAt == null || dueAt.trim().isEmpty()) {
            throw new IllegalArgumentException("Missing dueAt.");
        }
        return Instant.parse(dueAt).toEpochMilli();
    }

    public static int requestCode(String id) {
        return Math.abs(id.hashCode());
    }

    public static int immutableFlag() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
    }

    private JSObject buildCapabilityResult(Context context) {
        JSObject result = new JSObject();

        boolean notificationsAllowed = NotificationManagerCompat.from(context).areNotificationsEnabled();
        boolean exactAllowed = true;
        boolean fullScreenIntentAllowed = true;

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                exactAllowed = alarmManager.canScheduleExactAlarms();
            } catch (Exception ignored) {
                exactAllowed = true;
            }
        }

        if (Build.VERSION.SDK_INT >= 34) {
            try {
                NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                fullScreenIntentAllowed = manager.canUseFullScreenIntent();
            } catch (Exception ignored) {
                fullScreenIntentAllowed = true;
            }
        }

        long lastScheduled = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getLong("lastScheduledAtEpochMs", 0);

        result.put("nativeSpike", "3N.12-P0");
        result.put("notificationsAllowed", notificationsAllowed);
        result.put("exactAllowed", exactAllowed);
        result.put("fullScreenIntentAllowed", fullScreenIntentAllowed);
        result.put("lastScheduledAtEpochMs", lastScheduled);
        result.put("lastScheduleUsedAlarmClock", true);
        return result;
    }
}
