package com.mantrabe.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;

// Shared utilities used by MantraSchedulerPlugin and the alarm/boot
// receivers. All scheduling logic lives here so it can run from a
// receiver context without touching JS — that's the whole point of this
// plugin: surviving full app process death.
public final class MantraScheduler {
    private static final String TAG = "MantraScheduler";

    private static final String PREF_NAME = "mantrabe_native_mantras";
    private static final String PREF_KEY_LIST = "mantras_v1";
    public static final String EXTRA_MANTRA_JSON = "mantra_json";

    public static final int ONCE_A_DAY = 1440;

    private MantraScheduler() {}

    // ---- persistence ------------------------------------------------------

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public static void persistAll(Context ctx, JSONArray mantras) {
        prefs(ctx).edit().putString(PREF_KEY_LIST, mantras.toString()).apply();
    }

    public static JSONArray loadAll(Context ctx) {
        String s = prefs(ctx).getString(PREF_KEY_LIST, "[]");
        try {
            return new JSONArray(s);
        } catch (JSONException e) {
            Log.e(TAG, "Corrupt mantra prefs, resetting", e);
            return new JSONArray();
        }
    }

    // ---- ids --------------------------------------------------------------

    // Same DJB2 hash as src/lib/notifications.ts so JS and native agree on
    // the per-mantra notification id (and the AlarmManager request code).
    public static int notificationId(String mantraId) {
        int h = 5381;
        for (int i = 0; i < mantraId.length(); i++) {
            h = (h << 5) + h + mantraId.charAt(i);
        }
        int abs = h < 0 ? -(h + 1) : h;
        int id = abs % Integer.MAX_VALUE;
        return id == 0 ? 1 : id;
    }

    // ---- channels ---------------------------------------------------------

