package com.example.healthyhelper.fragments

import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ImageButton
import android.widget.Button
import androidx.navigation.fragment.findNavController
import androidx.fragment.app.Fragment
import android.view.View
import android.widget.Toast
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.calendar.PrescriptionDetailsResponse
import com.example.healthyhelper.network.calendar.PrescriptionDetailsRequest
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import android.os.Bundle
import android.util.Log
import okhttp3.ResponseBody
import java.io.*
import android.os.Environment

class TreatmentInfoFragment : Fragment(R.layout.fragment_treatment_info) {

    private fun downloadReport(prescriptionId: Int) {
        val request = PrescriptionDetailsRequest(prescriptionId)

        RetrofitClient.calendarApi.downloadPrescriptionReport(request)
            .enqueue(object : Callback<ResponseBody> {
                override fun onResponse(call: Call<ResponseBody>, response: Response<ResponseBody>) {
                    if (response.isSuccessful) {
                        response.body()?.let { body ->
                            saveFileToDownloads(body.byteStream(), "prescription-report.pdf")
                        }
                    } else {
                        Toast.makeText(requireContext(), "Не вдалося завантажити звіт", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<ResponseBody>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun saveFileToDownloads(inputStream: InputStream, fileName: String) {
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        if (!downloadsDir.exists()) downloadsDir.mkdirs()
        val file = File(downloadsDir, fileName)

        try {
                FileOutputStream(file).use { output ->
                inputStream.copyTo(output)
            }
            Toast.makeText(requireContext(), "Звіт збережено в папку Downloads", Toast.LENGTH_LONG).show()
        } catch (e: IOException) {
            e.printStackTrace()
            Toast.makeText(requireContext(), "Помилка збереження файлу", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val btnBack = view.findViewById<ImageButton>(R.id.btnBack)
        val textDiagnosis = view.findViewById<TextView>(R.id.textDiagnosis)
        val textDate = view.findViewById<TextView>(R.id.textDate)
        val textDoctor = view.findViewById<TextView>(R.id.textDoctor)
        val textTotal = view.findViewById<TextView>(R.id.textTotalIntakes)
        val medicationContainer = view.findViewById<LinearLayout>(R.id.medicationContainer)
        val btnPrint = view.findViewById<Button>(R.id.btnPrint)

        val args = TreatmentInfoFragmentArgs.fromBundle(requireArguments())
        val prescriptionId = args.prescriptionId

        btnBack.setOnClickListener {
            findNavController().popBackStack()
        }
        Log.d("DEBUG", "Sending prescriptionId = $prescriptionId")

        RetrofitClient.calendarApi
            .getPrescriptionDetails(PrescriptionDetailsRequest(prescriptionId))
            .enqueue(object : Callback<PrescriptionDetailsResponse> {
                override fun onResponse(
                    call: Call<PrescriptionDetailsResponse>,
                    response: Response<PrescriptionDetailsResponse>
                ) {
                    val data = response.body() ?: return

                    textDiagnosis.text = data.diagnosis
                    textDate.text = "Application date: ${data.date}"
                    textDoctor.text = "Лікар: ${data.doctor}"
                    textTotal.text = "Всього прийнято: ${data.total_taken} 💊"

                    data.medications.forEachIndexed { index, med ->
                        val item = layoutInflater.inflate(R.layout.item_patient_medication, medicationContainer, false)

                        val medName = item.findViewById<TextView>(R.id.medName)
                        val medDosage = item.findViewById<TextView>(R.id.medDosage)
                        val medDuration = item.findViewById<TextView>(R.id.medDuration)
                        val medTimes = item.findViewById<TextView>(R.id.medTimes)

                        medName.text = "${index + 1}. ${med.name}"
                        medDosage.text = med.frequency
                        medDuration.text = "${med.duration} days"

                        // Форматування списку часів
                        medTimes.text = med.intake_times.joinToString("\n") { "${it.time} - ${it.quantity} табл." }

                        medicationContainer.addView(item)
                    }
                }

                override fun onFailure(call: Call<PrescriptionDetailsResponse>, t: Throwable) {
                    Toast.makeText(requireContext(), "Помилка з'єднання", Toast.LENGTH_SHORT).show()
                }
            })

        btnPrint.setOnClickListener {
            downloadReport(prescriptionId)
        }

    }
}