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
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val PREF_KEY_URL = "saved_server_url"
    private val defaultGameUrl = "http://10.207.47.54:3000"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen awake while playing
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUI()

        val prefs = getSharedPreferences("the_box_world_prefs", Context.MODE_PRIVATE)
        val currentUrl = prefs.getString(PREF_KEY_URL, defaultGameUrl) ?: defaultGameUrl

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                loadsImagesAutomatically = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
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

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    if (request?.isForMainFrame == true) {
                        showServerConfigDialog(
                            "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้\nกรุณาตรวจสอบว่าเซิร์ฟเวอร์เปิดอยู่ หรือระบุ IP / Cloudflare Tunnel URL ใหม่:"
                        )
                    }
                }
            }

            setOnLongClickListener {
                showServerConfigDialog("ตั้งค่าที่อยู่เซิร์ฟเวอร์ (Server URL):")
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

    private fun showServerConfigDialog(message: String) {
        val prefs = getSharedPreferences("the_box_world_prefs", Context.MODE_PRIVATE)
        val currentUrl = prefs.getString(PREF_KEY_URL, defaultGameUrl) ?: defaultGameUrl

        val input = EditText(this).apply {
            setText(currentUrl)
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
            .setPositiveButton("เชื่อมต่อ (Connect)") { _, _ ->
                var targetUrl = input.text.toString().trim()
                if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
                    targetUrl = "http://$targetUrl"
                }
                prefs.edit().putString(PREF_KEY_URL, targetUrl).apply()
                webView.loadUrl(targetUrl)
                Toast.makeText(this, "กำลังเชื่อมต่อไปที่ $targetUrl", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("ลองใหม่ (Retry)") { _, _ ->
                webView.reload()
            }
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
