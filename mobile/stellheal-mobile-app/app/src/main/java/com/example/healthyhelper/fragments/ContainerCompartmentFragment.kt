package com.example.healthyhelper.fragments

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.*
import android.widget.*
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.container.ClearCompartmentRequest
import com.example.healthyhelper.network.container.CompartmentResponse
import com.example.healthyhelper.network.container.ContainerDetailsResponse
import com.example.healthyhelper.network.container.RfidStatusResponse
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ContainerCompartmentFragment : Fragment() {

    private val args: ContainerCompartmentFragmentArgs by navArgs()
    private var patientId: Int? = null
    private var rfidAuthenticated = false
    private lateinit var progressBar: ProgressBar
    private lateinit var scrollView: ScrollView

    private val rfidHandler = Handler(Looper.getMainLooper())
    private lateinit var rfidRunnable: Runnable

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_container_compartment, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val containerTitle = view.findViewById<TextView>(R.id.containerTitle)
        val statusText = view.findViewById<TextView>(R.id.statusText)
        val networkText = view.findViewById<TextView>(R.id.networkText)
        val compartmentList = view.findViewById<LinearLayout>(R.id.compartmentList)
        val btnBack = view.findViewById<ImageButton>(R.id.btnBack)
        val btnFinishFilling = view.findViewById<Button>(R.id.btnFinishFilling)
        progressBar = view.findViewById(R.id.progressBar)
        scrollView = view.findViewById(R.id.scrollView)
        val containerId = args.containerId

        // Показуємо лоадер
        progressBar.visibility = View.VISIBLE
        scrollView.visibility = View.GONE

        btnBack.setOnClickListener { findNavController().popBackStack() }

        btnFinishFilling.setOnClickListener {
            RetrofitClient.containerApi.resetRfidStatus(containerId)
                .enqueue(object : Callback<Unit> {
                    override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                        if (response.isSuccessful) {
                            rfidAuthenticated = false
                            updateRfidUI(false, btnFinishFilling, compartmentList, containerId)
                            Toast.makeText(requireContext(), "Заповнення завершено", Toast.LENGTH_SHORT).show()
                        }
                    }
                    override fun onFailure(call: Call<Unit>, t: Throwable) {
                        Toast.makeText(requireContext(), "Помилка мережі", Toast.LENGTH_SHORT).show()
                    }
                })
        }

        RetrofitClient.containerApi.getContainerDetails(containerId)
            .enqueue(object : Callback<ContainerDetailsResponse> {
                override fun onResponse(
                    call: Call<ContainerDetailsResponse>,
                    response: Response<ContainerDetailsResponse>
                ) {
                    val data = response.body() ?: return
                    containerTitle.text = "Container №${data.container_number}"

                    // Статус активності контейнера
                    statusText.text = if (data.status.lowercase() == "active")
                        "Status: Active" else "Status: Inactive"

                    // Статус мережевого підключення на основі last_seen
                    networkText.text = if (data.is_online)
                        "Network: Connected" else "Network: Disconnected"

                    // Різні кольори для статусів
                    networkText.setTextColor(
                        if (data.is_online)
                            android.graphics.Color.parseColor("#4CAF50")
                        else
                            android.graphics.Color.parseColor("#F44336")
                    )

                    patientId = data.patientId
                }
                override fun onFailure(call: Call<ContainerDetailsResponse>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка завантаження контейнера", Toast.LENGTH_SHORT).show()
                }
            })

        rfidRunnable = object : Runnable {
            override fun run() {
                checkRfidStatus(containerId, compartmentList, btnFinishFilling)
                rfidHandler.postDelayed(this, 5000)
            }
        }

        loadCompartments(containerId, compartmentList)

        rfidHandler.post(rfidRunnable)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        rfidHandler.removeCallbacks(rfidRunnable)
    }

    private fun updateRfidUI(
        authenticated: Boolean,
        btnFinishFilling: Button,
        compartmentList: LinearLayout,
        containerId: Int
    ) {
        val statusBanner = view?.findViewById<TextView>(R.id.rfidStatusBanner)

        if (authenticated) {
            statusBanner?.text = "Картку прикладено — заповнення активне"
            statusBanner?.setBackgroundColor(0xFF4CAF50.toInt())
            btnFinishFilling.visibility = View.VISIBLE
        } else {
            statusBanner?.text = "Прикладіть картку для управління відсіками"
            statusBanner?.setBackgroundColor(0xFFFF9800.toInt())
            btnFinishFilling.visibility = View.GONE
        }

        loadCompartments(containerId, compartmentList)
    }

    private fun checkRfidStatus(
        containerId: Int,
        compartmentList: LinearLayout,
        btnFinishFilling: Button
    ) {
        RetrofitClient.containerApi.getRfidStatus(containerId)
            .enqueue(object : Callback<RfidStatusResponse> {
                override fun onResponse(
                    call: Call<RfidStatusResponse>,
                    response: Response<RfidStatusResponse>
                ) {
                    val newStatus = response.body()?.rfid_authenticated ?: false
                    val statusBanner = view?.findViewById<TextView>(R.id.rfidStatusBanner)

                    if (newStatus != rfidAuthenticated) {
                        rfidAuthenticated = newStatus
                        updateRfidUI(newStatus, btnFinishFilling, compartmentList, containerId)
                    } else {
                        if (newStatus) {
                            statusBanner?.text = "Картку прикладено — заповнення активне"
                            statusBanner?.setBackgroundColor(0xFF4CAF50.toInt())
                        } else {
                            statusBanner?.text = "Прикладіть картку для управління відсіками"
                            statusBanner?.setBackgroundColor(0xFFFF9800.toInt())
                        }
                    }
                }
                override fun onFailure(call: Call<RfidStatusResponse>, t: Throwable) {}
            })
    }

    private fun loadCompartments(containerId: Int, compartmentList: LinearLayout) {
        // Показуємо лоадер при кожному оновленні
        progressBar.visibility = View.VISIBLE
        scrollView.visibility = View.GONE

        RetrofitClient.containerApi.getCompartments(containerId)
            .enqueue(object : Callback<List<CompartmentResponse>> {
                override fun onResponse(
                    call: Call<List<CompartmentResponse>>,
                    response: Response<List<CompartmentResponse>>
                ) {
                    // Ховаємо лоадер
                    progressBar.visibility = View.GONE
                    scrollView.visibility = View.VISIBLE

                    val list = response.body() ?: return
                    compartmentList.removeAllViews()

                    list.forEach { item ->
                        val itemView = layoutInflater.inflate(
                            R.layout.item_compartment, compartmentList, false
                        )

                        val number = itemView.findViewById<TextView>(R.id.compartmentTitle)
                        val status = itemView.findViewById<TextView>(R.id.compartmentStatus)
                        val medInfo = itemView.findViewById<TextView>(R.id.medicationInfo)
                        val btnAdd = itemView.findViewById<Button>(R.id.btnAddMed)
                        val btnClear = itemView.findViewById<Button>(R.id.btnClearMed)

                        number.text = "№${item.compartment_number}"

                        if (item.is_filled && item.medication != null) {
                            medInfo.text = "${item.medication.name} ${item.medication.dosage} - ${item.medication.intake_time ?: "??:??"}"
                            medInfo.visibility = View.VISIBLE
                            status.text = "Заповнено"
                            btnAdd.visibility = View.GONE
                            btnClear.visibility = View.VISIBLE
                        } else {
                            status.text = "Вільний"
                            medInfo.visibility = View.GONE
                            btnAdd.visibility = View.VISIBLE
                            btnClear.visibility = View.GONE
                        }

                        btnAdd.isEnabled = rfidAuthenticated
                        btnAdd.alpha = if (rfidAuthenticated) 1.0f else 0.5f
                        btnClear.isEnabled = rfidAuthenticated
                        btnClear.alpha = if (rfidAuthenticated) 1.0f else 0.5f

                        btnAdd.setOnClickListener {
                            val pid = patientId ?: run {
                                Toast.makeText(requireContext(), "Пацієнт не закріплений", Toast.LENGTH_SHORT).show()
                                return@setOnClickListener
                            }

                            RetrofitClient.containerApi.rotateToCompartment(
                                mapOf(
                                    "containerId" to containerId,
                                    "compartmentNumber" to item.compartment_number
                                )
                            ).enqueue(object : Callback<Unit> {
                                override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                                    if (!response.isSuccessful) {
                                        Toast.makeText(requireContext(), "Помилка команди барабану", Toast.LENGTH_SHORT).show()
                                        return
                                    }
                                    val dialog = AddMedicationDialogFragment(
                                        patientId = pid,
                                        compartmentNumber = item.compartment_number,
                                        containerId = containerId,
                                        onSuccess = { loadCompartments(containerId, compartmentList) }
                                    )
                                    dialog.show(parentFragmentManager, "AddMedDialog")
                                }
                                override fun onFailure(call: Call<Unit>, t: Throwable) {
                                    Toast.makeText(requireContext(), "Барабан не відповідає", Toast.LENGTH_SHORT).show()
                                }
                            })
                        }

                        btnClear.setOnClickListener {
                            android.app.AlertDialog.Builder(requireContext())
                                .setTitle("Очистити відсік №${item.compartment_number}?")
                                .setMessage("Барабан прокрутиться до відсіку. Підтвердіть дію.")
                                .setPositiveButton("Прокрутити") { _, _ ->
                                    RetrofitClient.containerApi.rotateToCompartment(
                                        mapOf(
                                            "containerId" to containerId,
                                            "compartmentNumber" to item.compartment_number
                                        )
                                    ).enqueue(object : Callback<Unit> {
                                        override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                                            if (!response.isSuccessful) {
                                                Toast.makeText(requireContext(), "Помилка команди барабану", Toast.LENGTH_SHORT).show()
                                                return
                                            }
                                            android.app.AlertDialog.Builder(requireContext())
                                                .setTitle("Відсік №${item.compartment_number} готовий")
                                                .setMessage("Дістаньте таблетки та натисніть Готово")
                                                .setPositiveButton("Готово") { _, _ ->
                                                    RetrofitClient.containerApi.clearCompartmentWithRotate(
                                                        ClearCompartmentRequest(
                                                            containerId = containerId,
                                                            compartmentId = item.compartment_id,
                                                            compartmentNumber = item.compartment_number
                                                        )
                                                    ).enqueue(object : Callback<Unit> {
                                                        override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                                                            if (response.isSuccessful) {
                                                                Toast.makeText(requireContext(), "Відсік №${item.compartment_number} очищено", Toast.LENGTH_SHORT).show()
                                                                loadCompartments(containerId, compartmentList)
                                                            } else {
                                                                Toast.makeText(requireContext(), "Помилка при очищенні", Toast.LENGTH_SHORT).show()
                                                            }
                                                        }
                                                        override fun onFailure(call: Call<Unit>, t: Throwable) {
                                                            Toast.makeText(requireContext(), "Помилка мережі", Toast.LENGTH_SHORT).show()
                                                        }
                                                    })
                                                }
                                                .setNegativeButton("Скасувати", null)
                                                .show()
                                        }
                                        override fun onFailure(call: Call<Unit>, t: Throwable) {
                                            Toast.makeText(requireContext(), "Барабан не відповідає", Toast.LENGTH_SHORT).show()
                                        }
                                    })
                                }
                                .setNegativeButton("Скасувати", null)
                                .show()
                        }

                        compartmentList.addView(itemView)
                    }
                }

                override fun onFailure(call: Call<List<CompartmentResponse>>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(requireContext(), "Помилка завантаження відсіків", Toast.LENGTH_SHORT).show()
                }
            })
    }
}