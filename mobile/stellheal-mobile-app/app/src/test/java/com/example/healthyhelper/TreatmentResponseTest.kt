package com.example.healthyhelper

import com.example.healthyhelper.network.treatment.MedicationItem
import com.example.healthyhelper.network.treatment.TreatmentResponse
import org.junit.Assert.*
import org.junit.Test

class MedicationItemTest {

    @Test
    fun `stores all fields correctly`() {
        val m = MedicationItem("Aspirin", "2 рази на день", 7, 2)
        assertEquals("Aspirin", m.name)
        assertEquals("2 рази на день", m.frequency)
        assertEquals(7, m.duration)
        assertEquals(2, m.quantity)
    }

    @Test
    fun `equality works correctly`() {
        val m1 = MedicationItem("Aspirin", "1x", 5, 1)
        val m2 = MedicationItem("Aspirin", "1x", 5, 1)
        assertEquals(m1, m2)
    }

    @Test
    fun `different names are not equal`() {
        val m1 = MedicationItem("Aspirin",   "1x", 5, 1)
        val m2 = MedicationItem("Ibuprofen", "1x", 5, 1)
        assertNotEquals(m1, m2)
    }

    @Test
    fun `copy changes only specified field`() {
        val original = MedicationItem("Aspirin", "1x", 5, 1)
        val copy     = original.copy(quantity = 3)
        assertEquals(1, original.quantity)
        assertEquals(3, copy.quantity)
        assertEquals("Aspirin", copy.name)
    }

    @Test
    fun `toString contains field values`() {
        val m = MedicationItem("Aspirin", "1x", 7, 1)
        assertTrue(m.toString().contains("Aspirin"))
    }
}

class TreatmentResponseTest {

    private val sampleMed = MedicationItem("Aspirin", "2x", 7, 1)

    @Test
    fun `stores all fields correctly`() {
        val t = TreatmentResponse(
            prescriptionId = 1,
            name           = "Flu",
            date           = "2026-06-01T00:00:00.000Z",
            endDate        = "2026-06-08T00:00:00.000Z",
            duration       = 7,
            ward           = "3",
            doctor         = "Ivan Petrov",
            medications    = listOf(sampleMed)
        )
        assertEquals(1, t.prescriptionId)
        assertEquals("Flu", t.name)
        assertEquals(7, t.duration)
        assertEquals("3", t.ward)
        assertEquals("Ivan Petrov", t.doctor)
    }

    @Test
    fun `allows null optional fields`() {
        val t = TreatmentResponse(1, null, null, null, 0, null, null, emptyList())
        assertNull(t.name)
        assertNull(t.date)
        assertNull(t.ward)
        assertNull(t.doctor)
    }

    @Test
    fun `medications list is accessible`() {
        val t = TreatmentResponse(1, "Flu", null, null, 7, null, null, listOf(sampleMed))
        assertEquals(1, t.medications.size)
        assertEquals("Aspirin", t.medications[0].name)
    }

    @Test
    fun `supports empty medications list`() {
        val t = TreatmentResponse(1, "Flu", null, null, 0, null, null, emptyList())
        assertTrue(t.medications.isEmpty())
    }

    @Test
    fun `supports multiple medications`() {
        val meds = listOf(
            MedicationItem("Aspirin",   "1x", 7, 1),
            MedicationItem("Ibuprofen", "2x", 5, 2),
        )
        val t = TreatmentResponse(1, "Flu", null, null, 7, null, null, meds)
        assertEquals(2, t.medications.size)
        assertEquals("Ibuprofen", t.medications[1].name)
    }

    @Test
    fun `copy creates modified version`() {
        val original = TreatmentResponse(1, "Flu", null, null, 7, "3", null, emptyList())
        val copy     = original.copy(name = "Diabetes")
        assertEquals("Flu", original.name)
        assertEquals("Diabetes", copy.name)
    }
}