package com.mantrabe.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// JS-facing surface for our self-rescheduling alarm pipeline. Replaces
// @capacitor/local-notifications for Android scheduling. Permission
// requests still go through the upstream plugin since POST_NOTIFICATIONS
// is app-wide and unifying that flow isn't worth duplicating.
@CapacitorPlugin(name = "MantraScheduler")
public class MantraSchedulerPlugin extends Plugin {

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
}
