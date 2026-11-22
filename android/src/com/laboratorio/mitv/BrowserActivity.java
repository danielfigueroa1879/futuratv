package com.laboratorio.mitv;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.UiModeManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Navegador interno de FuturaTV.
 * - Barra de arriba: ◀ ▶ ⟳, dirección o búsqueda, ★ (favoritos del navegador), ☰ (lista de favoritos),
 *   📺 (guardar la página como canal de FuturaTV) y ✕ (volver).
 * - TV: un cursor que se mueve con ◀▲▼▶ y hace clic con OK (también en la barra). ATRÁS = página anterior.
 * - Rápido y seguro: sin ventanas emergentes, bloqueador de anuncios, sin descargas y sin abrir otras apps desde las páginas.
 * - Este WebView NO tiene acceso a las funciones internas de FuturaTV.
 */
public class BrowserActivity extends Activity {

    static final String HOME = "https://www.google.com/";
    /** Bloqueador de anuncios y ventanas emergentes: servidores de publicidad conocidos (se bloquean con sus subdominios). */
    static final String[] AD_HOSTS = {
        "doubleclick.net", "googlesyndication.com", "googleadservices.com", "adservice.google.com",
        "popads.net", "popcash.net", "propellerads.com", "propellerclick.com", "exoclick.com", "exosrv.com", "adsterra.com",
        "adsterratech.com", "hilltopads.net", "juicyads.com", "trafficjunky.net", "onclickads.net", "onclckads.net", "clickadu.com",
        "adcash.com", "admaven.com", "ad-maven.com", "monetag.com", "a-ads.com", "bidvertiser.com", "revcontent.com", "mgid.com",
        "taboola.com", "outbrain.com", "zedo.com", "adnxs.com", "rubiconproject.com", "pubmatic.com", "openx.net", "criteo.com",
        "criteo.net", "amazon-adsystem.com", "adform.net", "smartadserver.com", "yieldmo.com", "moatads.com",
        "scorecardresearch.com", "quantserve.com", "popunder.net", "richpush.co", "pushame.com", "notix.io", "realsrv.com",
        "tsyndicate.com", "trafficstars.com", "adspyglass.com", "dolohen.com", "highperformanceformat.com", "highcpmgate.com",
        "profitablecpmrate.com", "displaycontentnetwork.com", "acint.net", "cpmstar.com", "bebi.com", "lkqd.net"
    };
    static final java.util.HashSet<String> AD_SET = new java.util.HashSet<>();
    static { for (String h : AD_HOSTS) AD_SET.add(h); }
    static boolean isAd(String host) {
        if (host == null) return false;
        host = host.toLowerCase();
        while (true) {
            if (AD_SET.contains(host)) return true;
            int i = host.indexOf('.');
            if (i < 0 || host.indexOf('.', i + 1) < 0) return false;   // hasta llegar a dominio.tld
            host = host.substring(i + 1);
        }
    }
    private WebView web;
    private EditText urlBar;
    private TextView starBtn;
    private ProgressBar progress;
    private LinearLayout bar;
    private FrameLayout root, page;
    private CursorView cursor;
    private View fullView;                              // video a pantalla completa de la página
    private WebChromeClient.CustomViewCallback fullCb;
    private boolean tv;
    private int blockedPopups = 0;
    private float cx, cy;

    /** Flecha de cursor: vista chica que solo se desplaza (no redibuja la pantalla: fluido). */
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
            float o = 3 * s;
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

    private SharedPreferences prefs() { return getSharedPreferences("futuratv", MODE_PRIVATE); }
    private int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

