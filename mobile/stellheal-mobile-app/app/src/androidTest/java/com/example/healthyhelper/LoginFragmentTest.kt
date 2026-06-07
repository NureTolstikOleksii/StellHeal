package com.example.healthyhelper

import androidx.fragment.app.testing.launchFragmentInContainer
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.*
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.*
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.example.healthyhelper.fragments.LoginFragment
import com.example.healthyhelper.network.ApiConfig
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.hamcrest.Matchers.not
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.lang.reflect.Field

@RunWith(AndroidJUnit4::class)
class LoginFragmentTest {

    private lateinit var mockWebServer: MockWebServer

    @Before
    fun setUp() {
        mockWebServer = MockWebServer()
        mockWebServer.start()

        val field: Field = ApiConfig::class.java.getDeclaredField("BASE_URL")
        field.isAccessible = true
        field.set(null, mockWebServer.url("/").toString())
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun emailField_isDisplayed() {
        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)
        onView(withId(R.id.emailInput)).check(matches(isDisplayed()))
    }

    @Test
    fun passwordField_isDisplayed() {
        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)
        onView(withId(R.id.passwordInput)).check(matches(isDisplayed()))
    }

    @Test
    fun loginButton_isDisplayed() {
        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)
        onView(withId(R.id.btnLogin)).check(matches(isDisplayed()))
    }

    @Test
    fun emptyEmail_showsEmailError() {
        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)
        onView(withId(R.id.btnLogin)).perform(click())
        onView(withId(R.id.emailError)).check(matches(isDisplayed()))
        onView(withId(R.id.emailError)).check(matches(withText("Введіть email")))
    }

    @Test
    fun emptyPassword_showsPasswordError() {
        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)
        onView(withId(R.id.emailInput)).perform(typeText("doctor@test.com"), closeSoftKeyboard())
        onView(withId(R.id.btnLogin)).perform(click())
        onView(withId(R.id.passwordError)).check(matches(isDisplayed()))
        onView(withId(R.id.passwordError)).check(matches(withText("Введіть пароль")))
    }

    @Test
    fun invalidEmail_showsFormatError() {
        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)
        onView(withId(R.id.emailInput)).perform(typeText("not-an-email"), closeSoftKeyboard())
        onView(withId(R.id.btnLogin)).perform(click())
        onView(withId(R.id.emailError)).check(matches(isDisplayed()))
        onView(withId(R.id.emailError)).check(matches(withText("Некоректний формат email")))
    }

    @Test
    fun shortPassword_showsLengthError() {
        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)
        onView(withId(R.id.emailInput)).perform(typeText("doctor@test.com"), closeSoftKeyboard())
        onView(withId(R.id.passwordInput)).perform(typeText("123"), closeSoftKeyboard())
        onView(withId(R.id.btnLogin)).perform(click())
        onView(withId(R.id.passwordError)).check(matches(isDisplayed()))
        onView(withId(R.id.passwordError)).check(matches(withText("Пароль має бути не менше 6 символів")))
    }

    @Test
    fun typingInEmailField_clearsEmailError() {
        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)
        onView(withId(R.id.btnLogin)).perform(click())
        onView(withId(R.id.emailError)).check(matches(isDisplayed()))
        onView(withId(R.id.emailInput)).perform(typeText("d"), closeSoftKeyboard())
        onView(withId(R.id.emailError)).check(matches(not(isDisplayed())))
    }

    @Test
    fun typingInPasswordField_clearsPasswordError() {
        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)
        onView(withId(R.id.emailInput)).perform(typeText("doctor@test.com"), closeSoftKeyboard())
        onView(withId(R.id.btnLogin)).perform(click())
        onView(withId(R.id.passwordError)).check(matches(isDisplayed()))
        onView(withId(R.id.passwordInput)).perform(typeText("p"), closeSoftKeyboard())
        onView(withId(R.id.passwordError)).check(matches(not(isDisplayed())))
    }

    @Test
    fun validCredentials_successfulLogin_showsNoErrors() {
        mockWebServer.enqueue(MockResponse()
            .setResponseCode(200)
            .setHeader("Content-Type", "application/json")
            .setBody("""
                {
                  "accessToken": "eyJhbGciOiJIUzI1NiJ9.test",
                  "refreshToken": "refresh-token-123",
                  "user": {
                    "id": 1,
                    "role": "admin",
                    "first_name": "Ivan",
                    "last_name": "Petrov"
                  }
                }
            """.trimIndent())
        )

        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)

        onView(withId(R.id.emailInput)).perform(typeText("doctor@test.com"), closeSoftKeyboard())
        onView(withId(R.id.passwordInput)).perform(typeText("Qwerty123!"), closeSoftKeyboard())
        onView(withId(R.id.btnLogin)).perform(click())
        onView(withId(R.id.emailError)).check(matches(not(isDisplayed())))
    }

    @Test
    fun invalidCredentials_401_showsPasswordError() {
        mockWebServer.enqueue(MockResponse()
            .setResponseCode(401)
            .setHeader("Content-Type", "application/json")
            .setBody("""{"code":"INVALID_PASSWORD","message":"Невірний email або пароль"}""")
        )

        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)

        onView(withId(R.id.emailInput)).perform(typeText("doctor@test.com"), closeSoftKeyboard())
        onView(withId(R.id.passwordInput)).perform(typeText("WrongPass!"), closeSoftKeyboard())
        onView(withId(R.id.btnLogin)).perform(click())

        Thread.sleep(500)

        onView(withId(R.id.passwordError)).check(matches(isDisplayed()))
        onView(withId(R.id.passwordError)).check(matches(withText("Невірний email або пароль")))
    }

    @Test
    fun serverError_403_showsErrorMessage() {
        mockWebServer.enqueue(MockResponse()
            .setResponseCode(403)
            .setHeader("Content-Type", "application/json")
            .setBody("""{"code":"FORBIDDEN","message":"Доступ заборонено для цієї платформи"}""")
        )

        launchFragmentInContainer<LoginFragment>(themeResId = R.style.Theme_HealthyHelper)

        onView(withId(R.id.emailInput)).perform(typeText("patient@test.com"), closeSoftKeyboard())
        onView(withId(R.id.passwordInput)).perform(typeText("Qwerty123!"), closeSoftKeyboard())
        onView(withId(R.id.btnLogin)).perform(click())

        Thread.sleep(500)

        onView(withId(R.id.passwordError)).check(matches(isDisplayed()))
    }
}