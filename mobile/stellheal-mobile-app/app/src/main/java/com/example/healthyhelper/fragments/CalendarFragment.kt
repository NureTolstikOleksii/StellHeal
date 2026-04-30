package com.example.healthyhelper.fragments

import android.content.Context
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.calendar.CalendarAdapter
import com.example.healthyhelper.network.calendar.PrescriptionHistoryItem
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class CalendarFragment : Fragment(R.layout.fragment_calendar) {

    private lateinit var recyclerView: RecyclerView

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        recyclerView = view.findViewById(R.id.historyRecyclerView)
        recyclerView.layoutManager = LinearLayoutManager(requireContext())

        loadHistory(view)
    }

    private fun loadHistory(view: View) {

        val emptyText = view.findViewById<TextView>(R.id.emptyText)
        val loader = view.findViewById<ProgressBar>(R.id.loading)

        val patientId = requireContext()
            .getSharedPreferences("prefs", Context.MODE_PRIVATE)
            .getInt("user_id", -1)

        if (patientId == -1) {
            Toast.makeText(requireContext(), "User not found", Toast.LENGTH_SHORT).show()
            return
        }

        // 🔥 показ loader
        loader.visibility = View.VISIBLE
        recyclerView.visibility = View.GONE
        emptyText.visibility = View.GONE

        RetrofitClient.calendarApi
            .getPrescriptionHistory(mapOf("patientId" to patientId))
            .enqueue(object : Callback<List<PrescriptionHistoryItem>> {

                override fun onResponse(
                    call: Call<List<PrescriptionHistoryItem>>,
                    response: Response<List<PrescriptionHistoryItem>>
                ) {

                    loader.visibility = View.GONE

                    if (!response.isSuccessful) {
                        Toast.makeText(requireContext(), "Error loading history", Toast.LENGTH_SHORT).show()
                        return
                    }

                    val items = response.body() ?: emptyList()

                    if (items.isEmpty()) {
                        recyclerView.visibility = View.GONE
                        emptyText.visibility = View.VISIBLE
                        return
                    }

                    recyclerView.visibility = View.VISIBLE
                    emptyText.visibility = View.GONE

                    recyclerView.adapter = CalendarAdapter(items) { selectedItem ->
                        val action = CalendarFragmentDirections
                            .actionCalendarFragmentToTreatmentInfoFragment(selectedItem.prescriptionId)

                        findNavController().navigate(action)
                    }
                }

                override fun onFailure(call: Call<List<PrescriptionHistoryItem>>, t: Throwable) {
                    loader.visibility = View.GONE
                    Toast.makeText(requireContext(), "Connection error", Toast.LENGTH_SHORT).show()
                }
            })
    }
}