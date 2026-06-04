package com.example.healthyhelper.fragments

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.Log
import android.util.Patterns
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
import java.util.TimeZone

class LoginFragment : Fragment() {

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_login, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val backButton    = view.findViewById<ImageButton>(R.id.btnBack)
        val togglePassword = view.findViewById<ImageButton>(R.id.togglePassword)
        val btnLogin      = view.findViewById<Button>(R.id.btnLogin)
        val emailInput    = view.findViewById<EditText>(R.id.emailInput)
        val passwordInput = view.findViewById<EditText>(R.id.passwordInput)
        val emailError    = view.findViewById<TextView>(R.id.emailError)
        val passwordError = view.findViewById<TextView>(R.id.passwordError)
        val controller    = findNavController()

        var isPasswordVisible = false

        emailInput.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) = clearFieldError(emailInput, emailError)
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
        })

        passwordInput.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) = clearFieldError(passwordInput, passwordError)
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
        })

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

            val email    = emailInput.text.toString().trim()
            val password = passwordInput.text.toString().trim()

            var hasError = false

            if (email.isEmpty()) {
                showFieldError(emailInput, emailError, "Введіть email")
                hasError = true
            } else if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                showFieldError(emailInput, emailError, "Некоректний формат email")
                hasError = true
            }

            if (password.isEmpty()) {
                showFieldError(passwordInput, passwordError, "Введіть пароль")
                hasError = true
            } else if (password.length < 6) {
                showFieldError(passwordInput, passwordError, "Пароль має бути не менше 6 символів")
                hasError = true
            }

            if (hasError) return@setOnClickListener

            val loginRequest = LoginRequest(email, password)
            val timezone = TimeZone.getDefault().id

            RetrofitClient.authApi.login(timezone, loginRequest)
                .enqueue(object : Callback<LoginResponse> {

                    override fun onResponse(
                        call: Call<LoginResponse>,
                        response: Response<LoginResponse>
                    ) {
                        if (!response.isSuccessful) {
                            val errorBody = response.errorBody()?.string()
                            val errorMsg  = extractMessage(errorBody)

                            showFieldError(emailInput, emailError, " ")
                            showFieldError(passwordInput, passwordError, errorMsg)
                            return
                        }

                        val body = response.body()

                        val accessToken  = body?.accessToken
                        val refreshToken = body?.refreshToken
                        val role         = body?.user?.role
                        val userId       = body?.user?.id

                        if (accessToken == null || refreshToken == null || role == null || userId == null) {
                            Toast.makeText(context, "Некоректна відповідь сервера", Toast.LENGTH_SHORT).show()
                            return
                        }

                        AuthManager.saveTokens(accessToken, refreshToken)

                        requireContext()
                            .getSharedPreferences("prefs", Context.MODE_PRIVATE)
                            .edit {
                                putInt("user_id", userId)
                                putString("user_role", role)
                            }

                        Log.d("LoginDebug", "Saved user_id = $userId")

                        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                            if (task.isSuccessful) {
                                val fcmToken = task.result
                                Log.d("FCM_TOKEN_LOGIN", fcmToken)
                                MyFirebaseMessagingService.sendTokenToServer(requireContext(), fcmToken)
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

    private fun showFieldError(field: EditText, errorView: TextView, message: String) {
        field.background = requireContext().getDrawable(R.drawable.input_field_background_error)
        if (message.isNotBlank()) {
            errorView.text = message
            errorView.visibility = View.VISIBLE
        }
    }

    private fun clearFieldError(field: EditText, errorView: TextView) {
        field.background = requireContext().getDrawable(R.drawable.input_field_background)
        errorView.visibility = View.GONE
        errorView.text = ""
    }

    private fun extractMessage(errorBody: String?): String {
        return try {
            val json = JSONObject(errorBody ?: "")
            json.getString("message")
        } catch (e: Exception) {
            "Невірний email або пароль"
        }
    }
}