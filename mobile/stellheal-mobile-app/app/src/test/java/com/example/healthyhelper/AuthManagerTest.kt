package com.example.healthyhelper

import android.content.Context
import android.os.Build
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [Build.VERSION_CODES.TIRAMISU])
class AuthManagerTest {

    private lateinit var prefs: android.content.SharedPreferences

    @Before
    fun setUp() {
        val context = RuntimeEnvironment.getApplication()
        prefs = context.getSharedPreferences("prefs", Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
    }

    @Test
    fun `saveTokens stores access and refresh tokens`() {
        prefs.edit()
            .putString("access_token", "access123")
            .putString("refresh_token", "refresh456")
            .apply()

        assertEquals("access123",  prefs.getString("access_token", null))
        assertEquals("refresh456", prefs.getString("refresh_token", null))
    }

    @Test
    fun `getAccessToken returns null when not set`() {
        assertNull(prefs.getString("access_token", null))
    }

    @Test
    fun `getRefreshToken returns null when not set`() {
        assertNull(prefs.getString("refresh_token", null))
    }

    @Test
    fun `clear removes all tokens`() {
        prefs.edit()
            .putString("access_token", "access123")
            .putString("refresh_token", "refresh456")
            .apply()

        prefs.edit().clear().apply()

        assertNull(prefs.getString("access_token", null))
        assertNull(prefs.getString("refresh_token", null))
    }

    @Test
    fun `overwrite token replaces old value`() {
        prefs.edit().putString("access_token", "old_token").apply()
        prefs.edit().putString("access_token", "new_token").apply()
        assertEquals("new_token", prefs.getString("access_token", null))
    }
}