package com.muruk.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "muruk")
data class MurukProperties(
    var googleClientId: String = "",
    var corsAllowedOrigins: String = "http://localhost:3000",
    var notionRelayUrl: String = "",
    // 노션 직접 연결(선택). 둘 다 채우면 Notion API로 바로 백업.
    var notionToken: String = "",
    var notionDatabaseId: String = "",
    // 관리자 이메일(쉼표 구분). 이 계정은 전체 사용자 데이터를 조회할 수 있다.
    var adminEmails: String = "",
) {
    fun isAdmin(email: String): Boolean {
        val set = adminEmails.split(",").map { it.trim().lowercase() }.filter { it.isNotEmpty() }.toSet()
        return email.isNotBlank() && email.lowercase() in set
    }
}
