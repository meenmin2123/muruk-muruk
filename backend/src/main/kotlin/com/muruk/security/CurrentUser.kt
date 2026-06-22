package com.muruk.security

import org.springframework.security.core.context.SecurityContextHolder

/** 인증 필터가 채워 넣는 현재 사용자 정보. */
data class CurrentUser(
    val id: String,      // 구글 sub
    val email: String,
    val name: String,
    val picture: String?,
)

object CurrentUserHolder {
    fun get(): CurrentUser? = SecurityContextHolder.getContext().authentication?.principal as? CurrentUser
    fun require(): CurrentUser = get() ?: error("인증된 사용자가 없습니다")
}
