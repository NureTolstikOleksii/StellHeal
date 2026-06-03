package com.example.healthyhelper.network.notification

data class NotificationResponse(
    val id:      Int,
    val message: String,
    val type:    String,
    val sent_at: String?,  // ← nullable
    val is_read: Boolean
)