package com.example.healthyhelper.fragments

import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import coil.load
import coil.transform.CircleCropTransformation
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.container.AssignContainerRequest
import com.example.healthyhelper.network.container.ContainerDetailsResponse
import com.example.healthyhelper.network.container.ContainerResponse
import com.example.healthyhelper.network.patients.PatientResponse
import com.example.healthyhelper.network.treatment.TreatmentResponse
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import android.os.Build
import androidx.annotation.RequiresApi
import com.example.healthyhelper.utils.formatLocalDate
import com.example.healthyhelper.utils.utcToLocalDate
import com.example.healthyhelper.utils.utcToLocalTime

class TreatmentFragment : Fragment(R.layout.fragment_treatment) {

    private val args: TreatmentFragmentArgs by navArgs()
    private var currentContainer: ContainerResponse? = null
    private var loadedRequests = 0
    private val totalRequests = 3

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val progressBar = view.findViewById<ProgressBar>(R.id.progressBar)
        val treatmentScroll = view.findViewById<ScrollView>(R.id.treatmentScroll)

        val avatar = view.findViewById<ImageView>(R.id.imageAvatar)
        val fullName = view.findViewById<TextView>(R.id.textFullName)
        val email = view.findViewById<TextView>(R.id.textEmail)
        val phone = view.findViewById<TextView>(R.id.textPhone)
        val address = view.findViewById<TextView>(R.id.textAddress)
        val diagnosis = view.findViewById<TextView>(R.id.textDiagnosis)
        val dateRange = view.findViewById<TextView>(R.id.textDates)
        val medsContainer = view.findViewById<LinearLayout>(R.id.medicationsContainer)
        val btnAddContainer = view.findViewById<Button>(R.id.btnAddContainer)
        val btnUnassignContainer = view.findViewById<Button>(R.id.btnUnassignContainer)
        val textDoctor = view.findViewById<TextView>(R.id.textDoctor)
        val textWard = view.findViewById<TextView>(R.id.textWard)
        val btnBack = view.findViewById<ImageButton>(R.id.btnBack)
        val containerCard = view.findViewById<LinearLayout>(R.id.containerCard)
        val btnViewStatistics = view.findViewById<Button>(R.id.btnViewStatistics)
        val btnConfigureContainer = view.findViewById<Button>(R.id.btnConfigureContainer)

        val patientId = args.patientId

        progressBar.visibility = View.VISIBLE
        treatmentScroll.visibility = View.GONE
        loadedRequests = 0

        fun onRequestComplete() {
            loadedRequests++
            if (loadedRequests >= totalRequests) {
                progressBar.visibility = View.GONE
                treatmentScroll.visibility = View.VISIBLE
            }
        }

        btnBack.setOnClickListener { findNavController().popBackStack() }

        btnViewStatistics.setOnClickListener {
            val action = TreatmentFragmentDirections
                .actionTreatmentFragmentToIntakeFragment(patientId)
            findNavController().navigate(action)
        }

        // 1. Завантаження пацієнта
        RetrofitClient.getPatientsApi().getAllPatients()
            .enqueue(object : Callback<List<PatientResponse>> {
                @RequiresApi(Build.VERSION_CODES.O)
                override fun onResponse(
                    call: Call<List<PatientResponse>>,
                    response: Response<List<PatientResponse>>
                ) {
                    val patient = response.body()?.find { it.id == patientId }
                    if (patient != null) {
                        val freshAvatar = "${patient.avatar}?t=${System.currentTimeMillis()}"
                        avatar.load(freshAvatar) {
                            placeholder(R.drawable.ic_default_avatar)
                            error(R.drawable.ic_default_avatar)
                            transformations(CircleCropTransformation())
                        }
                        fullName.text = "${patient.name} (${formatLocalDate(patient.dob)})"
                        email.text = patient.email
                        phone.text = patient.phone
                        address.text = patient.address ?: "—"
                    }
                    onRequestComplete()
                }
                override fun onFailure(call: Call<List<PatientResponse>>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка з'єднання з пацієнтами", Toast.LENGTH_SHORT).show()
                    onRequestComplete()
                }
            })

