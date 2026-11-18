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

    /** Flecha de cursor dibujada (sin imágenes). */
    static class CursorView extends View {
        final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG), line = new Paint(Paint.ANTI_ALIAS_FLAG);
        final Path arrow = new Path();
        float x, y, s;
        CursorView(Context c) {
            super(c);
            s = c.getResources().getDisplayMetrics().density * 1.6f;
            fill.setColor(Color.WHITE);
            line.setColor(Color.BLACK); line.setStyle(Paint.Style.STROKE); line.setStrokeWidth(s * 1.4f);
            line.setStrokeJoin(Paint.Join.ROUND);
            setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            fill.setShadowLayer(6 * s, 0, 2 * s, 0x99000000);
        }
        @Override protected void onDraw(Canvas c) {
            arrow.reset();
            arrow.moveTo(x, y);
            arrow.lineTo(x + 7.5f * s, y + 19 * s);
            arrow.lineTo(x + 10.1f * s, y + 11.6f * s);
            arrow.lineTo(x + 17.5f * s, y + 9 * s);
            arrow.close();
            c.drawPath(arrow, fill);
            c.drawPath(arrow, line);
        }
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
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());

        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        cursor = new CursorView(this);
        root.addView(cursor, new FrameLayout.LayoutParams(-1, -1));
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
        cursor.x = cx; cursor.y = cy; cursor.invalidate();
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
        float d = getResources().getDisplayMetrics().density, st = (e.getRepeatCount() > 0 ? 26 : 10) * d;
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
