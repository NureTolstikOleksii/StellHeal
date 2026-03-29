package com.example.healthyhelper.fragments

import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.widget.SearchView
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.notification.NotificationResponse
import com.example.healthyhelper.network.patients.PatientAdapter
import com.example.healthyhelper.network.patients.PatientResponse
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class HomeStaffFragment : Fragment(R.layout.fragment_home_staff) {

    private lateinit var adapter: PatientAdapter
    private var allPatients: List<PatientResponse> = emptyList()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val recyclerView = view.findViewById<RecyclerView>(R.id.patientRecyclerView)
        val searchView = view.findViewById<SearchView>(R.id.searchView)

        val searchPlate = searchView.findViewById<View>(androidx.appcompat.R.id.search_plate)
        searchPlate?.setBackgroundColor(android.graphics.Color.TRANSPARENT)

        val editText = searchView.findViewById<EditText>(androidx.appcompat.R.id.search_src_text)
        editText.setBackgroundColor(android.graphics.Color.TRANSPARENT)
        editText.background = null


        val sortSpinner = view.findViewById<Spinner>(R.id.sortSpinner)
        val notificationBtn = view.findViewById<ImageButton>(R.id.notificationBtn)
        val notificationBadge = view.findViewById<View>(R.id.notificationBadge)

        recyclerView.layoutManager = GridLayoutManager(requireContext(), 2)

        // Перехід на фрагмент сповіщень
        notificationBtn.setOnClickListener {
            findNavController().navigate(R.id.action_homeStaffFragment_to_notificationFragment)
        }

        // Перевірка наявності нових сповіщень
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

                    override fun onFailure(call: Call<List<NotificationResponse>>, t: Throwable) { }
                })
        }

        RetrofitClient.getPatientsApi().getAllPatients()
            .enqueue(object : Callback<List<PatientResponse>> {
                override fun onResponse(
                    call: Call<List<PatientResponse>>,
                    response: Response<List<PatientResponse>>
                ) {
                    if (response.isSuccessful) {
                        allPatients = response.body() ?: emptyList()

                        adapter = PatientAdapter(allPatients) { patient ->
                            val action = HomeStaffFragmentDirections
                                .actionHomeStaffFragmentToTreatmentFragment2(patient.id)
                            findNavController().navigate(action)
                        }
                        recyclerView.adapter = adapter

                        // Пошук
                        searchView.setOnQueryTextListener(object : SearchView.OnQueryTextListener {
                            override fun onQueryTextSubmit(query: String?): Boolean = false
                            override fun onQueryTextChange(newText: String?): Boolean {
                                adapter.filter(newText.orEmpty())
                                return true
                            }
                        })

                        // Сортування
                        sortSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                            override fun onItemSelected(parent: AdapterView<*>, view: View?, position: Int, id: Long) {
                                val sortedList = when (position) {
                                    0 -> allPatients.sortedBy { it.name }
                                    1 -> allPatients.sortedBy { it.dob }
                                    else -> allPatients
                                }
                                adapter.updateList(sortedList)
                            }

                            override fun onNothingSelected(parent: AdapterView<*>) {}
                        }

                    } else {
                        Toast.makeText(requireContext(), "Помилка завантаження: ${response.code()}", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<List<PatientResponse>>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка з'єднання", Toast.LENGTH_SHORT).show()
                }
            })
    }
}