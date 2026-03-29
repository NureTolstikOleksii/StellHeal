package com.example.healthyhelper.network.container

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import androidx.recyclerview.widget.RecyclerView
import com.example.healthyhelper.R

class ContainerAdapter(
    private val containers: List<ContainerResponse>,
    private val onClick: (ContainerResponse) -> Unit
) : RecyclerView.Adapter<ContainerAdapter.ContainerViewHolder>() {

    inner class ContainerViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val btn: Button = itemView.findViewById(R.id.btnContainer)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ContainerViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_container, parent, false)
        return ContainerViewHolder(view)
    }

    override fun onBindViewHolder(holder: ContainerViewHolder, position: Int) {
        val container = containers[position]
        holder.btn.text = "Container №${container.container_number}"
        holder.btn.setOnClickListener { onClick(container) }
    }

    override fun getItemCount() = containers.size
}
