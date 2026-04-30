package com.example.healthyhelper

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.*
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.NavOptions
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.example.healthyhelper.auth.AuthEvents
import com.example.healthyhelper.auth.AuthManager
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    private lateinit var navController: androidx.navigation.NavController
    private lateinit var bottomNav: BottomNavigationView

    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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

        // menu for staff
        if (role == "staff") {
            bottomNav.menu.clear()
            bottomNav.inflateMenu(R.menu.bottom_nav_menu_staff)
        }

        // автологін
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
        }

        bottomNav.setupWithNavController(navController)

        // показ/приховування bottomNav
        navController.addOnDestinationChangedListener { _, destination, _ ->
            bottomNav.visibility = when (destination.id) {
                R.id.mainFragment, R.id.loginFragment -> View.GONE
                else -> View.VISIBLE
            }
        }

        // FCM token
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                Log.d("FCM_TOKEN", task.result)
            } else {
                Log.e("FCM_ERROR", "Failed to get token", task.exception)
            }
        }

        // logout receiver
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(
                logoutReceiver,
                IntentFilter(AuthEvents.ACTION_LOGOUT),
                RECEIVER_NOT_EXPORTED
            )
        } else {
            registerReceiver(logoutReceiver, IntentFilter(AuthEvents.ACTION_LOGOUT))
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(logoutReceiver)
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