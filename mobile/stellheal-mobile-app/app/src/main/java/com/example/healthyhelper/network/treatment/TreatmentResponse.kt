package com.example.healthyhelper.network.treatment

data class TreatmentResponse(
    val prescriptionId: Int,
    val name: String,
    val date: String,
    val medications: List<String>,
    val ward: String,
    val doctor: String,
    val duration: Int
)
