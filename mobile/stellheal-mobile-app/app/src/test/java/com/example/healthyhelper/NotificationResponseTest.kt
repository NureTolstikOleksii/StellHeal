package com.example.healthyhelper

import com.example.healthyhelper.network.notification.NotificationResponse
import org.junit.Assert.*
import org.junit.Test

class NotificationResponseTest {

    @Test
    fun `stores all fields correctly`() {
        val n = NotificationResponse(
            id      = 1,
            message = "Take your medication",
            type    = "INTAKE_REMINDER",
            sent_at = "2026-06-01T10:00:00.000Z",
            is_read = false
        )
        assertEquals(1, n.id)
        assertEquals("Take your medication", n.message)
        assertEquals("INTAKE_REMINDER", n.type)
        assertEquals("2026-06-01T10:00:00.000Z", n.sent_at)
        assertFalse(n.is_read)
    }

    @Test
    fun `allows null sent_at`() {
        val n = NotificationResponse(1, "msg", "warning", null, false)
        assertNull(n.sent_at)
    }

    @Test
    fun `is_read can be true`() {
        val n = NotificationResponse(1, "msg", "info", null, true)
        assertTrue(n.is_read)
    }

    @Test
    fun `two identical objects are equal`() {
        val n1 = NotificationResponse(1, "msg", "info", "2026-06-01T10:00:00.000Z", false)
        val n2 = NotificationResponse(1, "msg", "info", "2026-06-01T10:00:00.000Z", false)
        assertEquals(n1, n2)
    }

    @Test
    fun `copy creates independent copy with modified field`() {
        val original = NotificationResponse(1, "msg", "info", null, false)
        val copy     = original.copy(is_read = true)
        assertFalse(original.is_read)
        assertTrue(copy.is_read)
    }

    @Test
    fun `different ids are not equal`() {
        val n1 = NotificationResponse(1, "msg", "info", null, false)
        val n2 = NotificationResponse(2, "msg", "info", null, false)
        assertNotEquals(n1, n2)
    }
}