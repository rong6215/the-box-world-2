package com.theboxworld.ro

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val PREF_KEY_URL = "saved_server_url"
    private val OFFLINE_URL = "https://appassets.androidplatform.net/assets/www/index.html"
    private val DEFAULT_REMOTE_URL = "http://10.207.47.54:3000"

    private lateinit var assetLoader: WebViewAssetLoader

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen awake while playing
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUI()

        // Configure modern Android AssetLoader to serve all APK bundled assets
        assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val prefs = getSharedPreferences("the_box_world_prefs", Context.MODE_PRIVATE)
        val currentUrl = prefs.getString(PREF_KEY_URL, OFFLINE_URL) ?: OFFLINE_URL

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

            // Enable hardware acceleration
            setLayerType(View.LAYER_TYPE_HARDWARE, null)

            webChromeClient = WebChromeClient()
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
                    if (request?.isForMainFrame == true && currentUrl != OFFLINE_URL) {
                        showServerConfigDialog(
                            "ไม่สามารถเชื่อมต่อไปยังเซิร์ฟเวอร์ภายนอกได้ ($currentUrl)\nต้องการกลับไปเล่นโหมดออฟไลน์ในเครื่อง (Offline Mode) หรือไม่?"
                        )
                    }
                }
            }

            setOnLongClickListener {
                showServerConfigDialog("ตั้งค่าโหมดการเล่น / เปลี่ยนเซิร์ฟเวอร์:")
                true
            }
        }

        setContentView(webView)
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
            hideSystemUI()
        }
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
