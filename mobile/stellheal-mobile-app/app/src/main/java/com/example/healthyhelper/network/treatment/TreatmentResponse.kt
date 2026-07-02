package com.example.healthyhelper.network.treatment

data class TreatmentResponse(
    val prescriptionId: Int,
    val name:           String?,
    val date:           String?,
    val endDate:        String?,
    val duration:       Int,
    val ward:           String?,
    val doctor:         String?,
    val medications:    List<MedicationItem>
)

data class MedicationItem(
    val name:      String,
    val frequency: String,
    val duration:  Int,
    val quantity:  Int
)