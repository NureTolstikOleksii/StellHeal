package com.example.healthyhelper.network.patients

data class PatientResponse(
    val id: Int,
    val name: String,
    val email: String,
    val phone: String?,
    val address: String?,
    val dob: String?,
    val avatar: String?,
    val ward: String?
)
