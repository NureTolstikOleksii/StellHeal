package com.example.healthyhelper.fragments

import android.os.Bundle
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.Patterns
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.fragment.app.DialogFragment
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ChangeEmailDialogFragment : DialogFragment() {

    var onEmailChanged: ((newEmail: String) -> Unit)? = null

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            (resources.displayMetrics.widthPixels * 0.92).toInt(),
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
        dialog?.window?.setBackgroundDrawableResource(android.R.color.transparent)
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.dialog_change_email, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val editEmail    = view.findViewById<EditText>(R.id.editNewEmail)
        val editPassword = view.findViewById<EditText>(R.id.editPasswordConfirm)
        val togglePw     = view.findViewById<ImageView>(R.id.togglePasswordConfirm)

        val errorEmail   = view.findViewById<TextView>(R.id.errorNewEmail)
        val errorPw      = view.findViewById<TextView>(R.id.errorPasswordConfirm)
        val errorServer  = view.findViewById<TextView>(R.id.textError)

        val btnConfirm   = view.findViewById<Button>(R.id.btnConfirmEmailChange)

        var pwVisible = false
        togglePw.setOnClickListener {
            pwVisible = !pwVisible
            editPassword.inputType = if (pwVisible)
                InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            else
                InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            editPassword.setSelection(editPassword.text.length)
            togglePw.setImageResource(
                if (pwVisible) R.drawable.ic_eye_on else R.drawable.ic_eye_off
            )
        }

        editEmail.onTextChanged    { clearError(editEmail,    errorEmail) }
        editPassword.onTextChanged { clearError(editPassword, errorPw) }

        btnConfirm.setOnClickListener {
            errorServer.visibility = View.GONE

            val newEmail = editEmail.text.toString().trim()
            val password = editPassword.text.toString()

            var hasError = false

            if (newEmail.isEmpty()) {
                showError(editEmail, errorEmail, "Введіть новий email")
                hasError = true
            } else if (!Patterns.EMAIL_ADDRESS.matcher(newEmail).matches()) {
                showError(editEmail, errorEmail, "Некоректний формат email")
                hasError = true
            }

            if (password.isEmpty()) {
                showError(editPassword, errorPw, "Введіть поточний пароль")
                hasError = true
            }

            if (hasError) return@setOnClickListener

            btnConfirm.isEnabled = false

            RetrofitClient.profileApi.changeEmail(
                mapOf("currentPassword" to password, "newEmail" to newEmail)
            ).enqueue(object : Callback<Void> {

                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    btnConfirm.isEnabled = true
                    if (response.isSuccessful) {
                        Toast.makeText(context, "Email успішно змінено", Toast.LENGTH_SHORT).show()
                        onEmailChanged?.invoke(newEmail)
                        dismiss()
                    } else {
                        val msg = extractMessage(response.errorBody()?.string())
                        errorServer.text = msg
                        errorServer.visibility = View.VISIBLE
                        // Wrong password → highlight password field
                        if (response.code() == 400) {
                            showError(editPassword, errorPw, " ")
                        }
                        // Email already taken
                        if (response.code() == 409) {
                            showError(editEmail, errorEmail, "Цей email вже зайнятий")
                        }
                    }
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    btnConfirm.isEnabled = true
                    errorServer.text = "Помилка з'єднання: ${t.message}"
                    errorServer.visibility = View.VISIBLE
                }
            })
        }
    }

    private fun showError(field: EditText, errorView: TextView, message: String) {
        field.background = requireContext().getDrawable(R.drawable.input_field_background_error)
        if (message.isNotBlank()) {
            errorView.text = message
            errorView.visibility = View.VISIBLE
        }
    }

    private fun clearError(field: EditText, errorView: TextView) {
        field.background = requireContext().getDrawable(R.drawable.input_field_background)
        errorView.visibility = View.GONE
        errorView.text = ""
    }

    private fun extractMessage(errorBody: String?): String {
        return try {
            JSONObject(errorBody ?: "").getString("message")
        } catch (e: Exception) {
            "Не вдалося змінити email"
        }
    }
}

private fun EditText.onTextChanged(block: (String) -> Unit) {
    addTextChangedListener(object : TextWatcher {
        override fun afterTextChanged(s: Editable?) = block(s.toString())
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
    })
}