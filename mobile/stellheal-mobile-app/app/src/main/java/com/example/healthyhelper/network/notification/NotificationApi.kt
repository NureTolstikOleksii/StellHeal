package com.example.healthyhelper.network.notification

import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface NotificationApi {

    @GET("notification/my")
    fun getUserNotifications(): Call<List<NotificationResponse>>

    @POST("notification/mark-read")
    fun markNotificationsRead(): Call<Void>

    // 🔥 НОВИЙ ПРАВИЛЬНИЙ
    @POST("notification/fcm-token")
    fun sendFcmToken(
        @Body tokenRequest: FcmTokenRequest
    ): Call<Void>
}