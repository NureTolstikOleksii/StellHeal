package com.example.healthyhelper.network.container

import retrofit2.Call
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Body
import retrofit2.http.Path
import retrofit2.http.Query

interface ContainerApi {

    @GET("containers")
    fun getAllContainers(): Call<List<ContainerResponse>>

    @GET("containers/free")
    fun getFreeContainers(): Call<List<ContainerResponse>>

    @POST("containers/assign")
    fun assignContainerToPatient(@Body request: AssignContainerRequest): Call<Unit>

    @POST("containers/unassign")
    fun unassignContainer(@Body request: AssignContainerRequest): Call<Unit>

    @GET("containers/{id}")
    fun getContainerDetails(@Path("id") containerId: Int): Call<ContainerDetailsResponse>

    @GET("containers/{id}/compartments")
    fun getFilledCompartments(@Path("id") containerId: Int): Call<List<FilledCompartmentResponse>>

    @GET("containers/patient/{id}/today")
    fun getTodaysPrescriptions(@Path("id") patientId: Int): Call<List<PrescriptionOption>>

    @POST("containers/compartments/fill")
    fun addMedicationToCompartment(@Body body: Map<String, Int>): Call<Unit>

    @POST("containers/compartments/clear")
    fun clearCompartment(@Body body: Map<String, Int>): Call<Map<String, String>>

    @GET("containers/patients/{id}/date-range")
    fun getPrescriptionDateRange(@Path("id") patientId: Int): Call<PrescriptionDateRange>

    @GET("containers/patients/{id}/intake")
    fun getIntakeStatistics(
        @Path("id") patientId: Int,
        @Query("date") date: String
    ): Call<List<PrescriptionOption>>

    @GET("containers/all-container-details")
    fun getAllContainerDetails(): Call<List<ContainerWithDetails>>
}