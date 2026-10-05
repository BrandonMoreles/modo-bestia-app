package com.joel.mamadoapp;

import android.content.Context;
import android.util.Base64;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

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
                    .apply();
            PetWidgetProvider.refreshAll(ctx);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo actualizar el widget", e);
        }
    }
}
