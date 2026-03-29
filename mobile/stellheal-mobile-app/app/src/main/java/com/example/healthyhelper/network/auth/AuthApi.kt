package com.example.healthyhelper.network.auth

import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {
    @POST("/login/mobile")
    fun login(@Body request: LoginRequest): Call<LoginResponse>
}
