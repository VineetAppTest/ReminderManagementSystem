package com.remindiq.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Handles notification/activity button actions.
 */
public class RemindIqAlarmActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String id = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_ID);
        String title = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_TITLE);
        String body = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_BODY);
        String dueAt = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_DUE_AT);
        String timeText = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_TIME_TEXT);
        String category = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_CATEGORY);

        if (id == null || id.trim().isEmpty()) id = "native_alarm";
        if (title == null || title.trim().isEmpty()) title = "Reminder";
        if (body == null || body.trim().isEmpty()) body = title;
        if (category == null) category = "General";

        if (RemindIqNativeAlarm.ACTION_SNOOZE.equals(action)) {
            snooze(context, id, title, body, category);
            return;
        }

        if (RemindIqNativeAlarm.ACTION_DISMISS.equals(action) || RemindIqNativeAlarm.ACTION_STOP.equals(action)) {
            dismiss(context, id);
        }
    }

    public static PendingIntent buildActionIntent(
        Context context,
        String action,
        String id,
        String title,
        String body,
        String dueAt,
        String timeText,
        String category
    ) {
        Intent intent = new Intent(context, RemindIqAlarmActionReceiver.class);
        intent.setAction(action);
        RemindIqNativeAlarm.putAlarmExtras(intent, id, title, body, dueAt, timeText, category);
        return PendingIntent.getBroadcast(
            context,
            RemindIqNativeAlarm.requestCode(id + "_" + action),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | RemindIqNativeAlarm.immutableFlag()
        );
    }

    public static void snooze(Context context, String id, String title, String body, String category) {
        RemindIqRingingService.stop(context);

        long dueAtEpochMs = System.currentTimeMillis() + RemindIqNativeAlarm.SNOOZE_MINUTES * 60_000L;
        String dueAt = java.time.Instant.ofEpochMilli(dueAtEpochMs).toString();
        String timeText = "Snoozed 5m";

        Intent fireIntent = new Intent(context, RemindIqAlarmReceiver.class);
        fireIntent.setAction(RemindIqNativeAlarm.ACTION_FIRE);
        RemindIqNativeAlarm.putAlarmExtras(fireIntent, id, title, body, dueAt, timeText, category);

        PendingIntent firePendingIntent = PendingIntent.getBroadcast(
            context,
            RemindIqNativeAlarm.requestCode(id),
            fireIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | RemindIqNativeAlarm.immutableFlag()
        );

        Intent showIntent = RemindIqAlarmActivity.buildIntent(context, id, title, body, dueAt, timeText, category);
        PendingIntent showPendingIntent = PendingIntent.getActivity(
            context,
            RemindIqNativeAlarm.requestCode(id + "_show"),
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | RemindIqNativeAlarm.immutableFlag()
        );

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        alarmManager.setAlarmClock(new AlarmManager.AlarmClockInfo(dueAtEpochMs, showPendingIntent), firePendingIntent);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        manager.cancel(RemindIqNativeAlarm.requestCode(id));
    }

    public static void dismiss(Context context, String id) {
        RemindIqRingingService.stop(context);
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        manager.cancel(RemindIqNativeAlarm.requestCode(id));
    }
}
