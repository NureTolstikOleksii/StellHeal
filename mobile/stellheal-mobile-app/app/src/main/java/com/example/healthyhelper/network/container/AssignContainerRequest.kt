package com.example.healthyhelper.network.container

data class AssignContainerRequest(
    val containerId: Int,
    val patientId: Int
)

data class IntakeRequest(
    val patientId: Int,
    val date: String
)

data class ClearCompartmentRequest(
    val containerId: Int,
    val compartmentId: Int,
    val compartmentNumber: Int
)