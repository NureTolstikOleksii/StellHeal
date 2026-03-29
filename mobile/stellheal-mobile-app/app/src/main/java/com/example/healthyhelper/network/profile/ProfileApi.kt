package com.example.healthyhelper.network.profile

import AvatarResponse
import UserProfileResponse
import okhttp3.MultipartBody
import retrofit2.Call
import retrofit2.http.*

interface ProfileApi {
    @GET("profile")
    fun getProfile(@Header("Authorization") token: String): Call<UserProfileResponse>

    @PUT("profile/change-password")
    fun changePassword(
        @Header("Authorization") token: String,
        @Body body: Map<String, String>
    ): Call<Void>

    @Multipart
    @PUT("/profile/avatar")
    fun uploadAvatar(
        @Part avatar: MultipartBody.Part,
        @Header("Authorization") token: String
    ): Call<AvatarResponse>
}