    // One channel per (soundId) so each mantra can play its own bell on
    // Android 8+ where per-notification sound is ignored unless it
    // matches the channel sound. Channel ids are immutable after first
    // create, so changing importance/sound mappings means bumping the
    // version suffix.
    public static String ensureChannel(Context ctx, String soundId) {
        String safe = (soundId == null || soundId.isEmpty()) ? "default" : soundId;
        String channelId = "mantras-" + safe + "-v1";
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return channelId;

        NotificationManager nm =
            (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return channelId;
        if (nm.getNotificationChannel(channelId) != null) return channelId;

        NotificationChannel channel = new NotificationChannel(
            channelId,
            "Mantras",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Scheduled mantras and reminders");
        channel.enableVibration(true);
        channel.enableLights(true);

        if (soundId != null && !soundId.isEmpty()) {
            int rawId = ctx.getResources().getIdentifier(soundId, "raw", ctx.getPackageName());
            if (rawId != 0) {
                Uri soundUri = Uri.parse(
                    "android.resource://" + ctx.getPackageName() + "/" + rawId
                );
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();
                channel.setSound(soundUri, attrs);
            }
        }

        nm.createNotificationChannel(channel);
        return channelId;
    }

    // ---- next-occurrence math --------------------------------------------

    // Returns sorted, deduplicated, validated specificTimes hours, or an empty
    // int[] if the field is missing/empty/all-invalid.
    private static int[] parseSpecificTimes(JSONObject mantra) throws JSONException {
        if (!mantra.has("specificTimes") || mantra.isNull("specificTimes")) return new int[0];
        JSONArray arr = mantra.getJSONArray("specificTimes");
        if (arr.length() == 0) return new int[0];
        java.util.TreeSet<Integer> hours = new java.util.TreeSet<>();
        for (int i = 0; i < arr.length(); i++) {
            int h = arr.getInt(i);
            if (h >= 0 && h <= 23) hours.add(h);
        }
        int[] out = new int[hours.size()];
        int i = 0;
        for (Integer h : hours) out[i++] = h;
        return out;
    }

    // Mirrors computeNextOccurrences in src/lib/scheduler.ts. Returns 0 if
    // no future occurrence exists within the next 60 days (e.g. all
    // active days disabled).
    public static long computeNextOccurrence(JSONObject mantra, long fromMs) throws JSONException {
        int activeDaysMask = mantra.getInt("activeDaysMask");
        if (activeDaysMask == 0) return 0;

        int[] specificTimes = parseSpecificTimes(mantra);

        Calendar dayStart = Calendar.getInstance();
        dayStart.setTimeInMillis(fromMs);
        dayStart.set(Calendar.HOUR_OF_DAY, 0);
        dayStart.set(Calendar.MINUTE, 0);
        dayStart.set(Calendar.SECOND, 0);
        dayStart.set(Calendar.MILLISECOND, 0);

        if (specificTimes.length > 0) {
            for (int day = 0; day < 60; day++) {
                int dow = (dayStart.get(Calendar.DAY_OF_WEEK) + 5) % 7;
                if ((activeDaysMask & (1 << dow)) != 0) {
                    for (int hour : specificTimes) {
                        Calendar occ = (Calendar) dayStart.clone();
                        occ.set(Calendar.HOUR_OF_DAY, hour);
                        occ.set(Calendar.MINUTE, 0);
                        long t = occ.getTimeInMillis();
                        if (t > fromMs) return t;
                    }
                }
                dayStart.add(Calendar.DAY_OF_MONTH, 1);
            }
            return 0;
        }

        int frequencyMinutes = mantra.getInt("frequencyMinutes");
        int activeHoursStart = mantra.getInt("activeHoursStart");
        int activeHoursEnd = mantra.getInt("activeHoursEnd");
        if (frequencyMinutes <= 0) return 0;

        int startMin = activeHoursStart * 60;
        int endMin;
        boolean onceADay = frequencyMinutes >= ONCE_A_DAY;
        if (onceADay) {
            endMin = startMin + 1;
        } else {
            endMin = activeHoursEnd * 60;
        }
        if (endMin <= startMin) return 0;

        for (int day = 0; day < 60; day++) {
            // Calendar.DAY_OF_WEEK: SUN=1..SAT=7. We want MON=0..SUN=6.
            int dow = (dayStart.get(Calendar.DAY_OF_WEEK) + 5) % 7;
            if ((activeDaysMask & (1 << dow)) != 0) {
                for (int m = startMin; m < endMin; m += frequencyMinutes) {
                    Calendar occ = (Calendar) dayStart.clone();
                    occ.set(Calendar.HOUR_OF_DAY, m / 60);
                    occ.set(Calendar.MINUTE, m % 60);
                    long t = occ.getTimeInMillis();
                    if (t > fromMs) return t;
                }
            }
            dayStart.add(Calendar.DAY_OF_MONTH, 1);
        }
        return 0;
    }

    // ---- alarm wiring -----------------------------------------------------

    // Returns true when the OS will honor setExactAndAllowWhileIdle.
    // - API < 31: no permission concept, always allowed.
    // - API 31+: gated by SCHEDULE_EXACT_ALARM (user-revocable) OR
    //   USE_EXACT_ALARM (granted at install on API 33+ for alarm/reminder
    //   apps); AlarmManager.canScheduleExactAlarms() is the unified gate.
    public static boolean canScheduleExact(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    public static void scheduleNext(Context ctx, JSONObject mantra) {
        try {
            long now = System.currentTimeMillis();
            long next = computeNextOccurrence(mantra, now);
            if (next == 0) {
                Log.d(TAG, "No future occurrence for " + mantra.optString("id"));
                return;
            }

            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            int id = notificationId(mantra.getString("id"));

            Intent intent = new Intent(ctx, MantraAlarmReceiver.class);
            intent.putExtra(EXTRA_MANTRA_JSON, mantra.toString());
            PendingIntent pi = PendingIntent.getBroadcast(
                ctx, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // Exact-and-while-idle is what bypasses Doze and produces an
            // on-time fire; setAndAllowWhileIdle drifts up to ~9 minutes
            // and is throttled to once per ~9 minutes per app, which
            // visibly stalls minute-frequency mantras. We declare both
            // USE_EXACT_ALARM (API 33+) and SCHEDULE_EXACT_ALARM (API
            // 31–32) in the manifest; canScheduleExact() is the single
            // gate that tells us if either is currently honored. Falls
            // back to inexact whenever the user has revoked the API-32
            // permission via "Alarms & reminders" — the alarm still
            // fires, just within a Doze window.
            if (canScheduleExact(ctx)) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, next, pi);
            }
            Log.d(TAG, "Scheduled " + mantra.getString("id") + " for " + next);
        } catch (SecurityException e) {
            // Race: canScheduleExactAlarms returned true but the OS
            // revoked the permission between the check and the call.
            // Retry inexact so we never lose the alarm entirely.
            Log.w(TAG, "scheduleNext: exact alarm denied, falling back to inexact", e);
            try {
                AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
                if (am == null) return;
                int id = notificationId(mantra.getString("id"));
                Intent intent = new Intent(ctx, MantraAlarmReceiver.class);
                intent.putExtra(EXTRA_MANTRA_JSON, mantra.toString());
                PendingIntent pi = PendingIntent.getBroadcast(
                    ctx, id, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                long retryAt = computeNextOccurrence(mantra, System.currentTimeMillis());
                if (retryAt == 0) return;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, retryAt, pi);
                } else {
                    am.set(AlarmManager.RTC_WAKEUP, retryAt, pi);
                }
            } catch (JSONException ignored) {}
        } catch (JSONException e) {
            Log.e(TAG, "scheduleNext: bad mantra json", e);
        }
    }

    public static void cancel(Context ctx, String mantraId) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        int id = notificationId(mantraId);
        Intent intent = new Intent(ctx, MantraAlarmReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(
            ctx, id, intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }
}
