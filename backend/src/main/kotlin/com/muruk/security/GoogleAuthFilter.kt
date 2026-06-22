package com.muruk.security

import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier
import com.google.api.client.http.javanet.NetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import com.muruk.config.MurukProperties
import com.muruk.domain.AppUser
import com.muruk.repo.AppUserRepository
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.time.Instant

/**
 * Authorization: Bearer <구글 ID 토큰> 을 검증하고 SecurityContext에 현재 사용자를 채운다.
 * GOOGLE_CLIENT_ID 미설정 시(개발용) 검증을 건너뛰고 토큰 페이로드만 신뢰한다.
 */
@Component
class GoogleAuthFilter(
    private val props: MurukProperties,
    private val users: AppUserRepository,
) : OncePerRequestFilter() {

    private val log = LoggerFactory.getLogger(javaClass)

    private val verifier: GoogleIdTokenVerifier? =
        props.googleClientId.takeIf { it.isNotBlank() }?.let {
            GoogleIdTokenVerifier.Builder(NetHttpTransport(), GsonFactory.getDefaultInstance())
                .setAudience(listOf(it))
                .build()
        }

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        chain: FilterChain,
    ) {
        val header = request.getHeader("Authorization")
        val token = header?.takeIf { it.startsWith("Bearer ") }?.removePrefix("Bearer ")?.trim()
        if (token != null) {
            try {
                val claims = verify(token)
                if (claims != null) {
                    upsertUser(claims)
                    val auth = UsernamePasswordAuthenticationToken(
                        claims, null, listOf(SimpleGrantedAuthority("ROLE_USER")),
                    )
                    SecurityContextHolder.getContext().authentication = auth
                }
            } catch (e: Exception) {
                log.debug("토큰 검증 실패: {}", e.message)
            }
        }
        chain.doFilter(request, response)
    }

    private fun verify(token: String): CurrentUser? {
        val v = verifier
        if (v == null) {
            // 개발 모드: 검증 없이 페이로드만 파싱
            val payload = com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.parse(
                GsonFactory.getDefaultInstance(), token,
            ).payload
            return toUser(payload)
        }
        val idToken = v.verify(token) ?: return null
        return toUser(idToken.payload)
    }

    private fun toUser(p: com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload) = CurrentUser(
        id = p.subject,
        email = p.email ?: "",
        name = (p["name"] as? String) ?: (p.email ?: "사용자"),
        picture = p["picture"] as? String,
    )

    private fun upsertUser(u: CurrentUser) {
        val now = Instant.now()
        val existing = users.findById(u.id).orElse(null)
        if (existing == null) {
            users.save(AppUser(id = u.id, email = u.email, name = u.name, picture = u.picture, createdAt = now, lastSeenAt = now))
        } else {
            existing.email = u.email; existing.name = u.name; existing.picture = u.picture; existing.lastSeenAt = now
            users.save(existing)
        }
    }
}
