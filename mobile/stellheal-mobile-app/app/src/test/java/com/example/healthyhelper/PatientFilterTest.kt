package com.example.healthyhelper

import com.example.healthyhelper.network.patients.PatientResponse
import org.junit.Assert.*
import org.junit.Test

class PatientFilterTest {

    private fun filterPatients(list: List<PatientResponse>, query: String): List<PatientResponse> {
        return if (query.isEmpty()) list
        else list.filter { it.name.contains(query, ignoreCase = true) }
    }

    private val patients = listOf(
        PatientResponse(1, "John Doe",      "john@test.com", "+380991111111", "Kyiv", "1990-01-01", null, "3"),
        PatientResponse(2, "Jane Smith",    "jane@test.com", "+380992222222", "Lviv", "1985-05-15", null, "4"),
        PatientResponse(3, "Ivan Petrenko", "ivan@test.com", "+380993333333", "Odesa","1995-03-20", null, "5"),
    )

    @Test
    fun `empty query returns all patients`() {
        val result = filterPatients(patients, "")
        assertEquals(3, result.size)
    }

    @Test
    fun `filter by full name returns matching patient`() {
        val result = filterPatients(patients, "John Doe")
        assertEquals(1, result.size)
        assertEquals("John Doe", result[0].name)
    }

    @Test
    fun `filter is case insensitive`() {
        val result = filterPatients(patients, "jane")
        assertEquals(1, result.size)
        assertEquals("Jane Smith", result[0].name)
    }

    @Test
    fun `filter by partial name returns matches`() {
        val result = filterPatients(patients, "Pet")
        assertEquals(1, result.size)
        assertEquals("Ivan Petrenko", result[0].name)
    }

    @Test
    fun `filter with no match returns empty list`() {
        val result = filterPatients(patients, "nonexistent")
        assertTrue(result.isEmpty())
    }

    @Test
    fun `filter with uppercase query works`() {
        val result = filterPatients(patients, "IVAN")
        assertEquals(1, result.size)
    }
}