package com.joel.mamadoapp;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Process;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

/** Utilidades compartidas entre el plugin y el worker de fondo. */
public class ScreenTimeUtil {

    public static boolean hasPermission(Context ctx) {
        AppOpsManager ops = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        } else {
            mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    public static long startOfToday() {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    /** Milisegundos en primer plano por paquete, desde las 00:00 de hoy hasta ahora. */
    public static Map<String, Long> todayForeground(Context ctx) {
        Map<String, Long> total = new HashMap<>();
        Map<String, Long> open = new HashMap<>();
        UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return total;
        long begin = startOfToday();
        long end = System.currentTimeMillis();
        UsageEvents events = usm.queryEvents(begin, end);
        UsageEvents.Event e = new UsageEvents.Event();
        while (events != null && events.hasNextEvent()) {
            events.getNextEvent(e);
            String pkg = e.getPackageName();
            int type = e.getEventType();
            if (type == 1) { // ACTIVITY_RESUMED / MOVE_TO_FOREGROUND
                if (!open.containsKey(pkg)) open.put(pkg, e.getTimeStamp());
            } else if (type == 2 || type == 23) { // ACTIVITY_PAUSED / ACTIVITY_STOPPED
                Long s = open.remove(pkg);
                if (s != null) {
                    Long prev = total.get(pkg);
                    total.put(pkg, (prev == null ? 0L : prev) + (e.getTimeStamp() - s));
                }
            }
        }
        for (Map.Entry<String, Long> o : open.entrySet()) {
            long dur = end - o.getValue();
            if (dur > 0 && dur < 6L * 3600_000L) {
                Long prev = total.get(o.getKey());
                total.put(o.getKey(), (prev == null ? 0L : prev) + dur);
            }
        }
        return total;
    }

    public static String label(Context ctx, String pkg) {
        try {
            PackageManager pm = ctx.getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(ai).toString();
        } catch (Exception ex) {
            return pkg;
        }
    }
}
