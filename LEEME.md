# Modo Bestia

App de Android para gym, nutrición y enfoque. Todo se guarda en tu teléfono.

## Qué trae

- **Hoy:** agua, macros del día, qué rutina te toca, hábitos, tiempo en pantalla y un consejo diario.
- **Gym:** tu rutina Torso/Pierna precargada, peso y reps por serie, "la vez pasada", temporizador de descanso (con notificación), historial y gráfica de progreso con 1RM estimado.
- **Comida:** diario por desayuno/comida/cena/snacks, base de alimentos mexicanos sin internet, búsqueda en Open Food Facts (por nombre o código de barras), captura manual, 13 recetas fitness con macros, recetas extra de TheMealDB y consejos.
- **Enfoque:** tiempo en pantalla por app, límites con alertas (ej. Instagram 30 min), Pomodoro 25/5 o 50/10, tareas y hábitos con racha.
- **Ajustes:** metas de macros (con sugerencia según tu peso), recordatorios de agua, recordatorio de gym por día y hora, tema claro/oscuro, exportar e importar respaldo.

## Opción A: compilar el APK en la nube con GitHub (sin instalar nada)

1. Crea una cuenta en github.com si no tienes.
2. Crea un repositorio nuevo (puede ser privado) y sube TODO el contenido de esta carpeta
   (en la web: "Add file" → "Upload files", arrastra todo, incluida la carpeta `.github`).
   Si la web no deja subir la carpeta oculta `.github`, crea el archivo a mano:
   "Add file" → "Create new file", nombre `.github/workflows/build-apk.yml` y pega el contenido.
3. Ve a la pestaña **Actions**. Se corre solo "Compilar APK" (o dale "Run workflow").
4. Cuando termine (5–8 min, palomita verde), entra a la ejecución y descarga **ModoBestia-apk** en "Artifacts".
5. Descomprime el zip, pasa `app-debug.apk` a tu teléfono e instálalo
   (Android te pedirá permitir instalar apps de este origen).

## Opción B: Android Studio

```
npm install
npx cap sync android
npx cap open android
```
En Android Studio: Build → Build App Bundle(s) / APK(s) → Build APK(s). Necesita JDK 21.

## Primer uso en el teléfono

- Acepta las notificaciones cuando la app las pida (agua, gym, descanso, Pomodoro).
- **Tiempo en pantalla:** en Enfoque toca "Dar permiso" y activa *Acceso a datos de uso* para Modo Bestia.
  Luego activa "Alertas de límite". La app revisa cada ~15 min (es lo mínimo que permite Android en segundo plano),
  así que el aviso puede llegar unos minutos después de pasar el límite.
- Si tu teléfono es Xiaomi, Huawei, Oppo, etc., quita la optimización de batería para la app
  (Ajustes → Batería → Modo Bestia → Sin restricciones) o los avisos pueden retrasarse.

## Cambiar cosas

- Rutina, alimentos, recetas y consejos: `www/data.js`
- Pantallas y lógica: `www/app.js`, estilos en `www/index.html`
- Código nativo de tiempo en pantalla: `android/app/src/main/java/com/joel/mamadoapp/`

Después de cambiar algo, vuelve a subir los archivos a GitHub y se genera otro APK.
Los valores de alimentos y recetas son aproximados.
