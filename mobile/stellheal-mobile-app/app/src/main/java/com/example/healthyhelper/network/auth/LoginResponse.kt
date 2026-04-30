package com.example.healthyhelper.network.auth

data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: LoggedUser
)

data class LoggedUser(
    val id: Int,
    val first_name: String,
    val last_name: String,
    val role: String,
    val avatar: String?
)