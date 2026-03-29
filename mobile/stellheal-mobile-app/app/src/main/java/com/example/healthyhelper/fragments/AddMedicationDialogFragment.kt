package com.example.healthyhelper.fragments

import android.app.Dialog
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.view.Window
import android.widget.*
import androidx.fragment.app.DialogFragment
import androidx.navigation.fragment.findNavController
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.container.PrescriptionOption
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import android.content.Context
import android.util.Log
import android.view.ViewGroup

class AddMedicationDialogFragment(
    private val patientId: Int,
    private val compartmentId: Int,
    private val containerId: Int
) : DialogFragment() {

    private var prescriptionMap = emptyMap<String, Int>()

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = Dialog(requireContext())
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        dialog.setContentView(R.layout.dialog_add_medication)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))

        val spinner = dialog.findViewById<Spinner>(R.id.medicationSpinner)
        val btnOk = dialog.findViewById<Button>(R.id.btnOk)
        val btnCancel = dialog.findViewById<Button>(R.id.btnCancel)

        val sharedPref = requireContext().getSharedPreferences("prefs", Context.MODE_PRIVATE)
        val filledBy = sharedPref.getInt("user_id", -1)

        RetrofitClient.containerApi.getTodaysPrescriptions(mapOf("patientId" to patientId))
            .enqueue(object : Callback<List<PrescriptionOption>> {
                override fun onResponse(
                    call: Call<List<PrescriptionOption>>,
                    response: Response<List<PrescriptionOption>>
                ) {
                    val list = response.body() ?: return

                    val labels = list.map {
                        val time = try {
                            it.intake_time.substringAfter("T").substring(0, 5)
                        } catch (e: Exception) {
                            "??:??"
                        }
                        "${it.medication} - ${it.quantity} табл. - $time"
                    }

                    prescriptionMap = list.mapIndexed { index, item ->
                        labels[index] to item.prescription_med_id
                    }.toMap()

                    val adapter = ArrayAdapter(
                        requireContext(),
                        android.R.layout.simple_spinner_dropdown_item,
                        labels
                    )
                    spinner.adapter = adapter
                }

                override fun onFailure(call: Call<List<PrescriptionOption>>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка завантаження призначень", Toast.LENGTH_SHORT).show()
                }
            })

        btnOk.setOnClickListener {
            val selectedLabel = spinner.selectedItem?.toString() ?: return@setOnClickListener
            val prescriptionId = prescriptionMap[selectedLabel] ?: return@setOnClickListener

            if (filledBy == -1) {
                Toast.makeText(requireContext(), "Не знайдено ID користувача", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
                return@setOnClickListener
            }
            Log.d("AddMedDebug", "filledBy = $filledBy")

            RetrofitClient.containerApi.addMedicationToCompartment(
                mapOf(
                    "compartmentId" to compartmentId,
                    "prescription_med_id" to prescriptionId,
                    "filled_by" to filledBy
                )
            ).enqueue(object : Callback<Unit> {
                override fun onResponse(call: Call<Unit>, response: Response<Unit>) {
                    dialog.dismiss()
                    requireParentFragment().findNavController().navigate(
                        R.id.containerCompartmentFragment,
                        Bundle().apply {
                            putInt("containerId", containerId)
                        }
                    )
                }

                override fun onFailure(call: Call<Unit>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка додавання препарату", Toast.LENGTH_SHORT).show()
                }
            })
        }

        btnCancel.setOnClickListener {
            dialog.dismiss()
        }

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
