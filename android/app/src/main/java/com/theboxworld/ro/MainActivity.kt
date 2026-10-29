package com.theboxworld.ro

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private val TAG = "TheBoxWorldRO"
    private lateinit var webView: WebView
    private val PREF_KEY_URL = "saved_server_url"
    private val OFFLINE_URL = "https://appassets.androidplatform.net/assets/www/index.html"
    private val DEFAULT_REMOTE_URL = "http://10.207.47.54:3000"

    private lateinit var assetLoader: WebViewAssetLoader

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Install safe crash handler to prevent immediate silent black-screen crash
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e(TAG, "Uncaught Exception in thread ${thread.name}", throwable)
            runOnUiThread {
                try {
                    AlertDialog.Builder(this)
                        .setTitle("เกิดข้อผิดพลาดในการเริ่มเกม")
                        .setMessage("Error: ${throwable.localizedMessage}\n\n${throwable.stackTraceToString().take(400)}")
                        .setPositiveButton("ปิด") { _, _ -> finish() }
                        .show()
                } catch (_: Exception) {
                    finish()
                }
            }
        }

        try {
            // Keep screen awake while playing
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

            // Configure modern Android AssetLoader to serve all APK bundled assets
            assetLoader = WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
                .build()

            val prefs = getSharedPreferences("the_box_world_prefs", Context.MODE_PRIVATE)

            // CRITICAL FIX: Always default strictly to local offline standalone mode!
            // If the user previously had a broken local LAN IP (e.g. 10.207.47.54), purge it to prevent black screen crash
            val savedUrl = prefs.getString(PREF_KEY_URL, null)
            val currentUrl = if (savedUrl == null || savedUrl.contains("10.207.47.54") || savedUrl.contains("192.168.")) {
                prefs.edit().putString(PREF_KEY_URL, OFFLINE_URL).apply()
                OFFLINE_URL
            } else {
                savedUrl
            }

            webView = WebView(this).apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    loadsImagesAutomatically = true
                    mediaPlaybackRequiresUserGesture = false
                    allowFileAccess = true
                    allowContentAccess = true
                    allowFileAccessFromFileURLs = true
                    allowUniversalAccessFromFileURLs = true
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    cacheMode = WebSettings.LOAD_DEFAULT
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                }

                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                        Log.d(TAG, "[WebView Console] ${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                        return true
                    }
                }

                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                        return false
                    }

                    override fun shouldInterceptRequest(
                        view: WebView?,
                        request: WebResourceRequest?
                    ): WebResourceResponse? {
                        val url = request?.url ?: return null
                        val path = url.path ?: ""

                        // 1. Intercept dynamic /grf/ requests and serve from embedded APK assets
                        if (path.contains("/grf/")) {
                            val grfRes = handleGrfRequest(path)
                            if (grfRes != null) return grfRes
                        }

                        // 2. Delegate to WebViewAssetLoader for APK's internal assets/www/
                        return assetLoader.shouldInterceptRequest(url)
                    }

                    override fun onReceivedError(
                        view: WebView?,
                        request: WebResourceRequest?,
                        error: WebResourceError?
                    ) {
                        Log.e(TAG, "WebView error: ${error?.errorCode} ${error?.description}")
                        if (request?.isForMainFrame == true) {
                            val activeUrl = prefs.getString(PREF_KEY_URL, OFFLINE_URL) ?: OFFLINE_URL
                            if (activeUrl != OFFLINE_URL) {
                                runOnUiThread {
                                    if (!isFinishing && !isDestroyed) {
                                        showServerConfigDialog(
                                            "ไม่สามารถเชื่อมต่อไปยังเซิร์ฟเวอร์ภายนอกได้ ($activeUrl)\nต้องการกลับไปเล่นโหมดออฟไลน์ในเครื่อง (Offline Mode) หรือไม่?"
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Long click anywhere to bring up server config dialog safely
                setOnLongClickListener {
                    if (!isFinishing && !isDestroyed) {
                        showServerConfigDialog("ตั้งค่าโหมดการเล่น / เปลี่ยนเซิร์ฟเวอร์:")
                    }
                    true
                }
            }

            setContentView(webView)
            applySystemUI()
            webView.loadUrl(currentUrl)

            // Handle Android Back button: close in-game active window or exit
            onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    webView.evaluateJavascript(
                        "(function() { " +
                        "  const activeWins = document.querySelectorAll('.ro-window:not(.hidden), .modal-overlay:not(.hidden)'); " +
                        "  if (activeWins.length > 0) { " +
                        "    activeWins[activeWins.length - 1].classList.add('hidden'); " +
                        "    return true; " +
                        "  } " +
                        "  return false; " +
                        "})()"
                    ) { result ->
                        if (result != "true") {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                        }
                    }
                }
            })
        } catch (e: Throwable) {
            Log.e(TAG, "Error in onCreate", e)
            showFatalErrorView(e)
        }
    }

    private fun showFatalErrorView(e: Throwable) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 60, 40, 40)
            setBackgroundColor(0xFF0A0E17.toInt())
        }
        val tv = TextView(this).apply {
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 14f
            text = "เกิดข้อผิดพลาดในการโหลดเกม:\n${e.localizedMessage}\n\n${e.stackTraceToString()}"
        }
        layout.addView(tv)
        setContentView(layout)
    }

    private fun handleGrfRequest(path: String): WebResourceResponse? {
        try {
            val clean = path.substringAfter("/grf/")
            val kind = clean.substringBefore("/")
            val target = clean.substringAfter("/").substringBefore("?")

            var assetPath: String? = null
            when (kind) {
                "skill" -> {
                    val testPath = "www/assets/skills/$target"
                    assetPath = if (assetExists(testPath)) testPath else "www/assets/ui/btn_ok.png"
                }
                "monster" -> {
                    val testPath = "www/assets/sprites/$target"
                    assetPath = if (assetExists(testPath)) testPath else "www/assets/sprites/monster_poring_0.png"
                }
                "character" -> {
                    val job = target.substringBefore("_")
                    val testPath = "www/assets/sprites/class_${job}_0.png"
                    assetPath = if (assetExists(testPath)) testPath else "www/assets/sprites/class_novice_0.png"
                }
                "icon" -> {
                    val id = target.substringBefore(".")
                    val testPath = "www/assets/items/item_$id.png"
                    val testPath2 = "www/assets/items/$target"
                    assetPath = when {
                        assetExists(testPath) -> testPath
                        assetExists(testPath2) -> testPath2
                        else -> "www/assets/items/item_1201.png"
                    }
                }
                "collection" -> {
                    val id = target.substringBefore(".")
                    val testPath = "www/assets/collection/item_$id.png"
                    val testPath2 = "www/assets/collection/$target"
                    assetPath = when {
                        assetExists(testPath) -> testPath
                        assetExists(testPath2) -> testPath2
                        else -> "www/assets/cards/card_0.png"
                    }
                }
                "card" -> {
                    val id = target.substringBefore(".")
                    val testPath = "www/assets/cards/card_$id.png"
                    val testPath2 = "www/assets/cards/$target"
                    assetPath = when {
                        assetExists(testPath) -> testPath
                        assetExists(testPath2) -> testPath2
                        else -> "www/assets/cards/card_0.png"
                    }
                }
                "map", "groundmap" -> {
                    val code = target.substringBefore(".")
                    val testPath = "www/assets/maps/map_$code.png"
                    val testPath2 = "www/assets/maps/$code.png"
                    assetPath = when {
                        assetExists(testPath) -> testPath
                        assetExists(testPath2) -> testPath2
                        else -> "www/assets/maps/map_prontera.png"
                    }
                }
            }

            if (assetPath != null && assetExists(assetPath)) {
                val stream = assets.open(assetPath)
                return WebResourceResponse("image/png", "UTF-8", stream)
            }
        } catch (_: Exception) {}
        return null
    }

    private fun assetExists(path: String): Boolean {
        return try {
            assets.open(path).use { true }
        } catch (_: Exception) {
            false
        }
    }

    private fun showServerConfigDialog(message: String) {
        if (isFinishing || isDestroyed) return
        val prefs = getSharedPreferences("the_box_world_prefs", Context.MODE_PRIVATE)
        val currentUrl = prefs.getString(PREF_KEY_URL, OFFLINE_URL) ?: OFFLINE_URL

        val input = EditText(this).apply {
            setText(if (currentUrl == OFFLINE_URL) DEFAULT_REMOTE_URL else currentUrl)
            setSelection(text.length)
            setHint("http://10.207.47.54:3000 หรือ Cloudflare URL")
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(60, 20, 60, 20)
            addView(input)
        }

        AlertDialog.Builder(this)
            .setTitle("THE BOX WORLD 2 - RO")
            .setMessage(message)
            .setView(container)
            .setCancelable(true)
            .setPositiveButton("เล่นในเครื่อง (Offline Mode)") { _, _ ->
                prefs.edit().putString(PREF_KEY_URL, OFFLINE_URL).apply()
                webView.loadUrl(OFFLINE_URL)
                Toast.makeText(this, "กำลังเล่นโหมดออฟไลน์ในเครื่อง (Offline Mode)", Toast.LENGTH_SHORT).show()
            }
            .setNeutralButton("เชื่อมต่อรีโมท (Connect Remote)") { _, _ ->
                var targetUrl = input.text.toString().trim()
                if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
                    targetUrl = "http://$targetUrl"
                }
                prefs.edit().putString(PREF_KEY_URL, targetUrl).apply()
                webView.loadUrl(targetUrl)
                Toast.makeText(this, "กำลังเชื่อมต่อไปที่ $targetUrl", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("ปิด (Close)", null)
            .show()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            applySystemUI()
        }
    }

    private fun applySystemUI() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
        }
    }

    override fun onPause() {
        if (::webView.isInitialized) {
            webView.onPause()
        }
        super.onPause()
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }
}
