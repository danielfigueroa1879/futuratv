package com.laboratorio.mitv;

import android.app.Activity;
import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

/**
 * Abre un sitio web (p. ej. viendotele.cl) en su propia pantalla, como un navegador:
 * así el sitio guarda sus cookies (los canales elegidos) normalmente.
 * En TV hay un cursor: ◀▲▼▶ lo mueven, OK hace clic, ATRÁS vuelve a FuturaTV.
 * Este WebView NO tiene acceso a las funciones internas de FuturaTV.
 */
public class WebSiteActivity extends Activity {

    private WebView web;
    private CursorView cursor;
    private boolean tv;
    private float cx, cy;

    /** Flecha de cursor: vista chica (del tamaño de la flecha) que solo se desplaza; no redibuja la pantalla. */
    static class CursorView extends View {
        final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG), line = new Paint(Paint.ANTI_ALIAS_FLAG), halo = new Paint(Paint.ANTI_ALIAS_FLAG);
        final Path arrow = new Path();
        final float s;
        CursorView(Context c) {
            super(c);
            s = c.getResources().getDisplayMetrics().density * 0.9f;
            fill.setColor(Color.WHITE);
            line.setColor(Color.BLACK); line.setStyle(Paint.Style.STROKE); line.setStrokeWidth(s * 1.4f); line.setStrokeJoin(Paint.Join.ROUND);
            halo.setColor(0x66000000); halo.setStyle(Paint.Style.STROKE); halo.setStrokeWidth(s * 4f); halo.setStrokeJoin(Paint.Join.ROUND);
            float o = 3 * s;                                         // margen para el contorno
            arrow.moveTo(o, o);
            arrow.lineTo(o + 7.5f * s, o + 19 * s);
            arrow.lineTo(o + 10.1f * s, o + 11.6f * s);
            arrow.lineTo(o + 17.5f * s, o + 9 * s);
            arrow.close();
        }
        int size() { return (int) Math.ceil(24 * s); }
        @Override protected void onDraw(Canvas c) { c.drawPath(arrow, halo); c.drawPath(arrow, fill); c.drawPath(arrow, line); }
    }

    private boolean isTv() {
        UiModeManager um = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        if (um != null && um.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) return true;
        PackageManager pm = getPackageManager();
        return pm.hasSystemFeature(PackageManager.FEATURE_LEANBACK) || pm.hasSystemFeature("amazon.hardware.fire_tv")
                || !pm.hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN);
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        tv = isTv();
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);              // video y página con la tarjeta gráfica
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= 21) cm.setAcceptThirdPartyCookies(web, true);   // reproductores incrustados del sitio
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView v, String u) {
                // TV: el sitio se arma como en un computador (1920 de ancho) en vez de la versión «grande»
                if (tv) v.evaluateJavascript("(function(){var m=document.querySelector('meta[name=viewport]');"
                        + "if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}"
                        + "if(m.content.indexOf('width=1920')<0)m.setAttribute('content','width=1920');})()", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient());

        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        cursor = new CursorView(this);
        root.addView(cursor, new FrameLayout.LayoutParams(cursor.size(), cursor.size()));
        cursor.setVisibility(tv ? View.VISIBLE : View.GONE);
        setContentView(root);

        String url = getIntent().getStringExtra("url");
        if (url == null || !url.startsWith("https://")) { finish(); return; }
        web.loadUrl(url);
        web.post(() -> { cx = web.getWidth() / 2f; cy = web.getHeight() / 2f; moveCursor(0, 0); });
        if (tv) Toast.makeText(this, "◀▲▼▶ mover el cursor · OK clic · ATRÁS volver a FuturaTV", Toast.LENGTH_LONG).show();
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private void moveCursor(float dx, float dy) {
        int w = web.getWidth(), h = web.getHeight();
        cx = Math.max(0, Math.min(w - 2, cx + dx));
        cy = Math.max(0, Math.min(h - 2, cy + dy));
        if (dy > 0 && cy >= h - 4) web.scrollBy(0, (int) (h * 0.25f));      // en el borde: desplaza la página
        if (dy < 0 && cy <= 2) web.scrollBy(0, (int) (-h * 0.25f));
        float o = 3 * cursor.s;
        cursor.setTranslationX(cx - o); cursor.setTranslationY(cy - o);   // solo se mueve (sin redibujar)
    }

    private void touch(int action, long down, float x, float y) {
        MotionEvent ev = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0);
        ev.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        web.dispatchTouchEvent(ev);
        ev.recycle();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (k == KeyEvent.KEYCODE_BACK) {
            if (e.getAction() == KeyEvent.ACTION_UP) finish();
            return true;
        }
        if (!tv) return super.dispatchKeyEvent(e);
        if (e.getAction() != KeyEvent.ACTION_DOWN) {
            return k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER || k == KeyEvent.KEYCODE_DPAD_LEFT
                    || k == KeyEvent.KEYCODE_DPAD_RIGHT || k == KeyEvent.KEYCODE_DPAD_UP || k == KeyEvent.KEYCODE_DPAD_DOWN
                    || super.dispatchKeyEvent(e);
        }
        // más rápido: un toque = 18, mantenido acelera hasta 90 (en puntos de pantalla)
        int rc = e.getRepeatCount();
        float d = getResources().getDisplayMetrics().density, st = (rc == 0 ? 18 : Math.min(90, 30 + rc * 6)) * d;
        switch (k) {
            case KeyEvent.KEYCODE_DPAD_LEFT:  moveCursor(-st, 0); return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT: moveCursor(st, 0); return true;
            case KeyEvent.KEYCODE_DPAD_UP:    moveCursor(0, -st); return true;
            case KeyEvent.KEYCODE_DPAD_DOWN:  moveCursor(0, st); return true;
            case KeyEvent.KEYCODE_CHANNEL_UP:   case KeyEvent.KEYCODE_PAGE_UP:   web.scrollBy(0, -web.getHeight() / 2); return true;
            case KeyEvent.KEYCODE_CHANNEL_DOWN: case KeyEvent.KEYCODE_PAGE_DOWN: web.scrollBy(0, web.getHeight() / 2); return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
                if (e.getRepeatCount() == 0) {
                    final long t = SystemClock.uptimeMillis();
                    final float x = cx, y = cy;
                    touch(MotionEvent.ACTION_DOWN, t, x, y);
                    web.postDelayed(() -> touch(MotionEvent.ACTION_UP, t, x, y), 60);
                }
                return true;
            default:
                return super.dispatchKeyEvent(e);
        }
    }

    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override protected void onDestroy() {
        CookieManager.getInstance().flush();          // guarda los canales elegidos
        web.stopLoading(); web.destroy();
        super.onDestroy();
    }
}
