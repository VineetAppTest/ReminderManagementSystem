package com.remindiq.app

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Notification
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * RemindIQ 3N.10.1
 *
 * BroadcastReceiver that routes due alarms/reminders to native fullscreen UI.
 */
class AlarmDueReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val reminderId = intent.getStringExtra(FullScreenAlarmActivity.EXTRA_REMINDER_ID) ?: ""
        val reminderTitle = intent.getStringExtra(FullScreenAlarmActivity.EXTRA_REMINDER_TITLE) ?: "Reminder"
        val reminderTime = intent.getStringExtra(FullScreenAlarmActivity.EXTRA_REMINDER_TIME) ?: "Due now"

        showFullScreenAlarm(context, reminderId, reminderTitle, reminderTime)
    }

    private fun showFullScreenAlarm(
        context: Context,
        reminderId: String,
        reminderTitle: String,
        reminderTime: String
    ) {
        ensureAlarmChannel(context)

        val fullScreenIntent = FullScreenAlarmActivity.buildIntent(
            context,
            reminderId,
            reminderTitle,
            reminderTime
        )

        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            reminderId.hashCode(),
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or immutableFlag()
        )

        val snoozeIntent = Intent(context, AlarmDueReceiver::class.java).apply {
            action = ACTION_SNOOZE
            putExtra(FullScreenAlarmActivity.EXTRA_REMINDER_ID, reminderId)
            putExtra(FullScreenAlarmActivity.EXTRA_REMINDER_TITLE, reminderTitle)
            putExtra(FullScreenAlarmActivity.EXTRA_REMINDER_TIME, reminderTime)
        }

        val dismissIntent = Intent(context, AlarmDueReceiver::class.java).apply {
            action = ACTION_DISMISS
            putExtra(FullScreenAlarmActivity.EXTRA_REMINDER_ID, reminderId)
        }

        val snoozePendingIntent = PendingIntent.getBroadcast(
            context,
            (reminderId + "_snooze").hashCode(),
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or immutableFlag()
        )

        val dismissPendingIntent = PendingIntent.getBroadcast(
            context,
            (reminderId + "_dismiss").hashCode(),
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or immutableFlag()
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(reminderTitle)
            .setContentText(reminderTime)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(R.mipmap.ic_launcher, "Snooze", snoozePendingIntent)
            .addAction(R.mipmap.ic_launcher, "Dismiss", dismissPendingIntent)
            .build()

        NotificationManagerCompat.from(context).notify(reminderId.hashCode(), notification)

        // Attempt direct Activity launch as well.
        // On newer Android versions, fullscreen notification is the more reliable route.
        try {
            context.startActivity(fullScreenIntent)
        } catch (_: Exception) {
            // Fallback notification already posted.
        }
    }

    companion object {
        const val CHANNEL_ID = "remindiq_fullscreen_alarm_channel"
        const val CHANNEL_NAME = "RemindIQ Fullscreen Alarms"
        const val ACTION_SNOOZE = "remindiq.action.SNOOZE"
        const val ACTION_DISMISS = "remindiq.action.DISMISS"

        fun ensureAlarmChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Urgent RemindIQ alarm notifications"
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    setBypassDnd(true)
                    enableVibration(true)
                }

                val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.createNotificationChannel(channel)
            }
        }

        fun snoozeReminder(
            context: Context,
            reminderId: String,
            reminderTitle: String,
            minutes: Int
        ) {
            val dueAt = System.currentTimeMillis() + minutes * 60_000L
            val intent = Intent(context, AlarmDueReceiver::class.java).apply {
                putExtra(FullScreenAlarmActivity.EXTRA_REMINDER_ID, reminderId)
                putExtra(FullScreenAlarmActivity.EXTRA_REMINDER_TITLE, reminderTitle)
                putExtra(FullScreenAlarmActivity.EXTRA_REMINDER_TIME, "Snoozed")
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                reminderId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or immutableFlag()
            )

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, dueAt, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, dueAt, pendingIntent)
            }

            NotificationManagerCompat.from(context).cancel(reminderId.hashCode())
        }

        fun dismissReminder(context: Context, reminderId: String) {
            NotificationManagerCompat.from(context).cancel(reminderId.hashCode())
            // TODO: If you already have a native bridge/local storage update mechanism,
            // mark the reminder as notified/dismissed here.
        }

        private fun immutableFlag(): Int {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        }
    }
}
