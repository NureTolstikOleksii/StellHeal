package com.example.healthyhelper.fragments

import AvatarResponse
import UserProfileResponse
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import coil.load
import coil.transform.CircleCropTransformation
import com.example.healthyhelper.R
import com.example.healthyhelper.auth.AuthEvents
import com.example.healthyhelper.network.RetrofitClient
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import android.os.Build
import androidx.annotation.RequiresApi
import com.example.healthyhelper.utils.utcToLocalDate

class ProfileFragment : Fragment() {

    private val avatarLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            uri?.let { uploadAvatarToServer(it) }
        }

    private fun uploadAvatarToServer(uri: Uri) {
        val contentResolver = requireContext().contentResolver
        val inputStream = contentResolver.openInputStream(uri) ?: return
        val bytes = inputStream.readBytes()

        val requestFile = RequestBody.create(
            "image/*".toMediaTypeOrNull(),
            bytes
        )
        val body = MultipartBody.Part.createFormData("avatar", "avatar.jpg", requestFile)

        RetrofitClient.profileApi.uploadAvatar(body)
            .enqueue(object : Callback<AvatarResponse> {
                override fun onResponse(
                    call: Call<AvatarResponse>,
                    response: Response<AvatarResponse>
                ) {
                    if (response.isSuccessful) {
                        val avatarUrl = response.body()?.avatar ?: return

                        view?.findViewById<ImageView>(R.id.imageAvatar)?.load(avatarUrl) {
                            placeholder(R.drawable.ic_default_avatar)
                            error(R.drawable.ic_default_avatar)
                            transformations(CircleCropTransformation())
                            crossfade(true)
                        }

                        Toast.makeText(context, "Фото оновлено", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(context, "Помилка завантаження", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<AvatarResponse>, t: Throwable) {
                    Toast.makeText(context, "Помилка мережі", Toast.LENGTH_SHORT).show()
                }
            })
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_profile, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val progressBar = view.findViewById<ProgressBar>(R.id.progressBar)
        val profileScroll = view.findViewById<ScrollView>(R.id.profileScroll)

        val textFullName = view.findViewById<TextView>(R.id.textFullName)
        val textEmail = view.findViewById<TextView>(R.id.textEmail)
        val textPhone = view.findViewById<TextView>(R.id.textPhone)
        val textBirthDate = view.findViewById<TextView>(R.id.textBirthDate)
        val textAddress = view.findViewById<TextView>(R.id.textAddress)
        val textSpecialization = view.findViewById<TextView>(R.id.textSpecialization)
        val textShift = view.findViewById<TextView>(R.id.textShift)
        val textAdmissionDate = view.findViewById<TextView>(R.id.textAdmissionDate)
        val staffSection = view.findViewById<View>(R.id.staffSection)
        val patientSection = view.findViewById<View>(R.id.patientSection)
        val changePasswordButton = view.findViewById<Button>(R.id.btnChangePassword)
        val logoutButton = view.findViewById<Button>(R.id.btnSignOut)

        view.findViewById<ImageView>(R.id.btnEditAvatar).setOnClickListener {
            avatarLauncher.launch("image/*")
        }

        // Показуємо лоадер, ховаємо контент
        progressBar.visibility = View.VISIBLE
        profileScroll.visibility = View.GONE

        RetrofitClient.profileApi.getProfile()
            .enqueue(object : Callback<UserProfileResponse> {
                @RequiresApi(Build.VERSION_CODES.O)
                override fun onResponse(
                    call: Call<UserProfileResponse>,
                    response: Response<UserProfileResponse>
                ) {
                    // Ховаємо лоадер, показуємо контент
                    progressBar.visibility = View.GONE
                    profileScroll.visibility = View.VISIBLE

                    if (response.isSuccessful) {
                        val user = response.body()
                        user?.let {
                            view.findViewById<ImageView>(R.id.imageAvatar).load(it.avatar) {
                                placeholder(R.drawable.ic_default_avatar)
                                error(R.drawable.ic_default_avatar)
                                transformations(CircleCropTransformation())
                                crossfade(true)
                            }

                            val fullName = "${it.last_name} ${it.first_name} ${it.patronymic.orEmpty()}"
                            textFullName.text = fullName.trim()
                            textEmail.text = it.login
                            textPhone.text = it.phone.orEmpty()
                            textBirthDate.text = utcToLocalDate(it.date_of_birth)

                            if (it.roles.role_name == "staff") {
                                staffSection.visibility = View.VISIBLE
                                patientSection.visibility = View.GONE
                                textSpecialization.text = it.medical_staff?.specialization.orEmpty()
                                textShift.text = it.medical_staff?.shift.orEmpty()
                                textAdmissionDate.text = utcToLocalDate(it.medical_staff?.admission_date)
                            } else if (it.roles.role_name == "patient") {
                                staffSection.visibility = View.GONE
                                patientSection.visibility = View.VISIBLE
                                textAddress.text = it.contact_info.orEmpty()
                            }
                        }
                    } else {
                        Toast.makeText(context, "Не вдалося завантажити профіль", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<UserProfileResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(context, "Помилка з'єднання: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })

        logoutButton.setOnClickListener {
            Toast.makeText(context, "Ви вийшли з акаунту", Toast.LENGTH_SHORT).show()
            val intent = Intent(AuthEvents.ACTION_LOGOUT)
            intent.setPackage(requireContext().packageName)
            requireContext().sendBroadcast(intent)
        }

        changePasswordButton.setOnClickListener {
            ChangePasswordDialogFragment().show(parentFragmentManager, "ChangePasswordDialog")
        }
    }
}