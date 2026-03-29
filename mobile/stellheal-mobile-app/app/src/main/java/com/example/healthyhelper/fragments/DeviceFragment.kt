package com.example.healthyhelper.fragments

import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.example.healthyhelper.R
import com.example.healthyhelper.network.RetrofitClient
import com.example.healthyhelper.network.container.ContainerWithDetails
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class DeviceFragment : Fragment(R.layout.fragment_device) {

    private lateinit var devicesContainer: LinearLayout

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        devicesContainer = view.findViewById(R.id.devicesContainer)

        RetrofitClient.containerApi.getAllContainerDetails()
            .enqueue(object : Callback<List<ContainerWithDetails>> {
                override fun onResponse(
                    call: Call<List<ContainerWithDetails>>,
                    response: Response<List<ContainerWithDetails>>
                ) {
                    val containers = response.body() ?: return
                    devicesContainer.removeAllViews()

                    containers.forEach { container ->
                        val card = layoutInflater.inflate(
                            R.layout.item_device_container,
                            devicesContainer,
                            false
                        )

                        card.findViewById<TextView>(R.id.containerTitle).text =
                            "Container №${container.container_number}"
                        card.findViewById<TextView>(R.id.containerStatus).text =
                            "Status: ${container.status}"
                        card.findViewById<TextView>(R.id.containerNetwork).text =
                            if (container.status.lowercase() == "active") "Network: Connected" else "Network: Not connected"

                        val compLayout = card.findViewById<LinearLayout>(R.id.compartmentsInfo)
                        container.compartments.forEach { line ->
                            val text = TextView(requireContext())
                            text.text = line
                            text.setTextColor(
                                ContextCompat.getColor(
                                    requireContext(),
                                    R.color.black
                                )
                            )
                            compLayout.addView(text)
                        }

                        val setupBtn = card.findViewById<Button>(R.id.btnConfigureContainer)
                        setupBtn.setOnClickListener {
                            val action = DeviceFragmentDirections
                                .actionDeviceFragmentToContainerCompartmentFragment(container.container_id)
                            findNavController().navigate(action)
                        }

                        devicesContainer.addView(card)
                    }
                }

                override fun onFailure(call: Call<List<ContainerWithDetails>>, t: Throwable) {
                    Toast.makeText(
                        requireContext(),
                        "Failed to load containers",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

}
