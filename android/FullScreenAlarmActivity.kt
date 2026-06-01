package com.remindiq.app

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * RemindIQ 3N.10.1
 *
 * Native fullscreen alarm surface.
 *
 * This Activity is intentionally native because lock-screen / wake-screen behavior
 * cannot be reliably controlled from React UI alone.
 */
class FullScreenAlarmActivity : AppCompatActivity() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var mediaPlayer: MediaPlayer? = null

    private val reminderId: String
        get() = intent.getStringExtra(EXTRA_REMINDER_ID) ?: ""

    private val reminderTitle: String
        get() = intent.getStringExtra(EXTRA_REMINDER_TITLE) ?: "Reminder"

    private val reminderTime: String
        get() = intent.getStringExtra(EXTRA_REMINDER_TIME) ?: ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        applyLockScreenFlags()
        acquireWakeLock()
        setContentView(R.layout.activity_full_screen_alarm)

        val titleView = findViewById<TextView>(R.id.alarmTitle)
        val timeView = findViewById<TextView>(R.id.alarmTime)
        val snoozeButton = findViewById<Button>(R.id.btnSnooze)
        val dismissButton = findViewById<Button>(R.id.btnDismiss)
        val openButton = findViewById<Button>(R.id.btnOpenApp)

        titleView.text = reminderTitle
        timeView.text = if (reminderTime.isNotBlank()) reminderTime else "Due now"

        startAlarmFeedback()

        snoozeButton.setOnClickListener {
            AlarmDueReceiver.snoozeReminder(this, reminderId, reminderTitle, 5)
            stopAlarmFeedback()
            finishAndRemoveTask()
        }

        dismissButton.setOnClickListener {
            AlarmDueReceiver.dismissReminder(this, reminderId)
            stopAlarmFeedback()
            finishAndRemoveTask()
        }

        openButton.setOnClickListener {
            stopAlarmFeedback()
            openMainApp()
            finishAndRemoveTask()
        }
    }

    override fun onDestroy() {
        stopAlarmFeedback()
        wakeLock?.releaseIfHeld()
        wakeLock = null
        super.onDestroy()
    }

    private fun applyLockScreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        )
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        wakeLock = powerManager.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "RemindIQ:FullScreenAlarmWakeLock"
        )
        wakeLock?.acquire(60_000)
    }

    private fun startAlarmFeedback() {
        vibrate()
        // Keep sound lightweight. If you already have custom alarm sound logic,
        // wire it here instead of MediaPlayer default.
    }

    private fun stopAlarmFeedback() {
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
    }

    private fun vibrate() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                val vibrator = vibratorManager.defaultVibrator
                vibrator.vibrate(
                    VibrationEffect.createWaveform(longArrayOf(0, 700, 400, 700, 400, 700), -1)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(
                        VibrationEffect.createWaveform(longArrayOf(0, 700, 400, 700, 400, 700), -1)
                    )
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(longArrayOf(0, 700, 400, 700, 400, 700), -1)
                }
            }
        } catch (_: Exception) {
            // Vibration may be blocked on some devices. Do not crash alarm UI.
        }
    }

    private fun openMainApp() {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        launchIntent?.putExtra(EXTRA_REMINDER_ID, reminderId)
        launchIntent?.putExtra("source", "fullscreen_alarm")
        if (launchIntent != null) startActivity(launchIntent)
    }

    private fun PowerManager.WakeLock.releaseIfHeld() {
        if (isHeld) release()
    }

    companion object {
        const val EXTRA_REMINDER_ID = "remindiq.extra.REMINDER_ID"
        const val EXTRA_REMINDER_TITLE = "remindiq.extra.REMINDER_TITLE"
        const val EXTRA_REMINDER_TIME = "remindiq.extra.REMINDER_TIME"

        fun buildIntent(
            context: Context,
            reminderId: String,
            reminderTitle: String,
            reminderTime: String
        ): Intent {
            return Intent(context, FullScreenAlarmActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra(EXTRA_REMINDER_ID, reminderId)
                putExtra(EXTRA_REMINDER_TITLE, reminderTitle)
                putExtra(EXTRA_REMINDER_TIME, reminderTime)
            }
        }
    }
}
