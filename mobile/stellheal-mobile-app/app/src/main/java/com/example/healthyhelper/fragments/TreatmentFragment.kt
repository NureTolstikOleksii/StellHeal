package com.example.healthyhelper.fragments

import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import coil.load
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

class TreatmentFragment : Fragment(R.layout.fragment_treatment) {

    private val args: TreatmentFragmentArgs by navArgs()
    private var currentContainer: ContainerResponse? = null

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

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

        btnBack.setOnClickListener {
            findNavController().popBackStack()
        }

        btnViewStatistics.setOnClickListener {
            val action = TreatmentFragmentDirections
                .actionTreatmentFragmentToIntakeFragment(patientId)
            findNavController().navigate(action)
        }

        // 1. Завантаження пацієнта
        RetrofitClient.getPatientsApi().getAllPatients().enqueue(object : Callback<List<PatientResponse>> {
            override fun onResponse(call: Call<List<PatientResponse>>, response: Response<List<PatientResponse>>) {
                val patient = response.body()?.find { it.id == patientId }

                if (patient != null) {
                    avatar.load(patient.avatar) {
                        placeholder(R.drawable.ic_default_avatar)
                        error(R.drawable.ic_default_avatar)
                    }
                    fullName.text = "${patient.name} (${formatDate(patient.dob)})"
                    email.text = patient.email
                    phone.text = patient.phone
                    address.text = patient.address ?: "—"
                }
            }

            override fun onFailure(call: Call<List<PatientResponse>>, t: Throwable) {
                Toast.makeText(requireContext(), "Помилка з'єднання з пацієнтами", Toast.LENGTH_SHORT).show()
            }
        })

        // 2. Завантаження лікування
        RetrofitClient.treatmentApi.getCurrentTreatment(patientId).enqueue(object : Callback<List<TreatmentResponse>> {
            override fun onResponse(call: Call<List<TreatmentResponse>>, response: Response<List<TreatmentResponse>>) {
                if (response.isSuccessful) {
                    val treatment = response.body()?.firstOrNull()
                    if (treatment != null) {
                        diagnosis.text = treatment.name
                        dateRange.text = "Application date: ${treatment.date}\nDuration: ${treatment.duration} days"
                        textDoctor.text = "Doctor: ${treatment.doctor}"
                        textWard.text = "Ward: ${treatment.ward}"
                        medsContainer.removeAllViews()
                        treatment.medications.forEachIndexed { index, med ->
                            val medView = layoutInflater.inflate(R.layout.item_medication, medsContainer, false)
                            medView.findViewById<TextView>(R.id.medName).text = "${index + 1}. $med"
                            medsContainer.addView(medView)
                        }
                    }
                }
            }

            override fun onFailure(call: Call<List<TreatmentResponse>>, t: Throwable) {
                Toast.makeText(requireContext(), "Помилка при отриманні лікування", Toast.LENGTH_SHORT).show()
            }
        })

        // 3. Перевірка: чи пацієнт вже має контейнер
        RetrofitClient.containerApi.getAllContainers().enqueue(object : Callback<List<ContainerResponse>> {
            override fun onResponse(call: Call<List<ContainerResponse>>, response: Response<List<ContainerResponse>>) {
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
            }

            override fun onFailure(call: Call<List<ContainerResponse>>, t: Throwable) {
                Toast.makeText(requireContext(), "Помилка при перевірці контейнера", Toast.LENGTH_SHORT).show()
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
            RetrofitClient.containerApi.unassignContainer(request).enqueue(object : Callback<Unit> {
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
            val action = TreatmentFragmentDirections.actionTreatmentFragmentToContainerCompartmentFragment(containerId)
            findNavController().navigate(action)
        }
    }

    private fun getContainerDetails(containerId: Int) {
        val containerCard = view?.findViewById<LinearLayout>(R.id.containerCard) ?: return
        val containerTitle = view?.findViewById<TextView>(R.id.containerTitle) ?: return
        val containerStatus = view?.findViewById<TextView>(R.id.containerStatus) ?: return
        val containerNetwork = view?.findViewById<TextView>(R.id.containerNetwork) ?: return
        val compartmentsInfo = view?.findViewById<LinearLayout>(R.id.compartmentsInfo) ?: return

        val body = mapOf("containerId" to containerId)
        RetrofitClient.containerApi.getContainerDetails(body).enqueue(object : Callback<ContainerDetailsResponse> {
            override fun onResponse(call: Call<ContainerDetailsResponse>, response: Response<ContainerDetailsResponse>) {
                if (response.isSuccessful) {
                    val data = response.body() ?: return
                    containerCard.visibility = View.VISIBLE
                    containerTitle.text = "Container №${data.container_number}"
                    containerStatus.text = "Status: ${data.status}"
                    containerNetwork.text = if (data.status.lowercase() == "active") "Network: Connected" else "Network: Not connected"
                    compartmentsInfo.removeAllViews()
                    data.compartments.forEach { info ->
                        val textView = TextView(requireContext())
                        textView.text = info
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

    private fun formatDate(input: String?): String {
        return input?.split("T")?.get(0) ?: "—"
    }
}
