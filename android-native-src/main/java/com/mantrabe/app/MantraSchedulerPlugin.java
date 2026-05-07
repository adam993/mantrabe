package com.mantrabe.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

// JS-facing surface for our self-rescheduling alarm pipeline. Replaces
// @capacitor/local-notifications for Android scheduling. Permission
// requests still go through the upstream plugin since POST_NOTIFICATIONS
// is app-wide and unifying that flow isn't worth duplicating.
//
// Also exposes a small "reliability" surface — exact-alarm status,
// battery-optimization status, OEM brand, deep-links into the relevant
// system settings. This is what powers the in-app reliability banner;
// without it, every Honor / Xiaomi / Oppo install would silently miss
// reminders the moment their OEM "phone manager" decides Mantrabe is a
// background nuisance.
@CapacitorPlugin(name = "MantraScheduler")
public class MantraSchedulerPlugin extends Plugin {
    private static final String TAG = "MantraSchedulerPlugin";

    // Replace the entire active set in one call. Cancels existing alarms
    // for any mantra that's no longer in the list, persists the new
    // list (so the boot receiver can restore it), and arms the next
    // occurrence for each enabled mantra.
    @PluginMethod
    public void scheduleAll(PluginCall call) {
        JSArray mantrasArr = call.getArray("mantras");
        if (mantrasArr == null) {
            call.reject("Missing 'mantras' array");
            return;
        }
        try {
            JSONArray previous = MantraScheduler.loadAll(getContext());
            for (int i = 0; i < previous.length(); i++) {
                MantraScheduler.cancel(getContext(), previous.getJSONObject(i).getString("id"));
            }

            JSONArray fresh = new JSONArray();
            for (int i = 0; i < mantrasArr.length(); i++) {
                JSONObject m = mantrasArr.getJSONObject(i);
                fresh.put(m);
                MantraScheduler.scheduleNext(getContext(), m);
            }
            MantraScheduler.persistAll(getContext(), fresh);

            JSObject result = new JSObject();
            result.put("count", fresh.length());
            call.resolve(result);
        } catch (JSONException e) {
            call.reject("Invalid mantra payload: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        try {
            JSONArray previous = MantraScheduler.loadAll(getContext());
            for (int i = 0; i < previous.length(); i++) {
                MantraScheduler.cancel(getContext(), previous.getJSONObject(i).getString("id"));
            }
            MantraScheduler.persistAll(getContext(), new JSONArray());
            call.resolve();
        } catch (JSONException e) {
            call.reject("cancelAll failed: " + e.getMessage(), e);
        }
    }

    // ---- reliability surface ----------------------------------------------

    // Snapshot of every gate that affects whether reminders actually fire.
    // The JS reliability banner reads this on mount and after the user
    // returns from a settings deep-link to re-render its state.
    @PluginMethod
    public void getReliabilityStatus(PluginCall call) {
        Context ctx = getContext();
        String manufacturer = (Build.MANUFACTURER == null ? "" : Build.MANUFACTURER).toLowerCase(Locale.ROOT);
        String brand = (Build.BRAND == null ? "" : Build.BRAND).toLowerCase(Locale.ROOT);

        JSObject res = new JSObject();
        res.put("manufacturer", manufacturer);
        res.put("brand", brand);
        res.put("model", Build.MODEL == null ? "" : Build.MODEL);
        res.put("sdkInt", Build.VERSION.SDK_INT);
        res.put("exactAlarmsAllowed", MantraScheduler.canScheduleExact(ctx));
        res.put("ignoringBatteryOptimizations", isIgnoringBatteryOpt(ctx));
        res.put("oemAutostartAvailable", oemAutostartIntent(ctx) != null);
        // The "aggressive OEM" flag is a hint for the JS layer to surface
        // the autostart nudge proactively — these brands ship background
        // killers that no exact-alarm permission can paper over. List
        // mirrors dontkillmyapp.com's worst-offenders.
        res.put("isAggressiveOem", isAggressiveOem(manufacturer, brand));
        call.resolve(res);
    }

    // Triggers the system dialog "Allow [App] to ignore battery
    // optimizations? — Yes / No". REQUEST_IGNORE_BATTERY_OPTIMIZATIONS is
    // declared in the manifest (without it the dialog refuses to appear).
    // Resolves with whether the dialog was launchable; the actual user
    // decision comes through on the next getReliabilityStatus poll.
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context ctx = getContext();
        if (isIgnoringBatteryOpt(ctx)) {
            JSObject res = new JSObject();
            res.put("alreadyExempt", true);
            res.put("launched", false);
            call.resolve(res);
            return;
        }
        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        i.setData(Uri.parse("package:" + ctx.getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        boolean launched = startActivitySafely(ctx, i);
        if (!launched) {
            // Some OEMs strip ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
            // (e.g. older Huawei). Fall back to the per-app battery-opt
            // settings list — at least gets the user one tap away.
            Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            launched = startActivitySafely(ctx, fallback);
        }
        JSObject res = new JSObject();
        res.put("alreadyExempt", false);
        res.put("launched", launched);
        call.resolve(res);
    }

    // Deep-links into "Alarms & reminders" so the user can grant
    // SCHEDULE_EXACT_ALARM. On API 33+ devices that support
    // USE_EXACT_ALARM at install, this is normally never needed — but
    // some users disable it explicitly and we still want a path back.
    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        Context ctx = getContext();
        boolean launched = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            i.setData(Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            launched = startActivitySafely(ctx, i);
        }
        if (!launched) {
            launched = startActivitySafely(ctx, appDetailsIntent(ctx));
        }
        JSObject res = new JSObject();
        res.put("launched", launched);
        call.resolve(res);
    }

    // Opens the OEM-specific autostart / protected-apps page so the
    // user can whitelist Mantrabe. Falls through to the standard app
    // details page when no OEM page resolves — that's still a useful
    // landing on stock Android (the user can navigate to Battery →
    // Unrestricted from there).
    @PluginMethod
    public void openOemAutostartSettings(PluginCall call) {
        Context ctx = getContext();
        Intent i = oemAutostartIntent(ctx);
        boolean opened = i != null && startActivitySafely(ctx, i);
        if (!opened) {
            opened = startActivitySafely(ctx, appDetailsIntent(ctx));
        }
        JSObject res = new JSObject();
        res.put("opened", opened);
        res.put("oemSpecific", i != null);
        res.put(
            "manufacturer",
            (Build.MANUFACTURER == null ? "" : Build.MANUFACTURER).toLowerCase(Locale.ROOT)
        );
        call.resolve(res);
    }

    // Generic "App info" deep-link — shown as the bottom-row escape
    // hatch in the reliability banner, so users on stock-Android-ish
    // devices that don't match any OEM table can still reach Battery
    // settings without hunting through Settings.
    @PluginMethod
    public void openAppNotificationSettings(PluginCall call) {
        Context ctx = getContext();
        Intent i;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        } else {
            i = appDetailsIntent(ctx);
        }
        boolean launched = startActivitySafely(ctx, i);
        if (!launched) {
            launched = startActivitySafely(ctx, appDetailsIntent(ctx));
        }
        JSObject res = new JSObject();
        res.put("launched", launched);
        call.resolve(res);
    }

