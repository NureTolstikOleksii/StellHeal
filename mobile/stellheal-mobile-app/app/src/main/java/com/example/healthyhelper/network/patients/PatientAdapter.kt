package com.example.healthyhelper.network.patients

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.example.healthyhelper.R

class PatientAdapter(
    private val originalList: List<PatientResponse>,
    private val onDetailClick: (PatientResponse) -> Unit
) : RecyclerView.Adapter<PatientAdapter.PatientViewHolder>() {

    private var filteredList = originalList.toMutableList()

    inner class PatientViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val avatar: ImageView = itemView.findViewById(R.id.imageAvatar)
        val name: TextView = itemView.findViewById(R.id.textName)
        val dob: TextView = itemView.findViewById(R.id.textBirth)
        val ward: TextView = itemView.findViewById(R.id.textWard)
        val btnView: Button = itemView.findViewById(R.id.btnViewDetail)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PatientViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_patient, parent, false)
        return PatientViewHolder(view)
    }

    override fun onBindViewHolder(holder: PatientViewHolder, position: Int) {
        val patient = filteredList[position]
        holder.name.text = patient.name
        holder.dob.text = patient.dob ?: "Невідомо"
        holder.ward.text = "Палата: ${patient.ward}"
        holder.avatar.load(patient.avatar) {
            placeholder(R.drawable.ic_default_avatar)
            error(R.drawable.ic_default_avatar)
        }
        holder.btnView.setOnClickListener {
            onDetailClick(patient)
        }
    }

    override fun getItemCount(): Int = filteredList.size

    fun updateList(newList: List<PatientResponse>) {
        filteredList = newList.toMutableList()
        notifyDataSetChanged()
    }

    fun filter(query: String) {
        filteredList = if (query.isEmpty()) {
            originalList.toMutableList()
        } else {
            originalList.filter {
                it.name.contains(query, ignoreCase = true)
            }.toMutableList()
        }
        notifyDataSetChanged()
    }
}
