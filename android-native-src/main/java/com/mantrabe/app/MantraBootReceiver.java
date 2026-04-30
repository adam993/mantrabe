package com.mantrabe.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// AlarmManager loses pending alarms on reboot. We persist the active
// mantra list to SharedPreferences whenever JS calls schedule(), and
// this receiver re-arms each one on BOOT_COMPLETED so reminders
// resume after the device reboots without the user having to open the
// app.
public class MantraBootReceiver extends BroadcastReceiver {
    private static final String TAG = "MantraBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
            && !Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(intent.getAction())) {
            return;
        }
        JSONArray all = MantraScheduler.loadAll(context);
        for (int i = 0; i < all.length(); i++) {
            try {
                JSONObject m = all.getJSONObject(i);
                MantraScheduler.scheduleNext(context, m);
            } catch (JSONException e) {
                Log.e(TAG, "Bad mantra at index " + i, e);
            }
        }
        Log.d(TAG, "Restored " + all.length() + " mantras after boot");
    }
}
