package com.example.healthyhelper.fragments

import android.os.Bundle
import androidx.fragment.app.Fragment
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.notification.NotificationResponse
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.util.Locale

class NotificationFragment : Fragment(R.layout.fragment_notification) {

    private lateinit var notificationList: LinearLayout

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        notificationList = view.findViewById(R.id.notificationList)

        val userId = requireContext().getSharedPreferences("prefs", 0).getInt("user_id", -1)

        if (userId == -1) {
            Toast.makeText(requireContext(), "User not found", Toast.LENGTH_SHORT).show()
            return
        }

        RetrofitClient.notificationApi.getUserNotifications(mapOf("userId" to userId))
            .enqueue(object : Callback<List<NotificationResponse>> {
                override fun onResponse(
                    call: Call<List<NotificationResponse>>,
                    response: Response<List<NotificationResponse>>
                ) {
                    val notifications = response.body() ?: return
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

                    val userId = requireContext().getSharedPreferences("prefs", 0).getInt("user_id", -1)
                    RetrofitClient.notificationApi.markNotificationsRead(mapOf("userId" to userId))
                        .enqueue(object : Callback<Void> {
                            override fun onResponse(call: Call<Void>, response: Response<Void>) {}
                            override fun onFailure(call: Call<Void>, t: Throwable) {}
                        })
                }

                override fun onFailure(call: Call<List<NotificationResponse>>, t: Throwable) {
                    Toast.makeText(requireContext(), "Error loading notifications", Toast.LENGTH_SHORT).show()
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
        val parsedDate = inputFormat.parse(notification.date)
        val formattedDate = parsedDate?.let { outputFormat.format(it) } ?: notification.date

        message.text = notification.message
        time.text = "${notification.time.substring(11, 16)}"
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

        if (!notification.is_read) {
            item.alpha = 1.0f
        } else {
            item.alpha = 0.5f
        }

        notificationList.addView(item)
    }

    private fun addSectionHeader(title: String) {
        val header = layoutInflater.inflate(R.layout.item_section_header, notificationList, false)
        header.findViewById<TextView>(R.id.headerText).text = title
        notificationList.addView(header)
    }
}
