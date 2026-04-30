package com.example.healthyhelper.fragments

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.widget.*
import androidx.annotation.RequiresApi
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.calendar.PrescriptionDetailsRequest
import com.example.healthyhelper.network.calendar.PrescriptionDetailsResponse
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.InputStream

class TreatmentInfoFragment : Fragment(R.layout.fragment_treatment_info) {

    private lateinit var progressBar: ProgressBar
    private lateinit var progressText: TextView

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {

        val btnBack = view.findViewById<ImageButton>(R.id.btnBack)
        val textDiagnosis = view.findViewById<TextView>(R.id.textDiagnosis)
        val textDate = view.findViewById<TextView>(R.id.textDate)
        val textDoctor = view.findViewById<TextView>(R.id.textDoctor)
        val textTotal = view.findViewById<TextView>(R.id.textTotalIntakes)
        val medicationContainer = view.findViewById<LinearLayout>(R.id.medicationContainer)
        val btnPrint = view.findViewById<Button>(R.id.btnPrint)

        // 🔥 ДОДАЙ у layout
        progressBar = view.findViewById(R.id.downloadProgress)
        progressText = view.findViewById(R.id.downloadProgressText)

        val args = TreatmentInfoFragmentArgs.fromBundle(requireArguments())
        val prescriptionId = args.prescriptionId

        btnBack.setOnClickListener {
            findNavController().popBackStack()
        }

        // 🔥 ЗАВАНТАЖЕННЯ ДЕТАЛЕЙ
        RetrofitClient.calendarApi
            .getPrescriptionDetails(PrescriptionDetailsRequest(prescriptionId))
            .enqueue(object : Callback<PrescriptionDetailsResponse> {

                override fun onResponse(
                    call: Call<PrescriptionDetailsResponse>,
                    response: Response<PrescriptionDetailsResponse>
                ) {

                    if (!response.isSuccessful) {
                        Toast.makeText(requireContext(), "Помилка", Toast.LENGTH_SHORT).show()
                        return
                    }

                    val data = response.body() ?: return

                    textDiagnosis.text = data.diagnosis
                    textDate.text = "Дата: ${data.date}"
                    textDoctor.text = "Лікар: ${data.doctor}"
                    textTotal.text = "Прийнято: ${data.total_taken} 💊"

                    medicationContainer.removeAllViews()

                    data.medications.forEachIndexed { index, med ->

                        val item = layoutInflater.inflate(
                            R.layout.item_patient_medication,
                            medicationContainer,
                            false
                        )

                        val medName = item.findViewById<TextView>(R.id.medName)
                        val medDosage = item.findViewById<TextView>(R.id.medDosage)
                        val medDuration = item.findViewById<TextView>(R.id.medDuration)
                        val medTimes = item.findViewById<TextView>(R.id.medTimes)

                        medName.text = "${index + 1}. ${med.name}"
                        medDosage.text = med.frequency
                        medDuration.text = "${med.duration} днів"

                        medTimes.text = med.intake_times.joinToString("\n") {
                            "${it.time} - ${it.quantity} табл."
                        }

                        medicationContainer.addView(item)
                    }
                }

                override fun onFailure(call: Call<PrescriptionDetailsResponse>, t: Throwable) {
                    Toast.makeText(requireContext(), "Connection error", Toast.LENGTH_SHORT).show()
                }
            })

        btnPrint.setOnClickListener {
            downloadReport(prescriptionId)
        }
    }

    // 🔥 ЗАВАНТАЖЕННЯ З ПРОГРЕСОМ
    private fun downloadReport(prescriptionId: Int) {

        progressBar.visibility = View.VISIBLE
        progressText.visibility = View.VISIBLE
        progressBar.progress = 0
        progressText.text = "0%"

        RetrofitClient.calendarApi
            .downloadPrescriptionReport(PrescriptionDetailsRequest(prescriptionId))
            .enqueue(object : Callback<ResponseBody> {

                @RequiresApi(Build.VERSION_CODES.Q)
                override fun onResponse(call: Call<ResponseBody>, response: Response<ResponseBody>) {

                    if (!response.isSuccessful) {
                        Toast.makeText(requireContext(), "Помилка завантаження", Toast.LENGTH_SHORT).show()
                        return
                    }

                    val body = response.body() ?: return

                    val total = response.headers()["Content-Length"]?.toLongOrNull() ?: -1

                    val uri = saveFileWithProgress(body, total, "prescription-report.pdf")

                    progressBar.visibility = View.GONE
                    progressText.visibility = View.GONE

                    if (uri != null) {
                        openPdf(uri)
                    }
                }

                override fun onFailure(call: Call<ResponseBody>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    progressText.visibility = View.GONE
                    Toast.makeText(requireContext(), "Помилка: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    // 🔥 ЗБЕРЕЖЕННЯ З ПРОГРЕСОМ
    @RequiresApi(Build.VERSION_CODES.Q)
    private fun saveFileWithProgress(
        body: ResponseBody,
        total: Long,
        fileName: String
    ): Uri? {

        return try {

            val resolver = requireContext().contentResolver

            val contentValues = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                put(MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS)
            }

            val uri = resolver.insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                contentValues
            ) ?: return null

            val inputStream = body.byteStream()

            resolver.openOutputStream(uri)?.use { output ->

                val buffer = ByteArray(4096)
                var bytesRead: Int
                var downloaded: Long = 0

                while (inputStream.read(buffer).also { bytesRead = it } != -1) {

                    output.write(buffer, 0, bytesRead)
                    downloaded += bytesRead

                    if (total > 0) {
                        val progress = ((downloaded * 100) / total).toInt()

                        activity?.runOnUiThread {
                            progressBar.progress = progress
                            progressText.text = "$progress%"
                        }
                    } else {
                        activity?.runOnUiThread {
                            progressText.text = "Завантаження..."
                        }
                    }
                }
            }

            uri

        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    // 🔥 ВІДКРИТТЯ PDF
    private fun openPdf(uri: Uri) {
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/pdf")
                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(requireContext(), "Немає програми для відкриття PDF", Toast.LENGTH_SHORT).show()
        }
    }
}