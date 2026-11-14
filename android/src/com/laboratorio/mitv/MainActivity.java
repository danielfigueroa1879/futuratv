package com.laboratorio.mitv;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.app.UiModeManager;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Rational;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.ArrayList;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Contenedor Android TV de FuturaTV: muestra la interfaz web y abre otras apps.
 * La interfaz se actualiza sola: si en "updateUrl" (version.json) hay una versión más nueva,
 * se descarga a files/www y se usa en lugar de la incluida en el APK.
 */
public class MainActivity extends Activity {

    private WebView web;
    private long lastUpdateCheck = 0;
    private static final long UPDATE_EVERY_MS = 6L * 3600 * 1000;
    private volatile boolean videoPlaying = false;   // lo avisa la app web (Android.setPlaying)

    /** TV (Android TV / Google TV / Fire TV) o celular/tablet. */
    private boolean isTv() {
        UiModeManager um = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        if (um != null && um.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) return true;
        PackageManager pm = getPackageManager();
        return pm.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
                || pm.hasSystemFeature("amazon.hardware.fire_tv")
                || !pm.hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN);
    }

    // ---------- Búsqueda por voz ----------
    private static final int REQ_MIC = 7;
    private static final int REQ_VOICE = 8;
    private SpeechRecognizer recognizer;
    private boolean triedIntentFallback = false;
    private long lastLevelSent = 0;

    private Intent recognizerIntent() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-CL");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Di el nombre del canal");
        return i;
    }

    private boolean canUseVoiceIntent() {
        return recognizerIntent().resolveActivity(getPackageManager()) != null;
    }

    /** Plan B: la ventana de voz de Google (cuando el reconocedor interno no está o falla). */
    private boolean startVoiceIntent() {
        triedIntentFallback = true;
        stopVoice();
        try {
            startActivityForResult(recognizerIntent(), REQ_VOICE);
            js("window.mitvVoiceState('external')");
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_VOICE) return;
        ArrayList<String> l = (resultCode == RESULT_OK && data != null)
                ? data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS) : null;
        if (l != null && !l.isEmpty()) js("window.mitvVoiceResult(" + jsStr(l.get(0)) + ")");
        else js("window.mitvVoiceError(6)");
    }

    private void js(String code) {
        runOnUiThread(() -> web.evaluateJavascript(code, null));
    }

    private static String jsStr(String s) {
        return JSONObject.quote(s == null ? "" : s);
    }

    private void startVoice() {
        if (Build.VERSION.SDK_INT >= 23
                && checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            js("window.mitvVoiceState('permission')");
            requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO}, REQ_MIC);
            return;
        }
        stopVoice();
        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle b) { js("window.mitvVoiceState('listening')"); }
                @Override public void onBeginningOfSpeech() { js("window.mitvVoiceState('speaking')"); }
                @Override public void onRmsChanged(float rms) {
                    long now = System.currentTimeMillis();
                    if (now - lastLevelSent < 80) return;          // no saturar la app web
                    lastLevelSent = now;
                    js("window.mitvVoiceLevel(" + rms + ")");
                }
                @Override public void onBufferReceived(byte[] b) { }
                @Override public void onEndOfSpeech() { js("window.mitvVoiceState('processing')"); }
                @Override public void onError(int error) {
                    stopVoice();
                    boolean fallback = error == SpeechRecognizer.ERROR_AUDIO || error == SpeechRecognizer.ERROR_CLIENT
                            || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS
                            || error == 10 /* demasiadas solicitudes */ || error == 11 /* servidor desconectado */ || error >= 12;
                    if (fallback && !triedIntentFallback && canUseVoiceIntent() && startVoiceIntent()) return;
                    js("window.mitvVoiceError(" + error + ")");
                }
                @Override public void onResults(Bundle r) {
                    ArrayList<String> l = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    stopVoice();
                    if (l != null && !l.isEmpty()) js("window.mitvVoiceResult(" + jsStr(l.get(0)) + ")");
                    else js("window.mitvVoiceError(7)");
                }
                @Override public void onPartialResults(Bundle r) {
                    ArrayList<String> l = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (l != null && !l.isEmpty() && l.get(0).length() > 0) js("window.mitvVoicePartial(" + jsStr(l.get(0)) + ")");
                }
                @Override public void onEvent(int type, Bundle b) { }
            });
            recognizer.startListening(recognizerIntent());
        } catch (Exception e) {
            stopVoice();
            if (!triedIntentFallback && canUseVoiceIntent() && startVoiceIntent()) return;
            js("window.mitvVoiceError(3)");
        }
    }

    private void stopVoice() {
        if (recognizer != null) {
            try { recognizer.cancel(); recognizer.destroy(); } catch (Exception ignored) { }
            recognizer = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != REQ_MIC) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) startVoice();
        else js("window.mitvVoiceError('permiso')");
    }

    // ---------- PiP del sistema (celular): el video sigue en una ventanita al salir de la app ----------
    private boolean inSystemPip() {
        return Build.VERSION.SDK_INT >= 24 && isInPictureInPictureMode();
    }

    private boolean enterSystemPip() {
        if (Build.VERSION.SDK_INT < 26 || !videoPlaying || isTv()) return false;
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return false;
        try {
            return enterPictureInPictureMode(new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9)).build());
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void onUserLeaveHint() {           // botón Inicio / cambiar de app
        super.onUserLeaveHint();
        enterSystemPip();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean inPip, Configuration newConfig) {
        super.onPictureInPictureModeChanged(inPip, newConfig);
        web.evaluateJavascript("window.mitvSystemPip && window.mitvSystemPip(" + inPip + ")", null);
        if (!inPip) hideSystemUi();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // TV: siempre horizontal · celular/tablet: vertical u horizontal según se gire (respeta el bloqueo de rotación)
        setRequestedOrientation(isTv() ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                : ActivityInfo.SCREEN_ORIENTATION_FULL_USER);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(8, 16, 51));
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowUniversalAccessFromFileURLs(true); // permite leer listas M3U y streams sin CORS
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            // Sin esto, el WebView muestra una imagen gris/blanco y negro (icono de play) antes de que arranque el video
            @Override public Bitmap getDefaultVideoPoster() {
                Bitmap b = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
                b.eraseColor(Color.TRANSPARENT);
                return b;
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        web.loadUrl(startUrl());

        setContentView(web);
        web.requestFocus();
        hideSystemUi();
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    /** Traduce teclas del control Android a los códigos que usa la app web (los mismos de LG webOS). */
    private static int webKeyFor(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_BUTTON_A:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
                return 13;
            case KeyEvent.KEYCODE_CHANNEL_UP:
            case KeyEvent.KEYCODE_PAGE_UP:
                return 33;
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
            case KeyEvent.KEYCODE_PAGE_DOWN:
                return 34;
            case KeyEvent.KEYCODE_PROG_RED:    return 403;
            case KeyEvent.KEYCODE_PROG_GREEN:  return 404;
            case KeyEvent.KEYCODE_PROG_YELLOW: return 405;
            case KeyEvent.KEYCODE_PROG_BLUE:
            case KeyEvent.KEYCODE_WINDOW:      return 406;   // PiP
            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_INFO:
            case KeyEvent.KEYCODE_BUTTON_Y:    return 1001;  // opciones del canal
            default:                           return 0;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int code = e.getKeyCode();
        boolean down = e.getAction() == KeyEvent.ACTION_DOWN;
        if (code == KeyEvent.KEYCODE_BACK) {
            if (down && e.getRepeatCount() == 0) {
                // La app web decide; si devuelve false estamos en el inicio y se cierra.
                web.evaluateJavascript("window.mitvBack ? window.mitvBack() : false", value -> {
                    if (!"true".equals(value)) finish();
                });
            }
            return true;
        }
        if (code == KeyEvent.KEYCODE_SEARCH || code == KeyEvent.KEYCODE_VOICE_ASSIST) {
            if (down && e.getRepeatCount() == 0) js("window.mitvVoiceKey && window.mitvVoiceKey()");
            return true;
        }
        int webKey = webKeyFor(code);
        if (webKey != 0) {
            // Se envían keydown (con "repeat" si se mantiene) y keyup: así funciona "mantener OK".
            if (down) sendKey("keydown", webKey, e.getRepeatCount() > 0);
            else if (e.getAction() == KeyEvent.ACTION_UP) sendKey("keyup", webKey, false);
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    private void sendKey(String type, int keyCode, boolean repeat) {
        web.evaluateJavascript("document.dispatchEvent(new KeyboardEvent('" + type + "',{keyCode:" + keyCode
                + ",which:" + keyCode + ",repeat:" + repeat + ",bubbles:true}));", null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
        web.onResume();
        web.evaluateJavascript("window.mitvResume && window.mitvResume()", null);
        if (System.currentTimeMillis() - lastUpdateCheck > UPDATE_EVERY_MS) checkForUpdate();
    }

    // ---------- Actualización automática de la interfaz ----------
    private File wwwDir() { return new File(getFilesDir(), "www"); }

    private static int compareVersions(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = 0, q = 0;
            try { p = i < x.length ? Integer.parseInt(x[i].trim()) : 0; } catch (Exception ignored) { }
            try { q = i < y.length ? Integer.parseInt(y[i].trim()) : 0; } catch (Exception ignored) { }
            if (p != q) return p < q ? -1 : 1;
        }
        return 0;
    }

    private static String readAll(InputStream in) throws Exception {
        return new String(readBytes(in), "UTF-8");
    }

    private static byte[] readBytes(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toByteArray();
    }

    private JSONObject bundledVersion() {
        try { return new JSONObject(readAll(getAssets().open("version.json"))); } catch (Exception e) { return new JSONObject(); }
    }

    private JSONObject downloadedVersion() {
        try {
            File f = new File(wwwDir(), "version.json");
            if (!f.exists() || !new File(wwwDir(), "index.html").exists()) return null;
            return new JSONObject(readAll(new FileInputStream(f)));
        } catch (Exception e) { return null; }
    }

    /** Usa la versión descargada solo si es más nueva que la que trae el APK. */
    private boolean useDownloaded() {
        JSONObject d = downloadedVersion();
        return d != null && compareVersions(d.optString("version", "0"), bundledVersion().optString("version", "0")) > 0;
    }

    private String startUrl() {
        return useDownloaded() ? "file://" + wwwDir().getAbsolutePath() + "/index.html" : "file:///android_asset/index.html";
    }

    private JSONObject currentVersion() {
        return useDownloaded() ? downloadedVersion() : bundledVersion();
    }

    private static byte[] httpGet(String url) throws Exception {
        for (int redirects = 0; redirects < 5; redirects++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setUseCaches(false);
            c.setInstanceFollowRedirects(true);
            int code = c.getResponseCode();
            if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                url = new URL(new URL(url), c.getHeaderField("Location")).toString();
                continue;
            }
            if (code != 200) throw new Exception("HTTP " + code);
            return readBytes(c.getInputStream());
        }
        throw new Exception("demasiadas redirecciones");
    }

    private static void deleteRec(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteRec(k);
        f.delete();
    }

    private void checkForUpdate() { checkForUpdate(false); }

    private void checkForUpdate(final boolean manual) {
        lastUpdateCheck = System.currentTimeMillis();
        new Thread(() -> {
            try {
                JSONObject cur = currentVersion();
                String base = cur.optString("updateUrl", "");
                if (!base.startsWith("https://")) return;          // sin dirección de actualización configurada
                if (!base.endsWith("/")) base += "/";
                JSONObject remote = new JSONObject(new String(httpGet(base + "version.json?t=" + System.currentTimeMillis()), "UTF-8"));
                String version = remote.optString("version", "0");
                int cmp = compareVersions(version, cur.optString("version", "0"));
                if (cmp < 0 || (cmp == 0 && !manual)) {   // a mano: con la misma versión se vuelve a bajar (repara archivos)
                    if (manual) js("window.mitvUpdateStatus && window.mitvUpdateStatus('ok')");
                    return;
                }
                if (manual) js("window.mitvUpdateStatus && window.mitvUpdateStatus('downloading')");

                File tmp = new File(getFilesDir(), "www_new");
                deleteRec(tmp);
                tmp.mkdirs();
                JSONArray files = remote.getJSONArray("files");
                for (int i = 0; i < files.length(); i++) {
                    String name = files.getString(i);
                    if (name.contains("..") || name.startsWith("/") || name.contains("\\")) throw new Exception("nombre inválido");
                    byte[] data = httpGet(base + name.replace(" ", "%20") + "?v=" + version);   // evita copias viejas de la caché
                    File out = new File(tmp, name);
                    out.getParentFile().mkdirs();
                    FileOutputStream fo = new FileOutputStream(out);
                    fo.write(data);
                    fo.close();
                }
                if (!new File(tmp, "index.html").exists()) throw new Exception("falta index.html");
                FileOutputStream vo = new FileOutputStream(new File(tmp, "version.json"));
                vo.write(remote.toString().getBytes("UTF-8"));
                vo.close();

                File old = new File(getFilesDir(), "www_old");
                deleteRec(old);
                if (wwwDir().exists()) wwwDir().renameTo(old);
                if (!tmp.renameTo(wwwDir())) throw new Exception("no se pudo instalar");
                deleteRec(old);

                final String safe = version.replaceAll("[^0-9.]", "");
                runOnUiThread(() -> web.evaluateJavascript(
                        "window.mitvUpdateReady && window.mitvUpdateReady('" + safe + "')", null));
            } catch (Exception ignored) {
                // sin internet o archivo con error: se sigue usando la versión actual
                if (manual) js("window.mitvUpdateStatus && window.mitvUpdateStatus('error')");
            }
        }).start();
    }

    @Override
    protected void onPause() {
        if (inSystemPip()) { super.onPause(); return; }   // en la ventanita el video sigue
        web.evaluateJavascript("window.mitvPause && window.mitvPause()", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onStop() {
        // Al cerrar la ventanita PiP (X o deslizar) la app queda detenida: se apaga el video
        web.evaluateJavascript("window.mitvPause && window.mitvPause()", null);
        web.onPause();
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        stopVoice();
        web.destroy();
        super.onDestroy();
    }

    /** Funciones disponibles en JavaScript como window.Android */
    private class Bridge {
        @JavascriptInterface
        public boolean launchApp(String packagesJson) {
            try {
                JSONArray pkgs = new JSONArray(packagesJson);
                PackageManager pm = getPackageManager();
                for (int i = 0; i < pkgs.length(); i++) {
                    String pkg = pkgs.getString(i);
                    Intent intent = null;
                    if (Build.VERSION.SDK_INT >= 21) intent = pm.getLeanbackLaunchIntentForPackage(pkg);
                    if (intent == null) intent = pm.getLaunchIntentForPackage(pkg);
                    if (intent != null) {
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return true;
                    }
                }
            } catch (Exception ignored) { }
            return false;
        }

        @JavascriptInterface
        public boolean openUrl(String url) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void reload() {
            runOnUiThread(() -> web.loadUrl(startUrl()));
        }

        @JavascriptInterface
        public boolean isTV() { return isTv(); }

        @JavascriptInterface
        public boolean voiceSearch() {
            triedIntentFallback = false;
            if (SpeechRecognizer.isRecognitionAvailable(MainActivity.this)) {
                runOnUiThread(MainActivity.this::startVoice);
                return true;
            }
            if (!canUseVoiceIntent()) return false;
            runOnUiThread(MainActivity.this::startVoiceIntent);
            return true;
        }

        @JavascriptInterface
        public void voiceCancel() { runOnUiThread(MainActivity.this::stopVoice); }

        @JavascriptInterface
        public void checkUpdateNow() { checkForUpdate(true); }

        @JavascriptInterface
        public void setPlaying(boolean playing) { videoPlaying = playing; }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(MainActivity.this::finish);
        }
    }
}
