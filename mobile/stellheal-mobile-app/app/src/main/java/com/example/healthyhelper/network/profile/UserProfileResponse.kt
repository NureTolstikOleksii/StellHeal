data class UserProfileResponse(
    val user_id: Int,
    val first_name: String,
    val last_name: String,
    val patronymic: String?,
    val login: String,
    val phone: String?,
    val contact_info: String?,
    val avatar: String?,
    val date_of_birth: String?,
    val roles: RoleResponse,
    val medical_staff: MedicalStaffResponse?
)

data class RoleResponse(
    val role_name: String
)

data class MedicalStaffResponse(
    val specialization: String?,
    val shift: String?,
    val admission_date: String?
)

data class AvatarResponse(val avatar: String)
