package com.example.healthyhelper.network.calendar

import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Streaming

interface CalendarApi {
    @POST("/patients/prescription-history")
    fun getPrescriptionHistory(@Body body: Map<String, Int>): Call<List<PrescriptionHistoryItem>>

    @POST("patients/prescription-details")
    fun getPrescriptionDetails(@Body body: PrescriptionDetailsRequest): Call<PrescriptionDetailsResponse>

    @POST("patients/prescription-report")
    @Streaming
    fun downloadPrescriptionReport(@Body body: PrescriptionDetailsRequest): Call<ResponseBody>
}
