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

    @GET("containers/patient/{id}/today")
    fun getTodaysPrescriptions(@Path("id") patientId: Int): Call<List<PrescriptionOption>>

    @GET("containers/patients/{id}/date-range")
    fun getPrescriptionDateRange(@Path("id") patientId: Int): Call<PrescriptionDateRange>

    @GET("containers/patients/{id}/intake")
    fun getIntakeStatistics(
        @Path("id") patientId: Int,
        @Query("date") date: String
    ): Call<List<PrescriptionOption>>

    @GET("containers/all-container-details")
    fun getAllContainerDetails(): Call<List<ContainerWithDetails>>


    // Нові роути для device
    @POST("device/fill/clear")
    fun clearCompartmentWithRotate(@Body body: ClearCompartmentRequest): Call<Unit>


    @GET("device/compartments/{containerId}")
    fun getCompartments(@Path("containerId") containerId: Int): Call<List<CompartmentResponse>>

    @POST("device/fill/rotate")
    fun rotateToCompartment(@Body body: Map<String, Int>): Call<Unit>

    @POST("device/fill/confirm")
    fun fillConfirm(@Body body: FillConfirmRequest): Call<Unit>

    @GET("device/rfid-status/{containerId}")
    fun getRfidStatus(@Path("containerId") containerId: Int): Call<RfidStatusResponse>

    @POST("device/rfid-reset/{containerId}")
    fun resetRfidStatus(@Path("containerId") containerId: Int): Call<Unit>
}