package com.example.healthyhelper.fragments

import android.animation.ObjectAnimator
import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.container.PrescriptionOption
import com.example.healthyhelper.network.container.PrescriptionDateRange
import com.google.android.material.progressindicator.CircularProgressIndicator
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.util.*

class IntakeFragment : Fragment() {

    private lateinit var calendarContainer: LinearLayout
    private lateinit var intakeList: LinearLayout
    private lateinit var progressText: TextView
    private lateinit var circleProgress: CircularProgressIndicator

    private val args: IntakeFragmentArgs by navArgs()

    private var selectedDate: Date = Date()
    private var allDates: List<Date> = emptyList()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_intake, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {

        calendarContainer = view.findViewById(R.id.calendarContainer)
        intakeList = view.findViewById(R.id.intakeList)
        progressText = view.findViewById(R.id.progressText)
        circleProgress = view.findViewById(R.id.circleProgress)

        val btnBack = view.findViewById<ImageButton>(R.id.btnBack)

        btnBack.setOnClickListener {
            findNavController().popBackStack()
        }

        loadDateRangeAndBuildCalendar()
    }

    // 🔥 API FIX
    private fun loadDateRangeAndBuildCalendar() {
        val patientId = args.patientId

        RetrofitClient.containerApi
            .getPrescriptionDateRange(patientId)
            .enqueue(object : Callback<PrescriptionDateRange> {

                override fun onResponse(
                    call: Call<PrescriptionDateRange>,
                    response: Response<PrescriptionDateRange>
                ) {
                    if (!response.isSuccessful) {
                        Toast.makeText(requireContext(), "Помилка", Toast.LENGTH_SHORT).show()
                        return
                    }

                    val range = response.body() ?: return

                    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                    val startDate = sdf.parse(range.minDate)
                    val endDate = sdf.parse(range.maxDate)

                    if (startDate != null && endDate != null) {
                        allDates = getDatesInRange(startDate, endDate)
                        buildCalendarFromDates(allDates)

                        // 🔥 важливо
                        loadDataForDate(selectedDate)
                    }
                }

                override fun onFailure(call: Call<PrescriptionDateRange>, t: Throwable) {
                    Toast.makeText(requireContext(), "Connection error", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun buildCalendarFromDates(dates: List<Date>) {
        calendarContainer.removeAllViews()

        val sdf = SimpleDateFormat("d", Locale.getDefault())
        val dowFormat = SimpleDateFormat("EEE", Locale.getDefault())

        dates.forEach { date ->

            val dayView = layoutInflater.inflate(
                R.layout.item_calendar_day,
                calendarContainer,
                false
            )

            dayView.findViewById<TextView>(R.id.dayNumber).text = sdf.format(date)
            dayView.findViewById<TextView>(R.id.dayName).text =
                dowFormat.format(date).uppercase()

            if (isSameDay(date, selectedDate)) {
                dayView.background = ContextCompat.getDrawable(
                    requireContext(),
                    R.drawable.bg_selected_day
                )
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

        val patientId = args.patientId

        val formatted = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            .format(date)

        RetrofitClient.containerApi
            .getIntakeStatistics(patientId, formatted)
            .enqueue(object : Callback<List<PrescriptionOption>> {

                override fun onResponse(
                    call: Call<List<PrescriptionOption>>,
                    response: Response<List<PrescriptionOption>>
                ) {
                    if (!response.isSuccessful) {
                        Toast.makeText(requireContext(), "Помилка", Toast.LENGTH_SHORT).show()
                        return
                    }

                    val list = response.body() ?: emptyList()
                    renderIntakeList(list)
                }

                override fun onFailure(call: Call<List<PrescriptionOption>>, t: Throwable) {
                    Toast.makeText(requireContext(), "Connection error", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun renderIntakeList(meds: List<PrescriptionOption>) {

        intakeList.removeAllViews()

        val taken = meds.count { it.isTaken == true }
        val total = meds.size

        progressText.text = "$taken/$total"

        val percent = if (total != 0) (taken * 100 / total) else 0

        ObjectAnimator.ofInt(circleProgress, "progress", percent).apply {
            duration = 500
            start()
        }

        meds.forEach { med ->

            val item = layoutInflater.inflate(
                R.layout.item_intake,
                intakeList,
                false
            )

            item.findViewById<TextView>(R.id.medName).text = med.medication
            item.findViewById<TextView>(R.id.medQuantity).text =
                "${med.quantity} pill" + if (med.quantity != 1) "s" else ""

            item.findViewById<TextView>(R.id.timeText).text =
                med.intake_time.substringAfter("T").substring(0, 5)

            val statusIcon = when (med.isTaken) {
                true -> R.drawable.ic_check_circle
                false -> R.drawable.ic_close_circle
                null -> R.drawable.ic_null_circle
            }

            item.findViewById<ImageView>(R.id.iconStatus)
                .setImageResource(statusIcon)

            intakeList.addView(item)
        }
    }

    private fun getDatesInRange(start: Date, end: Date): List<Date> {
        val dates = mutableListOf<Date>()
        val calendar = Calendar.getInstance()
        calendar.time = start

        while (!calendar.time.after(end)) {
            dates.add(calendar.time)
            calendar.add(Calendar.DAY_OF_MONTH, 1)
        }

        return dates
    }

    private fun isSameDay(d1: Date, d2: Date): Boolean {
        val fmt = SimpleDateFormat("yyyyMMdd", Locale.getDefault())
        return fmt.format(d1) == fmt.format(d2)
    }
}