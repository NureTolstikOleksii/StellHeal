package com.example.healthyhelper.fragments

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.example.healthyhelper.MainActivity
import com.example.healthyhelper.R
import com.example.healthyhelper.auth.AuthManager
import com.example.healthyhelper.fcm.MyFirebaseMessagingService
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.auth.LoginRequest
import com.example.healthyhelper.network.auth.LoginResponse
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import androidx.core.content.edit

class LoginFragment : Fragment() {

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_login, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val backButton = view.findViewById<ImageButton>(R.id.btnBack)
        val togglePassword = view.findViewById<ImageButton>(R.id.togglePassword)
        val btnLogin = view.findViewById<Button>(R.id.btnLogin)
        val emailInput = view.findViewById<EditText>(R.id.emailInput)
        val passwordInput = view.findViewById<EditText>(R.id.passwordInput)
        val controller = findNavController()

        var isPasswordVisible = false

        togglePassword.setOnClickListener {
            passwordInput.inputType =
                if (isPasswordVisible)
                    InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                else
                    InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD

            togglePassword.setImageResource(
                if (isPasswordVisible) R.drawable.ic_eye_off else R.drawable.ic_eye_on
            )

            isPasswordVisible = !isPasswordVisible
            passwordInput.setSelection(passwordInput.text.length)
        }

        backButton.setOnClickListener {
            controller.navigate(R.id.mainFragment)
        }

        btnLogin.setOnClickListener {

            val email = emailInput.text.toString().trim()
            val password = passwordInput.text.toString().trim()

            if (email.isEmpty() || password.isEmpty()) {
                Toast.makeText(context, "Введіть email і пароль", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val loginRequest = LoginRequest(email, password)

            RetrofitClient.authApi.login(loginRequest)
                .enqueue(object : Callback<LoginResponse> {

                    override fun onResponse(
                        call: Call<LoginResponse>,
                        response: Response<LoginResponse>
                    ) {

                        if (!response.isSuccessful) {
                            val errorBody = response.errorBody()?.string()
                            val errorMsg = extractMessage(errorBody)
                            Toast.makeText(context, errorMsg, Toast.LENGTH_SHORT).show()
                            return
                        }

                        val body = response.body()

                        val accessToken = body?.accessToken
                        val refreshToken = body?.refreshToken
                        val role = body?.user?.role
                        val userId = body?.user?.id

                        if (accessToken == null || refreshToken == null || role == null || userId == null) {
                            Toast.makeText(context, "Некоректна відповідь сервера", Toast.LENGTH_SHORT).show()
                            return
                        }

                        // 🔥 токени
                        AuthManager.saveTokens(accessToken, refreshToken)

                        // 🔥 user data
                        val prefs = requireContext()
                            .getSharedPreferences("prefs", Context.MODE_PRIVATE)

                        prefs.edit {
                            putInt("user_id", userId)
                            putString("user_role", role)
                        }

                        Log.d("LoginDebug", "Saved user_id = $userId")

                        // 🔥 FCM токен
                        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                            if (task.isSuccessful) {
                                val fcmToken = task.result
                                Log.d("FCM_TOKEN_LOGIN", fcmToken)

                                MyFirebaseMessagingService
                                    .sendTokenToServer(requireContext(), fcmToken)
                            }
                        }

                        Toast.makeText(context, "Login successful", Toast.LENGTH_SHORT).show()

                        requireActivity().finish()
                        startActivity(Intent(requireContext(), MainActivity::class.java))
                    }

                    override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                        Toast.makeText(context, "Помилка з'єднання: ${t.message}", Toast.LENGTH_SHORT).show()
                    }
                })
        }
    }

    private fun extractMessage(errorBody: String?): String {
        return try {
            val json = JSONObject(errorBody ?: "")
            json.getString("message")
        } catch (e: Exception) {
            "Login failed"
        }
    }
}