        // 2. Завантаження лікування
        RetrofitClient.treatmentApi.getCurrentTreatment(patientId)
            .enqueue(object : Callback<List<TreatmentResponse>> {
                @RequiresApi(Build.VERSION_CODES.O)
                override fun onResponse(
                    call: Call<List<TreatmentResponse>>,
                    response: Response<List<TreatmentResponse>>
                ) {
                    if (response.isSuccessful) {
                        val treatment = response.body()?.firstOrNull()
                        if (treatment != null) {
                            diagnosis.text = treatment.name
                            dateRange.text = "Дата призначення: ${utcToLocalDate(treatment.date)}\nТривалість: ${treatment.duration} днів"
                            textDoctor.text = "Лікар: ${treatment.doctor}"
                            textWard.text = "Палата: ${treatment.ward}"
                            medsContainer.removeAllViews()
                            treatment.medications.forEachIndexed { index, med ->
                                val medView = layoutInflater.inflate(R.layout.item_medication, medsContainer, false)
                                medView.findViewById<TextView>(R.id.medName).text     = "${index + 1}. ${med.name}"
                                medView.findViewById<TextView>(R.id.medDosage).text   = med.frequency
                                medView.findViewById<TextView>(R.id.medDuration).text = "${med.duration} днів"
                                medsContainer.addView(medView)
                            }
                        }
                    }
                    onRequestComplete()
                }
                override fun onFailure(call: Call<List<TreatmentResponse>>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка при отриманні лікування", Toast.LENGTH_SHORT).show()
                    onRequestComplete()
                }
            })

        // 3. Перевірка контейнера
        RetrofitClient.containerApi.getAllContainers()
            .enqueue(object : Callback<List<ContainerResponse>> {
                override fun onResponse(
                    call: Call<List<ContainerResponse>>,
                    response: Response<List<ContainerResponse>>
                ) {
                    val container = response.body()?.find { it.patientId == patientId }
                    if (container != null) {
                        currentContainer = container
                        btnAddContainer.visibility = View.GONE
                        btnViewStatistics.visibility = View.VISIBLE
                        btnUnassignContainer.visibility = View.VISIBLE
                        getContainerDetails(container.container_id)
                    } else {
                        currentContainer = null
                        btnAddContainer.visibility = View.VISIBLE
                        btnViewStatistics.visibility = View.GONE
                        btnUnassignContainer.visibility = View.GONE
                        containerCard.visibility = View.GONE
                    }
                    onRequestComplete()
                }
                override fun onFailure(call: Call<List<ContainerResponse>>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка при перевірці контейнера", Toast.LENGTH_SHORT).show()
                    onRequestComplete()
                }
            })

