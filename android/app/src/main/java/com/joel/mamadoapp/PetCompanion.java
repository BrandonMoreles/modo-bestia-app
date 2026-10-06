package com.joel.mamadoapp;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.OvershootInterpolator;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

import java.io.File;
import java.util.Calendar;

/** La mascota fuera de la app: notificación persistente y burbuja flotante sobre otras apps. */
public class PetCompanion {

    static final int NOTIF_ID = 4243;
    static final String CANAL = "mascota";

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PetWidgetProvider.PREFS, Context.MODE_PRIVATE);
    }

    static Bitmap petBitmap(Context ctx) {
        File f = new File(ctx.getFilesDir(), PetWidgetProvider.IMG);
        return f.exists() ? BitmapFactory.decodeFile(f.getAbsolutePath()) : null;
    }

    static PendingIntent abrirApp(Context ctx, int code) {
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, code, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    // ---------------- Notificación persistente ----------------
    public static void updateNotification(Context ctx) {
        SharedPreferences sp = prefs(ctx);
        NotificationManagerCompat nmc = NotificationManagerCompat.from(ctx);
        if (!sp.getBoolean("notif", false)) {
            nmc.cancel(NOTIF_ID);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel ch = new NotificationChannel(CANAL, "Mascota", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        String msg = PetWidgetProvider.mensajeActual(sp);
        String titulo = sp.getString("nombre", "Bestia");
        String info = sp.getString("info", "");
        if (!info.isEmpty()) titulo = titulo + " · " + info;
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CANAL)
                .setSmallIcon(R.drawable.ic_stat_icon)
                .setContentTitle(titulo)
                .setContentText(msg)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(msg))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setShowWhen(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setColor(0xFFF2C230)
                .setContentIntent(abrirApp(ctx, 4244));
        Bitmap bmp = petBitmap(ctx);
        if (bmp != null) b.setLargeIcon(bmp);
        try {
            nmc.notify(NOTIF_ID, b.build());
        } catch (SecurityException ignored) { }
    }

    // ---------------- Mascota flotante ----------------
    public static boolean canOverlay(Context ctx) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(ctx);
    }

    /** Decide si toca aparecer (la llama el worker cada ~15 min). */
    public static void maybeFloat(Context ctx) {
        SharedPreferences sp = prefs(ctx);
        if (!sp.getBoolean("flotante", false) || !canOverlay(ctx)) return;
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (h < 9 || h >= 22) return;
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        if (pm != null && !pm.isInteractive()) return;
        long cada = Math.max(30, sp.getInt("cada", 60)) * 60000L;
        long ultima = sp.getLong("float_last", 0);
        if (System.currentTimeMillis() - ultima < cada) return;
        JSONObject actual = PetWidgetProvider.entradaActual(sp);
        if (actual == null || actual.optInt("r", 0) != 1) return; // solo si hay algo que recordar
        if (Math.random() > 0.7) return; // que no sea tan predecible
        showFloatBlocking(ctx, actual.optString("msg", ""));
    }

    /** Para hilos de fondo: muestra la burbuja y espera a que se vaya. */
    public static void showFloatBlocking(Context ctx, String msg) {
        if (!showFloat(ctx, msg)) return;
        try { Thread.sleep(8000); } catch (InterruptedException ignored) { }
    }

    public static boolean showFloat(Context ctx, final String msg) {
        final Context app = ctx.getApplicationContext();
        if (!canOverlay(app) || msg == null || msg.isEmpty()) return false;
        prefs(app).edit().putLong("float_last", System.currentTimeMillis()).apply();
        final Handler main = new Handler(Looper.getMainLooper());
        main.post(() -> {
            try {
                final WindowManager wm = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
                final float d = app.getResources().getDisplayMetrics().density;

                final LinearLayout root = new LinearLayout(app);
                root.setOrientation(LinearLayout.HORIZONTAL);
                root.setGravity(Gravity.CENTER_VERTICAL);

                TextView tv = new TextView(app);
                tv.setText(msg);
                tv.setTextColor(Color.WHITE);
                tv.setTextSize(14);
                tv.setMaxWidth((int) (220 * d));
                int pad = (int) (12 * d);
                tv.setPadding(pad, (int) (9 * d), pad, (int) (9 * d));
                GradientDrawable bg = new GradientDrawable();
                bg.setColor(0xF01D2A33);
                bg.setCornerRadius(18 * d);
                bg.setStroke((int) (2 * d), 0xFFF2C230);
                tv.setBackground(bg);
                tv.setElevation(6 * d);

                final ImageView iv = new ImageView(app);
                Bitmap bmp = petBitmap(app);
                if (bmp != null) iv.setImageBitmap(bmp); else iv.setImageResource(R.mipmap.ic_launcher);
                LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams((int) (88 * d), (int) (88 * d));
                ip.leftMargin = (int) (4 * d);

                root.addView(tv);
                root.addView(iv, ip);

                int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE;
                WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                        WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                        PixelFormat.TRANSLUCENT);
                lp.gravity = Gravity.BOTTOM | Gravity.END;
                lp.x = (int) (6 * d);
                lp.y = (int) (150 * d);

                final float fuera = 420 * d;
                root.setTranslationX(fuera);
                root.setAlpha(0f);

                final Runnable quitar = () -> {
                    if (!root.isAttachedToWindow()) return;
                    root.animate().translationX(fuera).alpha(0f).setDuration(380)
                            .withEndAction(() -> { try { wm.removeView(root); } catch (Exception ignored) { } })
                            .start();
                };
                root.setOnClickListener((View v) -> {
                    try { abrirApp(app, 4245).send(); } catch (Exception ignored) { }
                    quitar.run();
                });

                wm.addView(root, lp);
                root.animate().translationX(0).alpha(1f).setDuration(500)
                        .setInterpolator(new OvershootInterpolator(1.2f)).start();
                // saludito: la mascota da un brinco al llegar
                iv.animate().translationY(-14 * d).setStartDelay(550).setDuration(180)
                        .withEndAction(() -> iv.animate().translationY(0).setDuration(220).start()).start();
                main.postDelayed(quitar, 6500);
            } catch (Exception ignored) { }
        });
        return true;
    }
}