    private TextView barButton(String label, View.OnClickListener l) {
        TextView b = new TextView(this);
        b.setText(label);
        b.setTextColor(Color.WHITE);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, tv ? 17 : 18);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(10), 0, dp(10), 0);
        b.setMinWidth(dp(42));
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(10)); bg.setColor(0x22FFFFFF);
        b.setBackground(bg);
        b.setClickable(true); b.setFocusable(true);
        b.setOnClickListener(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(tv ? 40 : 42));
        lp.setMargins(dp(3), 0, dp(3), 0);
        b.setLayoutParams(lp);
        return b;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN);
        tv = isTv();

        // ---- barra ----
        bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(6), dp(5), dp(6), dp(5));
        bar.setBackgroundColor(0xFF0D1540);
        bar.addView(barButton("✕", v -> finish()));
        bar.addView(barButton("◀", v -> { if (web.canGoBack()) web.goBack(); }));
        bar.addView(barButton("▶", v -> { if (web.canGoForward()) web.goForward(); }));
        bar.addView(barButton("⟳", v -> web.reload()));
        urlBar = new EditText(this);
        urlBar.setSingleLine(true);
        urlBar.setTextColor(Color.WHITE);
        urlBar.setHintTextColor(0x99FFFFFF);
        urlBar.setHint("Escribe una dirección o busca en Google");
        urlBar.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        urlBar.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        urlBar.setImeOptions(EditorInfo.IME_ACTION_GO | EditorInfo.IME_FLAG_NO_EXTRACT_UI);
        urlBar.setSelectAllOnFocus(true);
        urlBar.setPadding(dp(12), 0, dp(12), 0);
        GradientDrawable ubg = new GradientDrawable();
        ubg.setCornerRadius(dp(10)); ubg.setColor(0xFF1B2452);
        urlBar.setBackground(ubg);
        urlBar.setOnEditorActionListener((v, id, ev) -> { go(urlBar.getText().toString()); return true; });
        LinearLayout.LayoutParams ulp = new LinearLayout.LayoutParams(0, dp(tv ? 40 : 42), 1f);
        ulp.setMargins(dp(4), 0, dp(4), 0);
        bar.addView(urlBar, ulp);
        starBtn = barButton("☆", v -> toggleStar());
        bar.addView(starBtn);
        bar.addView(barButton("☰", v -> showFavs()));
        bar.addView(barButton(tv ? "📺 Canal" : "📺", v -> saveAsChannel()));

        // ---- página ----
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(true);               // las ventanas nuevas pasan por onCreateWindow (bloqueador)
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setAllowFileAccess(false);
        if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= 21) cm.setAcceptThirdPartyCookies(web, true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return block(r.getUrl()); }
            @SuppressWarnings("deprecation")
            @Override public boolean shouldOverrideUrlLoading(WebView v, String u) { return block(Uri.parse(u)); }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                if (isAd(r.getUrl().getHost()))             // anuncio: se corta (la página carga más rápido)
                    return new WebResourceResponse("text/plain", "utf-8", new java.io.ByteArrayInputStream(new byte[0]));
                return null;
            }
            @Override public void onPageStarted(WebView v, String u, Bitmap f) { showUrl(u); progress.setVisibility(View.VISIBLE); }
            @Override public void onPageFinished(WebView v, String u) {
                showUrl(u); progress.setVisibility(View.GONE);
                prefs().edit().putString("browserLast", u).apply();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView v, int p) { progress.setProgress(p); }
            @Override public void onShowCustomView(View view, CustomViewCallback cb) {   // video a pantalla completa
                if (fullView != null) { cb.onCustomViewHidden(); return; }
                fullView = view; fullCb = cb;
                root.addView(view, new FrameLayout.LayoutParams(-1, -1));
                bar.setVisibility(View.GONE);
                cursor.bringToFront();
            }
            @Override public void onHideCustomView() { exitFull(); }
            // Bloqueador de ventanas emergentes: un enlace real que pide ventana nueva se abre aquí mismo;
            // las ventanas que abre un script (publicidad) se descartan.
            @Override public boolean onCreateWindow(WebView v, boolean dialog, boolean userGesture, android.os.Message msg) {
                WebView.HitTestResult h = v.getHitTestResult();
                String link = h == null ? null : h.getExtra();
                int t = h == null ? 0 : h.getType();
                if (userGesture && link != null && link.matches("(?i)^https?://.*") && !isAd(Uri.parse(link).getHost())
                        && (t == WebView.HitTestResult.SRC_ANCHOR_TYPE || t == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE)) {
                    v.loadUrl(link);
                } else {
                    blockedPopups++;
                    if (blockedPopups == 1 || blockedPopups % 5 == 0)
                        Toast.makeText(BrowserActivity.this, "🚫 Ventana emergente bloqueada", Toast.LENGTH_SHORT).show();
                }
                return false;
            }
        });
        web.setDownloadListener((u, ua, cd, mt, len) ->
                Toast.makeText(this, "Las descargas están desactivadas en el navegador de FuturaTV", Toast.LENGTH_SHORT).show());

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);

        page = new FrameLayout(this);
        page.addView(web, new FrameLayout.LayoutParams(-1, -1));
        page.addView(progress, new FrameLayout.LayoutParams(-1, dp(3)));

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.addView(bar, new LinearLayout.LayoutParams(-1, ViewGroup.LayoutParams.WRAP_CONTENT));
        col.addView(page, new LinearLayout.LayoutParams(-1, 0, 1f));

        root = new FrameLayout(this);
        root.setBackgroundColor(0xFF081033);
        root.addView(col, new FrameLayout.LayoutParams(-1, -1));
        cursor = new CursorView(this);
        root.addView(cursor, new FrameLayout.LayoutParams(cursor.size(), cursor.size()));
        cursor.setVisibility(tv ? View.VISIBLE : View.GONE);
        setContentView(root);

        String url = getIntent().getStringExtra("url");
        if (url == null || url.isEmpty()) url = prefs().getString("browserLast", HOME);
        web.loadUrl(url);
        root.post(() -> { cx = root.getWidth() / 2f; cy = root.getHeight() / 2f; moveCursor(0, 0); });
        if (tv) Toast.makeText(this, "◀▲▼▶ mueven el cursor · OK = clic · ATRÁS = página anterior", Toast.LENGTH_LONG).show();
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    /** Solo se abren páginas web: nada de abrir otras apps, tiendas o archivos desde un sitio. */
    private boolean block(Uri u) {
        String sc = u == null ? "" : String.valueOf(u.getScheme()).toLowerCase();
        return !(sc.equals("http") || sc.equals("https"));
    }

    private void go(String t) {
        t = t.trim();
        if (t.isEmpty()) return;
        String u;
        if (t.matches("(?i)^https?://.*")) u = t;
        else if (!t.contains(" ") && t.matches("(?i)^[\\w.-]+\\.[a-z]{2,}([/:?#].*)?$")) u = "https://" + t;
        else u = "https://www.google.com/search?q=" + Uri.encode(t);
        web.loadUrl(u);
        urlBar.clearFocus();
        hideKeyboard();
        web.requestFocus();
    }

    private void hideKeyboard() {
        InputMethodManager im = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (im != null) im.hideSoftInputFromWindow(urlBar.getWindowToken(), 0);
    }

    private void showUrl(String u) {
        if (!urlBar.hasFocus()) urlBar.setText(u);
        starBtn.setText(isFav(u) ? "★" : "☆");
        starBtn.setTextColor(isFav(u) ? 0xFFFFD23F : Color.WHITE);
    }

    // ---------- Favoritos del navegador ----------
    private JSONArray favs() {
        try { return new JSONArray(prefs().getString("browserFavs", "[]")); } catch (Exception e) { return new JSONArray(); }
    }
    private boolean isFav(String u) {
        JSONArray a = favs();
        for (int i = 0; i < a.length(); i++) if (u != null && u.equals(a.optJSONObject(i).optString("url"))) return true;
        return false;
    }
    private void toggleStar() {
        String u = web.getUrl(), t = web.getTitle();
        if (u == null) return;
        JSONArray a = favs(), out = new JSONArray();
        boolean was = false;
        for (int i = 0; i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            if (u.equals(o.optString("url"))) was = true; else out.put(o);
        }
        if (!was) {
            try { out.put(new JSONObject().put("url", u).put("title", t == null || t.isEmpty() ? u : t)); } catch (Exception ignored) { }
        }
        prefs().edit().putString("browserFavs", out.toString()).apply();
        showUrl(u);
        Toast.makeText(this, was ? "Quitado de los favoritos del navegador" : "★ Guardado en los favoritos del navegador", Toast.LENGTH_SHORT).show();
    }
    private void showFavs() {
        final JSONArray a = favs();
        if (a.length() == 0) { Toast.makeText(this, "Aún no hay favoritos: abre una página y toca ☆", Toast.LENGTH_LONG).show(); return; }
        String[] items = new String[a.length()];
        for (int i = 0; i < a.length(); i++) items[i] = "★  " + a.optJSONObject(i).optString("title");
        new AlertDialog.Builder(this)
                .setTitle("Favoritos del navegador")
                .setItems(items, (d, i) -> web.loadUrl(a.optJSONObject(i).optString("url")))
                .setNegativeButton("Cerrar", null)
                .show();
    }

    // ---------- Guardar la página como canal de FuturaTV ----------
    private void saveAsChannel() {
        final String u = web.getUrl();
        if (u == null || !u.startsWith("http")) return;
        final EditText name = new EditText(this);
        String t = web.getTitle();
        name.setText(t == null || t.isEmpty() ? Uri.parse(u).getHost() : (t.length() > 40 ? t.substring(0, 40) : t));
        name.setSingleLine(true);
        name.setSelectAllOnFocus(true);
        new AlertDialog.Builder(this)
                .setTitle("📺 Guardar como canal")
                .setMessage("Aparecerá en FuturaTV, en la categoría «🌐 Sitios web». Puedes marcarlo con ★ como cualquier canal.")
                .setView(name)
                .setPositiveButton("Guardar", (d, w) -> {
                    String n = name.getText().toString().trim();
                    if (n.isEmpty()) n = Uri.parse(u).getHost();
                    JSONArray a;
                    try { a = new JSONArray(prefs().getString("webChannels", "[]")); } catch (Exception e) { a = new JSONArray(); }
                    JSONArray out = new JSONArray();
                    for (int i = 0; i < a.length(); i++) if (!u.equals(a.optJSONObject(i).optString("url"))) out.put(a.optJSONObject(i));
                    try { out.put(new JSONObject().put("name", n).put("url", u)); } catch (Exception ignored) { }
                    prefs().edit().putString("webChannels", out.toString()).apply();
                    Toast.makeText(this, "📺 Guardado como canal: " + n, Toast.LENGTH_LONG).show();
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    // ---------- Cursor del control remoto (TV) ----------
    private void moveCursor(float dx, float dy) {
        int w = root.getWidth(), h = root.getHeight();
        if (w == 0) return;
        float top = fullView != null ? 0 : page.getTop();
        float ny = cy + dy;
        if (dy > 0 && ny >= h - 4 && web.canScrollVertically(1)) { web.scrollBy(0, (int) (h * 0.25f)); ny = h - 4; }
        if (dy < 0 && ny <= top + 4 && cy >= top + 4 && web.canScrollVertically(-1)) { web.scrollBy(0, (int) (-h * 0.25f)); ny = top + 4; }
        cx = Math.max(0, Math.min(w - 2, cx + dx));
        cy = Math.max(0, Math.min(h - 2, ny));
        float o = 3 * cursor.s;
        cursor.setTranslationX(cx - o); cursor.setTranslationY(cy - o);
    }

    private void touch(int action, long down, float x, float y) {
        MotionEvent ev = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0);
        ev.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        root.dispatchTouchEvent(ev);                    // a toda la pantalla: sirve para la página y para la barra
        ev.recycle();
    }

    private void exitFull() {
        if (fullView == null) return;
        root.removeView(fullView);
        fullView = null;
        if (fullCb != null) fullCb.onCustomViewHidden();
        fullCb = null;
        bar.setVisibility(View.VISIBLE);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (k == KeyEvent.KEYCODE_BACK) {
            if (e.getAction() == KeyEvent.ACTION_UP) {
                if (fullView != null) exitFull();
                else if (urlBar.hasFocus()) { urlBar.clearFocus(); hideKeyboard(); web.requestFocus(); }
                else if (web.canGoBack()) web.goBack();
                else finish();
            }
            return true;
        }
        if (!tv || urlBar.hasFocus()) return super.dispatchKeyEvent(e);   // escribiendo la dirección: teclas normales
        boolean dir = k == KeyEvent.KEYCODE_DPAD_LEFT || k == KeyEvent.KEYCODE_DPAD_RIGHT || k == KeyEvent.KEYCODE_DPAD_UP
                || k == KeyEvent.KEYCODE_DPAD_DOWN || k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER
                || k == KeyEvent.KEYCODE_NUMPAD_ENTER;
        if (e.getAction() != KeyEvent.ACTION_DOWN) return dir || super.dispatchKeyEvent(e);
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
                if (rc == 0) {
                    final long t = SystemClock.uptimeMillis();
                    final float x = cx, y = cy;
                    touch(MotionEvent.ACTION_DOWN, t, x, y);
                    root.postDelayed(() -> touch(MotionEvent.ACTION_UP, t, x, y), 60);
                }
                return true;
            default:
                return super.dispatchKeyEvent(e);
        }
    }

    @Override protected void onPause() { super.onPause(); web.onPause(); CookieManager.getInstance().flush(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override protected void onDestroy() {
        CookieManager.getInstance().flush();
        web.stopLoading(); web.destroy();
        super.onDestroy();
    }
}
