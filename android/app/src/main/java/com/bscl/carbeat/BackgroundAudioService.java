package com.bscl.carbeat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.text.TextUtils;

import androidx.annotation.Nullable;

/**
 * Mantiene vivo el WebView mientras el carro reproduce música con la pantalla apagada.
 *
 * La reproducción real sigue ocurriendo en JS (HTML5 Audio / YouTube IFrame). Este servicio
 * no reproduce audio por su cuenta: evita que Android congele o mate el proceso cuando la
 * pantalla se apaga, y mantiene la CPU y el Wi-Fi despiertos durante la reproducción.
 *
 * Además publica una MediaSession para que el bloqueo y la notificación tengan controles
 * (play/pausa/anterior/siguiente). Esos controles vuelven a JS mediante
 * BackgroundAudioPlugin.dispatchMediaAction(...).
 */
public class BackgroundAudioService extends Service {

    public static final String ACTION_START = "com.bscl.carbeat.backgroundaudio.START";
    public static final String ACTION_UPDATE = "com.bscl.carbeat.backgroundaudio.UPDATE";
    public static final String ACTION_STOP = "com.bscl.carbeat.backgroundaudio.STOP";
    public static final String ACTION_PLAY = "com.bscl.carbeat.backgroundaudio.PLAY";
    public static final String ACTION_PAUSE = "com.bscl.carbeat.backgroundaudio.PAUSE";
    public static final String ACTION_NEXT = "com.bscl.carbeat.backgroundaudio.NEXT";
    public static final String ACTION_PREVIOUS = "com.bscl.carbeat.backgroundaudio.PREVIOUS";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_COVER_URL = "coverUrl";
    public static final String EXTRA_PLAYING = "playing";
    public static final String EXTRA_POSITION_MS = "positionMs";
    public static final String EXTRA_DURATION_MS = "durationMs";

    private static final String CHANNEL_ID = "carbeat_playback";
    private static final int NOTIFICATION_ID = 7011;

    private MediaSession mediaSession;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private boolean foregroundStarted = false;

