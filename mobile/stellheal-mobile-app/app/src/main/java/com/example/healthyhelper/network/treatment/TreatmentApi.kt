package com.example.healthyhelper.network.treatment

import retrofit2.Call
import retrofit2.http.GET
import retrofit2.http.Path

interface TreatmentApi {
    @GET("patients/{id}/current")
    fun getCurrentTreatment(@Path("id") patientId: Int): Call<List<TreatmentResponse>>
}
