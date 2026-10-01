package com.example.jarvisapp;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.Locale;

public class MainActivity extends AppCompatActivity implements TextToSpeech.OnInitListener {

    private static final int MICROPHONE_PERMISSION_CODE = 1;
    private WebView webView;
    private TextToSpeech tts;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        webView = new WebView(this);
        setContentView(webView);

        // Initialize TextToSpeech
        tts = new TextToSpeech(this, this);

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);

        // Add Javascript Interface to allow Web app to call native TTS
        webView.addJavascriptInterface(new JarvisInterface(), "AndroidJarvis");

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                MainActivity.this.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }
        });

        // Request Mic Permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, MICROPHONE_PERMISSION_CODE);
        } else {
            loadJarvis();
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = tts.setLanguage(Locale.US);
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                Toast.makeText(this, "Language not supported", Toast.LENGTH_SHORT).show();
            } else {
                tts.setPitch(0.8f);   // Deep voice as requested
                tts.setSpeechRate(0.9f); // AI feel as requested
                tts.speak("Initializing system", TextToSpeech.QUEUE_FLUSH, null, "init_id");
            }
        } else {
            Toast.makeText(this, "TTS Initialization failed", Toast.LENGTH_SHORT).show();
        }
    }

    private void loadJarvis() {
        // Load the full Me AI web application from the hosted URL
        webView.loadUrl("https://ais-pre-uxqjna3oq7xerrndl3ibzp-27348241861.asia-southeast1.run.app");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MICROPHONE_PERMISSION_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                loadJarvis();
            } else {
                Toast.makeText(this, "Microphone permission is required for voice commands", Toast.LENGTH_LONG).show();
                loadJarvis(); // Still load, but it will have reduced functionality web-side
            }
        }
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        super.onDestroy();
    }

    // Javascript Interface for the Web App
    public class JarvisInterface {
        @JavascriptInterface
        public void speak(String text) {
            if (tts != null) {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, null);
            }
        }

        @JavascriptInterface
        public void setLanguage(String langCode) {
            if (tts != null) {
                Locale locale;
                if (langCode.startsWith("hi")) {
                    locale = new Locale("hi", "IN");
                } else if (langCode.startsWith("en-IN")) {
                    locale = new Locale("en", "IN");
                } else {
                    locale = Locale.US;
                }
                tts.setLanguage(locale);
            }
        }

        @JavascriptInterface
        public void playAudio(String url) {
            try {
                android.media.MediaPlayer mediaPlayer = new android.media.MediaPlayer();
                mediaPlayer.setDataSource(url);
                mediaPlayer.prepare();
                mediaPlayer.start();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void toast(String message) {
            Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
        }
    }
}
