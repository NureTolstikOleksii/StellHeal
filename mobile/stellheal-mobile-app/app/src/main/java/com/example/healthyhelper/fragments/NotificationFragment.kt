package com.example.healthyhelper.fragments

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.notification.NotificationResponse
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.util.*

class NotificationFragment : Fragment(R.layout.fragment_notification) {

    private lateinit var notificationList: LinearLayout

    // 🔥 Receiver для real-time оновлення
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val v = view ?: return
            loadNotifications(v)
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        notificationList = view.findViewById(R.id.notificationList)

        loadNotifications(view)
    }

    private fun loadNotifications(view: View) {

        // 🔥 очищаємо перед завантаженням
        notificationList.removeAllViews()

        RetrofitClient.notificationApi.getUserNotifications()
            .enqueue(object : Callback<List<NotificationResponse>> {

                override fun onResponse(
                    call: Call<List<NotificationResponse>>,
                    response: Response<List<NotificationResponse>>
                ) {
                    if (!response.isSuccessful) {
                        Toast.makeText(requireContext(), "Помилка сервера", Toast.LENGTH_SHORT).show()
                        return
                    }

                    val notifications = response.body() ?: emptyList()

                    val emptyText = view.findViewById<TextView>(R.id.emptyText)

                    if (notifications.isEmpty()) {
                        emptyText.visibility = View.VISIBLE
                        return
                    } else {
                        emptyText.visibility = View.GONE
                    }

                    val unread = notifications.filter { !it.is_read }
                    val read = notifications.filter { it.is_read }

                    if (unread.isNotEmpty()) {
                        addSectionHeader("New")
                        unread.forEach { addNotificationItem(it) }

                        if (read.isNotEmpty()) {
                            addSectionHeader("Earlier")
                            read.forEach { addNotificationItem(it) }
                        }
                    } else {
                        read.forEach { addNotificationItem(it) }
                    }

                    // 🔥 автоматично позначаємо як прочитані
                    RetrofitClient.notificationApi.markNotificationsRead()
                        .enqueue(object : Callback<Void> {
                            override fun onResponse(call: Call<Void>, response: Response<Void>) {}
                            override fun onFailure(call: Call<Void>, t: Throwable) {}
                        })
                }

                override fun onFailure(call: Call<List<NotificationResponse>>, t: Throwable) {
                    Toast.makeText(
                        requireContext(),
                        "Помилка: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun addNotificationItem(notification: NotificationResponse) {
        val item = layoutInflater.inflate(R.layout.item_notification, notificationList, false)

        val icon = item.findViewById<ImageView>(R.id.icon)
        val message = item.findViewById<TextView>(R.id.message)
        val time = item.findViewById<TextView>(R.id.timeText)
        val date = item.findViewById<TextView>(R.id.dateText)

        val inputFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val outputFormat = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault())

        val parsedDate = try {
            inputFormat.parse(notification.date)
        } catch (e: Exception) {
            null
        }

        val formattedDate = parsedDate?.let { outputFormat.format(it) } ?: notification.date

        message.text = notification.message
        time.text = notification.time.substring(11, 16)
        date.text = formattedDate

        when (notification.type) {
            "warning" -> {
                item.setBackgroundResource(R.drawable.bg_orange_gradient)
                icon.setImageResource(R.drawable.ic_warning_notific)
            }
            "error" -> {
                item.setBackgroundResource(R.drawable.bg_red_gradient)
                icon.setImageResource(R.drawable.ic_error_notific)
            }
            "success" -> {
                item.setBackgroundResource(R.drawable.bg_green_gradient)
                icon.setImageResource(R.drawable.ic_success_notific)
            }
        }

        item.alpha = if (!notification.is_read) 1.0f else 0.5f

        notificationList.addView(item)
    }

    private fun addSectionHeader(title: String) {
        val header = layoutInflater.inflate(R.layout.item_section_header, notificationList, false)
        header.findViewById<TextView>(R.id.headerText).text = title
        notificationList.addView(header)
    }

    override fun onResume() {
        super.onResume()

        // 🔥 Android 13 fix
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requireContext().registerReceiver(
                receiver,
                IntentFilter("NEW_NOTIFICATION"),
                Context.RECEIVER_NOT_EXPORTED
            )
        } else {
            ContextCompat.registerReceiver(
                requireContext(),
                receiver,
                IntentFilter("NEW_NOTIFICATION"),
                ContextCompat.RECEIVER_NOT_EXPORTED
            )
        }
    }

    override fun onPause() {
        super.onPause()
        requireContext().unregisterReceiver(receiver)
    }
}