    // ---- helpers ----------------------------------------------------------

    private static boolean isIgnoringBatteryOpt(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }

    private static boolean isAggressiveOem(String manufacturer, String brand) {
        // Brands that ship background-killer "phone managers" by default.
        // The user-facing nudge fires on these even if exact alarms +
        // battery-opt are already healthy, because the OEM managers
        // bypass both. Source: dontkillmyapp.com worst-offenders list.
        for (String m : Arrays.asList(
            "huawei", "honor", "xiaomi", "redmi", "poco",
            "oppo", "realme", "oneplus", "vivo", "iqoo",
            "meizu", "letv", "samsung"
        )) {
            if (m.equals(manufacturer) || m.equals(brand)) return true;
        }
        return false;
    }

    // Resolves to the first OEM-specific autostart Intent that this
    // device can actually launch, or null if none. ComponentName table
    // is borrowed from judemanutd/AutoStarter (MIT) — a per-OEM list of
    // historically-stable activity entry points into "auto-start" /
    // "protected apps" / "battery whitelist" pages. They get renamed
    // every couple of system updates, so each brand has 1–3 fallbacks.
    private static Intent oemAutostartIntent(Context ctx) {
        String manufacturer = (Build.MANUFACTURER == null ? "" : Build.MANUFACTURER).toLowerCase(Locale.ROOT);
        String brand = (Build.BRAND == null ? "" : Build.BRAND).toLowerCase(Locale.ROOT);
        List<ComponentName> candidates = new ArrayList<>();

        if (matches(manufacturer, brand, "xiaomi", "redmi", "poco")) {
            candidates.add(new ComponentName(
                "com.miui.securitycenter",
                "com.miui.permcenter.autostart.AutoStartManagementActivity"));
        } else if (matches(manufacturer, brand, "honor")) {
            candidates.add(new ComponentName(
                "com.huawei.systemmanager",
                "com.huawei.systemmanager.optimize.process.ProtectActivity"));
            candidates.add(new ComponentName(
                "com.huawei.systemmanager",
                "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
        } else if (matches(manufacturer, brand, "huawei")) {
            candidates.add(new ComponentName(
                "com.huawei.systemmanager",
                "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
            candidates.add(new ComponentName(
                "com.huawei.systemmanager",
                "com.huawei.systemmanager.optimize.process.ProtectActivity"));
        } else if (matches(manufacturer, brand, "oppo", "realme")) {
            candidates.add(new ComponentName(
                "com.coloros.safecenter",
                "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
            candidates.add(new ComponentName(
                "com.coloros.safecenter",
                "com.coloros.safecenter.startupapp.StartupAppListActivity"));
            candidates.add(new ComponentName(
                "com.oppo.safe",
                "com.oppo.safe.permission.startup.StartupAppListActivity"));
        } else if (matches(manufacturer, brand, "vivo", "iqoo")) {
            candidates.add(new ComponentName(
                "com.iqoo.secure",
                "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"));
            candidates.add(new ComponentName(
                "com.vivo.permissionmanager",
                "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));
            candidates.add(new ComponentName(
                "com.iqoo.secure",
                "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"));
        } else if (matches(manufacturer, brand, "samsung")) {
            candidates.add(new ComponentName(
                "com.samsung.android.lool",
                "com.samsung.android.sm.ui.battery.BatteryActivity"));
            candidates.add(new ComponentName(
                "com.samsung.android.lool",
                "com.samsung.android.sm.battery.ui.BatteryActivity"));
        } else if (matches(manufacturer, brand, "asus")) {
            candidates.add(new ComponentName(
                "com.asus.mobilemanager",
                "com.asus.mobilemanager.powersaver.PowerSaverSettings"));
            candidates.add(new ComponentName(
                "com.asus.mobilemanager",
                "com.asus.mobilemanager.autostart.AutoStartActivity"));
        } else if (matches(manufacturer, brand, "letv")) {
            candidates.add(new ComponentName(
                "com.letv.android.letvsafe",
                "com.letv.android.letvsafe.AutobootManageActivity"));
        } else if (matches(manufacturer, brand, "nokia")) {
            candidates.add(new ComponentName(
                "com.evenwell.powersaving.g3",
                "com.evenwell.powersaving.g3.exception.PowerSaverExceptionActivity"));
        }

        PackageManager pm = ctx.getPackageManager();
        for (ComponentName cn : candidates) {
            Intent i = new Intent();
            i.setComponent(cn);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (pm.resolveActivity(i, 0) != null) return i;
        }
        return null;
    }

    private static boolean matches(String manufacturer, String brand, String... wanted) {
        for (String w : wanted) {
            if (w.equals(manufacturer) || w.equals(brand)) return true;
        }
        return false;
    }

    private static Intent appDetailsIntent(Context ctx) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        i.setData(Uri.parse("package:" + ctx.getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return i;
    }

    private static boolean startActivitySafely(Context ctx, Intent i) {
        try {
            ctx.startActivity(i);
            return true;
        } catch (Exception e) {
            Log.w(TAG, "startActivity failed for " + i, e);
            return false;
        }
    }
}
