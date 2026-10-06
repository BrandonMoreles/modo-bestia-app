package com.joel.mamadoapp;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.util.Base64;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.TimeUnit;

/** Recibe de la app el dibujo de la mascota y los mensajes, y refresca el widget. */
@CapacitorPlugin(name = "PetWidget")
public class PetWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        try {
            String image = call.getString("image");
            if (image != null && !image.isEmpty()) {
                byte[] bytes = Base64.decode(image, Base64.DEFAULT);
                File f = new File(ctx.getFilesDir(), PetWidgetProvider.IMG);
                try (FileOutputStream out = new FileOutputStream(f)) {
                    out.write(bytes);
                }
            }
            ctx.getSharedPreferences(PetWidgetProvider.PREFS, Context.MODE_PRIVATE).edit()
                    .putString("nombre", call.getString("nombre", "Bestia"))
                    .putString("info", call.getString("info", ""))
                    .putString("agenda", call.getString("agenda", "[]"))
                    .putBoolean("notif", Boolean.TRUE.equals(call.getBoolean("notif", false)))
                    .putBoolean("flotante", Boolean.TRUE.equals(call.getBoolean("flotante", false)))
                    .putInt("cada", call.getInt("cada", 60))
                    .apply();
            PetWidgetProvider.refreshAll(ctx);
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(PetWorker.class, 15, TimeUnit.MINUTES).build();
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("pet_tick", ExistingPeriodicWorkPolicy.KEEP, req);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo actualizar el widget", e);
        }
    }

    @PluginMethod
    public void canOverlay(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", PetCompanion.canOverlay(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void testFloat(PluginCall call) {
        final String msg = call.getString("msg", "¡Aquí ando! 👋");
        final Context ctx = getContext();
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> PetCompanion.showFloat(ctx, msg), 3000);
        call.resolve();
    }
}
