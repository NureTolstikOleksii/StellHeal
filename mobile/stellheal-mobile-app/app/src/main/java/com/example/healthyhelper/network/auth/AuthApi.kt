package com.example.healthyhelper.network.auth

import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {

    @POST("auth/login")
    fun login(@Body request: LoginRequest): Call<LoginResponse>

    @POST("auth/refresh")
    fun refresh(@Body request: RefreshRequest): Call<LoginResponse>
}
