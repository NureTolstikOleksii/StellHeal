package com.example.healthyhelper.network.auth

data class LoginRequest(
    val email: String,
    val password: String,
    val platform: String = "mobile"
)