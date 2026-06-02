package com.example.healthyhelper.network.notification

data class NotificationResponse(
    val id: Int,
    val message: String,
    val type: String,
    val sent_at: String,  // ← UTC ISO, конвертувати при відображенні
    val is_read: Boolean
)