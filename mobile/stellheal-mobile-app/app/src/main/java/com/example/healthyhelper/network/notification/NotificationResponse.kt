package com.example.healthyhelper.network.notification

data class NotificationResponse(
    val notification_id: Int,
    val message: String,
    val type: String,
    val time: String,
    val date: String,
    val is_read: Boolean
)
