package com.example.healthyhelper.utils

import android.os.Build
import androidx.annotation.RequiresApi
import java.time.ZonedDateTime
import java.time.ZoneId
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

// ─── UTC ISO → локальний час "HH:mm" ─────────────────────────────────────────
@RequiresApi(Build.VERSION_CODES.O)
fun utcToLocalTime(isoString: String?): String {
    if (isoString.isNullOrBlank()) return "—"
    return try {
        ZonedDateTime.parse(isoString)
            .withZoneSameInstant(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("HH:mm"))
    } catch (e: Exception) { "—" }
}

// ─── UTC ISO → локальна дата "dd.MM.yyyy" ────────────────────────────────────
@RequiresApi(Build.VERSION_CODES.O)
fun utcToLocalDate(isoString: String?): String {
    if (isoString.isNullOrBlank()) return "—"
    return try {
        ZonedDateTime.parse(isoString)
            .withZoneSameInstant(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofLocalizedDate(FormatStyle.SHORT)
                .withLocale(Locale.getDefault()))
    } catch (e: Exception) { "—" }
}

// ─── UTC ISO → локальна дата довга "6 черв. 2026" ────────────────────────────
@RequiresApi(Build.VERSION_CODES.O)
fun utcToLocalDateLong(isoString: String?): String {
    if (isoString.isNullOrBlank()) return "—"
    return try {
        ZonedDateTime.parse(isoString)
            .withZoneSameInstant(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
                .withLocale(Locale.getDefault()))
    } catch (e: Exception) { "—" }
}

// ─── UTC ISO → локальна дата + час "06.06.2026, 11:00" ───────────────────────
@RequiresApi(Build.VERSION_CODES.O)
fun utcToLocalDateTime(isoString: String?): String {
    if (isoString.isNullOrBlank()) return "—"
    return try {
        ZonedDateTime.parse(isoString)
            .withZoneSameInstant(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.SHORT)
                .withLocale(Locale.getDefault()))
    } catch (e: Exception) { "—" }
}

// ─── "yyyy-MM-dd" → локальна дата "6 черв. 2026" ─────────────────────────────
@RequiresApi(Build.VERSION_CODES.O)
fun formatLocalDate(dateStr: String?): String {
    if (dateStr.isNullOrBlank()) return "—"
    return try {
        LocalDate.parse(dateStr)
            .format(DateTimeFormatter.ofPattern("dd.MM.yyyy", Locale.US))
    } catch (e: Exception) {
        dateStr
    }
}