package com.joel.mamadoapp;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;

/** Revisa cada ~15 min el uso de las apps vigiladas y avisa al pasar el límite. */
public class ScreenTimeWorker extends Worker {

    static final String CHANNEL = "tiempo_pantalla";

    public ScreenTimeWorker(@NonNull Context ctx, @NonNull WorkerParameters params) {
        super(ctx, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        try { PetWidgetProvider.refreshAll(ctx); } catch (Exception ignored) { }
        try {
            SharedPreferences sp = ctx.getSharedPreferences(ScreenTimePlugin.PREFS, Context.MODE_PRIVATE);
            if (!sp.getBoolean("enabled", false) || !ScreenTimeUtil.hasPermission(ctx)) return Result.success();
            JSONArray watch = new JSONArray(sp.getString("watch", "[]"));
            if (watch.length() == 0) return Result.success();
            Map<String, Long> fg = ScreenTimeUtil.todayForeground(ctx);
            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            for (int i = 0; i < watch.length(); i++) {
                JSONObject w = watch.getJSONObject(i);
                String pkg = w.getString("pkg");
                String label = w.optString("label", pkg);
                int limit = Math.max(5, w.optInt("limit", 30));
                Long ms = fg.get(pkg);
                long min = ms == null ? 0 : ms / 60000L;
                long step = min / limit; // 1 = pasó el límite, 2 = el doble, etc.
                String key = "notified_" + today + "_" + pkg;
                long already = sp.getLong(key, 0);
                if (step >= 1 && step > already) {
                    notify(ctx, i + 7000, label, min, limit);
                    if (sp2(ctx).getBoolean("flotante", false)) {
                        PetCompanion.showFloatBlocking(ctx, "Llevas " + min + " min en " + label + ". ¡Suéltalo un rato! 🙌");
                    }
                    sp.edit().putLong(key, step).apply();
                }
            }
        } catch (Exception e) {
            return Result.success();
        }
        return Result.success();
    }

    private void notify(Context ctx, int id, String label, long min, int limit) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Tiempo en pantalla", NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String[] frases = {
            "Suelta el cel un rato, ve por agua o estírate.",
            "Ese tiempo te alcanzaba para una serie de lagartijas.",
            "Date un break: 10 minutos sin pantalla y regresas.",
            "Ya estuvo de scroll por ahora. ¿Qué tienes pendiente hoy?"
        };
        String txt = frases[(int) (System.currentTimeMillis() / 60000L % frases.length)];
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_icon)
                .setContentTitle("Llevas " + min + " min en " + label + " hoy")
                .setContentText(txt)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(txt + " (Tu límite: " + limit + " min)"))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pi);
        try {
            NotificationManagerCompat.from(ctx).notify(id, b.build());
        } catch (SecurityException se) {
            // Sin permiso de notificaciones: no hay nada que hacer.
        }
    }

    private static SharedPreferences sp2(Context ctx) {
        return ctx.getSharedPreferences(PetWidgetProvider.PREFS, Context.MODE_PRIVATE);
    }
}
