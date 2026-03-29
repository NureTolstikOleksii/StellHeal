package com.example.healthyhelper.network.patients

import retrofit2.Call
import retrofit2.http.GET

interface PatientsApi {
    @GET("patients/staff")
    fun getAllPatients(): Call<List<PatientResponse>>
}
