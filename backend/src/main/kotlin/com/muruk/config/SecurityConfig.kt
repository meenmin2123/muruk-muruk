package com.muruk.config

import com.muruk.security.GoogleAuthFilter
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableConfigurationProperties(MurukProperties::class)
class SecurityConfig(
    private val props: MurukProperties,
    private val googleAuthFilter: GoogleAuthFilter,
) {

    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .cors { it.configurationSource(corsSource()) }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests {
                it.requestMatchers("/actuator/health", "/api/health").permitAll()
                it.anyRequest().authenticated()
            }
            // 미인증 → 401, 인증됐지만 권한 없음 → 403 으로 구분한다.
            // 이 설정이 없으면 httpBasic/formLogin 을 모두 끈 기본값 탓에 미인증도 403 이 나가고,
            // 프론트가 '토큰 만료'를 알아채지 못해 저장이 조용히 멈춘다.
            .exceptionHandling { ex ->
                ex.authenticationEntryPoint { _, res, _ ->
                    writeJson(res, HttpServletResponse.SC_UNAUTHORIZED, "unauthorized", "로그인이 필요합니다")
                }
                ex.accessDeniedHandler { _, res, _ ->
                    writeJson(res, HttpServletResponse.SC_FORBIDDEN, "forbidden", "권한이 없습니다")
                }
            }
            .addFilterBefore(googleAuthFilter, UsernamePasswordAuthenticationFilter::class.java)
            .httpBasic { it.disable() }
            .formLogin { it.disable() }
        return http.build()
    }

    private fun writeJson(res: HttpServletResponse, status: Int, error: String, message: String) {
        if (res.isCommitted) return
        res.status = status
        res.characterEncoding = "UTF-8"
        res.contentType = "application/json;charset=UTF-8"
        res.writer.write("""{"error":"$error","message":"$message"}""")
    }

    private fun corsSource(): CorsConfigurationSource {
        val config = CorsConfiguration().apply {
            allowedOrigins = props.corsAllowedOrigins.split(",").map { it.trim() }
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
        }
        return UrlBasedCorsConfigurationSource().apply { registerCorsConfiguration("/**", config) }
    }
}
