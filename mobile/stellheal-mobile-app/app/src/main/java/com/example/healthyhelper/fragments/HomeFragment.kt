package com.example.healthyhelper.fragments

import android.animation.ObjectAnimator
import android.content.Context
import android.os.Bundle
import androidx.fragment.app.Fragment
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.navigation.fragment.findNavController
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.container.IntakeRequest
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
import android.util.Log

class HomeFragment : Fragment(R.layout.fragment_home) {
    private lateinit var calendarContainer: LinearLayout
    private lateinit var intakeList: LinearLayout
    private lateinit var progressText: TextView
    private lateinit var circleProgress: CircularProgressIndicator

    private var selectedDate: Date = Date()
    private var allDates: List<Date> = emptyList()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        calendarContainer = view.findViewById(R.id.calendarContainer)
        intakeList = view.findViewById(R.id.intakeList)
        progressText = view.findViewById(R.id.progressText)
        circleProgress = view.findViewById(R.id.circleProgress)
        val notificationBtn = view.findViewById<ImageButton>(R.id.notificationBtn)
        val notificationBadge = view.findViewById<View>(R.id.notificationBadge)

        notificationBtn.setOnClickListener {
            findNavController().navigate(R.id.action_homeFragment_to_notificationFragment)
        }

        loadDateRangeAndBuildCalendar()
        loadDataForDate(selectedDate)

        val prefs = requireContext().getSharedPreferences("prefs", Context.MODE_PRIVATE)
        val userId = prefs.getInt("user_id", -1)
        if (userId != -1) {
            RetrofitClient.notificationApi.getUserNotifications(mapOf("userId" to userId))
                .enqueue(object : Callback<List<NotificationResponse>> {
                    override fun onResponse(
                        call: Call<List<NotificationResponse>>,
                        response: Response<List<NotificationResponse>>
                    ) {
                        if (response.isSuccessful) {
                            val hasUnread = response.body()?.any { !it.is_read } == true
                            notificationBadge.visibility = if (hasUnread) View.VISIBLE else View.GONE
                        }
                    }

                    override fun onFailure(call: Call<List<NotificationResponse>>, t: Throwable) {
                    }
                })
        }
    }

    private fun loadDateRangeAndBuildCalendar() {
        val patientId = getPatientId()
        RetrofitClient.containerApi.getPrescriptionDateRange(mapOf("patientId" to patientId))
            .enqueue(object : Callback<PrescriptionDateRange> {
                override fun onResponse(
                    call: Call<PrescriptionDateRange>,
                    response: Response<PrescriptionDateRange>
                ) {
                    val range = response.body() ?: return
                    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                    val startDate = sdf.parse(range.minDate)
                    val endDate = sdf.parse(range.maxDate)
                    if (startDate != null && endDate != null) {
                        allDates = getDatesInRange(startDate, endDate)
                        buildCalendarFromDates(allDates)
                    }
                }

                override fun onFailure(call: Call<PrescriptionDateRange>, t: Throwable) {}
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

    private fun loadDataForDate(date: Date) {
        val patientId = getPatientId()
        val formatted = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(date)
        RetrofitClient.containerApi.getIntakeStatistics(IntakeRequest(patientId, formatted))
            .enqueue(object : Callback<List<PrescriptionOption>> {
                override fun onResponse(
                    call: Call<List<PrescriptionOption>>,
                    response: Response<List<PrescriptionOption>>
                ) {
                    val list = response.body() ?: emptyList()
                    renderIntakeList(list)
                }

                override fun onFailure(call: Call<List<PrescriptionOption>>, t: Throwable) {}
            })
    }

    private fun renderIntakeList(meds: List<PrescriptionOption>) {
        intakeList.removeAllViews()

        val taken = meds.count { it.isTaken == true }
        val total = meds.size

        progressText.text = "$taken/$total"

        val progressPercent = if (total != 0) (taken * 100 / total) else 0
        val animator = ObjectAnimator.ofInt(circleProgress, "progress", circleProgress.progress, progressPercent)
        animator.duration = 500
        animator.start()

        meds.forEach { med ->
            val item = layoutInflater.inflate(R.layout.item_intake, intakeList, false)

            item.findViewById<TextView>(R.id.medName).text = med.medication
            item.findViewById<TextView>(R.id.medQuantity).text = "${med.quantity} pill" + if (med.quantity != 1) "s" else ""
            item.findViewById<TextView>(R.id.timeText).text = med.intake_time.substringAfter("T").substring(0, 5)
            Log.d("DEBUG", "isTaken = ${med.isTaken} (${med.medication})")
            val statusIcon = when (med.isTaken) {
                true -> R.drawable.ic_check_circle
                false -> R.drawable.ic_close_circle
                null -> R.drawable.ic_null_circle
            }

            item.findViewById<ImageView>(R.id.iconStatus).setImageResource(statusIcon)
            intakeList.addView(item)
        }
    }

    private fun getPatientId(): Int {
        return requireContext().getSharedPreferences("prefs", Context.MODE_PRIVATE).getInt("user_id", -1)
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
