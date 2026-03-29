package com.example.healthyhelper.fragments

import android.app.AlertDialog
import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.ImageButton
import android.widget.Toast
import androidx.fragment.app.DialogFragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.container.ContainerResponse
import com.example.healthyhelper.network.container.ContainerAdapter
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ChooseContainerDialogFragment : DialogFragment() {

    private var onContainerSelected: ((ContainerResponse) -> Unit)? = null

    fun setOnContainerSelectedListener(listener: (ContainerResponse) -> Unit) {
        this.onContainerSelected = listener
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_choose_container, null)
        val recyclerView = view.findViewById<RecyclerView>(R.id.containerRecyclerView)
        val btnClose = view.findViewById<ImageButton>(R.id.btnClose)

        val dialog = AlertDialog.Builder(requireContext())
            .setView(view)
            .create()

        btnClose.setOnClickListener { dialog.dismiss() }

        recyclerView.layoutManager = LinearLayoutManager(requireContext())

        RetrofitClient.containerApi.getFreeContainers().enqueue(object : Callback<List<ContainerResponse>> {
            override fun onResponse(call: Call<List<ContainerResponse>>, response: Response<List<ContainerResponse>>) {
                if (response.isSuccessful) {
                    val containers = response.body() ?: emptyList()
                    recyclerView.adapter = ContainerAdapter(containers) { selected ->
                        onContainerSelected?.invoke(selected)
                        dismiss()
                    }
                } else {
                    Toast.makeText(requireContext(), "Не вдалося завантажити контейнер", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<List<ContainerResponse>>, t: Throwable) {
                Toast.makeText(requireContext(), "Помилка: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
        return dialog
    }
}