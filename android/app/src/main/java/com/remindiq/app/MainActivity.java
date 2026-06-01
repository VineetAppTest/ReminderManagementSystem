package com.remindiq.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(RemindIqNativeAlarmPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
