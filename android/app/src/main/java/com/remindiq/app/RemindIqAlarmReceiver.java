package com.remindiq.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Receives AlarmManager firing event and launches the native alarm path.
 */
public class RemindIqAlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        ensureChannel(context);

        String id = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_ID);
        String title = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_TITLE);
        String body = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_BODY);
        String dueAt = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_DUE_AT);
        String timeText = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_TIME_TEXT);
        String category = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_CATEGORY);

        if (id == null || id.trim().isEmpty()) id = "native_alarm";
        if (title == null || title.trim().isEmpty()) title = "Reminder";
        if (body == null || body.trim().isEmpty()) body = title;
        if (dueAt == null) dueAt = "";
        if (timeText == null || timeText.trim().isEmpty()) timeText = "Due now";
        if (category == null) category = "General";

        RemindIqRingingService.start(context, id, title, body, dueAt, timeText, category);

        Intent activityIntent = RemindIqAlarmActivity.buildIntent(context, id, title, body, dueAt, timeText, category);
        PendingIntent fullScreenIntent = PendingIntent.getActivity(
            context,
            RemindIqNativeAlarm.requestCode(id + "_activity"),
            activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | RemindIqNativeAlarm.immutableFlag()
        );

        PendingIntent snoozeIntent = RemindIqAlarmActionReceiver.buildActionIntent(
            context,
            RemindIqNativeAlarm.ACTION_SNOOZE,
            id,
            title,
            body,
            dueAt,
            timeText,
            category
        );

        PendingIntent dismissIntent = RemindIqAlarmActionReceiver.buildActionIntent(
            context,
            RemindIqNativeAlarm.ACTION_DISMISS,
            id,
            title,
            body,
            dueAt,
            timeText,
            category
        );

        Notification notification = new NotificationCompat.Builder(context, RemindIqNativeAlarm.CHANNEL_ID)
            .setSmallIcon(context.getApplicationInfo().icon)
            .setContentTitle("Reminder due")
            .setContentText(title + " · " + timeText)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenIntent, true)
            .setContentIntent(fullScreenIntent)
            .addAction(context.getApplicationInfo().icon, "Snooze 5m", snoozeIntent)
            .addAction(context.getApplicationInfo().icon, "Dismiss", dismissIntent)
            .build();

        NotificationManagerCompat.from(context).notify(RemindIqNativeAlarm.requestCode(id), notification);

        try {
            context.startActivity(activityIntent);
        } catch (Exception ignored) {
            // Fullscreen notification remains as fallback.
        }
    }

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                RemindIqNativeAlarm.CHANNEL_ID,
                "RemindIQ Native Alarms",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Native RemindIQ alarm ringing and controls");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.enableVibration(true);
            channel.setBypassDnd(true);

            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            manager.createNotificationChannel(channel);
        }
    }
}
