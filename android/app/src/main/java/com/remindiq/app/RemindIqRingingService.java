package com.remindiq.app;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Native ringing owner. This is deliberately outside WebView.
 */
public class RemindIqRingingService extends Service {

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;

    public static void start(Context context, String id, String title, String body, String dueAt, String timeText, String category) {
        Intent intent = new Intent(context, RemindIqRingingService.class);
        RemindIqNativeAlarm.putAlarmExtras(intent, id, title, body, dueAt, timeText, category);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        Intent intent = new Intent(context, RemindIqRingingService.class);
        context.stopService(intent);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        RemindIqAlarmReceiver.ensureChannel(this);

        String id = intent != null ? intent.getStringExtra(RemindIqNativeAlarm.EXTRA_ID) : "native_alarm";
        String title = intent != null ? intent.getStringExtra(RemindIqNativeAlarm.EXTRA_TITLE) : "Reminder";
        String timeText = intent != null ? intent.getStringExtra(RemindIqNativeAlarm.EXTRA_TIME_TEXT) : "Due now";

        if (id == null || id.trim().isEmpty()) id = "native_alarm";
        if (title == null || title.trim().isEmpty()) title = "Reminder";
        if (timeText == null || timeText.trim().isEmpty()) timeText = "Due now";

        Notification notification = new NotificationCompat.Builder(this, RemindIqNativeAlarm.CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("Reminder ringing")
            .setContentText(title + " · " + timeText)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .build();

        startForeground(RemindIqNativeAlarm.requestCode(id), notification);

        startSound();
        startVibration();

        return START_STICKY;
    }

    private void startSound() {
        try {
            stopSound();

            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, alarmUri);
            mediaPlayer.setLooping(true);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );
            }

            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception ignored) {
            // Do not crash the alarm UI if device sound setup fails.
        }
    }

    private void stopSound() {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.release();
            }
        } catch (Exception ignored) {
        }
        mediaPlayer = null;
    }

    private void startVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager manager = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = manager.getDefaultVibrator();
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }

            long[] pattern = new long[]{0, 800, 350, 800, 350, 800, 700};

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                vibrator.vibrate(pattern, 0);
            }
        } catch (Exception ignored) {
        }
    }

    private void stopVibration() {
        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception ignored) {
        }
        vibrator = null;
    }

    @Override
    public void onDestroy() {
        stopSound();
        stopVibration();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
