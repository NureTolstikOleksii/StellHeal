package com.example.healthyhelper.network.notification

import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

interface NotificationApi {
    @POST("/notification/get-by-user")
    fun getUserNotifications(@Body body: Map<String, Int>): Call<List<NotificationResponse>>

    @POST("/notification/mark-read")
    fun markNotificationsRead(@Body body: Map<String, Int>): Call<Void>

    @POST("notification/users/{id}/fcm-token")
    fun sendFcmToken(
        @Path("id") userId: Int,
        @Body tokenRequest: FcmTokenRequest
    ): Call<Void>
}
