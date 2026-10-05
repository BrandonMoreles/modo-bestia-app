package com.joel.mamadoapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;

/** Widget de la mascota: dibujo, nombre, puntos y un mensaje que cambia según la hora. */
public class PetWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "pet_widget";
    static final String IMG = "pet_widget.png";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, build(ctx));
    }

    public static void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, PetWidgetProvider.class));
        if (ids == null || ids.length == 0) return;
        RemoteViews rv = build(ctx);
        for (int id : ids) mgr.updateAppWidget(id, rv);
    }

    static String mensajeActual(SharedPreferences sp) {
        String msg = "Abre Modo Bestia para despertarme.";
        try {
            JSONArray agenda = new JSONArray(sp.getString("agenda", "[]"));
            long now = System.currentTimeMillis();
            long mejor = -1;
            for (int i = 0; i < agenda.length(); i++) {
                JSONObject o = agenda.getJSONObject(i);
                long t = o.optLong("t", 0);
                if (t <= now && t >= mejor) {
                    mejor = t;
                    msg = o.optString("msg", msg);
                }
            }
        } catch (Exception ignored) { }
        return msg;
    }

    static RemoteViews build(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.pet_widget);
        rv.setTextViewText(R.id.pet_nombre, sp.getString("nombre", "Bestia"));
        rv.setTextViewText(R.id.pet_info, sp.getString("info", ""));
        rv.setTextViewText(R.id.pet_msg, mensajeActual(sp));
        File f = new File(ctx.getFilesDir(), IMG);
        if (f.exists()) {
            Bitmap bmp = BitmapFactory.decodeFile(f.getAbsolutePath());
            if (bmp != null) rv.setImageViewBitmap(R.id.pet_img, bmp);
        }
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 4242, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        rv.setOnClickPendingIntent(R.id.pet_root, pi);
        return rv;
    }
}
