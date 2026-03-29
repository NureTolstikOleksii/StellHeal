package com.example.healthyhelper.network.container

import com.google.gson.annotations.SerializedName

data class ContainerResponse(
    val container_id: Int,
    val container_number: Int,
    @SerializedName("patient_id")
    val patientId: Int?
)

data class ContainerDetailsResponse(
    val container_number: Int,
    val status: String,
    val compartments: List<String>,
    @SerializedName("patient_id")
    val patientId: Int?
)

data class FilledCompartmentResponse(
    val compartment_id: Int,
    val compartment_number: Int,
    val isFilled: Boolean,
    val fill_time: String?,
    val medication: String?,
    val quantity: Int?,
    val intake_time: String?
)

data class PrescriptionOption(
    val prescription_med_id: Int,
    val medication: String,
    val quantity: Int,
    val intake_time: String,
    val isTaken: Boolean?
)

data class PrescriptionDateRange(
    val minDate: String,
    val maxDate: String
)

data class ContainerWithDetails(
    val container_id: Int,
    val container_number: Int,
    val status: String,
    val compartments: List<String>,
    val patient_id: Int?
)
