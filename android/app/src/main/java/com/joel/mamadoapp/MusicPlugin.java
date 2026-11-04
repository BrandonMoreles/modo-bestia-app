package com.joel.mamadoapp;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Base64;
import android.view.KeyEvent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.List;

/** Controla la música que esté sonando (Spotify, YouTube Music, etc.) sin salir de la app. */
@CapacitorPlugin(name = "Musica")
public class MusicPlugin extends Plugin {

    private boolean tienePermiso() {
        String s = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        return s != null && s.contains(getContext().getPackageName());
    }

    private MediaController controlador() {
        if (!tienePermiso()) return null;
        try {
            MediaSessionManager msm = (MediaSessionManager) getContext().getSystemService(Context.MEDIA_SESSION_SERVICE);
            List<MediaController> lista = msm.getActiveSessions(new ComponentName(getContext(), MusicListener.class));
            if (lista == null || lista.isEmpty()) return null;
            for (MediaController c : lista) {
                PlaybackState st = c.getPlaybackState();
                if (st != null && st.getState() == PlaybackState.STATE_PLAYING) return c;
            }
            return lista.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void nowPlaying(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permiso", tienePermiso());
        MediaController c = controlador();
        if (c != null) {
            MediaMetadata md = c.getMetadata();
            if (md != null) {
                r.put("titulo", md.getString(MediaMetadata.METADATA_KEY_TITLE));
                String art = md.getString(MediaMetadata.METADATA_KEY_ARTIST);
                if (art == null) art = md.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST);
                r.put("artista", art);
                Bitmap bmp = md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
                if (bmp == null) bmp = md.getBitmap(MediaMetadata.METADATA_KEY_ART);
                if (bmp != null) {
                    try {
                        Bitmap peq = Bitmap.createScaledBitmap(bmp, 96, 96, true);
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        peq.compress(Bitmap.CompressFormat.PNG, 90, out);
                        r.put("arte", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                    } catch (Exception ignored) { }
                }
            }
            PlaybackState st = c.getPlaybackState();
            r.put("sonando", st != null && st.getState() == PlaybackState.STATE_PLAYING);
            r.put("app", c.getPackageName());
        } else {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            r.put("sonando", am != null && am.isMusicActive());
        }
        call.resolve(r);
    }

    @PluginMethod
    public void control(PluginCall call) {
        String accion = call.getString("accion", "toggle");
        MediaController c = controlador();
        if (c != null) {
            MediaController.TransportControls tc = c.getTransportControls();
            PlaybackState st = c.getPlaybackState();
            boolean sonando = st != null && st.getState() == PlaybackState.STATE_PLAYING;
            switch (accion) {
                case "next": tc.skipToNext(); break;
                case "prev": tc.skipToPrevious(); break;
                default: if (sonando) tc.pause(); else tc.play();
            }
            call.resolve();
            return;
        }
        // Sin permiso: mandamos teclas multimedia, igual que unos audífonos
        int code = "next".equals(accion) ? KeyEvent.KEYCODE_MEDIA_NEXT
                : "prev".equals(accion) ? KeyEvent.KEYCODE_MEDIA_PREVIOUS
                : KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        long t = SystemClock.uptimeMillis();
        am.dispatchMediaKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_DOWN, code, 0));
        am.dispatchMediaKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_UP, code, 0));
        call.resolve();
    }

    @PluginMethod
    public void abrirPermiso(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void abrirApp(PluginCall call) {
        String pkg = call.getString("pkg", "com.spotify.music");
        Intent i = getContext().getPackageManager().getLaunchIntentForPackage(pkg);
        if (i == null) {
            call.reject("No instalada");
            return;
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
