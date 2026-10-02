package com.muruk.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "muruk")
data class MurukProperties(
    // 구글 OAuth 클라이언트 ID. 쉼표로 여러 개를 줄 수 있다.
    // 웹과 아이폰 앱은 서로 다른 클라이언트 ID로 토큰을 발급받으므로,
    // 둘 다 받으려면 둘 다 적어야 한다(하나만 적으면 다른 쪽 토큰이 거부된다).
    var googleClientId: String = "",
    var corsAllowedOrigins: String = "http://localhost:3000",
    var notionRelayUrl: String = "",
    // 노션 직접 연결(선택). 둘 다 채우면 Notion API로 바로 백업.
    var notionToken: String = "",
    var notionDatabaseId: String = "",
    // 관리자 이메일(쉼표 구분). 이 계정은 전체 사용자 데이터를 조회할 수 있다.
    var adminEmails: String = "",
) {
    /** 검증에 허용할 클라이언트 ID 목록. */
    val googleClientIds: List<String>
        get() = googleClientId.split(",").map { it.trim() }.filter { it.isNotEmpty() }

    fun isAdmin(email: String): Boolean {
        val set = adminEmails.split(",").map { it.trim().lowercase() }.filter { it.isNotEmpty() }.toSet()
        return email.isNotBlank() && email.lowercase() in set
    }
}
