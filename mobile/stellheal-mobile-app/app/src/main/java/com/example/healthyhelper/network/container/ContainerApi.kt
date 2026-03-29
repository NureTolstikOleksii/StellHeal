package com.example.healthyhelper.network.container

import retrofit2.Call
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Body

interface ContainerApi {
    @GET("containers")
    fun getAllContainers(): Call<List<ContainerResponse>>

    @GET("containers/free")
    fun getFreeContainers(): Call<List<ContainerResponse>>

    @POST("containers/assign")
    fun assignContainerToPatient(
        @Body request: AssignContainerRequest
    ): Call<Unit>

    @POST("containers/unassign")
    fun unassignContainer(
        @Body request: AssignContainerRequest
    ): Call<Unit>

    @POST("containers/details")
    fun getContainerDetails(@Body request: Map<String, Int>): Call<ContainerDetailsResponse>

    @POST("containers/compartments/filled")
    fun getFilledCompartments(
        @Body body: Map<String, Int>
    ): Call<List<FilledCompartmentResponse>>

    @POST("/containers/today-prescriptions")
    fun getTodaysPrescriptions(@Body body: Map<String, Int>): Call<List<PrescriptionOption>>

    @POST("/containers/fill-compartment")
    fun addMedicationToCompartment(@Body body: Map<String, Int>): Call<Unit>

    @POST("/containers/compartments/clear")
    fun clearCompartment(@Body body: Map<String, Int>): Call<Map<String, String>>

    @POST("/containers/intake-statistics")
    fun getIntakeStatistics(@Body request: IntakeRequest): Call<List<PrescriptionOption>>

    @POST("/containers/prescription-date-range")
    fun getPrescriptionDateRange(@Body body: Map<String, Int>): Call<PrescriptionDateRange>

    @GET("/containers/all-container-details")
    fun getAllContainerDetails(): Call<List<ContainerWithDetails>>
}