    private String title = "CarBeat";
    private String artist = "";
    private String album = "";
    private String coverUrl = "";
    private boolean playing = false;
    private long positionMs = 0;
    private long durationMs = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        createMediaSession();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        final String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopPlayback();
            return START_NOT_STICKY;
        }

        if (ACTION_PLAY.equals(action)
                || ACTION_PAUSE.equals(action)
                || ACTION_NEXT.equals(action)
                || ACTION_PREVIOUS.equals(action)) {
            // Un PendingIntent puede recrear el servicio; hay que entrar en foreground
            // dentro de los 5 segundos que exige Android.
            if (!foregroundStarted) startForegroundWithNotification();
            handleMediaAction(action);
            return START_NOT_STICKY;
        }

        // ACTION_START / ACTION_UPDATE (o cualquier intent desconocido): refrescar metadatos.
        if (intent.hasExtra(EXTRA_TITLE)) title = safe(intent.getStringExtra(EXTRA_TITLE), title);
        if (intent.hasExtra(EXTRA_ARTIST)) artist = safe(intent.getStringExtra(EXTRA_ARTIST), artist);
        if (intent.hasExtra(EXTRA_ALBUM)) album = safe(intent.getStringExtra(EXTRA_ALBUM), album);
        if (intent.hasExtra(EXTRA_COVER_URL)) coverUrl = safe(intent.getStringExtra(EXTRA_COVER_URL), coverUrl);
        playing = intent.getBooleanExtra(EXTRA_PLAYING, playing);
        positionMs = Math.max(0, intent.getLongExtra(EXTRA_POSITION_MS, positionMs));
        durationMs = Math.max(0, intent.getLongExtra(EXTRA_DURATION_MS, durationMs));

        updateMediaSession();
        startForegroundWithNotification();
        updateWakeLocks();
        return START_NOT_STICKY;
    }

    private static String safe(@Nullable String value, String fallback) {
        return value == null ? fallback : value;
    }

    private void handleMediaAction(String action) {
        if (ACTION_PLAY.equals(action)) {
            applyPlayState(true);
            dispatchToJs("play");
        } else if (ACTION_PAUSE.equals(action)) {
            applyPlayState(false);
            dispatchToJs("pause");
        } else if (ACTION_NEXT.equals(action)) {
            dispatchToJs("next");
        } else if (ACTION_PREVIOUS.equals(action)) {
            dispatchToJs("prev");
        }
    }

    /** Estado optimista para que el botón de la notificación responda al instante. */
    private void applyPlayState(boolean isPlaying) {
        playing = isPlaying;
        updateMediaSession();
        updateWakeLocks();
        if (foregroundStarted) {
            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification());
        } else {
            startForegroundWithNotification();
        }
    }

    private void dispatchToJs(String action) {
        BackgroundAudioPlugin.dispatchMediaAction(action);
    }

    private void createMediaSession() {
        mediaSession = new MediaSession(this, "CarBeatPlayback");
        mediaSession.setFlags(
                MediaSession.FLAG_HANDLES_MEDIA_BUTTONS
                        | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                handleMediaAction(ACTION_PLAY);
            }

            @Override
            public void onPause() {
                handleMediaAction(ACTION_PAUSE);
            }

            @Override
            public void onSkipToNext() {
                handleMediaAction(ACTION_NEXT);
            }

            @Override
            public void onSkipToPrevious() {
                handleMediaAction(ACTION_PREVIOUS);
            }

            @Override
            public void onStop() {
                handleMediaAction(ACTION_PAUSE);
            }
        });
        mediaSession.setActive(true);
    }

    private void updateMediaSession() {
        if (mediaSession == null) return;

        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs);
        if (!TextUtils.isEmpty(coverUrl)) {
            metadata.putString(MediaMetadata.METADATA_KEY_ART_URI, coverUrl);
            metadata.putString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI, coverUrl);
        }
        mediaSession.setMetadata(metadata.build());

        long actions = PlaybackState.ACTION_PLAY
                | PlaybackState.ACTION_PAUSE
                | PlaybackState.ACTION_PLAY_PAUSE
                | PlaybackState.ACTION_SKIP_TO_NEXT
                | PlaybackState.ACTION_SKIP_TO_PREVIOUS
                | PlaybackState.ACTION_STOP;
        PlaybackState state = new PlaybackState.Builder()
                .setActions(actions)
                .setState(
                        playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                        positionMs,
                        playing ? 1f : 0f
                )
                .build();
        mediaSession.setPlaybackState(state);
    }

    private void createNotificationChannel() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Música del carro",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Mantiene la música sonando cuando la pantalla se apaga.");
        channel.setShowBadge(false);
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Action previous = new Notification.Action.Builder(
                Icon.createWithResource(this, R.drawable.ic_media_prev),
                "Anterior",
                serviceIntent(ACTION_PREVIOUS, 11)
        ).build();
        Notification.Action toggle = new Notification.Action.Builder(
                Icon.createWithResource(this, playing ? R.drawable.ic_media_pause : R.drawable.ic_media_play),
                playing ? "Pausar" : "Reproducir",
                serviceIntent(playing ? ACTION_PAUSE : ACTION_PLAY, 12)
        ).build();
        Notification.Action next = new Notification.Action.Builder(
                Icon.createWithResource(this, R.drawable.ic_media_next),
                "Siguiente",
                serviceIntent(ACTION_NEXT, 13)
        ).build();

        Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_carbeat)
                .setContentTitle(TextUtils.isEmpty(title) ? "CarBeat" : title)
                .setContentText(TextUtils.isEmpty(artist) ? "Música del carro" : artist)
                .setSubText("CarBeat")
                .setContentIntent(contentIntent)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setOngoing(true)
                .setColor(0xFF22D3EE)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setCategory(Notification.CATEGORY_TRANSPORT)
                .addAction(previous)
                .addAction(toggle)
                .addAction(next);

        if (mediaSession != null) {
            builder.setStyle(new Notification.MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2));
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }
        return builder.build();
    }

    private PendingIntent serviceIntent(String action, int requestCode) {
        Intent intent = new Intent(this, BackgroundAudioService.class).setAction(action);
        return PendingIntent.getService(
                this,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void startForegroundWithNotification() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        foregroundStarted = true;
    }

    private void updateWakeLocks() {
        if (playing) acquireWakeLocks();
        else releaseWakeLocks();
    }

    private void acquireWakeLocks() {
        try {
            if (wakeLock == null) {
                PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
                if (power != null) {
                    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CarBeat::Playback");
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire();
        } catch (RuntimeException ignored) {
            // Sin permiso o recurso no disponible: la reproducción sigue, sólo sin wake lock.
        }

        try {
            if (wifiLock == null) {
                WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
                if (wifi != null) {
                    wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL, "CarBeat::Streaming");
                    wifiLock.setReferenceCounted(false);
                }
            }
            if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
        } catch (RuntimeException ignored) {
            // Wi-Fi lock no disponible (algunas radios antiguas): no es crítico.
        }
    }

    private void releaseWakeLocks() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
    }

    private void stopPlayback() {
        releaseWakeLocks();
        if (foregroundStarted) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            foregroundStarted = false;
        }
        stopSelf();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Si el conductor cierra la app desde Recientes, la música también debe parar.
        stopPlayback();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        releaseWakeLocks();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        if (foregroundStarted) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            foregroundStarted = false;
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
