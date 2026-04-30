package com.example.healthyhelper.fcm

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.notification.FcmTokenRequest
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCM_TOKEN", token)
        sendTokenToServer(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.notification?.title ?: "Сповіщення"
        val body = remoteMessage.notification?.body ?: "Ви отримали повідомлення"

        showNotification(title, body)

        // 🔥 ДОДАТИ ОЦЕ
        val intent = Intent("NEW_NOTIFICATION")
        intent.setPackage(packageName)
        sendBroadcast(intent)
    }

    private fun showNotification(title: String, message: String) {
        val channelId = "default_channel"
        val notificationId = System.currentTimeMillis().toInt()

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(notificationId, builder.build())
    }

    private fun sendTokenToServer(token: String) {

        val api = RetrofitClient.notificationApi

        api.sendFcmToken(FcmTokenRequest(token))
            .enqueue(object : Callback<Void> {

                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    if (response.isSuccessful) {
                        Log.d("FCM_SEND", "FCM токен оновлено")
                    } else {
                        Log.w("FCM_SEND", "Сервер відхилив токен: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    Log.e("FCM_SEND", "Помилка надсилання токена", t)
                }
            })
    }
    companion object {
        fun sendTokenToServer(context: Context, token: String) {

            RetrofitClient.notificationApi
                .sendFcmToken(FcmTokenRequest(token))
                .enqueue(object : Callback<Void> {

                    override fun onResponse(call: Call<Void>, response: Response<Void>) {
                        if (response.isSuccessful) {
                            Log.d("FCM_SEND", "FCM токен оновлено після логіну")
                        }
                    }

                    override fun onFailure(call: Call<Void>, t: Throwable) {
                        Log.e("FCM_SEND", "Помилка надсилання токена", t)
                    }
                })
        }
    }
}
