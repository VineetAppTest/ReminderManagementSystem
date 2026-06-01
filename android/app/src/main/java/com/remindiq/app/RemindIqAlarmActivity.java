package com.remindiq.app;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Single native alarm UI for 3N.12.
 *
 * No WebView alarm surface should be shown while this is active.
 */
public class RemindIqAlarmActivity extends AppCompatActivity {

    private String id;
    private String title;
    private String body;
    private String dueAt;
    private String timeText;
    private String category;

    public static Intent buildIntent(Context context, String id, String title, String body, String dueAt, String timeText, String category) {
        Intent intent = new Intent(context, RemindIqAlarmActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        RemindIqNativeAlarm.putAlarmExtras(intent, id, title, body, dueAt, timeText, category);
        return intent;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyLockscreenFlags();
        readExtras(getIntent());
        setContentView(R.layout.activity_remindiq_alarm);
        bindUi();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readExtras(intent);
        bindUi();
    }

    private void readExtras(Intent intent) {
        id = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_ID);
        title = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_TITLE);
        body = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_BODY);
        dueAt = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_DUE_AT);
        timeText = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_TIME_TEXT);
        category = intent.getStringExtra(RemindIqNativeAlarm.EXTRA_CATEGORY);

        if (id == null || id.trim().isEmpty()) id = "native_alarm";
        if (title == null || title.trim().isEmpty()) title = "Reminder";
        if (body == null || body.trim().isEmpty()) body = title;
        if (dueAt == null) dueAt = "";
        if (timeText == null || timeText.trim().isEmpty()) timeText = "Due now";
        if (category == null) category = "General";
    }

    private void bindUi() {
        TextView titleView = findViewById(R.id.nativeAlarmTitle);
        TextView timeView = findViewById(R.id.nativeAlarmTime);
        TextView subtitleView = findViewById(R.id.nativeAlarmSubtitle);
        Button snoozeButton = findViewById(R.id.nativeAlarmSnooze);
        Button dismissButton = findViewById(R.id.nativeAlarmDismiss);
        Button openButton = findViewById(R.id.nativeAlarmOpenApp);

        titleView.setText(title);
        timeView.setText(timeText);
        subtitleView.setText("Your reminder is due now");

        snoozeButton.setOnClickListener(v -> {
            RemindIqAlarmActionReceiver.snooze(this, id, title, body, category);
            finishAndRemoveTask();
        });

        dismissButton.setOnClickListener(v -> {
            RemindIqAlarmActionReceiver.dismiss(this, id);
            finishAndRemoveTask();
        });

        openButton.setOnClickListener(v -> {
            RemindIqAlarmActionReceiver.dismiss(this, id);
            Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                launchIntent.putExtra("source", "native_alarm_activity");
                launchIntent.putExtra(RemindIqNativeAlarm.EXTRA_ID, id);
                startActivity(launchIntent);
            }
            finishAndRemoveTask();
        });
    }

    private void applyLockscreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            keyguardManager.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }

        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        );
    }
}
