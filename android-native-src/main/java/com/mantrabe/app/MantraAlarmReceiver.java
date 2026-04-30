package com.mantrabe.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;

// Fired by AlarmManager when a mantra's scheduled time arrives. Runs in
// a brief native context that is alive even when the JS process is dead
// — that's what makes self-rescheduling possible without depending on
// the user opening or tapping the app.
public class MantraAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "MantraAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String json = intent.getStringExtra(MantraScheduler.EXTRA_MANTRA_JSON);
        if (json == null) {
            Log.w(TAG, "Alarm fired without mantra payload");
            return;
        }
        try {
            JSONObject mantra = new JSONObject(json);
            // Belt-and-braces: only show if we're inside the active
            // window. computeNextOccurrence already places fires inside
            // it, but a sleeping device with clock skew or a switched-
            // off active day can occasionally land us outside.
            if (isWithinActiveWindow(mantra, System.currentTimeMillis())) {
                showNotification(context, mantra);
            }
            // Always reschedule the next occurrence — the whole point of
            // running here is that no JS will do it for us.
            MantraScheduler.scheduleNext(context, mantra);
        } catch (JSONException e) {
            Log.e(TAG, "Bad mantra JSON in alarm intent", e);
        }
    }

    private boolean isWithinActiveWindow(JSONObject mantra, long timeMs) throws JSONException {
        int activeDaysMask = mantra.getInt("activeDaysMask");

        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(timeMs);
        int dow = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7;
        if ((activeDaysMask & (1 << dow)) == 0) return false;

        int totalMin = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);

        // Specific-times mode: accept if we're within ±5 min of any chosen
        // hour. Doze-drift slack mirrors the frequency branch below.
        if (mantra.has("specificTimes") && !mantra.isNull("specificTimes")) {
            org.json.JSONArray arr = mantra.getJSONArray("specificTimes");
            if (arr.length() > 0) {
                for (int i = 0; i < arr.length(); i++) {
                    int hour = arr.getInt(i);
                    if (hour < 0 || hour > 23) continue;
                    int target = hour * 60;
                    if (totalMin >= target - 5 && totalMin < target + 5) return true;
                }
                return false;
            }
        }

        int activeHoursStart = mantra.getInt("activeHoursStart");
        int activeHoursEnd = mantra.getInt("activeHoursEnd");
        int frequencyMinutes = mantra.getInt("frequencyMinutes");

        int startMin = activeHoursStart * 60;
        int endMin = frequencyMinutes >= MantraScheduler.ONCE_A_DAY
            ? startMin + 1
            : activeHoursEnd * 60;
        // Allow 5 min slack at both ends to account for Doze drift.
        return totalMin >= startMin - 5 && totalMin < endMin + 5;
    }

    private void showNotification(Context ctx, JSONObject mantra) throws JSONException {
        String id = mantra.getString("id");
        String text = mantra.getString("text");
        String soundId = mantra.optString("soundId", null);

        String channelId = MantraScheduler.ensureChannel(ctx, soundId);
        int notifId = MantraScheduler.notificationId(id);

        // Tap → reopen app (singleTask, so we land on the existing instance).
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPi = PendingIntent.getActivity(
            ctx, notifId, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channelId)
            .setContentTitle("Mantrabe")
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setSmallIcon(resolveSmallIcon(ctx))
            .setAutoCancel(true)
            .setContentIntent(contentPi)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER);

        // Pre-O: channels don't apply, set sound + vibration on the
        // builder itself.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            if (soundId != null && !soundId.isEmpty()) {
                int rawId = ctx.getResources().getIdentifier(soundId, "raw", ctx.getPackageName());
                if (rawId != 0) {
                    Uri soundUri = Uri.parse(
                        "android.resource://" + ctx.getPackageName() + "/" + rawId
                    );
                    b.setSound(soundUri, AudioAttributes.USAGE_NOTIFICATION);
                }
            }
            b.setDefaults(NotificationCompat.DEFAULT_VIBRATE | NotificationCompat.DEFAULT_LIGHTS);
        }

        try {
            NotificationManagerCompat.from(ctx).notify(notifId, b.build());
        } catch (SecurityException se) {
            // Android 13+: POST_NOTIFICATIONS not granted. Silently skip;
            // the user will re-grant via app settings or our in-app
            // permission prompt.
            Log.w(TAG, "POST_NOTIFICATIONS not granted, skipping fire", se);
        }
    }

    // Prefer a dedicated monochrome status-bar icon if the project ships
    // one (looked up by name so we don't break compile when it's absent),
    // otherwise fall back to the launcher icon. The launcher renders as a
    // colored blob in the status bar, but it works.
    private int resolveSmallIcon(Context ctx) {
        int dedicated = ctx.getResources()
            .getIdentifier("ic_stat_mantrabe", "drawable", ctx.getPackageName());
        if (dedicated != 0) return dedicated;
        ApplicationInfo info = ctx.getApplicationInfo();
        return info.icon != 0 ? info.icon : android.R.drawable.ic_dialog_info;
    }
}
