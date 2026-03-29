package com.example.healthyhelper.network.calendar

data class PrescriptionHistoryItem(
    val prescriptionId: Int,
    val diagnosis: String,
    val date: String
)

data class PrescriptionDetailsResponse(
    val diagnosis: String,
    val date: String,
    val doctor: String,
    val total_taken: Int,
    val medications: List<MedicationDetail>
)

data class MedicationDetail(
    val name: String,
    val frequency: String,
    val duration: Int,
    val intake_times: List<IntakeTime>
)

data class IntakeTime(
    val time: String,
    val quantity: Int
)
