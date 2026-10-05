package com.joel.mamadoapp;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "ScreenTime")
public class ScreenTimePlugin extends Plugin {

    static final String PREFS = "screentime_prefs";
    static final String WORK = "screentime_check";

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", ScreenTimeUtil.hasPermission(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void getTodayUsage(PluginCall call) {
        Context ctx = getContext();
        if (!ScreenTimeUtil.hasPermission(ctx)) {
            call.reject("Sin permiso de acceso al uso", "NO_PERMISSION");
            return;
        }
        Map<String, Long> fg = ScreenTimeUtil.todayForeground(ctx);
        List<Map.Entry<String, Long>> list = new ArrayList<>(fg.entrySet());
        list.sort((a, b) -> Long.compare(b.getValue(), a.getValue()));
        JSArray apps = new JSArray();
        long total = 0;
        for (Map.Entry<String, Long> en : list) {
            if (en.getKey().equals(ctx.getPackageName())) continue;
            long min = en.getValue() / 60000L;
            total += en.getValue();
            if (min < 1) continue;
            JSObject o = new JSObject();
            o.put("pkg", en.getKey());
            o.put("label", ScreenTimeUtil.label(ctx, en.getKey()));
            o.put("minutes", min);
            apps.put(o);
        }
        JSObject r = new JSObject();
        r.put("apps", apps);
        r.put("totalMinutes", total / 60000L);
        call.resolve(r);
    }

    /** watch: JSON string [{pkg,label,limit}] ; enabled: boolean */
    @PluginMethod
    public void setWatch(PluginCall call) {
        String watch = call.getString("watch", "[]");
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        SharedPreferences sp = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit().putString("watch", watch).putBoolean("enabled", enabled).apply();
        WorkManager wm = WorkManager.getInstance(getContext());
        if (enabled) {
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(ScreenTimeWorker.class, 15, TimeUnit.MINUTES).build();
            wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, req);
        } else {
            wm.cancelUniqueWork(WORK);
        }
        call.resolve();
    }
}
