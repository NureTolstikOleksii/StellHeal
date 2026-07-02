package com.example.healthyhelper.fragments

import android.app.Dialog
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.view.Window
import android.widget.*
import androidx.fragment.app.DialogFragment
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.container.PrescriptionOption
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import android.view.ViewGroup
import com.example.healthyhelper.network.container.FillConfirmRequest
import android.os.Build
import android.view.View
import androidx.annotation.RequiresApi
import com.example.healthyhelper.utils.utcToLocalTime

class AddMedicationDialogFragment(
    private val patientId: Int,
    private val compartmentNumber: Int,
    private val containerId: Int,
    private val onSuccess: () -> Unit
) : DialogFragment() {

    private var prescriptionMap = emptyMap<String, Int>()

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = Dialog(requireContext())
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        dialog.setContentView(R.layout.dialog_add_medication)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))

        val spinner = dialog.findViewById<Spinner>(R.id.medicationSpinner)
        val textMedicationHeader = dialog.findViewById<TextView>(R.id.textMedicationHeader)
        val textEmptyState = dialog.findViewById<TextView>(R.id.textEmptyState)
        val btnOk = dialog.findViewById<Button>(R.id.btnOk)
        val btnCancel = dialog.findViewById<Button>(R.id.btnCancel)

        textEmptyState?.visibility = View.GONE

        RetrofitClient.containerApi.getTodaysPrescriptions(patientId)
            .enqueue(object : Callback<List<PrescriptionOption>> {
                @RequiresApi(Build.VERSION_CODES.O)
                override fun onResponse(call: Call<List<PrescriptionOption>>, response: Response<List<PrescriptionOption>>) {
                    val list = response.body() ?: emptyList()

                    if (list.isEmpty()) {
                        spinner.visibility = View.GONE
                        textMedicationHeader.visibility = View.GONE
                        textEmptyState?.text = "У пацієнта немає запланованих призначень ліків на сьогодні."
                        textEmptyState?.visibility = View.VISIBLE
                        btnOk.isEnabled = false
                        btnOk.alpha = 0.5f
                        return
                    }

                    spinner.visibility = View.VISIBLE
                    textMedicationHeader.visibility = View.VISIBLE
                    textEmptyState?.visibility = View.GONE
                    btnOk.isEnabled = true
                    btnOk.alpha = 1.0f

                    val labels = list.map {
                        val time = utcToLocalTime(it.intake_at)
                        "${it.medication} - ${it.quantity} табл. - $time"
                    }

                    prescriptionMap = list.mapIndexed { index, item ->
                        labels[index] to item.prescription_med_id
                    }.toMap()

                    spinner.adapter = ArrayAdapter(
                        requireContext(),
                        android.R.layout.simple_spinner_dropdown_item,
                        labels
                    )
                }
                override fun onFailure(call: Call<List<PrescriptionOption>>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка завантаження призначень", Toast.LENGTH_SHORT).show()
                }
            })

        btnOk.setOnClickListener {
            val selectedLabel = spinner.selectedItem?.toString() ?: return@setOnClickListener
            val prescriptionMedId = prescriptionMap[selectedLabel] ?: return@setOnClickListener

            RetrofitClient.containerApi.fillConfirm(
                FillConfirmRequest(
                    containerId = containerId,
                    compartmentNumber = compartmentNumber,
                    prescription_med_id = prescriptionMedId
                )
            ).enqueue(object : Callback<Unit> {
                override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                    if (response.isSuccessful) {
                        Toast.makeText(requireContext(), "Відсік успішно заповнено", Toast.LENGTH_SHORT).show()
                        dialog.dismiss()
                        onSuccess()
                    } else {
                        Toast.makeText(requireContext(), "Помилка підтвердження заповнення", Toast.LENGTH_SHORT).show()
                    }
                }
                override fun onFailure(call: Call<Unit>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка мережі", Toast.LENGTH_SHORT).show()
                }
            })
        }

        btnCancel.setOnClickListener { dialog.dismiss() }

        return dialog
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            (resources.displayMetrics.widthPixels * 0.90).toInt(),
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
    }
}