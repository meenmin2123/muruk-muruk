package com.muruk.web

import com.muruk.security.UnauthenticatedException
import jakarta.persistence.OptimisticLockException
import org.slf4j.LoggerFactory
import org.springframework.dao.OptimisticLockingFailureException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.server.ResponseStatusException

/**
 * API 오류 응답을 한 가지 형태로 통일한다: { "error": "...", "message": "..." }
 *
 * 이 클래스가 없으면 낙관적 잠금 충돌·인증 누락·잘못된 JSON이 모두 스프링 기본 500 으로 나가고,
 * 프론트는 409(병합)와 401(재로그인)을 구분할 수 없어 사용자의 편집이 조용히 사라진다.
 */
@RestControllerAdvice
class ApiExceptionHandler {

    private val log = LoggerFactory.getLogger(javaClass)

    /** 컨트롤러/서비스가 의도적으로 던진 상태코드는 그대로 내보낸다(409 충돌 등). */
    @ExceptionHandler(ResponseStatusException::class)
    fun onStatus(e: ResponseStatusException): ResponseEntity<Map<String, Any?>> {
        val status = HttpStatus.resolve(e.statusCode.value()) ?: HttpStatus.INTERNAL_SERVER_ERROR
        return body(status, e.reason ?: status.reasonPhrase)
    }

    /**
     * 저장 직전에 다른 요청이 먼저 커밋한 경우.
     * StateService 가 대부분 잡아 409 로 바꾸지만, 트랜잭션 커밋 시점에 터진 것까지 여기서 받는다.
     */
    @ExceptionHandler(OptimisticLockingFailureException::class, OptimisticLockException::class)
    fun onOptimisticLock(e: Exception): ResponseEntity<Map<String, Any?>> {
        log.debug("낙관적 잠금 충돌: {}", e.message)
        return body(HttpStatus.CONFLICT, "다른 기기에서 먼저 저장되었습니다 — 최신 상태를 받아 병합해주세요")
    }

    /** 인증된 사용자 없음 → 401. 프론트가 이 코드를 보고 토큰 갱신/재로그인을 시도한다. */
    @ExceptionHandler(UnauthenticatedException::class)
    fun onUnauthenticated(e: UnauthenticatedException): ResponseEntity<Map<String, Any?>> =
        body(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다")

    /** 인증은 됐지만 권한 없음 → 403 (관리자 전용 등). 401 과 섞이면 안 된다. */
    @ExceptionHandler(AccessDeniedException::class)
    fun onAccessDenied(e: AccessDeniedException): ResponseEntity<Map<String, Any?>> =
        body(HttpStatus.FORBIDDEN, "권한이 없습니다")

    /** 본문 JSON 파싱 실패 → 400 (서버 잘못이 아니므로 500 으로 보내지 않는다). */
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun onBadBody(e: HttpMessageNotReadableException): ResponseEntity<Map<String, Any?>> {
        log.debug("본문 파싱 실패: {}", e.message)
        return body(HttpStatus.BAD_REQUEST, "요청 본문을 읽을 수 없습니다")
    }

    /** 그 외 = 진짜 서버 오류. 내부 메시지는 노출하지 않고 로그에만 남긴다. */
    @ExceptionHandler(Exception::class)
    fun onUnexpected(e: Exception): ResponseEntity<Map<String, Any?>> {
        log.error("처리되지 않은 오류", e)
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "일시적인 오류가 발생했습니다")
    }

    private fun body(status: HttpStatus, message: String): ResponseEntity<Map<String, Any?>> =
        ResponseEntity.status(status).body(
            mapOf("error" to status.reasonPhrase.lowercase().replace(' ', '_'), "message" to message),
        )
}
