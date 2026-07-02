package com.example.healthyhelper.fragments

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.annotation.RequiresApi
import androidx.cardview.widget.CardView
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.notification.NotificationResponse
import com.example.healthyhelper.utils.utcToLocalDate
import com.example.healthyhelper.utils.utcToLocalTime
import com.google.android.material.bottomnavigation.BottomNavigationView
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class NotificationFragment : Fragment(R.layout.fragment_notification) {

    private lateinit var notificationList: LinearLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var scrollView: ScrollView
    private lateinit var emptyState: LinearLayout

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val v = view ?: return
            loadNotifications(v)
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        notificationList = view.findViewById(R.id.notificationList)
        progressBar      = view.findViewById(R.id.progressBar)
        scrollView       = view.findViewById(R.id.scrollView)
        emptyState       = view.findViewById(R.id.emptyState)

        loadNotifications(view)
    }

    private fun loadNotifications(view: View) {
        notificationList.removeAllViews()
        progressBar.visibility = View.VISIBLE
        scrollView.visibility  = View.GONE
        emptyState.visibility  = View.GONE

        RetrofitClient.notificationApi.getUserNotifications()
            .enqueue(object : Callback<List<NotificationResponse>> {

                @RequiresApi(Build.VERSION_CODES.O)
                override fun onResponse(
                    call: Call<List<NotificationResponse>>,
                    response: Response<List<NotificationResponse>>
                ) {
                    progressBar.visibility = View.GONE

                    if (!response.isSuccessful) {
                        Toast.makeText(requireContext(), "Помилка сервера", Toast.LENGTH_SHORT).show()
                        return
                    }

                    val notifications = (response.body() ?: emptyList())
                        .sortedByDescending { it.sent_at ?: "" }

                    if (notifications.isEmpty()) {
                        emptyState.visibility = View.VISIBLE
                        return
                    }

                    scrollView.visibility = View.VISIBLE

                    val unread = notifications.filter { !it.is_read }
                    val read   = notifications.filter { it.is_read }

                    if (unread.isNotEmpty()) {
                        addSectionHeader("Нові")
                        unread.forEach { addNotificationItem(it) }
                    }
                    if (read.isNotEmpty()) {
                        addSectionHeader(if (unread.isNotEmpty()) "Раніше" else "Всі")
                        read.forEach { addNotificationItem(it) }
                    }

                    if (unread.isNotEmpty()) {
                        markAllReadThenClearBadge()
                    }
                }

                override fun onFailure(call: Call<List<NotificationResponse>>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(requireContext(), "Помилка: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun markAllReadThenClearBadge() {
        RetrofitClient.notificationApi.markNotificationsRead()
            .enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    val nav = activity?.findViewById<BottomNavigationView>(R.id.bottomNavigationView)
                    nav?.removeBadge(R.id.notificationFragment)
                }
                override fun onFailure(call: Call<Void>, t: Throwable) {
                    val nav = activity?.findViewById<BottomNavigationView>(R.id.bottomNavigationView)
                    nav?.removeBadge(R.id.notificationFragment)
                }
            })
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun addNotificationItem(notification: NotificationResponse) {
        val item = layoutInflater.inflate(R.layout.item_notification, notificationList, false)

        val stripe    = item.findViewById<View>(R.id.typeStripe)
        val icon      = item.findViewById<ImageView>(R.id.icon)
        val message   = item.findViewById<TextView>(R.id.message)
        val time      = item.findViewById<TextView>(R.id.timeText)
        val date      = item.findViewById<TextView>(R.id.dateText)
        val unreadDot = item.findViewById<View>(R.id.unreadDot)
        val card      = item as? CardView

        message.text = notification.message
        time.text    = utcToLocalTime(notification.sent_at)
        date.text    = utcToLocalDate(notification.sent_at)

        val (stripeColor, iconBgColor, iconRes) = when (notification.type) {
            "warning"          -> Triple("#FF9800", "#FFF3E0", R.drawable.ic_warning_notific)
            "error"            -> Triple("#E53935", "#FFEBEE", R.drawable.ic_error_notific)
            "success"          -> Triple("#4CAF82", "#E8F5E9", R.drawable.ic_success_notific)
            "PILL_NOT_TAKEN"   -> Triple("#E53935", "#FFEBEE", R.drawable.ic_warning_notific)
            "INTAKE_REMINDER"  -> Triple("#4CAF82", "#E8F5E9", R.drawable.ic_success_notific)
            "info"             -> Triple("#2196F3", "#E3F2FD", R.drawable.ic_notifications)
            else               -> Triple("#AABAC8", "#F5F7FA", R.drawable.ic_notifications)
        }

        stripe.setBackgroundColor(Color.parseColor(stripeColor))
        icon.setImageResource(iconRes)
        icon.background?.setTint(Color.parseColor(iconBgColor))
            ?: icon.setBackgroundColor(Color.parseColor(iconBgColor))

        if (!notification.is_read) {
            unreadDot.visibility = View.VISIBLE

            val bgColor = when (notification.type) {
                "warning"                    -> "#FFE0B2"
                "error", "PILL_NOT_TAKEN"    -> "#FFCDD2"
                "success", "INTAKE_REMINDER" -> "#B9F0D4"
                "info"                       -> "#BBDEFB"
                else                         -> "#E0E0E0"
            }
            card?.setCardBackgroundColor(Color.parseColor(bgColor))

            message.setTextColor(Color.parseColor("#1A1A2E"))
            message.setTypeface(null, android.graphics.Typeface.BOLD)
            time.setTextColor(Color.parseColor("#7A8FA6"))
            date.setTextColor(Color.parseColor("#7A8FA6"))
        } else {
            unreadDot.visibility = View.GONE

            card?.setCardBackgroundColor(Color.parseColor("#F2F4F7"))
            message.setTextColor(Color.parseColor("#6B7280"))
            time.setTextColor(Color.parseColor("#9CA3AF"))
            date.setTextColor(Color.parseColor("#9CA3AF"))
        }

        notificationList.addView(item)
    }

    private fun addSectionHeader(title: String) {
        val header = layoutInflater.inflate(R.layout.item_section_header, notificationList, false)
        header.findViewById<TextView>(R.id.headerText).text = title
        notificationList.addView(header)
    }

    override fun onResume() {
        super.onResume()
        ContextCompat.registerReceiver(
            requireContext(),
            receiver,
            IntentFilter("NEW_NOTIFICATION"),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    override fun onPause() {
        super.onPause()
        requireContext().unregisterReceiver(receiver)
    }
}