package com.joel.mamadoapp;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Cada ~15 min: refresca widget y notificación, y a veces saca a la mascota flotante. */
public class PetWorker extends Worker {
    public PetWorker(@NonNull Context ctx, @NonNull WorkerParameters params) {
        super(ctx, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        try { PetWidgetProvider.refreshAll(ctx); } catch (Exception ignored) { }
        try { PetCompanion.maybeFloat(ctx); } catch (Exception ignored) { }
        return Result.success();
    }
}
