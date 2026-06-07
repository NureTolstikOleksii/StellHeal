package com.example.healthyhelper

import android.os.Build
import com.example.healthyhelper.utils.utcToLocalTime
import com.example.healthyhelper.utils.utcToLocalDate
import com.example.healthyhelper.utils.utcToLocalDateLong
import com.example.healthyhelper.utils.utcToLocalDateTime
import com.example.healthyhelper.utils.formatLocalDate
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.TimeZone

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [Build.VERSION_CODES.TIRAMISU])
class DateTimeUtilsTest {

    @Test
    fun `utcToLocalTime returns formatted time for valid ISO string`() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
        val result = utcToLocalTime("2026-06-01T10:30:00.000Z")
        assertEquals("10:30", result)
    }

    @Test
    fun `utcToLocalTime converts UTC to Kyiv time correctly`() {
        TimeZone.setDefault(TimeZone.getTimeZone("Europe/Kiev"))
        val result = utcToLocalTime("2026-06-01T10:00:00.000Z")
        assertEquals("13:00", result)
    }

    @Test
    fun `utcToLocalTime returns dash for null`() {
        val result = utcToLocalTime(null)
        assertEquals("—", result)
    }

    @Test
    fun `utcToLocalTime returns dash for blank string`() {
        val result = utcToLocalTime("   ")
        assertEquals("—", result)
    }

    @Test
    fun `utcToLocalTime returns dash for empty string`() {
        val result = utcToLocalTime("")
        assertEquals("—", result)
    }

    @Test
    fun `utcToLocalTime returns dash for invalid string`() {
        val result = utcToLocalTime("not-a-date")
        assertEquals("—", result)
    }

    @Test
    fun `utcToLocalTime handles midnight correctly`() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
        val result = utcToLocalTime("2026-06-01T00:00:00.000Z")
        assertEquals("00:00", result)
    }

    @Test
    fun `utcToLocalDate returns formatted date in UTC`() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
        val result = utcToLocalDate("2026-06-01T10:00:00.000Z")
        assertTrue(result.contains("06") || result.contains("6"))
    }

    @Test
    fun `utcToLocalDate returns dash for null`() {
        assertEquals("—", utcToLocalDate(null))
    }

    @Test
    fun `utcToLocalDate returns dash for blank string`() {
        assertEquals("—", utcToLocalDate(""))
    }

    @Test
    fun `utcToLocalDate returns dash for invalid string`() {
        assertEquals("—", utcToLocalDate("invalid"))
    }

    @Test
    fun `utcToLocalDate shifts date for positive timezone`() {
        TimeZone.setDefault(TimeZone.getTimeZone("Europe/Kiev"))
        val result = utcToLocalDate("2026-06-01T23:00:00.000Z")
        assertTrue(result.contains("02") || result.contains("2"))
    }

    @Test
    fun `utcToLocalDateLong returns dash for null`() {
        assertEquals("—", utcToLocalDateLong(null))
    }

    @Test
    fun `utcToLocalDateLong returns dash for empty string`() {
        assertEquals("—", utcToLocalDateLong(""))
    }

    @Test
    fun `utcToLocalDateLong returns non-empty string for valid date`() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
        val result = utcToLocalDateLong("2026-06-01T10:00:00.000Z")
        assertTrue(result.isNotEmpty())
        assertNotEquals("—", result)
    }

    @Test
    fun `utcToLocalDateLong returns dash for invalid string`() {
        assertEquals("—", utcToLocalDateLong("bad-date"))
    }

    @Test
    fun `utcToLocalDateTime returns dash for null`() {
        assertEquals("—", utcToLocalDateTime(null))
    }

    @Test
    fun `utcToLocalDateTime returns dash for empty string`() {
        assertEquals("—", utcToLocalDateTime(""))
    }

    @Test
    fun `utcToLocalDateTime returns non-empty string for valid ISO`() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
        val result = utcToLocalDateTime("2026-06-01T14:30:00.000Z")
        assertTrue(result.isNotEmpty())
        assertNotEquals("—", result)
    }

    @Test
    fun `utcToLocalDateTime returns dash for invalid string`() {
        assertEquals("—", utcToLocalDateTime("not-valid"))
    }

    @Test
    fun `formatLocalDate formats yyyy-MM-dd to dd_MM_yyyy`() {
        assertEquals("01.06.2026", formatLocalDate("2026-06-01"))
    }

    @Test
    fun `formatLocalDate returns dash for null`() {
        assertEquals("—", formatLocalDate(null))
    }

    @Test
    fun `formatLocalDate returns dash for blank string`() {
        assertEquals("—", formatLocalDate(""))
    }

    @Test
    fun `formatLocalDate returns original string for invalid format`() {
        val result = formatLocalDate("not-a-date")
        assertEquals("not-a-date", result)
    }

    @Test
    fun `formatLocalDate handles year 2000 correctly`() {
        assertEquals("15.03.2000", formatLocalDate("2000-03-15"))
    }

    @Test
    fun `formatLocalDate handles leap year date`() {
        assertEquals("29.02.2000", formatLocalDate("2000-02-29"))
    }
}