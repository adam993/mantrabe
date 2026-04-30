package com.mantrabe.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Patched in by scripts/apply-android-customizations.cjs after `cap sync`.
// The only addition over the Capacitor-generated default is the registerPlugin
// call so MantraSchedulerPlugin is available on the JS bridge.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MantraSchedulerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