        // 4. Закріпити контейнер
        btnAddContainer.setOnClickListener {
            val dialog = ChooseContainerDialogFragment()
            dialog.setOnContainerSelectedListener { selected ->
                val request = AssignContainerRequest(selected.container_id, patientId)
                RetrofitClient.containerApi.assignContainerToPatient(request)
                    .enqueue(object : Callback<Unit> {
                        override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                            if (response.isSuccessful) {
                                Toast.makeText(requireContext(), "Контейнер №${selected.container_number} закріплено", Toast.LENGTH_SHORT).show()
                                currentContainer = selected
                                btnAddContainer.visibility = View.GONE
                                btnViewStatistics.visibility = View.VISIBLE
                                btnUnassignContainer.visibility = View.VISIBLE
                                getContainerDetails(selected.container_id)
                            }
                        }
                        override fun onFailure(call: Call<Unit>, t: Throwable) {
                            Toast.makeText(requireContext(), "Помилка: ${t.message}", Toast.LENGTH_SHORT).show()
                        }
                    })
            }
            dialog.show(parentFragmentManager, "ChooseContainerDialog")
        }

        // 5. Відкріпити контейнер
        btnUnassignContainer.setOnClickListener {
            val current = currentContainer ?: return@setOnClickListener
            val request = AssignContainerRequest(current.container_id, patientId)
            RetrofitClient.containerApi.unassignContainer(request)
                .enqueue(object : Callback<Unit> {
                    override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                        if (response.isSuccessful) {
                            Toast.makeText(requireContext(), "Контейнер відкріплено", Toast.LENGTH_SHORT).show()
                            currentContainer = null
                            btnAddContainer.visibility = View.VISIBLE
                            btnViewStatistics.visibility = View.GONE
                            btnUnassignContainer.visibility = View.GONE
                            containerCard.visibility = View.GONE
                        }
                    }
                    override fun onFailure(call: Call<Unit>, t: Throwable) {
                        Toast.makeText(requireContext(), "Помилка: ${t.message}", Toast.LENGTH_SHORT).show()
                    }
                })
        }

        btnConfigureContainer.setOnClickListener {
            val containerId = currentContainer?.container_id ?: return@setOnClickListener
            val action = TreatmentFragmentDirections
                .actionTreatmentFragmentToContainerCompartmentFragment(containerId)
            findNavController().navigate(action)
        }
    }

    private fun getContainerDetails(containerId: Int) {
        val containerCard = view?.findViewById<LinearLayout>(R.id.containerCard) ?: return
        val containerTitle = view?.findViewById<TextView>(R.id.containerTitle) ?: return
        val containerStatus = view?.findViewById<TextView>(R.id.containerStatus) ?: return
        val containerNetwork = view?.findViewById<TextView>(R.id.containerNetwork) ?: return
        val compartmentsInfo = view?.findViewById<LinearLayout>(R.id.compartmentsInfo) ?: return

        RetrofitClient.containerApi.getContainerDetails(containerId)
            .enqueue(object : Callback<ContainerDetailsResponse> {
                @RequiresApi(Build.VERSION_CODES.O)
                override fun onResponse(
                    call: Call<ContainerDetailsResponse>,
                    response: Response<ContainerDetailsResponse>
                ) {
                    if (response.isSuccessful) {
                        val data = response.body() ?: return

                        containerCard.visibility = View.VISIBLE
                        containerTitle.text = "Контейнер №${data.container_number}"
                        containerStatus.text = if (data.status.lowercase() == "active")
                            "Статус: Активний" else "Статус: Неактивний"
                        containerNetwork.text = if (data.is_online)
                            "Мережа: Підключено" else "Мережа: Відключено"
                        containerNetwork.setTextColor(
                            if (data.is_online)
                                android.graphics.Color.parseColor("#4CAF50")
                            else
                                android.graphics.Color.parseColor("#F44336")
                        )
                        compartmentsInfo.removeAllViews()

                        data.compartments.forEach { comp ->
                            val textView = TextView(requireContext())
                            val displayText = java.lang.StringBuilder().apply {
                                append("Відсік ${comp.compartment_number}: ")
                                if (comp.is_filled && comp.medication_name != null) {
                                    append("${comp.medication_name} (${comp.quantity} шт.)")
                                    if (comp.intake_at != null) {
                                        val localTime = utcToLocalTime(comp.intake_at)
                                        append(" - Прийом: $localTime")
                                    }
                                } else {
                                    append("Порожньо")
                                }
                            }.toString()

                            textView.text = displayText
                            textView.setTextColor(resources.getColor(R.color.black, null))
                            textView.setPadding(0, 4, 0, 4)
                            compartmentsInfo.addView(textView)
                        }
                    }
                }
                override fun onFailure(call: Call<ContainerDetailsResponse>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка при завантаженні контейнера", Toast.LENGTH_SHORT).show()
                }
            })
    }
}