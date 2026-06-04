package com.example.healthyhelper.auth

import android.content.Intent
import android.util.Log
import com.example.healthyhelper.MyApp
import com.example.healthyhelper.network.ApiConfig
import com.example.healthyhelper.network.auth.AuthApi
import com.example.healthyhelper.network.auth.RefreshRequest
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class TokenAuthenticator : Authenticator {

    companion object {
        private val lock = Any()
    }

    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.request.url.encodedPath.contains("auth/refresh")) return null

        val refreshToken = AuthManager.getRefreshToken() ?: return null

        if (responseCount(response) >= 2) {
            AuthManager.clear()
            return null
        }

        val currentToken = AuthManager.getAccessToken()
        val requestToken = response.request.header("Authorization")?.removePrefix("Bearer ")
        if (currentToken != null && currentToken != requestToken) {
            Log.d("REFRESH", "Token already refreshed by another thread — retrying")
            return response.request.newBuilder()
                .header("Authorization", "Bearer $currentToken")
                .build()
        }

        return synchronized(lock) {

            val tokenAfterLock = AuthManager.getAccessToken()
            val requestTokenCheck = response.request.header("Authorization")?.removePrefix("Bearer ")
            if (tokenAfterLock != null && tokenAfterLock != requestTokenCheck) {
                Log.d("REFRESH", "Token refreshed while waiting for lock — retrying")
                return@synchronized response.request.newBuilder()
                    .header("Authorization", "Bearer $tokenAfterLock")
                    .build()
            }

            val currentRefresh = AuthManager.getRefreshToken() ?: run {
                Log.d("REFRESH", "No refresh token inside lock — logout")
                AuthManager.clear()
                MyApp.context.sendBroadcast(Intent(AuthEvents.ACTION_LOGOUT))
                return@synchronized null
            }

            try {
                Log.d("REFRESH", "Attempting refresh, token: ${currentRefresh.take(10)}...")

                val retrofit = Retrofit.Builder()
                    .baseUrl(ApiConfig.BASE_URL)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build()

                val api = retrofit.create(AuthApi::class.java)
                val refreshResponse = api.refresh(RefreshRequest(currentRefresh)).execute()

                Log.d("REFRESH", "Response code: ${refreshResponse.code()}")

                if (refreshResponse.isSuccessful) {
                    val body       = refreshResponse.body()
                    val newAccess  = body?.accessToken
                    val newRefresh = body?.refreshToken

                    if (newAccess != null && newRefresh != null) {
                        AuthManager.saveTokens(newAccess, newRefresh)
                        Log.d("REFRESH", "Tokens saved successfully")
                        return@synchronized response.request.newBuilder()
                            .header("Authorization", "Bearer $newAccess")
                            .build()
                    } else {
                        Log.d("REFRESH", "Body fields null — accessToken: $newAccess")
                    }
                } else {
                    Log.d("REFRESH", "Refresh failed: ${refreshResponse.code()} — ${refreshResponse.errorBody()?.string()}")
                }

            } catch (e: Exception) {
                Log.e("REFRESH", "Exception during refresh: ${e.message}", e)
            }

            Log.d("REFRESH", "Refresh failed — clearing and logout")
            AuthManager.clear()
            MyApp.context.sendBroadcast(Intent(AuthEvents.ACTION_LOGOUT))
            null
        }
    }

    private fun responseCount(response: Response): Int {
        var result = 1
        var res = response.priorResponse
        while (res != null) {
            result++
            res = res.priorResponse
        }
        return result
    }
}