package com.example.healthyhelper.fragments

import android.os.Bundle
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
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

class ChangePasswordDialogFragment : DialogFragment() {

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
    ): View = inflater.inflate(R.layout.dialog_change_password, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val editCurrent  = view.findViewById<EditText>(R.id.editCurrentPassword)
        val editNew      = view.findViewById<EditText>(R.id.editNewPassword)
        val editConfirm  = view.findViewById<EditText>(R.id.editConfirmPassword)

        val errorCurrent = view.findViewById<TextView>(R.id.errorCurrentPassword)
        val errorNew     = view.findViewById<TextView>(R.id.errorNewPassword)
        val errorConfirm = view.findViewById<TextView>(R.id.errorConfirmPassword)
        val errorServer  = view.findViewById<TextView>(R.id.textError)

        val strengthBar   = view.findViewById<ProgressBar>(R.id.passwordStrengthBar)
        val strengthLabel = view.findViewById<TextView>(R.id.textStrengthLabel)
        val btnConfirm    = view.findViewById<Button>(R.id.btnConfirmChange)

        setupToggle(view, R.id.toggleCurrentPassword, editCurrent)
        setupToggle(view, R.id.toggleNewPassword,     editNew)
        setupToggle(view, R.id.toggleConfirmPassword, editConfirm)

        editCurrent.onTextChanged { clearError(editCurrent, errorCurrent) }
        editConfirm.onTextChanged { clearError(editConfirm, errorConfirm) }

        editNew.onTextChanged { text ->
            clearError(editNew, errorNew)
            val score = passwordStrength(text)
            if (text.isEmpty()) {
                strengthBar.visibility = View.GONE
                strengthLabel.visibility = View.GONE
            } else {
                strengthBar.visibility = View.VISIBLE
                strengthBar.progress = score

                val (label, color) = when (score) {
                    1    -> "Слабкий"   to "#EF5350"
                    2    -> "Середній"  to "#FF9800"
                    3    -> "Добрий"    to "#FFC107"
                    else -> "Надійний"  to "#4CAF50"
                }
                strengthLabel.text = label
                strengthLabel.setTextColor(android.graphics.Color.parseColor(color))
                strengthLabel.visibility = View.VISIBLE

                (strengthBar.progressDrawable as? android.graphics.drawable.LayerDrawable)
                    ?.findDrawableByLayerId(android.R.id.progress)
                    ?.setColorFilter(
                        android.graphics.Color.parseColor(color),
                        android.graphics.PorterDuff.Mode.SRC_IN
                    )
            }
        }

        btnConfirm.setOnClickListener {
            errorServer.visibility = View.GONE

            val current  = editCurrent.text.toString()
            val newPass  = editNew.text.toString()
            val confirm  = editConfirm.text.toString()

            var hasError = false

            if (current.isEmpty()) {
                showError(editCurrent, errorCurrent, "Введіть поточний пароль")
                hasError = true
            }

            if (newPass.isEmpty()) {
                showError(editNew, errorNew, "Введіть новий пароль")
                hasError = true
            } else if (newPass.length < 8) {
                showError(editNew, errorNew, "Мінімум 8 символів")
                hasError = true
            } else if (passwordStrength(newPass) < 2) {
                showError(editNew, errorNew, "Пароль занадто простий — додайте цифри або символи")
                hasError = true
            }

            if (confirm.isEmpty()) {
                showError(editConfirm, errorConfirm, "Повторіть новий пароль")
                hasError = true
            } else if (newPass != confirm) {
                showError(editConfirm, errorConfirm, "Паролі не співпадають")
                hasError = true
            }

            if (hasError) return@setOnClickListener

            btnConfirm.isEnabled = false

            RetrofitClient.profileApi.changePassword(
                mapOf("currentPassword" to current, "newPassword" to newPass)
            ).enqueue(object : Callback<Void> {

                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    btnConfirm.isEnabled = true
                    if (response.isSuccessful) {
                        Toast.makeText(context, "Пароль успішно змінено", Toast.LENGTH_SHORT).show()
                        dismiss()
                    } else {
                        val msg = extractMessage(response.errorBody()?.string())
                        errorServer.text = msg
                        errorServer.visibility = View.VISIBLE

                        if (response.code() == 400) {
                            showError(editCurrent, errorCurrent, " ")
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

    private fun setupToggle(view: View, toggleId: Int, field: EditText) {
        var visible = false
        view.findViewById<ImageView>(toggleId).setOnClickListener {
            visible = !visible
            field.inputType = if (visible)
                InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            else
                InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            field.setSelection(field.text.length)
            (it as ImageView).setImageResource(
                if (visible) R.drawable.ic_eye_on else R.drawable.ic_eye_off
            )
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

    private fun passwordStrength(password: String): Int {
        if (password.length < 6) return 0
        var score = 1
        if (password.any { it.isUpperCase() }) score++
        if (password.any { it.isDigit() })     score++
        if (password.any { !it.isLetterOrDigit() }) score++
        return score
    }

    private fun extractMessage(errorBody: String?): String {
        return try {
            JSONObject(errorBody ?: "").getString("message")
        } catch (e: Exception) {
            "Не вдалося змінити пароль"
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