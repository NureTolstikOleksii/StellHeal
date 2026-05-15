package com.example.healthyhelper.fragments

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.*
import androidx.appcompat.widget.SearchView
import androidx.core.content.ContextCompat
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
    private lateinit var notificationBadge: TextView
    private var allPatients: List<PatientResponse> = emptyList()

    // Badge автооновлення
    private val badgeHandler = Handler(Looper.getMainLooper())
    private lateinit var badgeRunnable: Runnable

    // BroadcastReceiver для push сповіщень
    private val notificationReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            loadNotificationBadge()
        }
    }

    private lateinit var progressBar: ProgressBar
    private lateinit var recyclerView: RecyclerView

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        recyclerView = view.findViewById(R.id.patientRecyclerView)
        progressBar = view.findViewById(R.id.progressBar)
        val searchView = view.findViewById<SearchView>(R.id.searchView)
        val sortSpinner = view.findViewById<Spinner>(R.id.sortSpinner)
        val notificationBtn = view.findViewById<ImageButton>(R.id.notificationBtn)
        notificationBadge = view.findViewById(R.id.notificationBadge)

        val searchPlate = searchView.findViewById<View>(androidx.appcompat.R.id.search_plate)
        searchPlate?.setBackgroundColor(android.graphics.Color.TRANSPARENT)

        val editText = searchView.findViewById<EditText>(androidx.appcompat.R.id.search_src_text)
        editText.setBackgroundColor(android.graphics.Color.TRANSPARENT)
        editText.background = null

        recyclerView.layoutManager = GridLayoutManager(requireContext(), 2)

        notificationBtn.setOnClickListener {
            findNavController().navigate(R.id.action_homeStaffFragment_to_notificationFragment)
        }

        loadPatients(recyclerView, searchView, sortSpinner)

        badgeRunnable = object : Runnable {
            override fun run() {
                loadNotificationBadge()
                badgeHandler.postDelayed(this, 30000)
            }
        }
        badgeHandler.post(badgeRunnable)
    }

    private fun loadPatients(
        recyclerView: RecyclerView,
        searchView: SearchView,
        sortSpinner: Spinner
    ) {
        // Показуємо лоадер
        progressBar.visibility = View.VISIBLE
        recyclerView.visibility = View.GONE

        RetrofitClient.getPatientsApi().getAllPatients()
            .enqueue(object : Callback<List<PatientResponse>> {
                override fun onResponse(
                    call: Call<List<PatientResponse>>,
                    response: Response<List<PatientResponse>>
                ) {
                    // Ховаємо лоадер, показуємо список
                    progressBar.visibility = View.GONE
                    recyclerView.visibility = View.VISIBLE

                    if (response.isSuccessful) {
                        allPatients = response.body() ?: emptyList()

                        adapter = PatientAdapter(allPatients) { patient ->
                            val action = HomeStaffFragmentDirections
                                .actionHomeStaffFragmentToTreatmentFragment2(patient.id)
                            findNavController().navigate(action)
                        }
                        recyclerView.adapter = adapter

                        searchView.setOnQueryTextListener(object : SearchView.OnQueryTextListener {
                            override fun onQueryTextSubmit(query: String?): Boolean = false
                            override fun onQueryTextChange(newText: String?): Boolean {
                                adapter.filter(newText.orEmpty())
                                return true
                            }
                        })

                        sortSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                            override fun onItemSelected(
                                parent: AdapterView<*>,
                                view: View?,
                                position: Int,
                                id: Long
                            ) {
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
                        Toast.makeText(
                            requireContext(),
                            "Помилка завантаження: ${response.code()}",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<List<PatientResponse>>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(requireContext(), "Помилка з'єднання", Toast.LENGTH_SHORT).show()
                }
            })
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
}