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
)
