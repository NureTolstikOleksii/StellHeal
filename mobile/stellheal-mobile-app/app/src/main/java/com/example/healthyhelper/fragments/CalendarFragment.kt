package com.example.healthyhelper.fragments

import android.content.Context
import android.os.Bundle
import android.util.Log
import android.view.View
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

        val patientId = requireContext()
            .getSharedPreferences("prefs", Context.MODE_PRIVATE)
            .getInt("user_id", -1)

        if (patientId == -1) {
            Toast.makeText(requireContext(), "User not found", Toast.LENGTH_SHORT).show()
            return
        }

        RetrofitClient.calendarApi.getPrescriptionHistory(mapOf("patientId" to patientId))
            .enqueue(object : Callback<List<PrescriptionHistoryItem>> {
                override fun onResponse(
                    call: Call<List<PrescriptionHistoryItem>>,
                    response: Response<List<PrescriptionHistoryItem>>
                ) {
                    if (response.isSuccessful) {
                        val items = response.body() ?: emptyList()

                        recyclerView.adapter = CalendarAdapter(items) { selectedItem ->
                            val action = CalendarFragmentDirections
                                .actionCalendarFragmentToTreatmentInfoFragment(selectedItem.prescriptionId)
                            findNavController().navigate(action)
                            Log.d("DEBUG", "Navigating with prescriptionId = ${selectedItem.prescriptionId}")
                        }
                    } else {
                        Toast.makeText(requireContext(), "Error loading history", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<List<PrescriptionHistoryItem>>, t: Throwable) {
                    Toast.makeText(requireContext(), "Connection error", Toast.LENGTH_SHORT).show()
                }
            })
    }
}
