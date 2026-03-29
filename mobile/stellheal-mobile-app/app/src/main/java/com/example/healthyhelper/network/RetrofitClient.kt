package com.example.healthyhelper.network

import com.example.healthyhelper.network.auth.AuthApi
import com.example.healthyhelper.network.calendar.CalendarApi
import com.example.healthyhelper.network.container.ContainerApi
import com.example.healthyhelper.network.notification.NotificationApi
import com.example.healthyhelper.network.patients.PatientsApi
import com.example.healthyhelper.network.profile.ProfileApi
import com.example.healthyhelper.network.treatment.TreatmentApi
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object RetrofitClient {

    private const val BASE_URL = "https://stellhealback.onrender.com"

    private val logging = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val client = OkHttpClient.Builder()
        .addInterceptor(logging)
        .build()

    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .addConverterFactory(GsonConverterFactory.create())
        .client(client)
        .build()

    val authApi: AuthApi by lazy {
        retrofit.create(AuthApi::class.java)
    }

    val profileApi: ProfileApi by lazy {
        retrofit.create(ProfileApi::class.java)
    }

    val treatmentApi: TreatmentApi by lazy {
        retrofit.create(TreatmentApi::class.java)
    }

    val containerApi: ContainerApi by lazy {
        retrofit.create(ContainerApi::class.java)
    }

    val notificationApi: NotificationApi by lazy {
        retrofit.create(NotificationApi::class.java)
    }

    val calendarApi: CalendarApi by lazy {
        retrofit.create(CalendarApi::class.java)
    }

    fun getPatientsApi(): PatientsApi {
        return retrofit.create(PatientsApi::class.java)
    }
}
