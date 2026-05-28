package com.example.healthyhelper.fragments

import android.animation.ObjectAnimator
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.core.content.ContextCompat.registerReceiver
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.container.PrescriptionDateRange
import com.example.healthyhelper.network.container.PrescriptionOption
import com.example.healthyhelper.network.notification.NotificationResponse
import com.google.android.material.progressindicator.CircularProgressIndicator
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import android.widget.ProgressBar
import android.widget.ScrollView

class HomeFragment : Fragment(R.layout.fragment_home) {

    private lateinit var calendarContainer: LinearLayout
    private lateinit var intakeList: LinearLayout
    private lateinit var progressText: TextView
    private lateinit var circleProgress: CircularProgressIndicator
    private lateinit var notificationBadge: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var homeScrollView: ScrollView

    private var selectedDate: Date = Date()
    private var allDates: List<Date> = emptyList()

    private val badgeHandler = Handler(Looper.getMainLooper())
    private lateinit var badgeRunnable: Runnable

    private val intakeHandler = Handler(Looper.getMainLooper())
    private lateinit var intakeRunnable: Runnable

    private val notificationReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            loadNotificationBadge()
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        calendarContainer = view.findViewById(R.id.calendarContainer)
        intakeList = view.findViewById(R.id.intakeList)
        progressText = view.findViewById(R.id.progressText)
        circleProgress = view.findViewById(R.id.circleProgress)
        notificationBadge = view.findViewById(R.id.notificationBadge)
        progressBar = view.findViewById(R.id.progressBar)
        homeScrollView = view.findViewById(R.id.homeScrollView)

        // Показуємо лоадер при старті
        progressBar.visibility = View.VISIBLE
        homeScrollView.visibility = View.GONE

        val notificationBtn = view.findViewById<ImageButton>(R.id.notificationBtn)
        notificationBtn.setOnClickListener {
            findNavController().navigate(R.id.action_homeFragment_to_notificationFragment)
        }

        loadDateRangeAndBuildCalendar()

        badgeRunnable = object : Runnable {
            override fun run() {
                loadNotificationBadge()
                badgeHandler.postDelayed(this, 30000)
            }
        }
        badgeHandler.post(badgeRunnable)

