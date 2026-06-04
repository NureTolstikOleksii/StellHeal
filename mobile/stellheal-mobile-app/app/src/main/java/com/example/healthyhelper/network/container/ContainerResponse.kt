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
    val is_online: Boolean,
    val last_seen: String?,
    val compartments: List<CompartmentDetail>,
    @SerializedName("patient_id")
    val patientId: Int?
)

data class PrescriptionOption(
    val prescription_med_id: Int,
    val medication: String,
    val quantity: Int,
    val intake_at: String,
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
    val is_online: Boolean,
    val patient_id: Int?,
    val compartments: List<CompartmentDetail>
)

data class CompartmentDetail(
    val compartment_number: Int,
    val is_filled: Boolean,
    val medication_name: String?,
    val quantity: Int?,
    val intake_at: String?
)

data class CompartmentResponse(
    val compartment_id: Int,
    val compartment_number: Int,
    val is_filled: Boolean,
    val last_filled_at: String?,
    val medication: CompartmentMedication?
)

data class CompartmentMedication(
    val name: String,
    val dosage: String,
    val intake_at: String?
)

data class FillConfirmRequest(
    val containerId: Int,
    val compartmentNumber: Int,
    val prescription_med_id: Int
)

data class RfidStatusResponse(
    val rfid_authenticated: Boolean
)