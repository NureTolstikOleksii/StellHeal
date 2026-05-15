package com.example.healthyhelper

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.*
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.navigation.NavOptions
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.example.healthyhelper.auth.AuthEvents
import com.example.healthyhelper.auth.AuthManager
import com.example.healthyhelper.fcm.MyFirebaseMessagingService
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.notification.NotificationResponse
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.firebase.messaging.FirebaseMessaging
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class MainActivity : AppCompatActivity() {

    private lateinit var navController: androidx.navigation.NavController
    private lateinit var bottomNav: BottomNavigationView

    private val badgeHandler = Handler(Looper.getMainLooper())
    private lateinit var badgeRunnable: Runnable

    private val notificationReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            updateNavBadge()
        }
    }

    private val logoutReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            AuthManager.clear()
            val intentRestart = Intent(this@MainActivity, MainActivity::class.java)
            intentRestart.flags =
                Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intentRestart)
            finish()
        }
    }

    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT

        createNotificationChannel()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissions(
                    arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                    1001
                )
            }
        }

        enableEdgeToEdge()
        setContentView(R.layout.activity_main)

        val navHostFragment =
            supportFragmentManager.findFragmentById(R.id.fragmentContainerView) as NavHostFragment
        navController = navHostFragment.navController
        bottomNav = findViewById(R.id.bottomNavigationView)

        val token = AuthManager.getAccessToken()
        val prefs = getSharedPreferences("prefs", Context.MODE_PRIVATE)
        val role = prefs.getString("user_role", "unknown")

        if (role == "staff") {
            bottomNav.menu.clear()
            bottomNav.inflateMenu(R.menu.bottom_nav_menu_staff)
        }

        if (token != null) {
            val navOptions = NavOptions.Builder()
                .setPopUpTo(navController.graph.startDestinationId, true)
                .build()

            val target = if (role == "staff") {
                R.id.homeStaffFragment
            } else {
                R.id.homeFragment
            }

            navController.navigate(target, null, navOptions)

            // Запускаємо badge тільки якщо залогінений
            startNotificationBadgeUpdater()
        }

        bottomNav.setupWithNavController(navController)

        navController.addOnDestinationChangedListener { _, destination, _ ->
            bottomNav.visibility = when (destination.id) {
                R.id.mainFragment, R.id.loginFragment -> View.GONE
                else -> View.VISIBLE
            }
        }

        // FCM token
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val fcmToken = task.result
                Log.d("FCM_TOKEN", fcmToken)
                MyFirebaseMessagingService.sendTokenToServer(this, fcmToken)
            } else {
                Log.e("FCM_ERROR", "Failed to get token", task.exception)
            }
        }

        // Logout receiver
        ContextCompat.registerReceiver(
            this,
            logoutReceiver,
            IntentFilter(AuthEvents.ACTION_LOGOUT),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        // Push notification receiver
        ContextCompat.registerReceiver(
            this,
            notificationReceiver,
            IntentFilter("NEW_NOTIFICATION"),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(logoutReceiver)
        unregisterReceiver(notificationReceiver)
        if (::badgeRunnable.isInitialized) {
            badgeHandler.removeCallbacks(badgeRunnable)
        }
    }

    // =========================
    // BADGE
    // =========================

    private fun startNotificationBadgeUpdater() {
        badgeRunnable = object : Runnable {
            override fun run() {
                updateNavBadge()
                badgeHandler.postDelayed(this, 30000)
            }
        }
        badgeHandler.post(badgeRunnable)
    }

    private fun updateNavBadge() {
        RetrofitClient.notificationApi.getUserNotifications()
            .enqueue(object : Callback<List<NotificationResponse>> {
                override fun onResponse(
                    call: Call<List<NotificationResponse>>,
                    response: Response<List<NotificationResponse>>
                ) {
                    if (!response.isSuccessful) return
                    val unreadCount = response.body()?.count { !it.is_read } ?: 0

                    if (unreadCount > 0) {
                        val badge = bottomNav.getOrCreateBadge(R.id.notificationFragment)
                        badge.isVisible = true
                        badge.number = unreadCount
                        badge.maxCharacterCount = 3
                    } else {
                        bottomNav.removeBadge(R.id.notificationFragment)
                    }
                }

                override fun onFailure(
                    call: Call<List<NotificationResponse>>,
                    t: Throwable
                ) {}
            })
    }

    // =========================

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "default_channel",
                "Основний канал",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Канал для push-сповіщень"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}