package com.example.healthyhelper.auth

import android.content.Intent
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

    override fun authenticate(route: Route?, response: Response): Request? {

        if (response.request.url.encodedPath.contains("auth/refresh")) {
            return null
        }

        val refreshToken = AuthManager.getRefreshToken() ?: return null

        if (responseCount(response) >= 2) {
            AuthManager.clear()
            return null
        }

        try {
            val retrofit = Retrofit.Builder()
                .baseUrl(ApiConfig.BASE_URL)
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            val api = retrofit.create(AuthApi::class.java)

            val refreshResponse = api.refresh(RefreshRequest(refreshToken)).execute()

            if (refreshResponse.isSuccessful) {
                val body = refreshResponse.body()

                val newAccess = body?.accessToken
                val newRefresh = body?.refreshToken

                if (newAccess != null && newRefresh != null) {

                    AuthManager.saveTokens(newAccess, newRefresh)

                    return response.request.newBuilder()
                        .header("Authorization", "Bearer $newAccess")
                        .build()
                }
            }

        } catch (e: Exception) {
            e.printStackTrace()
        }

        AuthManager.clear()
        MyApp.context.sendBroadcast(Intent(AuthEvents.ACTION_LOGOUT))

        return null
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