package com.muruk.security

import org.springframework.security.core.context.SecurityContextHolder

/** 인증 필터가 채워 넣는 현재 사용자 정보. */
data class CurrentUser(
    val id: String,      // 구글 sub
    val email: String,
    val name: String,
    val picture: String?,
)

/**
 * 인증된 사용자가 없을 때 던진다.
 * ApiExceptionHandler 가 401 로 변환한다 — 일반 IllegalStateException(=서버 버그)과 섞이면
 * 진짜 버그가 401 로 둔갑해 클라이언트가 로그아웃 루프에 빠지므로 전용 타입을 쓴다.
 */
class UnauthenticatedException : RuntimeException("인증된 사용자가 없습니다")

object CurrentUserHolder {
    fun get(): CurrentUser? = SecurityContextHolder.getContext().authentication?.principal as? CurrentUser
    fun require(): CurrentUser = get() ?: throw UnauthenticatedException()
}
