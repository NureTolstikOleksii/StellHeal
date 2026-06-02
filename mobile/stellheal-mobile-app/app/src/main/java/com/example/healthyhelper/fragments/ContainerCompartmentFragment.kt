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
import com.example.healthyhelper.network.container.ContainerDetailsResponse
import com.example.healthyhelper.network.container.RfidStatusResponse
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import android.os.Build
import androidx.annotation.RequiresApi
import com.example.healthyhelper.utils.utcToLocalTime
import java.time.ZonedDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class ContainerCompartmentFragment : Fragment() {

    private val args: ContainerCompartmentFragmentArgs by navArgs()
    private var patientId: Int? = null
    private var rfidAuthenticated = false
    private lateinit var progressBar: ProgressBar
    private lateinit var scrollView: ScrollView

    // Глобальні посилання на UI елементи
    private lateinit var compartmentList: LinearLayout
    private lateinit var btnFinishFilling: Button

    private val rfidHandler = Handler(Looper.getMainLooper())
    private lateinit var rfidRunnable: Runnable

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_container_compartment, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val btnBack = view.findViewById<ImageButton>(R.id.btnBack)
        btnFinishFilling = view.findViewById(R.id.btnFinishFilling)
        compartmentList = view.findViewById(R.id.compartmentList)
        progressBar = view.findViewById(R.id.progressBar)
        scrollView = view.findViewById(R.id.scrollView)
        val containerId = args.containerId

        btnBack.setOnClickListener { findNavController().popBackStack() }

        btnFinishFilling.setOnClickListener {
            RetrofitClient.containerApi.resetRfidStatus(containerId)
                .enqueue(object : Callback<Unit> {
                    override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                        if (response.isSuccessful) {
                            rfidAuthenticated = false
                            updateRfidUI(false, containerId)
                            Toast.makeText(requireContext(), "Сесію заповнення успішно завершено", Toast.LENGTH_SHORT).show()
                        }
                    }
                    override fun onFailure(call: Call<Unit>, t: Throwable) {
                        Toast.makeText(requireContext(), "Помилка мережі", Toast.LENGTH_SHORT).show()
                    }
                })
        }

        rfidRunnable = object : Runnable {
            override fun run() {
                checkRfidStatus(containerId)
                rfidHandler.postDelayed(this, 5000)
            }
        }

        loadContainerAndCompartments(containerId)
        rfidHandler.post(rfidRunnable)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        rfidHandler.removeCallbacks(rfidRunnable)
    }

    private fun updateRfidUI(authenticated: Boolean, containerId: Int) {
        val statusBanner = view?.findViewById<TextView>(R.id.rfidStatusBanner)
        val bannerBackground = view?.findViewById<LinearLayout>(R.id.rfidBannerBackground)
        val rfidIcon = view?.findViewById<ImageView>(R.id.rfidIcon)

        if (authenticated) {
            statusBanner?.text = "Доступ відкрито. Органайзер розблоковано для медичного персоналу."
            statusBanner?.setTextColor(0xFFFFFFFF.toInt())

            // Векторна іконка блокування/замка (переходить у стан активного пристрою)
            rfidIcon?.setImageResource(android.R.drawable.ic_lock_idle_lock)
            rfidIcon?.setColorFilter(0xFFFFFFFF.toInt())

            bannerBackground?.setBackgroundColor(0xFF2E7D32.toInt())
            btnFinishFilling.visibility = View.VISIBLE
        } else {
            statusBanner?.text = "Для розблокування барабану прикладіть карту до NFC-мітки смарт-контейнера."
            statusBanner?.setTextColor(0xFF333333.toInt())

            // Інформаційна векторна іконка очікування карти
            rfidIcon?.setImageResource(android.R.drawable.ic_dialog_info)
            rfidIcon?.setColorFilter(0xFFE65100.toInt())

            bannerBackground?.setBackgroundColor(0xFFFFF3E0.toInt())
            btnFinishFilling.visibility = View.GONE
        }

        loadContainerAndCompartments(containerId)
    }

    private fun checkRfidStatus(containerId: Int) {
        RetrofitClient.containerApi.getRfidStatus(containerId)
            .enqueue(object : Callback<RfidStatusResponse> {
                override fun onResponse(
                    call: Call<RfidStatusResponse>,
                    response: Response<RfidStatusResponse>
                ) {
                    val newStatus = response.body()?.rfid_authenticated ?: false
                    if (newStatus != rfidAuthenticated) {
                        rfidAuthenticated = newStatus
                        updateRfidUI(newStatus, containerId)
                    }
                }
                override fun onFailure(call: Call<RfidStatusResponse>, t: Throwable) {}
            })
    }

    private fun loadContainerAndCompartments(containerId: Int) {
        progressBar.visibility = View.VISIBLE
        scrollView.visibility = View.GONE

        RetrofitClient.containerApi.getContainerDetails(containerId)
            .enqueue(object : Callback<ContainerDetailsResponse> {
                @RequiresApi(Build.VERSION_CODES.O)
                override fun onResponse(
                    call: Call<ContainerDetailsResponse>,
                    response: Response<ContainerDetailsResponse>
                ) {
                    progressBar.visibility = View.GONE
                    scrollView.visibility = View.VISIBLE

                    val data = response.body() ?: return

                    view?.findViewById<TextView>(R.id.containerTitle)?.text = "Container №${data.container_number}"
                    view?.findViewById<TextView>(R.id.statusText)?.text = if (data.status.lowercase() == "active") "Status: Active" else "Status: Inactive"

                    val networkText = view?.findViewById<TextView>(R.id.networkText)
                    networkText?.text = if (data.is_online) "Network: Connected" else "Network: Disconnected"
                    networkText?.setTextColor(
                        if (data.is_online) android.graphics.Color.parseColor("#4CAF50") else android.graphics.Color.parseColor("#F44336")
                    )

                    patientId = data.patientId
                    compartmentList.removeAllViews()

                    data.compartments.forEach { item ->
                        val itemView = layoutInflater.inflate(R.layout.item_compartment, compartmentList, false)

                        val number = itemView.findViewById<TextView>(R.id.compartmentTitle)
                        val status = itemView.findViewById<TextView>(R.id.compartmentStatus)
                        val medInfo = itemView.findViewById<TextView>(R.id.medicationInfo)
                        val btnAdd = itemView.findViewById<Button>(R.id.btnAddMed)
                        val btnClear = itemView.findViewById<Button>(R.id.btnClearMed)

                        number.text = "№${item.compartment_number}"

                        if (item.is_filled && item.medication_name != null) {
                            val formattedTime = if (item.intake_at != null) utcToLocalTime(item.intake_at) else "??:??"
                            medInfo.text = "${item.medication_name} (${item.quantity} шт.) — Прийом: $formattedTime"
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

                        // ➕ ДОДАВАННЯ ПРЕПАРАТУ
                        btnAdd.setOnClickListener {
                            val pid = patientId ?: run {
                                Toast.makeText(requireContext(), "Помилка: за даним пристроєм не закріплено пацієнта.", Toast.LENGTH_LONG).show()
                                return@setOnClickListener
                            }

                            android.app.AlertDialog.Builder(requireContext())
                                .setTitle("Підготовка до заповнення відсіку №${item.compartment_number}")
                                .setMessage("1. Барабан смарт-контейнера автоматично прокрутиться до вибраного відсіку.\n\n" +
                                        "2. Після завершення стабілізації механізму відкриється форма призначення ліків.\n\n" +
                                        "Запустити процес повороту каруселі?")
                                .setPositiveButton("Підтвердити") { _, _ ->
                                    RetrofitClient.containerApi.rotateToCompartment(
                                        mapOf("containerId" to containerId, "compartmentNumber" to item.compartment_number)
                                    ).enqueue(object : Callback<Unit> {
                                        override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                                            if (!response.isSuccessful) {
                                                Toast.makeText(requireContext(), "Пристрій зайнятий або не відповідає на команду.", Toast.LENGTH_SHORT).show()
                                                return
                                            }
                                            val dialog = AddMedicationDialogFragment(
                                                patientId = pid,
                                                compartmentNumber = item.compartment_number,
                                                containerId = containerId,
                                                onSuccess = { loadContainerAndCompartments(containerId) }
                                            )
                                            dialog.show(parentFragmentManager, "AddMedDialog")
                                        }
                                        override fun onFailure(call: Call<Unit>, t: Throwable) {
                                            Toast.makeText(requireContext(), "Апаратний збій калібрування пристрою.", Toast.LENGTH_SHORT).show()
                                        }
                                    })
                                }
                                .setNegativeButton("Скасувати", null)
                                .show()
                        }

                        // 🗑 ОЧИЩЕННЯ ВІДСІКУ
                        btnClear.setOnClickListener {
                            android.app.AlertDialog.Builder(requireContext())
                                .setTitle("Скасування призначення відсіку №${item.compartment_number}")
                                .setMessage("Увага! У цій комірці зафіксовано препарат:\n" +
                                        "• Назва: ${item.medication_name}\n" +
                                        "• Кількість: ${item.quantity} шт.\n\n" +
                                        "Для безпечного вилучення система проверне карусель до сервісного вікна видачі. Продовжити?")
                                .setPositiveButton("Прокрутити") { _, _ ->
                                    RetrofitClient.containerApi.rotateToCompartment(
                                        mapOf("containerId" to containerId, "compartmentNumber" to item.compartment_number)
                                    ).enqueue(object : Callback<Unit> {
                                        override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                                            if (!response.isSuccessful) {
                                                Toast.makeText(requireContext(), "Помилка синхронізації з пристроєм.", Toast.LENGTH_SHORT).show()
                                                return
                                            }

                                            android.app.AlertDialog.Builder(requireContext())
                                                .setTitle("Фізичне вилучення ліків")
                                                .setMessage("Будь ласка, дістаньте всі наявні таблетки з віконця органайзера.\n\n" +
                                                        "Переконайтеся, що відсік №${item.compartment_number} повністю порожній, щоб запобігти змішуванню ліків у майбутньому.")
                                                .setPositiveButton("Очищено, відсік порожній") { _, _ ->
                                                    RetrofitClient.containerApi.clearCompartmentWithRotate(
                                                        ClearCompartmentRequest(
                                                            containerId = containerId,
                                                            compartmentId = item.compartment_number,
                                                            compartmentNumber = item.compartment_number
                                                        )
                                                    ).enqueue(object : Callback<Unit> {
                                                        override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                                                            if (response.isSuccessful) {
                                                                Toast.makeText(requireContext(), "Статус відсіку №${item.compartment_number} успішно скинуто", Toast.LENGTH_SHORT).show()
                                                                loadContainerAndCompartments(containerId)
                                                            } else {
                                                                Toast.makeText(requireContext(), "Помилка сервера під час скидання статусу.", Toast.LENGTH_SHORT).show()
                                                            }
                                                        }
                                                        override fun onFailure(call: Call<Unit>, t: Throwable) {
                                                            Toast.makeText(requireContext(), "Помилка мережі: зміни не збережено.", Toast.LENGTH_SHORT).show()
                                                        }
                                                    })
                                                }
                                                .setNegativeButton("Скасувати", null)
                                                .setCancelable(false)
                                                .show()
                                        }
                                        override fun onFailure(call: Call<Unit>, t: Throwable) {
                                            Toast.makeText(requireContext(), "Пристрій не відповідає на запит прокрутки.", Toast.LENGTH_SHORT).show()
                                        }
                                    })
                                }
                                .setNegativeButton("Скасувати", null)
                                .show()
                        }

                        compartmentList.addView(itemView)
                    }
                }

                override fun onFailure(call: Call<ContainerDetailsResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(requireContext(), "Помилка завантаження даних", Toast.LENGTH_SHORT).show()
                }
            })
    }
}