package com.example.healthyhelper.auth

import android.content.Context
import com.example.healthyhelper.MyApp
import androidx.core.content.edit

object AuthManager {

    private val prefs = MyApp.context.getSharedPreferences("prefs", Context.MODE_PRIVATE)

    fun saveTokens(access: String, refresh: String) {
        prefs.edit {
            putString("access_token", access)
                .putString("refresh_token", refresh)
        }
    }

    fun getAccessToken(): String? {
        return prefs.getString("access_token", null)
    }

    fun getRefreshToken(): String? {
        return prefs.getString("refresh_token", null)
    }

    fun clear() {
        prefs.edit { clear() }
    }
}