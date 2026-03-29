package com.example.healthyhelper.fragments

import android.app.AlertDialog
import android.app.Dialog
import android.content.Context
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.DialogFragment
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ChangePasswordDialogFragment : DialogFragment() {
    private fun togglePasswordVisibility(editText: EditText, icon: ImageView, visible: Boolean) {
        if (visible) {
            editText.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            icon.setImageResource(R.drawable.ic_eye_on)
        } else {
            editText.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            icon.setImageResource(R.drawable.ic_eye_off)
        }
        editText.setSelection(editText.text.length)
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setBackgroundDrawableResource(R.drawable.dialog_background)
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val builder = AlertDialog.Builder(requireContext())
        val inflater = requireActivity().layoutInflater
        val view = inflater.inflate(R.layout.dialog_change_password, null)

        val editCurrentPassword = view.findViewById<EditText>(R.id.editCurrentPassword)
        val editNewPassword = view.findViewById<EditText>(R.id.editNewPassword)
        val editConfirmPassword = view.findViewById<EditText>(R.id.editConfirmPassword)
        val confirmButton = view.findViewById<Button>(R.id.btnConfirmChange)
        val textError = view.findViewById<TextView>(R.id.textError)

        val toggleCurrent = view.findViewById<ImageView>(R.id.toggleCurrentPassword)
        val toggleNew = view.findViewById<ImageView>(R.id.toggleNewPassword)
        val toggleConfirm = view.findViewById<ImageView>(R.id.toggleConfirmPassword)

        var visibleCurrent = false
        var visibleNew = false
        var visibleConfirm = false

        toggleCurrent.setOnClickListener {
            visibleCurrent = !visibleCurrent
            togglePasswordVisibility(editCurrentPassword, toggleCurrent, visibleCurrent)
        }
        toggleNew.setOnClickListener {
            visibleNew = !visibleNew
            togglePasswordVisibility(editNewPassword, toggleNew, visibleNew)
        }
        toggleConfirm.setOnClickListener {
            visibleConfirm = !visibleConfirm
            togglePasswordVisibility(editConfirmPassword, toggleConfirm, visibleConfirm)
        }

        builder.setView(view)
        val dialog = builder.create()

        confirmButton.setOnClickListener {
            textError.visibility = View.GONE

            val current = editCurrentPassword.text.toString().trim()
            val newPass = editNewPassword.text.toString().trim()
            val confirmPass = editConfirmPassword.text.toString().trim()

            if (current.isEmpty() || newPass.isEmpty() || confirmPass.isEmpty()) {
                textError.text = "Усі поля обов'язкові"
                textError.visibility = View.VISIBLE
                return@setOnClickListener
            }

            if (newPass != confirmPass) {
                textError.text = "Нові паролі не співпадають"
                textError.visibility = View.VISIBLE
                return@setOnClickListener
            }

            val prefs = requireContext().getSharedPreferences("prefs", Context.MODE_PRIVATE)
            val token = prefs.getString("jwt_token", null)

            if (token == null) {
                textError.text = "Користувач не авторизований"
                textError.visibility = View.VISIBLE
                return@setOnClickListener
            }

            val payload = mapOf(
                "currentPassword" to current,
                "newPassword" to newPass
            )

            RetrofitClient.profileApi.changePassword("Bearer $token", payload)
                .enqueue(object : Callback<Void> {
                    override fun onResponse(call: Call<Void>, response: Response<Void>) {
                        if (response.isSuccessful) {
                            Toast.makeText(context, "Пароль змінено успішно", Toast.LENGTH_SHORT).show()
                            dialog.dismiss()
                        } else {
                            val msg = try {
                                val json = JSONObject(response.errorBody()?.string() ?: "")
                                json.getString("message")
                            } catch (e: Exception) {
                                "Помилка при зміні пароля"
                            }
                            textError.text = msg
                            textError.visibility = View.VISIBLE
                        }
                    }

                    override fun onFailure(call: Call<Void>, t: Throwable) {
                        textError.text = "Помилка з'єднання: ${t.message}"
                        textError.visibility = View.VISIBLE
                    }
                })
        }
        return dialog
    }
}
