package com.example.healthyhelper.network.auth

data class LoginResponse(
    val message: String,
    val token: String,
    val user: LoggedUser
)

data class LoggedUser(
    val id: Int,
    val name: String,
    val role: String
)