        intakeRunnable = object : Runnable {
            override fun run() {
                loadDataForDate(selectedDate)
                intakeHandler.postDelayed(this, 30000)
            }
        }
        intakeHandler.post(intakeRunnable)
    }

    override fun onResume() {
        super.onResume()
        registerReceiver(
            requireContext(),
            notificationReceiver,
            IntentFilter("NEW_NOTIFICATION"),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        loadNotificationBadge()
        loadDataForDate(selectedDate)
    }

    override fun onPause() {
        super.onPause()
        requireContext().unregisterReceiver(notificationReceiver)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        badgeHandler.removeCallbacks(badgeRunnable)
        intakeHandler.removeCallbacks(intakeRunnable)
    }

    // =========================
    // ДАТИ
    // =========================

    private fun loadDateRangeAndBuildCalendar() {
        val patientId = getPatientId()

        RetrofitClient.containerApi
            .getPrescriptionDateRange(patientId)
            .enqueue(object : Callback<PrescriptionDateRange> {
                override fun onResponse(
                    call: Call<PrescriptionDateRange>,
                    response: Response<PrescriptionDateRange>
                ) {
                    if (!response.isSuccessful) {
                        progressBar.visibility = View.GONE
                        return
                    }
                    val range = response.body() ?: return

                    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                    val startDate = sdf.parse(range.minDate)
                    val endDate = sdf.parse(range.maxDate)

                    if (startDate != null && endDate != null) {
                        allDates = getDatesInRange(startDate, endDate)
                        selectedDate = Date()
                        buildCalendarFromDates(allDates)
                        loadDataForDate(selectedDate)
                    }
                }

                override fun onFailure(call: Call<PrescriptionDateRange>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(requireContext(), "Помилка завантаження дат", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun buildCalendarFromDates(dates: List<Date>) {
        val sdf = SimpleDateFormat("d", Locale.getDefault())
        val dowFormat = SimpleDateFormat("EEE", Locale.getDefault())

        calendarContainer.removeAllViews()

        dates.forEach { date ->
            val dayView = layoutInflater.inflate(R.layout.item_calendar_day, calendarContainer, false)

            dayView.findViewById<TextView>(R.id.dayNumber).text = sdf.format(date)
            dayView.findViewById<TextView>(R.id.dayName).text = dowFormat.format(date).uppercase()

            if (isSameDay(date, selectedDate)) {
                dayView.background = ContextCompat.getDrawable(requireContext(), R.drawable.bg_selected_day)
            }

            dayView.setOnClickListener {
                selectedDate = date
                buildCalendarFromDates(dates)
                loadDataForDate(date)
            }

            calendarContainer.addView(dayView)
        }
    }

    // =========================
    // ІНТЕЙКИ
    // =========================

    private fun loadDataForDate(date: Date) {
        val patientId = getPatientId()
        val formatted = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(date)

        RetrofitClient.containerApi
            .getIntakeStatistics(patientId, formatted)
            .enqueue(object : Callback<List<PrescriptionOption>> {
                override fun onResponse(
                    call: Call<List<PrescriptionOption>>,
                    response: Response<List<PrescriptionOption>>
                ) {
                    // Ховаємо лоадер, показуємо контент
                    progressBar.visibility = View.GONE
                    homeScrollView.visibility = View.VISIBLE

                    if (!response.isSuccessful) {
                        Toast.makeText(requireContext(), "Помилка", Toast.LENGTH_SHORT).show()
                        return
                    }
                    renderIntakeList(response.body() ?: emptyList())
                }

                override fun onFailure(call: Call<List<PrescriptionOption>>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    homeScrollView.visibility = View.VISIBLE
                    Toast.makeText(requireContext(), "Connection error", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun renderIntakeList(meds: List<PrescriptionOption>) {
        intakeList.removeAllViews()

        val taken = meds.count { it.isTaken == true }
        val total = meds.size

        progressText.text = "$taken/$total"

        val progressPercent = if (total != 0) (taken * 100 / total) else 0
        ObjectAnimator.ofInt(circleProgress, "progress", circleProgress.progress, progressPercent).apply {
            duration = 500
            start()
        }

        meds.forEach { med ->
            val item = layoutInflater.inflate(R.layout.item_intake, intakeList, false)

            item.findViewById<TextView>(R.id.medName).text = med.medication_name
            item.findViewById<TextView>(R.id.medQuantity).text =
                "${med.quantity} pill${if (med.quantity != 1) "s" else ""}"

            val time = med.intake_time.substringAfter("T", "").take(5)
            item.findViewById<TextView>(R.id.timeText).text = time

            val statusIcon = when (med.isTaken) {
                true -> R.drawable.ic_check_circle
                false -> R.drawable.ic_close_circle
                null -> R.drawable.ic_null_circle
            }
            item.findViewById<ImageView>(R.id.iconStatus).setImageResource(statusIcon)

            intakeList.addView(item)
        }
    }

    // =========================
    // NOTIFICATIONS BADGE
    // =========================

    private fun loadNotificationBadge() {
        RetrofitClient.notificationApi.getUserNotifications()
            .enqueue(object : Callback<List<NotificationResponse>> {
                override fun onResponse(
                    call: Call<List<NotificationResponse>>,
                    response: Response<List<NotificationResponse>>
                ) {
                    if (!response.isSuccessful) return
                    val unreadCount = response.body()?.count { !it.is_read } ?: 0
                    if (unreadCount > 0) {
                        notificationBadge.visibility = View.VISIBLE
                        notificationBadge.text = if (unreadCount > 9) "9+" else unreadCount.toString()
                    } else {
                        notificationBadge.visibility = View.GONE
                    }
                }
                override fun onFailure(call: Call<List<NotificationResponse>>, t: Throwable) {}
            })
    }

    // =========================
    // HELPERS
    // =========================

    private fun getPatientId(): Int {
        return requireContext()
            .getSharedPreferences("prefs", Context.MODE_PRIVATE)
            .getInt("user_id", -1)
    }

    private fun isSameDay(date1: Date, date2: Date): Boolean {
        val fmt = SimpleDateFormat("yyyyMMdd", Locale.getDefault())
        return fmt.format(date1) == fmt.format(date2)
    }

    private fun getDatesInRange(start: Date, end: Date): List<Date> {
        val result = mutableListOf<Date>()
        val cal = Calendar.getInstance()
        cal.time = start
        while (!cal.time.after(end)) {
            result.add(cal.time)
            cal.add(Calendar.DATE, 1)
        }
        return result
    }
}